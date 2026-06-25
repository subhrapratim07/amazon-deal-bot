import React, { useState } from 'react';
import './index.css';
import Sidebar    from './components/Sidebar';
import Dashboard  from './components/Dashboard';
import QueueView  from './components/QueueView';
import LogView    from './components/LogView';
import Toast      from './components/Toast';
import { useDashboard } from './hooks/useDashboard';
import { Menu, X } from 'lucide-react';
import './App.css';

export default function App() {
  const [page, setPage]             = useState('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);

  const {
    deals, stats, log, fetching, autoMode, intervalMin, toast,
    fetchDeals, approve, reject, postDeal, toggleAutoMode,
  } = useDashboard();

  const handleNav = (id) => {
    setPage(id);
    setMobileOpen(false);
  };

  return (
    <div className="app-layout">
      <header className="mobile-bar">
        <button className="mobile-menu-btn" onClick={() => setMobileOpen(o => !o)}>
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <span className="mobile-title">Deal Bot</span>
      </header>

      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
      )}

      <Sidebar
        active={page}
        onNav={handleNav}
        autoMode={autoMode}
        intervalMin={intervalMin}
        onToggleAuto={toggleAutoMode}
        stats={stats}
      />

      <main className="app-main">
        {page === 'dashboard' && (
          <Dashboard
            deals={deals} stats={stats} log={log}
            fetching={fetching} autoMode={autoMode}
            onFetch={fetchDeals}
            onApprove={approve} onReject={reject} onPost={postDeal}
          />
        )}
        {page === 'queue' && (
          <QueueView
            deals={deals} autoMode={autoMode}
            onApprove={approve} onReject={reject} onPost={postDeal}
          />
        )}
        {page === 'log' && <LogView log={log} />}
      </main>

      <Toast toast={toast} />
    </div>
  );
}