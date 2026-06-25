import React, { useState } from 'react';
import {
  LayoutDashboard, ListChecks, ScrollText,
  Zap, Send, Clock
} from 'lucide-react';
import './Sidebar.css';

const NAV = [
  { id: 'dashboard', label: 'Dashboard',    Icon: LayoutDashboard },
  { id: 'queue',     label: 'Deal Queue',   Icon: ListChecks },
  { id: 'log',       label: 'Activity Log', Icon: ScrollText },
];

export default function Sidebar({ active, onNav, autoMode, intervalMin, onToggleAuto, stats }) {
  const [interval, setInterval_] = useState(intervalMin || 60);

  const handleToggle = (enabled) => {
    onToggleAuto(enabled, interval);
  };

  const handleIntervalChange = (val) => {
    setInterval_(val);
    if (autoMode) onToggleAuto(true, val); // update live if already on
  };

  const nextPostMin = stats?.last_post_ago_min != null
    ? Math.max(0, interval - stats.last_post_ago_min).toFixed(0)
    : null;

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon"><Send size={16} /></div>
        <div>
          <div className="logo-name">Deal Bot</div>
          <div className="logo-sub">Amazon → Telegram</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`nav-item ${active === id ? 'active' : ''}`}
            onClick={() => onNav(id)}
          >
            <Icon size={16} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-spacer" />

      {/* Auto-post panel */}
      <div className="auto-panel">
        <div className="auto-header">
          <div className="auto-label-row">
            <Zap size={13} className={autoMode ? 'auto-zap on' : 'auto-zap'} />
            <span className="auto-label">Auto-post</span>
          </div>
          <label className="toggle-switch" aria-label="Toggle auto-post">
            <input
              type="checkbox"
              checked={autoMode}
              onChange={e => handleToggle(e.target.checked)}
            />
            <span className="slider" />
          </label>
        </div>

        {/* Interval selector — always visible */}
        <div className="interval-row">
          <Clock size={12} className="interval-icon" />
          <span className="interval-label">Post every</span>
          <select
            className="interval-select"
            value={interval}
            onChange={e => handleIntervalChange(Number(e.target.value))}
          >
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={60}>1 hour</option>
            <option value={120}>2 hours</option>
            <option value={180}>3 hours</option>
            <option value={360}>6 hours</option>
            <option value={720}>12 hours</option>
          </select>
        </div>

        <p className="auto-desc">
          {autoMode
            ? nextPostMin !== null
              ? `Next post in ~${nextPostMin} min`
              : `Posts one deal every ${interval} min automatically.`
            : 'Approve deals and post them manually.'}
        </p>

        <span className={`mode-badge ${autoMode ? 'auto' : 'manual'}`}>
          {autoMode ? `AUTO · ${interval}min` : 'MANUAL'}
        </span>

        {/* Fetch quota info */}
        {stats?.next_fetch_in_h > 0 && (
          <div className="quota-info">
            ⏳ Next fetch in {stats.next_fetch_in_h}h
          </div>
        )}
      </div>
    </aside>
  );
}

/* ── Sidebar CSS (append to Sidebar.css) ── */