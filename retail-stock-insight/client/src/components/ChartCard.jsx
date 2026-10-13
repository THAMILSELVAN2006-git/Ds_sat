export function ChartCard({ title, subtitle, children, controls, className = '' }) {
  return (
    <div className={`chart-card ${className}`}>
      <div className="chart-header">
        <div>
          <div className="chart-title">{title}</div>
          {subtitle && <div className="chart-subtitle">{subtitle}</div>}
        </div>
        {controls && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{controls}</div>}
      </div>
      {children}
    </div>
  );
}
