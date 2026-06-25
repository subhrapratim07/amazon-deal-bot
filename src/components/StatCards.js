import React from 'react';
import { Package, Clock, CheckCircle, Send } from 'lucide-react';
import './StatCards.css';

const STATS = [
  { key: 'total',    label: 'Total Fetched',     Icon: Package,     accent: 'blue' },
  { key: 'pending',  label: 'Pending Review',    Icon: Clock,       accent: 'amber' },
  { key: 'approved', label: 'Approved',           Icon: CheckCircle, accent: 'green' },
  { key: 'posted',   label: 'Posted to Telegram', Icon: Send,        accent: 'tg' },
];

export default function StatCards({ stats }) {
  return (
    <div className="stat-cards">
      {STATS.map(({ key, label, Icon, accent }) => (
        <div className={`stat-card stat-${accent}`} key={key}>
          <div className="stat-icon-wrap">
            <Icon size={18} />
          </div>
          <div className="stat-num">{stats[key] ?? 0}</div>
          <div className="stat-label">{label}</div>
        </div>
      ))}
    </div>
  );
}
