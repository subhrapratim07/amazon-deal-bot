import React from 'react';
import ActivityLog from './ActivityLog';
import './LogView.css';

export default function LogView({ log }) {
  return (
    <div className="log-content">
      <div className="dash-header">
        <div>
          <h1 className="dash-title">Activity Log</h1>
          <p className="dash-sub">Full history of bot actions and events</p>
        </div>
        <span className="log-count">{log.length} entries</span>
      </div>
      <ActivityLog log={log} compact={false} />
    </div>
  );
}
