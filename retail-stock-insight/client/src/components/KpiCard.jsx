import { Info } from 'lucide-react';

export function KpiCard({ label, value, sub, icon, variant = 'primary', tooltip, mono }) {
  return (
    <div className={`kpi-card ${variant}`}>
      {icon && (
        <div className={`kpi-icon ${variant}`}>
          {icon}
        </div>
      )}
      <div className="kpi-label">
        {label}
        {tooltip && (
          <span className="tooltip-wrapper" style={{ marginLeft: 6 }}>
            <Info size={11} className="tooltip-trigger" />
            <span className="tooltip-content">{tooltip}</span>
          </span>
        )}
      </div>
      <div className={`kpi-value ${mono ? 'mono' : ''}`}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

export function KpiGrid({ children }) {
  return <div className="kpi-grid">{children}</div>;
}
