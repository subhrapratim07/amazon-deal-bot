import React from 'react';
import { ArrowRight } from 'lucide-react';
import './Pipeline.css';

export default function Pipeline({ stats }) {
  const reviewed = stats.total - stats.pending;
  const steps = [
    { label: 'Fetched',  value: stats.total,    active: false },
    { label: 'Reviewed', value: reviewed,        active: false },
    { label: 'Approved', value: stats.approved,  active: false },
    { label: 'Posted ✓', value: stats.posted,    active: true  },
  ];

  return (
    <div className="pipeline">
      {steps.map((s, i) => (
        <React.Fragment key={s.label}>
          <div className={`pipe-step ${s.active ? 'highlight' : ''}`}>
            <div className="pipe-val">{s.value}</div>
            <div className="pipe-lbl">{s.label}</div>
          </div>
          {i < steps.length - 1 && (
            <ArrowRight size={16} className="pipe-arrow" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
