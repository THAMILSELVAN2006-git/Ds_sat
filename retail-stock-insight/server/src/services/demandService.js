import { getStore } from './csvLoader.js';
import { round, getWeekStart, getMonthLabel } from '../utils/formatters.js';

/**
 * Demand / historical sales trend insights.
 * Weekly units by total and per category (no product-level forecast).
 */
export function computeDemandTrend(params = {}) {
  const store = getStore();
  const { groupBy = 'week', category, productId, startDate, endDate } = params;

  const buckets = new Map(); // label → { total, [cat]: units }
  const categories = new Set();

  for (const [orderId, order] of store.orders) {
    if (order.order_status === 'Cancelled') continue;
    if (startDate && order.order_date < startDate) continue;
    if (endDate && order.order_date > endDate) continue;

    const label = groupBy === 'month'
      ? getMonthLabel(order.order_date)
      : getWeekStart(order.order_date);

    const items = store.orderItemsByOrderId.get(orderId) || [];
    for (const item of items) {
      const prod = store.products.get(item.product_id);
      if (!prod) continue;
      if (category && prod.category !== category) continue;
      if (productId && item.product_id !== productId) continue;

      if (!buckets.has(label)) buckets.set(label, { label, total: 0 });
      const b = buckets.get(label);
      b.total += item.quantity;
      b[prod.category] = (b[prod.category] || 0) + item.quantity;
      categories.add(prod.category);
    }
  }

  const data = Array.from(buckets.values())
    .sort((a, b) => a.label.localeCompare(b.label));

  // Compute simple growth rates
  const growthData = data.map((d, i) => {
    const prev = data[i - 1];
    const growth = prev && prev.total > 0 ? round((d.total - prev.total) / prev.total, 4) : null;
    return { ...d, growth };
  });

  // Monthly seasonality (units by month number across all years)
  const seasonal = {};
  for (const [orderId, order] of store.orders) {
    if (order.order_status === 'Cancelled') continue;
    const mo = order.order_date.getUTCMonth() + 1;
    const items = store.orderItemsByOrderId.get(orderId) || [];
    for (const item of items) {
      if (productId && item.product_id !== productId) continue;
      if (category) {
        const prod = store.products.get(item.product_id);
        if (!prod || prod.category !== category) continue;
      }
      seasonal[mo] = (seasonal[mo] || 0) + item.quantity;
    }
  }

  return {
    groupBy,
    categories: Array.from(categories).sort(),
    data: growthData,
    seasonality: Object.entries(seasonal)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([month, units]) => ({ month: parseInt(month), units })),
    note: 'Product-level forecasts not available due to data sparsity (median ~1.9 units/week per product). Forecasting available for total and per-category weekly units only.',
  };
}

/**
 * Get all weekly totals for total and each category.
 * Used by forecast service.
 */
export function getWeeklySeriesForForecast() {
  const store = getStore();
  const weekMap = new Map(); // weekStart → { total, [cat]: units }
  const categories = new Set();

  for (const [orderId, order] of store.orders) {
    if (order.order_status === 'Cancelled') continue;
    const weekStart = getWeekStart(order.order_date);
    if (!weekMap.has(weekStart)) weekMap.set(weekStart, { weekStart, total: 0 });
    const b = weekMap.get(weekStart);
    const items = store.orderItemsByOrderId.get(orderId) || [];
    for (const item of items) {
      const prod = store.products.get(item.product_id);
      if (!prod) continue;
      b.total += item.quantity;
      b[prod.category] = (b[prod.category] || 0) + item.quantity;
      categories.add(prod.category);
    }
  }

  const sorted = Array.from(weekMap.values())
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  // Remove the last (potentially partial) week
  const lastWeekStart = sorted[sorted.length - 1]?.weekStart;
  const completeWeeks = lastWeekStart === '2025-12-29'
    ? sorted.slice(0, -1)
    : sorted;

  return {
    weeks: completeWeeks,
    categories: Array.from(categories).sort(),
    partialWeekRemoved: lastWeekStart === '2025-12-29' ? lastWeekStart : null,
  };
}
