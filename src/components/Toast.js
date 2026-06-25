import React from 'react';
import './Toast.css';

export default function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`toast toast-${toast.type}`} key={toast.id}>
      {toast.msg}
    </div>
  );
}
