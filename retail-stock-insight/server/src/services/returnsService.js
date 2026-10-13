import { getStore } from './csvLoader.js';
import { round, getMonthLabel, getWeekStart } from '../utils/formatters.js';

export function computeReturnsSummary(params = {}) {
  const store = getStore();
  const { startDate, endDate, category, productId, region, country } = params;

  const productFilter = (pid) => {
    if (productId && pid !== productId) return false;
    if (category) {
      const prod = store.products.get(pid);
      if (!prod || prod.category !== category) return false;
    }
    return true;
  };
  const customerFilter = (custId) => {
    if (!region && !country) return true;
    const c = store.customers.get(custId);
    if (!c) return false;
    if (region && c.region !== region) return false;
    if (country && c.country !== country) return false;
    return true;
  };

  let totalRefunds = 0;
  let returnRecords = 0;
  const returnedOrderIds = new Set();
  const byReason = {};
  const byProduct = new Map();
  const byCategory = new Map();
  const returnLags = [];

  for (const ret of store.returns.values()) {
    // Filter by return_date range
    if (startDate && ret.return_date < startDate) continue;
    if (endDate && ret.return_date > endDate) continue;
    if (!productFilter(ret.product_id)) continue;
    if (!customerFilter(ret.customer_id)) continue;

    returnRecords++;
    totalRefunds += ret.refund_amount;
    returnedOrderIds.add(ret.order_id);

    // Reason breakdown
    byReason[ret.return_reason] = (byReason[ret.return_reason] || 0) + 1;

    // Per-product
    const prod = store.products.get(ret.product_id);
    if (prod) {
      if (!byProduct.has(ret.product_id)) {
        byProduct.set(ret.product_id, { product_id: ret.product_id, product_name: prod.product_name, category: prod.category, count: 0, refunds: 0 });
      }
      const p = byProduct.get(ret.product_id);
      p.count++;
      p.refunds += ret.refund_amount;

      // By category
      if (!byCategory.has(prod.category)) byCategory.set(prod.category, { category: prod.category, count: 0, refunds: 0 });
      const c = byCategory.get(prod.category);
      c.count++;
      c.refunds += ret.refund_amount;
    }

    // Return lag (days from order_date to return_date)
    const order = store.orders.get(ret.order_id);
    if (order) {
      const lagMs = ret.return_date.getTime() - order.order_date.getTime();
      const lagDays = Math.round(lagMs / 86400000);
      returnLags.push(lagDays);
    }
  }

  // Monthly trend (by return_date)
  const monthlyTrend = new Map();
  for (const ret of store.returns.values()) {
    if (startDate && ret.return_date < startDate) continue;
    if (endDate && ret.return_date > endDate) continue;
    if (!productFilter(ret.product_id)) continue;
    const label = getMonthLabel(ret.return_date);
    if (!monthlyTrend.has(label)) monthlyTrend.set(label, { label, count: 0, refunds: 0 });
    const b = monthlyTrend.get(label);
    b.count++;
    b.refunds += ret.refund_amount;
  }

  const avgLag = returnLags.length > 0 ? round(returnLags.reduce((a, b) => a + b, 0) / returnLags.length, 1) : null;
  const minLag = returnLags.length > 0 ? Math.min(...returnLags) : null;
  const maxLag = returnLags.length > 0 ? Math.max(...returnLags) : null;

  // Overall return rates (all-time, no date filter on orders)
  const totalNonCancelledOrders = Array.from(store.orders.values()).filter(o => o.order_status !== 'Cancelled').length;
  const allReturnedOrders = new Set(Array.from(store.returns.values()).map(r => r.order_id)).size;

  return {
    returnRecords,
    returnedOrders: returnedOrderIds.size,
    totalRefunds: round(totalRefunds),
    returnRates: {
      orderBasis: {
        rate: round(allReturnedOrders / totalNonCancelledOrders, 4),
        numerator: allReturnedOrders,
        denominator: totalNonCancelledOrders,
        label: 'Distinct returned orders / Non-cancelled orders (all-time)',
      },
      itemBasis: {
        rate: round(store.returns.size / store.orderItems.size, 4),
        numerator: store.returns.size,
        denominator: store.orderItems.size,
        label: 'Return records / Total order lines (all-time)',
      },
    },
    returnLag: { avg: avgLag, min: minLag, max: maxLag, note: 'Days from order_date to return_date. Verified range: 2-14 days per dataset.' },
    byReason: Object.entries(byReason).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    topProductsByReturns: Array.from(byProduct.values())
      .map(p => ({ ...p, refunds: round(p.refunds) }))
      .sort((a, b) => b.count - a.count).slice(0, 10),
    byCategoryReturns: Array.from(byCategory.values())
      .map(c => ({ ...c, refunds: round(c.refunds) }))
      .sort((a, b) => b.count - a.count),
    monthlyTrend: Array.from(monthlyTrend.values())
      .sort((a, b) => a.label.localeCompare(b.label))
      .map(b => ({ ...b, refunds: round(b.refunds) })),
    limitations: [
      'Returned vs Refunded status distinction not documented — both counted as returns',
      'Returns grain = one order line per return record; multi-item orders have one line returned',
      '11 returns have return_date after 2025-12-31 (up to 2026-01-11)',
      'Shipping fees are NOT refunded per dataset verification',
    ],
  };
}
