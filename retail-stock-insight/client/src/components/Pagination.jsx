import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;
  const nums = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) nums.push(i);

  return (
    <div className="pagination">
      <button className="page-btn" onClick={() => onPage(page - 1)} disabled={page === 1} aria-label="Previous page">
        <ChevronLeft size={14} />
      </button>
      {nums[0] > 1 && <><button className="page-btn" onClick={() => onPage(1)}>1</button>{nums[0] > 2 && <span style={{ color: 'var(--color-text-muted)' }}>…</span>}</>}
      {nums.map(n => (
        <button key={n} className={`page-btn ${n === page ? 'active' : ''}`} onClick={() => onPage(n)}>{n}</button>
      ))}
      {nums[nums.length - 1] < pages && <>{nums[nums.length - 1] < pages - 1 && <span style={{ color: 'var(--color-text-muted)' }}>…</span>}<button className="page-btn" onClick={() => onPage(pages)}>{pages}</button></>}
      <button className="page-btn" onClick={() => onPage(page + 1)} disabled={page === pages} aria-label="Next page">
        <ChevronRight size={14} />
      </button>
    </div>
  );
}
