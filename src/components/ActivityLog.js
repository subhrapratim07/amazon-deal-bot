import React from 'react';
import { RefreshCw, CheckCircle, XCircle, Send, Zap, Info, AlertTriangle } from 'lucide-react';
import './ActivityLog.css';

const ICON_MAP = {
  check:    <CheckCircle size={14} />,
  x:        <XCircle size={14} />,
  refresh:  <RefreshCw size={14} />,
  telegram: <Send size={14} />,
  bolt:     <Zap size={14} />,
  info:     <Info size={14} />,
  warning:  <AlertTriangle size={14} />,
  error:    <XCircle size={14} />,
};

export default function ActivityLog({ log, compact }) {
  if (!log.length) {
    return (
      <div className="log-empty">
        <Info size={16} />
        <span>No activity yet</span>
      </div>
    );
  }

  const items = compact ? log.slice(0, 8) : log;

  return (
    <div className={`log-panel ${compact ? 'compact' : ''}`}>
      {items.map((entry, i) => (
        <div key={i} className={`log-row level-${entry.level}`}>
          <span className="log-time">{entry.time}</span>
          <span className="log-icon">{ICON_MAP[entry.icon] || <Info size={14} />}</span>
          <span className="log-msg">{entry.message}</span>
        </div>
      ))}
    </div>
  );
}
