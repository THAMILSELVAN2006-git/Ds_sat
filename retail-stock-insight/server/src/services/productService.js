import { getStore } from './csvLoader.js';
import { round, getMonthLabel, getWeekStart } from '../utils/formatters.js';

/**
 * Full product catalogue (paginated, sortable, searchable)
 */
export function getProductCatalogue(params = {}) {
  const store = getStore();
  const { page = 1, limit = 20, sortBy = 'product_name', sortOrder = 'asc',
          search, category } = params;

  // Build product stats from all non-cancelled orders
  const stats = new Map();
  for (const [orderId, order] of store.orders) {
    if (order.order_status === 'Cancelled') continue;
    const items = store.orderItemsByOrderId.get(orderId) || [];
    for (const item of items) {
      if (!stats.has(item.product_id)) {
        stats.set(item.product_id, { grossSales: 0, units: 0, cogs: 0, orders: new Set() });
      }
      const s = stats.get(item.product_id);
      s.grossSales += item.line_total;
      s.units += item.quantity;
      const prod = store.products.get(item.product_id);
      if (prod) s.cogs += item.quantity * prod.unit_cost;
      s.orders.add(orderId);
    }
  }

  // Return counts per product
  const retCounts = new Map();
  for (const ret of store.returns.values()) {
    retCounts.set(ret.product_id, (retCounts.get(ret.product_id) || 0) + 1);
  }

  let products = Array.from(store.products.values()).map(p => {
    const s = stats.get(p.product_id) || { grossSales: 0, units: 0, cogs: 0, orders: new Set() };
    const grossSales = round(s.grossSales);
    const cogs = round(s.cogs);
    const grossProfit = round(s.grossSales - s.cogs);
    const margin = s.grossSales > 0 ? round((s.grossSales - s.cogs) / s.grossSales, 4) : 0;
    return {
      product_id: p.product_id,
      product_name: p.product_name,
      category: p.category,
      unit_cost: p.unit_cost,
      unit_price: p.unit_price,
      margin_pct: round(p.margin_pct, 4),
      negative_margin: p.negative_margin,
      low_margin: !p.negative_margin && p.margin_pct < 0.1,
      grossSales,
      units: s.units,
      orders: s.orders.size,
      cogs,
      grossProfit,
      margin,
      returnCount: retCounts.get(p.product_id) || 0,
    };
  });

  if (search) {
    const q = search.toLowerCase();
    products = products.filter(p => p.product_name.toLowerCase().includes(q) || p.product_id.toLowerCase().includes(q));
  }
  if (category) products = products.filter(p => p.category === category);

  const validSortFields = ['product_name', 'category', 'grossSales', 'units', 'grossProfit', 'margin', 'returnCount'];
  const sf = validSortFields.includes(sortBy) ? sortBy : 'product_name';
  products.sort((a, b) => {
    const av = a[sf], bv = b[sf];
    const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
    return sortOrder === 'desc' ? -cmp : cmp;
  });

  const total = products.length;
  const pageNum = Math.max(1, parseInt(page, 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const start = (pageNum - 1) * pageSize;

  return {
    data: products.slice(start, start + pageSize),
    meta: { total, page: pageNum, limit: pageSize, pages: Math.ceil(total / pageSize) },
  };
}

/**
 * Per-product sales history (monthly)
 */
export function getProductHistory(productId, params = {}) {
  const store = getStore();
  const prod = store.products.get(productId);
  if (!prod) return null;

  const { groupBy = 'month' } = params;
  const buckets = new Map();

  for (const [orderId, order] of store.orders) {
    if (order.order_status === 'Cancelled') continue;
    const items = store.orderItemsByOrderId.get(orderId) || [];
    for (const item of items) {
      if (item.product_id !== productId) continue;
      const label = groupBy === 'week' ? getWeekStart(order.order_date) : getMonthLabel(order.order_date);
      if (!buckets.has(label)) buckets.set(label, { label, grossSales: 0, units: 0, orders: new Set() });
      const b = buckets.get(label);
      b.grossSales += item.line_total;
      b.units += item.quantity;
      b.orders.add(orderId);
    }
  }

  return {
    product: { product_id: prod.product_id, product_name: prod.product_name, category: prod.category },
    history: Array.from(buckets.values())
      .sort((a, b) => a.label.localeCompare(b.label))
      .map(b => ({ label: b.label, grossSales: round(b.grossSales), units: b.units, orders: b.orders.size })),
  };
}
