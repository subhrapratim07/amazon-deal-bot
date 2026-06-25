// src/api/index.js
const BASE = process.env.REACT_APP_API_URL || '';

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  getDeals:    ()                    => req('/api/deals'),
  getStats:    ()                    => req('/api/stats'),
  getLog:      ()                    => req('/api/log'),

  // force=true bypasses the 6-hour throttle
  fetchDeals:  (force = false)       => req('/api/fetch', {
    method: 'POST',
    body: JSON.stringify({ force }),
  }),

  approve:     (asin)                => req(`/api/approve/${asin}`, { method: 'POST' }),
  reject:      (asin)                => req(`/api/reject/${asin}`,  { method: 'POST' }),
  postDeal:    (asin)                => req(`/api/post/${asin}`,    { method: 'POST' }),

  // interval_min: how many minutes between auto-posts
  setAutoMode: (enabled, interval_min) => req('/api/auto-mode', {
    method: 'POST',
    body: JSON.stringify({ enabled, interval_min }),
  }),
};