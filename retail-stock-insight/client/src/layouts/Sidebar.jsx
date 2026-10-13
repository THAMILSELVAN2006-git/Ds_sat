import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, TrendingUp, Package, Users,
  RotateCcw, BarChart2, X
} from 'lucide-react';

const navItems = [
  { to: '/', icon: <LayoutDashboard size={16} />, label: 'Overview' },
  { to: '/sales', icon: <TrendingUp size={16} />, label: 'Sales' },
  { to: '/products', icon: <Package size={16} />, label: 'Products' },
  { to: '/customers', icon: <Users size={16} />, label: 'Customers' },
  { to: '/returns', icon: <RotateCcw size={16} />, label: 'Returns' },
  { to: '/demand', icon: <BarChart2 size={16} />, label: 'Demand & Forecast' },
];

export function Sidebar({ open, onClose }) {
  return (
    <>
      {open !== undefined && (
        <div className={`sidebar-overlay ${open ? 'show' : ''}`} onClick={onClose} />
      )}
      <nav className={`sidebar ${open === false ? 'hidden' : ''}`} aria-label="Main navigation">
        <div className="sidebar-logo">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="sidebar-logo-text">📊 Retail Stock Insight</div>
              <div className="sidebar-logo-sub">Analytics Dashboard</div>
            </div>
            {onClose && (
              <button onClick={onClose} style={{ background: 'transparent', color: 'var(--color-text-muted)', display: 'none' }}
                className="menu-close-btn" aria-label="Close menu">
                <X size={16} />
              </button>
            )}
          </div>
        </div>
        <div className="sidebar-nav">
          <div className="nav-section-label">Navigation</div>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={onClose}
              aria-label={item.label}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </div>
        <div className="sidebar-footer">
          <div>Data: 2024-01-01 → 2025-12-31</div>
          <div style={{ marginTop: 2 }}>600 customers · 8,000 orders</div>
        </div>
      </nav>
    </>
  );
}
