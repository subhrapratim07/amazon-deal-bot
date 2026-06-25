# Amazon Deal Bot — Dashboard

A React + Flask app to fetch Amazon deals via RapidAPI and post them to a Telegram channel. Features a dark-mode dashboard with live stats, deal queue, and activity log.

## Project Structure

```
amazon-deal-bot/
├── server.py          ← Flask backend (API + serves React)
├── requirements.txt
├── Dockerfile
├── react-build/       ← Compiled React app (ready to serve)
├── react-src/         ← React source (edit and rebuild)
│   ├── api/           ← API layer
│   ├── hooks/         ← useDashboard hook
│   └── components/    ← All UI components
└── package.json
```

## Environment Variables

Create a `.env` file:

```env
RAPIDAPI_KEY=your_rapidapi_key
AMAZON_ASSOCIATE_TAG=your-tag-20
AMAZON_COUNTRY=IN                  # or US
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHANNEL_ID=@yourchannel   # or numeric ID like -100123456789
```

## Local Development

### Run backend + prebuilt React
```bash
pip install -r requirements.txt
python server.py
# Open http://localhost:5000
```

### Develop React with hot-reload
```bash
# Terminal 1 — Flask API
python server.py

# Terminal 2 — React dev server (proxies /api/* to Flask)
npm install
npm start
# Open http://localhost:3000
```

### Rebuild React after edits
```bash
npm run build
# Then restart server.py
```

## Deploy to Render (free tier)

1. Push to GitHub
2. Create a **Web Service** on [render.com](https://render.com)
3. Set:
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `gunicorn server:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120`
4. Add all env vars in the Render dashboard
5. The `react-build/` folder is committed to git, so Render will serve it immediately

## Deploy to Railway

```bash
railway login
railway init
railway up
# Set env vars in Railway dashboard
```

## Deploy with Docker

```bash
docker build -t deal-bot .
docker run -p 8080:8080 --env-file .env deal-bot
# Open http://localhost:8080
```

## Features

- **Dashboard** — stats, pipeline flow, deal grid with filter tabs
- **Deal Queue** — focused pending/approved review view  
- **Activity Log** — full timestamped bot history
- **Auto-post mode** — approve = instant Telegram post
- **Manual mode** — approve then post with one click
- **Responsive** — works on mobile and desktop
- **30-second auto-refresh** — stats and deals update automatically
