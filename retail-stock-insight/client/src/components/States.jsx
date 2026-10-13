import { AlertCircle, RefreshCw, PackageOpen } from 'lucide-react';

export function ErrorState({ message, onRetry }) {
  return (
    <div className="error-state">
      <AlertCircle size={40} className="state-icon" />
      <div className="state-title">Failed to load data</div>
      <div className="state-desc">{message}</div>
      {onRetry && (
        <button className="btn btn-ghost" onClick={onRetry} style={{ marginTop: 8 }}>
          <RefreshCw size={14} /> Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ message = 'No data for this period', icon }) {
  return (
    <div className="empty-state">
      {icon || <PackageOpen size={40} className="state-icon" />}
      <div className="state-title">{message}</div>
    </div>
  );
}
