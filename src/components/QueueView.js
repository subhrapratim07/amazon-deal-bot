import React from 'react';
import DealCard from './DealCard';
import './QueueView.css';

export default function QueueView({ deals, autoMode, onApprove, onReject, onPost }) {
  const pending  = Object.values(deals).filter(d => d.status === 'pending');
  const approved = Object.values(deals).filter(d => d.status === 'approved');

  return (
    <div className="queue-content">
      <div className="dash-header">
        <div>
          <h1 className="dash-title">Deal Queue</h1>
          <p className="dash-sub">Review pending deals and approve or reject them</p>
        </div>
      </div>

      {pending.length > 0 && (
        <section className="queue-section">
          <div className="queue-section-header">
            <h2 className="section-title">Pending Review</h2>
            <span className="count-badge amber">{pending.length}</span>
          </div>
          <div className="deals-grid">
            {pending.map(d => (
              <DealCard key={d.asin} deal={d} autoMode={autoMode}
                onApprove={onApprove} onReject={onReject} onPost={onPost} />
            ))}
          </div>
        </section>
      )}

      {approved.length > 0 && (
        <section className="queue-section">
          <div className="queue-section-header">
            <h2 className="section-title">Approved — Ready to Post</h2>
            <span className="count-badge green">{approved.length}</span>
          </div>
          <div className="deals-grid">
            {approved.map(d => (
              <DealCard key={d.asin} deal={d} autoMode={autoMode}
                onApprove={onApprove} onReject={onReject} onPost={onPost} />
            ))}
          </div>
        </section>
      )}

      {pending.length === 0 && approved.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">✅</div>
          <p className="empty-msg">Queue is clear! All deals have been reviewed.</p>
        </div>
      )}
    </div>
  );
}
