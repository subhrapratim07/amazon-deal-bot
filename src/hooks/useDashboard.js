import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';

export function useDashboard() {
  const [deals, setDeals]       = useState({});
  const [stats, setStats]       = useState({
    total:0, pending:0, approved:0, posted:0, rejected:0,
    auto_mode:false, interval_min:60,
    next_fetch_in_h:0, last_post_ago_min: null,
  });
  const [log, setLog]           = useState([]);
  const [fetching, setFetching] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [intervalMin, setIntervalMin] = useState(60);
  const [toast, setToast]       = useState(null);
  const pollRef                 = useRef(null);

  const notify = useCallback((msg, type = 'info') => {
    setToast({ msg, type, id: Date.now() });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [dealList, s, l] = await Promise.all([
        api.getDeals(), api.getStats(), api.getLog()
      ]);
      const map = {};
      dealList.forEach(d => { map[d.asin] = d; });
      setDeals(map);
      setStats(s);
      setLog(l);
      setAutoMode(s.auto_mode);
      setIntervalMin(s.interval_min || 60);
    } catch (e) {
      console.error('Refresh error', e);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  // ── Fetch deals (with force flag) ──
  const fetchDeals = useCallback(async (force = false) => {
    setFetching(true);
    try {
      await api.fetchDeals(force);
      notify(force ? 'Force-fetching deals…' : 'Fetching deals from Amazon…', 'info');
      let polls = 0;
      pollRef.current = setInterval(async () => {
        await refresh();
        polls++;
        if (polls >= 20) {
          clearInterval(pollRef.current);
          setFetching(false);
        }
      }, 1500);
    } catch (e) {
      notify(`Fetch failed: ${e.message}`, 'error');
      setFetching(false);
    }
  }, [refresh, notify]);

  useEffect(() => () => clearInterval(pollRef.current), []);

  const approve = useCallback(async (asin) => {
    try {
      await api.approve(asin);
      notify('Deal approved — added to post queue', 'success');
      await refresh();
    } catch (e) { notify(e.message, 'error'); }
  }, [refresh, notify]);

  const reject = useCallback(async (asin) => {
    try {
      await api.reject(asin);
      notify('Deal rejected', 'info');
      await refresh();
    } catch (e) { notify(e.message, 'error'); }
  }, [refresh, notify]);

  const postDeal = useCallback(async (asin) => {
    try {
      await api.postDeal(asin);
      notify('✔ Posted to Telegram!', 'success');
      await refresh();
    } catch (e) { notify(`Post failed: ${e.message}`, 'error'); }
  }, [refresh, notify]);

  const toggleAutoMode = useCallback(async (enabled, interval = intervalMin) => {
    try {
      await api.setAutoMode(enabled, interval);
      setAutoMode(enabled);
      setIntervalMin(interval);
      notify(
        enabled
          ? `⚡ Auto-post ON — every ${interval} min`
          : '✋ Manual mode ON',
        'info'
      );
      await refresh();
    } catch (e) { notify(e.message, 'error'); }
  }, [refresh, notify, intervalMin]);

  return {
    deals, stats, log, fetching, autoMode, intervalMin,
    toast, fetchDeals, approve, reject, postDeal, toggleAutoMode, refresh,
  };
}