export function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} />;
}

export function SkeletonKpiGrid({ count = 6 }) {
  return (
    <div className="kpi-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="kpi-card" style={{ minHeight: 120 }}>
          <Skeleton className="skeleton-text" style={{ width: '60%', marginBottom: 12 }} />
          <Skeleton className="skeleton-text" style={{ width: '40%', height: 28 }} />
          <Skeleton className="skeleton-text" style={{ width: '70%' }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart({ height = 280 }) {
  return <Skeleton style={{ height, width: '100%', borderRadius: 'var(--radius-lg)' }} />;
}
