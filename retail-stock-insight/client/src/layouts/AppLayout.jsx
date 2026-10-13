import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { useFetch } from '../hooks/useFetch';
import { fetchMetadata } from '../services/api';

const PAGE_TITLES = {
  '/': 'Overview',
  '/sales': 'Sales Analytics',
  '/products': 'Product Catalogue',
  '/customers': 'Customer Analytics',
  '/returns': 'Returns Analysis',
  '/demand': 'Demand & Forecast',
};

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { data: meta } = useFetch(fetchMetadata, []);

  const title = PAGE_TITLES[location.pathname] || 'Dashboard';

  return (
    <div className="app-layout">
      <Sidebar open={sidebarOpen ? true : undefined} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <header className="page-header" role="banner">
          <div className="page-header-left">
            <button className="menu-toggle btn" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle menu">
              <Menu size={18} />
            </button>
            <div className="page-title">{title}</div>
          </div>
          <div className="header-status">
            {meta && (
              <div className="status-pill" title="Data loaded">
                <div className="status-dot" />
                <span>
                  {meta.rowCounts?.orders?.toLocaleString()} orders ·{' '}
                  {meta.orderDateRange?.start} → {meta.orderDateRange?.end}
                </span>
              </div>
            )}
            {meta && (
              <div className="currency-warning" title={meta.currencyNote}>
                ⚠ {meta.currencyCode || 'Currency unspecified'}
              </div>
            )}
          </div>
        </header>
        <main id="main-content" aria-label={title}>
          <div className="page-wrapper">
            <Outlet context={{ meta }} />
          </div>
        </main>
        {meta && (
          <div style={{ textAlign: 'center', padding: '12px', fontSize: '11px', color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)' }}>
            <span className="footnote warning">⚠ Currency not specified in dataset</span>
            {' · '}All monetary values are neutral numbers · Negative-margin product: PROD0048 Fountain Pen Set
          </div>
        )}
      </div>
    </div>
  );
}
