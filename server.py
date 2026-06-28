"""
Amazon Deal Bot — Flask Backend
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIX 1: Use MANY different search queries (not pages of same query)
        Each query returns ~10-30 unique products
        30 queries × 30 products = ~900 deals per fetch call
FIX 2: Category filter works via /api/deals?category=Electronics
QUOTA : Still only 3 fetch "sessions" per day (each session = N queries)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import os, asyncio, threading, time, requests as req_lib
from datetime import datetime
from flask import Flask, jsonify, request, send_from_directory
from dotenv import load_dotenv
load_dotenv()

RAPIDAPI_KEY  = os.getenv("RAPIDAPI_KEY")
ASSOCIATE_TAG = os.getenv("AMAZON_ASSOCIATE_TAG")
COUNTRY       = os.getenv("AMAZON_COUNTRY", "IN")
CHANNEL       = os.getenv("TELEGRAM_CHANNEL_ID")
TG_TOKEN      = os.getenv("TELEGRAM_BOT_TOKEN")

# ── CHANGED ──────────────────────────────────────────────
# react-src no longer exists as a separate CRA project — the project root
# (amazon-deal-bot) IS the CRA app now (package.json lives there, source is
# in /src, public is in /public). `npm run build` from the root outputs to
# /build, not /react-build. Point Flask at that new folder.
REACT_BUILD   = os.path.join(os.path.dirname(__file__), "build")
app           = Flask(__name__, static_folder=REACT_BUILD, static_url_path="")

deal_store   = {}
activity_log = []

MAX_CALLS_PER_DAY = 2
CALL_INTERVAL_H   = 85 / MAX_CALLS_PER_DAY   
MIN_DISCOUNT      = 50
TARGET_TOTAL      = 1500   # stop after this many deals in store

fetch_state = {
    "last_fetch_time":  0,
    "is_fetching":      False,
    "calls_today":      0,
    "calls_reset_date": None,
}

auto_state = {
    "enabled":      False,
    "posts_per_day":  411,  # 411 posts = 1 post every 3.5 minutes
    "last_post_time": 0,
    "timer_thread":   None,
}

RA_HEADERS = {
    "x-rapidapi-key":  RAPIDAPI_KEY,
    "x-rapidapi-host": "real-time-amazon-data.p.rapidapi.com",
}
BASE_URL    = "https://real-time-amazon-data.p.rapidapi.com"
AMZN_DOMAIN = "amazon.in" if COUNTRY == "IN" else "amazon.com"

# ── 33 varied queries — run all per fetch session ─────────
# Each returns ~10-30 unique products → ~330-990 total per session
# All 3 daily sessions use different query subsets
QUERY_BANK = {
    "Electronics": [
        "wireless bluetooth headphones",
        "smartwatch fitness band",
        "portable bluetooth speaker",
        "power bank fast charging",
        "smart LED TV 32 inch",
        "Android tablet budget",
        "USB C laptop charger",
        "gaming mouse mechanical keyboard",
        "webcam HD home office",
        "earbuds noise cancelling",
    ],
    "Kitchen": [
        "mixer grinder 750W",
        "air fryer 4 litre",
        "electric pressure cooker",
        "non stick cookware set",
        "electric kettle stainless steel",
        "induction cooktop 2000W",
        "water bottle stainless insulated",
        "hand blender immersion",
    ],
    "Home Appliances": [
        "ceiling fan energy saving",
        "water purifier RO UV",
        "vacuum cleaner cordless",
        "room heater fan",
        "washing machine fully automatic",
    ],
    "Shoes": [
        "men running sports shoes",
        "women casual sneakers",
        "men formal loafers",
        "women flat sandals",
        "kids school shoes",
    ],
    "Home Decor": [
        "LED strip lights room",
        "decorative cushion covers",
        "wall clock modern",
        "artificial indoor plants",
        "blackout curtains bedroom",
    ],
    "Fashion": [
        "men polo tshirt cotton",
        "women kurta set",
        "men wallet leather slim",
        "women handbag tote",
    ],
    "Grocery": [
        "dry fruits cashew almond",
        "cold pressed coconut oil",
        "whey protein powder",
        "green tea weight loss",
    ],
    "Sports": [
        "yoga mat anti slip",
        "dumbbell set home gym",
        "resistance bands workout",
        "badminton racket set",
    ],
    "Toys": [
        "lego building blocks kids",
        "rc remote control car",
        "board game family",
    ],
}

# Flatten to ordered list — cycle through all on each session
ALL_QUERIES = [(cat, q) for cat, qs in QUERY_BANK.items() for q in qs]
# Total = ~43 queries × ~15 qualifying products = ~645/session × 3 sessions = ~1935 pool

CATEGORY_ICONS = {
    "Electronics":     "📱",
    "Kitchen":         "🍳",
    "Shoes":           "👟",
    "Home Appliances": "🏠",
    "Home Decor":      "🪴",
    "Grocery":         "🛒",
    "Fashion":         "👗",
    "Sports":          "🏋️",
    "Books":           "📚",
    "Toys":            "🧸",
    "Other":           "📦",
}


def log(icon, message, level="info"):
    entry = {
        "time":    datetime.now().strftime("%H:%M:%S"),
        "icon":    icon,
        "message": message,
        "level":   level,
    }
    activity_log.insert(0, entry)
    if len(activity_log) > 200:
        activity_log.pop()
    print(f"[{entry['time']}] {message}")


def make_affiliate_url(asin):
    return f"https://www.{AMZN_DOMAIN}/dp/{asin}?tag={ASSOCIATE_TAG}&linkCode=ogi"


def calc_discount(current, original):
    try:
        def clean(p):
            return float(str(p).replace("₹","").replace("$","").replace(",","").strip())
        c, o = clean(current), clean(original)
        if o > c > 0:
            return round((o - c) / o * 100)
    except Exception:
        pass
    return 0


def _reset_daily_quota_if_needed():
    today = datetime.now().strftime("%Y-%m-%d")
    if fetch_state["calls_reset_date"] != today:
        fetch_state["calls_today"]      = 0
        fetch_state["calls_reset_date"] = today


def calls_remaining_today():
    _reset_daily_quota_if_needed()
    return max(0, MAX_CALLS_PER_DAY - fetch_state["calls_today"])


def hours_until_next_call():
    if fetch_state["last_fetch_time"] == 0:
        return 0.0
    elapsed = (time.time() - fetch_state["last_fetch_time"]) / 3600
    return max(0.0, round(CALL_INTERVAL_H - elapsed, 2))


def fetch_one_query(query, category, seen_asins):
    """One /search call → list of qualifying deals for this query."""
    results = []
    try:
        resp = req_lib.get(
            f"{BASE_URL}/search",
            headers=RA_HEADERS,
            params={"query": query, "country": COUNTRY,
                    "sort_by": "RELEVANCE", "page": "1"},
            timeout=20,
        )
        if resp.status_code == 429:
            wait = int(resp.headers.get("Retry-After", 15))
            log("warning", f"Rate limited on '{query}' — waiting {wait}s…", "warning")
            time.sleep(wait)
            resp = req_lib.get(
                f"{BASE_URL}/search",
                headers=RA_HEADERS,
                params={"query": query, "country": COUNTRY,
                        "sort_by": "RELEVANCE", "page": "1"},
                timeout=20,
            )
        if resp.status_code == 401:
            log("warning", "401 — check RAPIDAPI_KEY in .env", "error")
            return results
        if resp.status_code != 200:
            log("warning", f"'{query}': HTTP {resp.status_code}", "warning")
            return results

        products = resp.json().get("data", {}).get("products", [])
        for p in products:
            asin = p.get("asin", "")
            if not asin or asin in seen_asins:
                continue
            curr = p.get("product_price", "")
            orig = p.get("product_original_price", "")
            if not curr or not orig:
                continue
            disc = calc_discount(curr, orig)
            if disc < MIN_DISCOUNT:
                continue
            results.append({
                "asin":          asin,
                "title":         p.get("product_title", "Amazon Product"),
                "price":         curr,
                "original":      orig,
                "badge":         f"{disc}% off",
                "discount":      disc,
                "image_url":     p.get("product_photo", ""),
                "affiliate_url": make_affiliate_url(asin),
                "rating":        str(p.get("product_star_rating", "") or "0"),
                "reviews":       str(p.get("product_num_ratings", "") or "0"),
                "status":        "pending",
                "category":      category,
                "fetched_at":    time.time(),
            })
            seen_asins.add(asin)
    except Exception as e:
        log("warning", f"Error on '{query}': {e}", "warning")
    return results


def fetch_amazon_deals(force=False):
    if fetch_state["is_fetching"]:
        log("warning", "Fetch already in progress.", "warning")
        return 0

    _reset_daily_quota_if_needed()

    if not force and fetch_state["calls_today"] >= MAX_CALLS_PER_DAY:
        log("warning",
            f"Daily quota exhausted ({MAX_CALLS_PER_DAY}/{MAX_CALLS_PER_DAY}). "
            "Resets at midnight.", "warning")
        return 0

    if not force and hours_until_next_call() > 0:
        log("warning",
            f"Next fetch in {hours_until_next_call()}h (quota protection).", "warning")
        return 0

    fetch_state["is_fetching"] = True
    total_new   = 0
    all_new     = []
    seen_asins  = set(deal_store.keys())

    log("refresh",
        f"Fetch session {fetch_state['calls_today']+1}/{MAX_CALLS_PER_DAY} — "
        f"running {len(ALL_QUERIES)} queries…", "info")

    try:
        for cat, query in ALL_QUERIES:
            if len(deal_store) + len(all_new) >= TARGET_TOTAL:
                log("refresh", f"Reached {TARGET_TOTAL} target — stopping early.", "info")
                break

            results = fetch_one_query(query, cat, seen_asins)
            all_new.extend(results)
            log("refresh",
                f"[{cat}] '{query}': +{len(results)} deals "
                f"(total so far: {len(all_new)})", "info")
            time.sleep(0.3)   # polite pacing between queries

        # Sort ALL collected deals by discount % descending
        all_new.sort(key=lambda x: x["discount"], reverse=True)

        for deal in all_new:
            if deal["asin"] not in deal_store:
                deal_store[deal["asin"]] = deal
                total_new += 1

        fetch_state["calls_today"]    += 1
        fetch_state["last_fetch_time"] = time.time()
        remaining = calls_remaining_today()

        if total_new:
            log("refresh",
                f"🎉 {total_new} deals added across all categories "
                f"(sorted by discount). {remaining} API call(s) left today.", "success")
            # Log per-category counts
            cat_summary = {}
            for d in deal_store.values():
                c = d.get("category", "Other")
                cat_summary[c] = cat_summary.get(c, 0) + 1
            for c, n in sorted(cat_summary.items()):
                log("refresh", f"  {CATEGORY_ICONS.get(c,'📦')} {c}: {n} deals", "info")
        else:
            log("warning",
                f"No new deals found. {remaining} API call(s) left today.", "warning")

    finally:
        fetch_state["is_fetching"] = False

    return total_new


def post_to_telegram(asin):
    deal = deal_store.get(asin)
    if not deal:
        return False, "Deal not found"
    try:
        from telegram import Bot
        bot = Bot(token=TG_TOKEN)
    except Exception as e:
        return False, f"Bot init failed: {e}"

    orig_line   = f"~~{deal['original']}~~ → " if deal.get("original") else ""
    rating_line = (
        f"⭐ {deal['rating']} ({deal['reviews']} reviews)\n"
        if deal.get("rating") and deal["rating"] not in ("0","") else ""
    )
    caption = (
        f"🛒 *{deal['title']}*\n\n"
        f"💰 {orig_line}*{deal['price']}*\n"
        f"🏷️ {deal['badge']}\n"
        f"{rating_line}\n"
        f"👉 [Buy on Amazon]({deal['affiliate_url']})\n\n"
        f"_Prices may change. Verify before buying._"
    )

    async def _send():
        if deal.get("image_url"):
            try:
                img = req_lib.get(deal["image_url"], timeout=10).content
                await bot.send_photo(chat_id=CHANNEL, photo=img,
                                     caption=caption, parse_mode="Markdown")
                return
            except Exception:
                pass
        await bot.send_message(chat_id=CHANNEL, text=caption, parse_mode="Markdown")

    try:
        asyncio.run(_send())
        deal_store[asin]["status"]   = "posted"
        auto_state["last_post_time"] = time.time()
        log("telegram", f"Posted: {deal['title'][:50]}", "success")
        return True, "Posted"
    except Exception as e:
        log("warning", f"Telegram error: {e}", "error")
        return False, str(e)


def get_next_approved_deal():
    for asin, deal in deal_store.items():
        if deal["status"] == "approved":
            return asin
    return None


def auto_post_worker():
    interval_sec = 86400 / max(1, auto_state["posts_per_day"])
    log("bolt", f"Auto-post ON — 1 post every {round(interval_sec)}s", "info")
    while auto_state["enabled"]:
        elapsed  = time.time() - auto_state["last_post_time"]
        wait_sec = max(0, interval_sec - elapsed)
        for _ in range(int(wait_sec)):
            if not auto_state["enabled"]:
                break
            time.sleep(1)
        if not auto_state["enabled"]:
            break
        asin = get_next_approved_deal()
        if asin:
            post_to_telegram(asin)
        else:
            log("bolt", "Auto-post: no approved deals — waiting…", "warning")
            time.sleep(interval_sec)
    log("bolt", "Auto-post stopped.", "info")


def start_auto_post():
    if auto_state["timer_thread"] and auto_state["timer_thread"].is_alive():
        return
    t = threading.Thread(target=auto_post_worker, daemon=True)
    auto_state["timer_thread"] = t
    t.start()


# ── API Routes ────────────────────────────────────────────
@app.route("/api/deals")
def get_deals():
    cat = request.args.get("category", "")
    vals = list(deal_store.values())
    if cat and cat != "all":
        vals = [d for d in vals if d.get("category") == cat]
    return jsonify(vals)


@app.route("/api/categories")
def get_categories():
    cats = {}
    for deal in deal_store.values():
        cat = deal.get("category", "Other")
        if cat not in cats:
            cats[cat] = {
                "name":    cat,
                "icon":    CATEGORY_ICONS.get(cat, "📦"),
                "total":   0, "pending": 0, "posted": 0,
            }
        cats[cat]["total"] += 1
        if deal["status"] == "pending": cats[cat]["pending"] += 1
        if deal["status"] == "posted":  cats[cat]["posted"]  += 1
    return jsonify(list(cats.values()))


@app.route("/api/fetch", methods=["POST"])
def fetch_route():
    data  = request.get_json(silent=True, force=True) or {}
    force = bool(data.get("force", False))
    threading.Thread(target=fetch_amazon_deals, args=(force,), daemon=True).start()
    return jsonify({"status": "started"})


@app.route("/api/approve/<asin>", methods=["POST"])
def approve(asin):
    if asin not in deal_store:
        return jsonify({"error": "Not found"}), 404
    deal_store[asin]["status"] = "approved"
    log("check", f"Approved: {deal_store[asin]['title'][:50]}", "success")
    return jsonify({"status": "approved"})


@app.route("/api/reject/<asin>", methods=["POST"])
def reject(asin):
    if asin not in deal_store:
        return jsonify({"error": "Not found"}), 404
    deal_store[asin]["status"] = "rejected"
    log("x", f"Rejected: {deal_store[asin]['title'][:50]}", "warning")
    return jsonify({"status": "rejected"})


@app.route("/api/post/<asin>", methods=["POST"])
def post_deal(asin):
    if asin not in deal_store:
        return jsonify({"error": "Not found"}), 404
    ok, msg = post_to_telegram(asin)
    return (jsonify({"status": "posted"}) if ok else (jsonify({"error": msg}), 500))


@app.route("/api/auto-mode", methods=["POST"])
def set_auto():
    data          = request.get_json() or {}
    enabled       = bool(data.get("enabled", False))
    posts_per_day = int(data.get("posts_per_day", auto_state["posts_per_day"]))
    auto_state["enabled"]       = enabled
    auto_state["posts_per_day"] = max(1, posts_per_day)
    if enabled:
        start_auto_post()
        log("bolt", f"Auto-post ON — {posts_per_day} posts/day", "info")
    else:
        log("bolt", "Auto-post OFF", "info")
    return jsonify({
        "auto_mode":     auto_state["enabled"],
        "posts_per_day": auto_state["posts_per_day"],
        "interval_sec":  round(86400 / auto_state["posts_per_day"]),
    })


@app.route("/api/log")
def get_log():
    return jsonify(activity_log)


@app.route("/api/stats")
def stats():
    vals = list(deal_store.values())
    cat_counts = {}
    for d in vals:
        c = d.get("category","Other")
        cat_counts[c] = cat_counts.get(c, 0) + 1

    _reset_daily_quota_if_needed()
    return jsonify({
        "total":             len(vals),
        "pending":           sum(1 for d in vals if d["status"] == "pending"),
        "approved":          sum(1 for d in vals if d["status"] in ("approved","posted")),
        "posted":            sum(1 for d in vals if d["status"] == "posted"),
        "rejected":          sum(1 for d in vals if d["status"] == "rejected"),
        "auto_mode":         auto_state["enabled"],
        "posts_per_day":     auto_state["posts_per_day"],
        "interval_sec":      round(86400 / max(1, auto_state["posts_per_day"])),
        "next_fetch_in_h":   hours_until_next_call(),
        "calls_today":       fetch_state["calls_today"],
        "calls_remaining":   calls_remaining_today(),
        "max_calls_per_day": MAX_CALLS_PER_DAY,
        "last_post_ago_min": (
            round((time.time() - auto_state["last_post_time"]) / 60, 1)
            if auto_state["last_post_time"] > 0 else None
        ),
        "category_counts": cat_counts,
        "category_icons":  CATEGORY_ICONS,
    })



@app.route("/api/approve-all", methods=["POST"])
def approve_all():
    """Approve every pending deal at once — auto-post picks them up sequentially."""
    count = 0
    for asin, deal in deal_store.items():
        if deal["status"] == "pending":
            deal_store[asin]["status"] = "approved"
            count += 1
    log("check",
        f"✅ Bulk approved {count} pending deals — "
        f"auto-post will send them sequentially to Telegram.", "success")
    return jsonify({"approved": count})


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_react(path):
    target = os.path.join(REACT_BUILD, path)
    if path and os.path.exists(target):
        return send_from_directory(REACT_BUILD, path)
    return send_from_directory(REACT_BUILD, "index.html")


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    print(f"\n🚀  Dashboard → http://localhost:{port}")
    print(f"📦  Quota     → {MAX_CALLS_PER_DAY} sessions/day")
    print(f"🔍  Queries   → {len(ALL_QUERIES)} per session × ~15 products = ~{len(ALL_QUERIES)*15} deals")
    print(f"📤  Auto-post → {auto_state['posts_per_day']} posts/day\n")
    app.run(host="0.0.0.0", port=port, debug=False)