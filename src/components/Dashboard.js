import React, { useState, useMemo, useCallback } from 'react';
import { RefreshCw, AlertTriangle, Clock, Zap, CheckCheck } from 'lucide-react';
import StatCards   from './StatCards';
import Pipeline    from './Pipeline';
import DealCard    from './DealCard';
import ActivityLog from './ActivityLog';
import './Dashboard.css';

const STATUS_FILTERS = ['all', 'pending', 'approved', 'posted', 'rejected'];

const CATEGORY_ICONS = {
  'Electronics':     '📱',
  'Kitchen':         '🍳',
  'Shoes':           '👟',
  'Home Appliances': '🏠',
  'Home Decor':      '🪴',
  'Grocery':         '🛒',
  'Fashion':         '👗',
  'Sports':          '🏋️',
  'Books':           '📚',
  'Toys':            '🧸',
  'Other':           '📦',
};

export default function Dashboard({
  deals, stats, log, fetching, autoMode,
  onFetch, onApprove, onReject, onPost,
}) {
  const [statusFilter,   setStatusFilter]   = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [approving,      setApproving]      = useState(false);
  const [approveToast,   setApproveToast]   = useState(null);

  const allDeals = useMemo(() => Object.values(deals), [deals]);

  const categories = useMemo(() => {
    const cats = new Set(allDeals.map(d => d.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [allDeals]);

  const catCounts = useMemo(() => {
    const m = {};
    allDeals.forEach(d => { const c = d.category || 'Other'; m[c] = (m[c] || 0) + 1; });
    return m;
  }, [allDeals]);

  const filteredDeals = useMemo(() => {
    return allDeals.filter(d => {
      const catOk    = categoryFilter === 'all' || d.category === categoryFilter;
      const statusOk = statusFilter   === 'all' || d.status   === statusFilter;
      return catOk && statusOk;
    });
  }, [allDeals, categoryFilter, statusFilter]);

  const statusCounts = useMemo(() => {
    const base = categoryFilter === 'all'
      ? allDeals
      : allDeals.filter(d => d.category === categoryFilter);
    return {
      all:      base.length,
      pending:  base.filter(d => d.status === 'pending').length,
      approved: base.filter(d => d.status === 'approved').length,
      posted:   base.filter(d => d.status === 'posted').length,
      rejected: base.filter(d => d.status === 'rejected').length,
    };
  }, [allDeals, categoryFilter]);

  const pendingCount = allDeals.filter(d => d.status === 'pending').length;

  // ── Auto-approve all pending deals ──────────────────────
  const handleApproveAll = useCallback(async () => {
    if (!pendingCount) return;
    const confirmed = window.confirm(
      `Approve all ${pendingCount} pending deals?\n\nIf Auto-post is ON they will be posted to Telegram sequentially.`
    );
    if (!confirmed) return;

    setApproving(true);
    try {
      const res  = await fetch('/api/approve-all', { method: 'POST' });
      const data = await res.json();
      setApproveToast(`✅ ${data.approved} deals approved — auto-post is sending them to Telegram!`);
      setTimeout(() => setApproveToast(null), 5000);
    } catch (e) {
      setApproveToast('❌ Failed to approve all. Check console.');
      setTimeout(() => setApproveToast(null), 4000);
    } finally {
      setApproving(false);
    }
  }, [pendingCount]);

  const callsRemaining = stats.calls_remaining ?? (3 - (stats.calls_today ?? 0));
  const canFetch       = callsRemaining > 0 && stats.next_fetch_in_h === 0;
  const throttled      = stats.next_fetch_in_h > 0;
  const quotaExhausted = callsRemaining === 0 && !throttled;

  const fetchLabel = throttled
    ? `Next fetch in ${stats.next_fetch_in_h}h`
    : quotaExhausted ? 'Daily quota used' : 'Fetch new deals';

  const intervalSec  = stats.interval_sec ?? Math.round(86400 / (stats.posts_per_day ?? 1000));
  const intervalDisp = intervalSec >= 60
    ? `${Math.round(intervalSec / 60)}m` : `${intervalSec}s`;

  return (
    <div className="dash-content">

      {/* ── Header ──────────────────────────────────────── */}
      <div className="dash-header">
        <div>
          <h1 className="dash-title">Deal Dashboard</h1>
          <p className="dash-sub">
            Fetch · Review · Auto-post {stats.posts_per_day ?? 1000} deals/day to Telegram
          </p>
        </div>
        <div className="fetch-group">
          {/* Auto-Approve All button — shown when pending deals exist */}
          {pendingCount > 0 && (
            <button
              className={`approve-all-btn ${approving ? 'loading' : ''}`}
              onClick={handleApproveAll}
              disabled={approving}
              title={`Approve all ${pendingCount} pending deals and start auto-posting`}
            >
              <CheckCheck size={15} />
              {approving ? 'Approving…' : `Approve All (${pendingCount})`}
            </button>
          )}

          <button
            className={`fetch-btn ${fetching ? 'loading' : ''} ${!canFetch ? 'throttled' : ''}`}
            onClick={() => onFetch(false)}
            disabled={fetching || quotaExhausted}
          >
            <RefreshCw size={15} className={fetching ? 'spin' : ''} />
            {fetching ? 'Fetching…' : fetchLabel}
          </button>
          {(!canFetch || throttled) && (
            <button
              className="fetch-btn force"
              onClick={() => onFetch(true)}
              disabled={fetching}
              title="Force fetch — uses extra API quota!"
            >
              Force Fetch
            </button>
          )}
        </div>
      </div>

      {/* ── Toast notification ───────────────────────────── */}
      {approveToast && (
        <div className="approve-toast">{approveToast}</div>
      )}

      {/* ── Banners ─────────────────────────────────────── */}
      {quotaExhausted && (
        <div className="quota-banner quota-danger">
          <AlertTriangle size={14} />
          Daily quota exhausted — {stats.calls_today}/{stats.max_calls_per_day ?? 3} calls used.
          Resets at midnight.
        </div>
      )}
      {throttled && (
        <div className="quota-banner">
          <Clock size={14} />
          Next fetch in <strong>{stats.next_fetch_in_h}h</strong>
          &nbsp;·&nbsp;{callsRemaining}/{stats.max_calls_per_day ?? 3} call(s) left today.
        </div>
      )}
      {autoMode && (
        <div className="autopost-strip">
          <Zap size={13} />
          Auto-posting {stats.posts_per_day ?? 1000} deals/day
          &nbsp;·&nbsp;1 post every {intervalDisp}
          {stats.last_post_ago_min != null && (
            <>&nbsp;·&nbsp;Last post {stats.last_post_ago_min}m ago</>
          )}
        </div>
      )}

      <StatCards stats={stats} />
      <Pipeline  stats={stats} />

      {/* ── Category pills ───────────────────────────────── */}
      {categories.length > 0 && (
        <div className="cat-section">
          <div className="cat-label">Filter by Category</div>
          <div className="cat-pills">
            <button
              className={`cat-pill ${categoryFilter === 'all' ? 'active' : ''}`}
              onClick={() => { setCategoryFilter('all'); setStatusFilter('all'); }}
            >
              🏷️ All <span className="cat-count">{allDeals.length}</span>
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                className={`cat-pill ${categoryFilter === cat ? 'active' : ''}`}
                onClick={() => { setCategoryFilter(cat); setStatusFilter('all'); }}
              >
                {CATEGORY_ICONS[cat] || '📦'} {cat}
                <span className="cat-count">{catCounts[cat] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Status tabs ──────────────────────────────────── */}
      <div className="filter-bar">
        <div className="filter-tabs">
          {STATUS_FILTERS.map(f => (
            <button
              key={f}
              className={`filter-tab ${statusFilter === f ? 'active' : ''}`}
              onClick={() => setStatusFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span className="filter-count">{statusCounts[f] ?? 0}</span>
            </button>
          ))}
        </div>
        {categoryFilter !== 'all' && (
          <button
            className="clear-cat"
            onClick={() => { setCategoryFilter('all'); setStatusFilter('all'); }}
          >
            ✕ Clear &quot;{categoryFilter}&quot;
          </button>
        )}
      </div>

      {/* ── Deal grid ────────────────────────────────────── */}
      {filteredDeals.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <p className="empty-msg">
            {allDeals.length === 0
              ? <>No deals yet — click <strong>Fetch new deals</strong> to start</>
              : categoryFilter !== 'all'
                ? `No ${statusFilter !== 'all' ? statusFilter + ' ' : ''}deals in ${categoryFilter}`
                : `No ${statusFilter !== 'all' ? statusFilter : ''} deals`}
          </p>
        </div>
      ) : (
        <>
          {categoryFilter !== 'all' && (
            <div className="cat-heading">
              {CATEGORY_ICONS[categoryFilter] || '📦'} {categoryFilter}
              <span className="cat-heading-count">{filteredDeals.length} deals</span>
            </div>
          )}
          <div className="deals-grid">
            {filteredDeals.map(d => (
              <DealCard
                key={d.asin} deal={d}
                autoMode={autoMode}
                onApprove={onApprove}
                onReject={onReject}
                onPost={onPost}
              />
            ))}
          </div>
        </>
      )}

      <div className="section-block">
        <h2 className="section-title">Recent Activity</h2>
        <ActivityLog log={log} compact />
      </div>
    </div>
  );
}