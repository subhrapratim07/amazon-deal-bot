import React, { useState } from 'react';
import { CheckCircle, XCircle, Send, Package, ExternalLink } from 'lucide-react';
import './DealCard.css';

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  cls: 'pending'  },
  approved: { label: 'Approved', cls: 'approved' },
  rejected: { label: 'Rejected', cls: 'rejected' },
  posted:   { label: 'Posted',   cls: 'posted'   },
};

export default function DealCard({ deal, autoMode, onApprove, onReject, onPost }) {
  const [posting, setPosting] = useState(false);
  const { label, cls } = STATUS_CONFIG[deal.status] || STATUS_CONFIG.pending;

  const handlePost = async () => {
    setPosting(true);
    await onPost(deal.asin);
    setPosting(false);
  };

  return (
    <div className={`deal-card ${cls}`}>
      <div className="card-thumb">
        {deal.image_url
          ? <img src={deal.image_url} alt={deal.title} loading="lazy" />
          : <Package size={36} className="no-img-icon" />
        }
        {deal.category && <span className="card-cat">{deal.category}</span>}
        <a
          href={deal.affiliate_url}
          target="_blank" rel="noopener noreferrer"
          className="card-ext"
          title="Open on Amazon"
        >
          <ExternalLink size={13} />
        </a>
      </div>

      <div className="card-body">
        <p className="card-title">{deal.title}</p>

        <div className="card-price-row">
          <div className="card-prices">
            <span className="card-price">{deal.price || '—'}</span>
            {deal.original && <span className="card-orig">{deal.original}</span>}
          </div>
          {deal.badge && <span className="deal-badge">{deal.badge}</span>}
        </div>

        <div className="card-actions">
          {deal.status === 'pending' && (
            <>
              <button className="action-btn approve" onClick={() => onApprove(deal.asin)} title="Approve">
                <CheckCircle size={14} /> Approve
              </button>
              <button className="action-btn reject icon-only" onClick={() => onReject(deal.asin)} title="Reject">
                <XCircle size={14} />
              </button>
            </>
          )}
          {deal.status === 'approved' && !autoMode && (
            <>
              <button
                className="action-btn post"
                onClick={handlePost}
                disabled={posting}
                title="Post to Telegram"
              >
                <Send size={13} />
                {posting ? 'Posting…' : 'Post now'}
              </button>
              <button className="action-btn reject icon-only" onClick={() => onReject(deal.asin)} title="Reject">
                <XCircle size={14} />
              </button>
            </>
          )}
          <span className={`status-tag ${cls}`}>{label}</span>
        </div>
      </div>
    </div>
  );
}
