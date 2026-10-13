/**
 * Format numbers with thousands separators (currency-neutral)
 */
export function fmtNum(n, decimals = 2) {
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Round to N decimals
 */
export function round(n, decimals = 2) {
  return Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/**
 * Get ISO week number (Monday-based)
 * Returns { year, week, weekLabel }
 */
export function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7; // Mon=1..Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return {
    year: d.getUTCFullYear(),
    week: weekNo,
    weekLabel: `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`,
  };
}

/**
 * Get week start date (Monday) for a given date
 */
export function getWeekStart(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = (day === 0) ? -6 : 1 - day; // Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Get month label YYYY-MM
 */
export function getMonthLabel(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Parse query date params; returns Date or null
 */
export function parseDateParam(str) {
  if (!str) return null;
  const d = new Date(str);
  if (isNaN(d.getTime())) return null;
  return d;
}

/**
 * Check if a date is within [start, end] (inclusive, day-level)
 */
export function inDateRange(date, start, end) {
  const d = date.getTime();
  if (start && d < start.setUTCHours(0, 0, 0, 0)) return false;
  if (end && d > end.setUTCHours(23, 59, 59, 999)) return false;
  return true;
}
