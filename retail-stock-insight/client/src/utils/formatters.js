/**
 * Format a number with thousands separators (currency-neutral)
 * @param {number} n
 * @param {number} decimals
 */
export function fmtNum(n, decimals = 2) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format compact: 1.23M, 45.6K, etc.
 */
export function fmtCompact(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return fmtNum(n, 1);
}

/**
 * Format percent
 */
export function fmtPct(n, decimals = 2) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return `${(Number(n) * 100).toFixed(decimals)}%`;
}

/**
 * Format integer
 */
export function fmtInt(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Math.round(Number(n)).toLocaleString('en-US');
}

/**
 * Format date string YYYY-MM-DD → "Jan 15, 2024"
 */
export function fmtDate(str) {
  if (!str) return '—';
  try {
    return new Date(str).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return str; }
}

/**
 * Format week label "2024-01-01" → "Jan 1"
 */
export function fmtWeekLabel(str) {
  if (!str) return '';
  try {
    const d = new Date(str);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return str; }
}

/**
 * Format month label "2024-01" → "Jan 2024"
 */
export function fmtMonthLabel(str) {
  if (!str) return '';
  try {
    const [y, m] = str.split('-');
    return new Date(parseInt(y), parseInt(m) - 1, 1)
      .toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch { return str; }
}

export function fmtAxisLabel(label, groupBy) {
  if (!label) return '';
  if (groupBy === 'month') return fmtMonthLabel(label);
  if (groupBy === 'week') return fmtWeekLabel(label);
  return fmtDate(label);
}
