import { getStore } from './csvLoader.js';
import { round, getMonthLabel, getWeekStart, getISOWeek } from '../utils/formatters.js';

/**
 * Build filter function for orders based on query params.
 * Default: exclude Cancelled orders.
 */
function buildOrderFilter(params = {}) {
  const {
    startDate, endDate, category, productId, region, country,
    paymentMethod, status, includeCancelled,
  } = params;

  return function filterOrder(order) {
    if (!includeCancelled && order.order_status === 'Cancelled') return false;
    if (status && order.order_status !== status) return false;
    if (paymentMethod && order.payment_method !== paymentMethod) return false;
    if (startDate && order.order_date < startDate) return false;
    if (endDate && order.order_date > endDate) return false;
    return true;
  };
}

/**
 * Core sales aggregation — always works at item grain first, then joins.
 * Never sums order_subtotal after joining to avoid double-count.
 */
export function computeSalesSummary(params = {}) {
  const store = getStore();
  if (!store.loaded) throw new Error('Data not loaded');

  const {
    startDate, endDate, category, productId, region, country,
    paymentMethod, status, includeCancelled,
  } = params;

  // Step 1: filter orders
  const orderFilter = buildOrderFilter(params);
  const filteredOrders = new Map();
  for (const [id, order] of store.orders) {
    if (orderFilter(order)) filteredOrders.set(id, order);
  }

  // Step 2: Customer filter (region/country)
  const customerFilter = (customerId) => {
    if (!region && !country) return true;
    const cust = store.customers.get(customerId);
    if (!cust) return false;
    if (region && cust.region !== region) return false;
    if (country && cust.country !== country) return false;
    return true;
  };

  // Step 3: Aggregate at item grain
  let grossSales = 0;
  let unitsSold = 0;
  let cogs = 0;
  let shippingRevenue = 0;
  const orderIdsSeen = new Set();
  const customerIdsSeen = new Set();
  const cancelledOrderIds = new Set();
  let cancelledGrossSales = 0;
  let cancelledUnits = 0;

  // Also count cancelled separately
  for (const [id, order] of store.orders) {
    if (order.order_status === 'Cancelled') {
      cancelledOrderIds.add(id);
      const items = store.orderItemsByOrderId.get(id) || [];
      for (const item of items) {
        // Apply product/category filter if any
        if (productId && item.product_id !== productId) continue;
        if (category) {
          const prod = store.products.get(item.product_id);
          if (!prod || prod.category !== category) continue;
        }
        cancelledGrossSales += item.line_total;
        cancelledUnits += item.quantity;
      }
    }
  }

  for (const [orderId, order] of filteredOrders) {
    if (!customerFilter(order.customer_id)) continue;
    const items = store.orderItemsByOrderId.get(orderId) || [];
    let orderHasMatchingItem = false;
    for (const item of items) {
      if (productId && item.product_id !== productId) continue;
      if (category) {
        const prod = store.products.get(item.product_id);
        if (!prod || prod.category !== category) continue;
      }
      orderHasMatchingItem = true;
      grossSales += item.line_total;
      unitsSold += item.quantity;
      const prod = store.products.get(item.product_id);
      if (prod) cogs += item.quantity * prod.unit_cost;
    }
    if (orderHasMatchingItem) {
      orderIdsSeen.add(orderId);
      customerIdsSeen.add(order.customer_id);
      shippingRevenue += order.shipping_fee;
    }
  }

  // Step 4: Refunds — cohort method: refunds for lines whose ORDER date is in window
  let refunds = 0;
  const returnedOrderIds = new Set();
  for (const ret of store.returns.values()) {
    const order = store.orders.get(ret.order_id);
    if (!order) continue;
    if (startDate && order.order_date < startDate) continue;
    if (endDate && order.order_date > endDate) continue;
    if (productId && ret.product_id !== productId) continue;
    if (category) {
      const prod = store.products.get(ret.product_id);
      if (!prod || prod.category !== category) continue;
    }
    if (!customerFilter(order.customer_id)) continue;
    refunds += ret.refund_amount;
    returnedOrderIds.add(ret.order_id);
  }

  const orders = orderIdsSeen.size;
  const grossProfit = grossSales - cogs;
  const netSales = grossSales - refunds;
  const aov = orders > 0 ? grossSales / orders : 0;
  const uniqueCustomers = customerIdsSeen.size;

  // Return rates — using non-cancelled orders scope
  const returnRateOrderBasis = orders > 0 ? returnedOrderIds.size / orders : 0;
  const totalLines = (() => {
    let cnt = 0;
    for (const orderId of orderIdsSeen) {
      const items = store.orderItemsByOrderId.get(orderId) || [];
      for (const item of items) {
        if (productId && item.product_id !== productId) continue;
        if (category) {
          const prod = store.products.get(item.product_id);
          if (!prod || prod.category !== category) continue;
        }
        cnt++;
      }
    }
    return cnt;
  })();

  // Item basis: return records / order lines
  const returnRecordsInScope = (() => {
    let cnt = 0;
    for (const ret of store.returns.values()) {
      const order = store.orders.get(ret.order_id);
      if (!order) continue;
      if (startDate && order.order_date < startDate) continue;
      if (endDate && order.order_date > endDate) continue;
      if (productId && ret.product_id !== productId) continue;
      if (category) {
        const prod = store.products.get(ret.product_id);
        if (!prod || prod.category !== category) continue;
      }
      if (!customerFilter(order.customer_id)) continue;
      cnt++;
    }
    return cnt;
  })();

  const returnRateItemBasis = totalLines > 0 ? returnRecordsInScope / totalLines : 0;
  const returnRateValueBasis = grossSales > 0 ? refunds / grossSales : 0;

  return {
    grossSales: round(grossSales),
    netSales: round(netSales),
    refunds: round(refunds),
    cogs: round(cogs),
    grossProfit: round(grossProfit),
    shippingRevenue: round(shippingRevenue),
    unitsSold,
    orders,
    aov: round(aov),
    uniqueCustomers,
    returnRates: {
      orderBasis: {
        rate: round(returnRateOrderBasis, 4),
        numerator: returnedOrderIds.size,
        denominator: orders,
        label: 'Returned order_ids / Non-cancelled orders',
      },
      itemBasis: {
        rate: round(returnRateItemBasis, 4),
        numerator: returnRecordsInScope,
        denominator: totalLines,
        label: 'Return records / Order lines in non-cancelled orders',
      },
      valueBasis: {
        rate: round(returnRateValueBasis, 4),
        numerator: round(refunds),
        denominator: round(grossSales),
        label: 'Refunds / Gross sales',
      },
    },
    cancelled: {
      orders: cancelledOrderIds.size,
      grossSales: round(cancelledGrossSales),
      units: cancelledUnits,
    },
    notes: [
      'Gross sales = SUM(order_items.line_total) for non-cancelled orders',
      'AOV = Gross sales (items) / Distinct order count',
      'COGS = SUM(quantity × products.unit_cost); returned-item cost recovery is unknown',
      'Discounts are already inside line_total',
      'Refund attribution: cohort method — refunds for lines whose ORDER date is in window',
      'Shipping revenue reported separately and never added to item sales',
    ],
  };
}

/**
 * Sales trend grouped by day | week | month
 */
export function computeSalesTrend(params = {}) {
  const store = getStore();
  const { groupBy = 'month', startDate, endDate, category, productId,
          region, country, paymentMethod, includeCancelled } = params;

  const orderFilter = buildOrderFilter(params);
  const customerFilter = (customerId) => {
    if (!region && !country) return true;
    const cust = store.customers.get(customerId);
    if (!cust) return false;
    if (region && cust.region !== region) return false;
    if (country && cust.country !== country) return false;
    return true;
  };

  const buckets = new Map(); // label → { grossSales, units, orders, refunds }

  for (const [orderId, order] of store.orders) {
    if (!orderFilter(order)) continue;
    if (!customerFilter(order.customer_id)) continue;
    const items = store.orderItemsByOrderId.get(orderId) || [];

    let label;
    if (groupBy === 'day') label = order.order_date.toISOString().slice(0, 10);
    else if (groupBy === 'week') label = getWeekStart(order.order_date);
    else label = getMonthLabel(order.order_date);

    if (!buckets.has(label)) buckets.set(label, { label, grossSales: 0, units: 0, orders: 0, refunds: 0, orderIds: new Set() });
    const b = buckets.get(label);

    for (const item of items) {
      if (productId && item.product_id !== productId) continue;
      if (category) {
        const prod = store.products.get(item.product_id);
        if (!prod || prod.category !== category) continue;
      }
      b.grossSales += item.line_total;
      b.units += item.quantity;
    }
    b.orderIds.add(orderId);
  }

  // Add refunds by return_date (for the returns trend chart)
  // cohort refunds are in grossSales; here we also compute return_date-based for chart
  const returnBuckets = new Map();
  for (const ret of store.returns.values()) {
    let label;
    if (groupBy === 'day') label = ret.return_date.toISOString().slice(0, 10);
    else if (groupBy === 'week') label = getWeekStart(ret.return_date);
    else label = getMonthLabel(ret.return_date);
    returnBuckets.set(label, (returnBuckets.get(label) || 0) + ret.refund_amount);
  }

  // Cohort refunds (by order_date)
  for (const ret of store.returns.values()) {
    const order = store.orders.get(ret.order_id);
    if (!order) continue;
    let label;
    if (groupBy === 'day') label = order.order_date.toISOString().slice(0, 10);
    else if (groupBy === 'week') label = getWeekStart(order.order_date);
    else label = getMonthLabel(order.order_date);
    if (buckets.has(label)) {
      buckets.get(label).refunds = (buckets.get(label).refunds || 0) + ret.refund_amount;
    }
  }

  const result = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, b]) => ({
      label,
      grossSales: round(b.grossSales),
      netSales: round(b.grossSales - b.refunds),
      units: b.units,
      orders: b.orderIds.size,
      refunds: round(b.refunds),
      refundsByReturnDate: round(returnBuckets.get(label) || 0),
    }));

  return {
    groupBy,
    note: groupBy === 'week'
      ? 'Weeks start Monday. The partial week 2025-12-29 to 2025-12-31 is flagged.'
      : undefined,
    partialLastWeek: groupBy === 'week' ? '2025-12-29' : undefined,
    refundAttributionNote: 'grossSales uses cohort method (refunds attributed to order_date); refundsByReturnDate uses return_date for trend visualization',
    data: result,
  };
}

/**
 * Category breakdown
 */
export function computeCategoryBreakdown(params = {}) {
  const store = getStore();
  const { startDate, endDate, region, country, includeCancelled } = params;
  const orderFilter = buildOrderFilter(params);
  const customerFilter = (id) => {
    if (!region && !country) return true;
    const c = store.customers.get(id);
    if (!c) return false;
    if (region && c.region !== region) return false;
    if (country && c.country !== country) return false;
    return true;
  };

  const cats = new Map();

  for (const [orderId, order] of store.orders) {
    if (!orderFilter(order)) continue;
    if (!customerFilter(order.customer_id)) continue;
    const items = store.orderItemsByOrderId.get(orderId) || [];
    for (const item of items) {
      const prod = store.products.get(item.product_id);
      if (!prod) continue;
      if (!cats.has(prod.category)) cats.set(prod.category, { category: prod.category, grossSales: 0, units: 0, cogs: 0, returns: 0, refunds: 0, orderIds: new Set() });
      const c = cats.get(prod.category);
      c.grossSales += item.line_total;
      c.units += item.quantity;
      c.cogs += item.quantity * prod.unit_cost;
      c.orderIds.add(orderId);
    }
  }

  for (const ret of store.returns.values()) {
    const order = store.orders.get(ret.order_id);
    if (!order) continue;
    if (startDate && order.order_date < startDate) continue;
    if (endDate && order.order_date > endDate) continue;
    const prod = store.products.get(ret.product_id);
    if (!prod) continue;
    const c = cats.get(prod.category);
    if (c) { c.returns++; c.refunds += ret.refund_amount; }
  }

  return Array.from(cats.values())
    .map(c => ({
      category: c.category,
      grossSales: round(c.grossSales),
      netSales: round(c.grossSales - c.refunds),
      units: c.units,
      orders: c.orderIds.size,
      cogs: round(c.cogs),
      grossProfit: round(c.grossSales - c.cogs),
      margin: c.grossSales > 0 ? round((c.grossSales - c.cogs) / c.grossSales, 4) : 0,
      returns: c.returns,
      refunds: round(c.refunds),
    }))
    .sort((a, b) => b.grossSales - a.grossSales);
}

/**
 * Top products
 */
export function computeTopProducts(params = {}) {
  const store = getStore();
  const { sortBy = 'revenue', limit = 10, startDate, endDate, category,
          region, country, includeCancelled } = params;
  const orderFilter = buildOrderFilter(params);
  const customerFilter = (id) => {
    if (!region && !country) return true;
    const c = store.customers.get(id);
    if (!c) return false;
    if (region && c.region !== region) return false;
    if (country && c.country !== country) return false;
    return true;
  };

  const prods = new Map();

  for (const [orderId, order] of store.orders) {
    if (!orderFilter(order)) continue;
    if (!customerFilter(order.customer_id)) continue;
    const items = store.orderItemsByOrderId.get(orderId) || [];
    for (const item of items) {
      const prod = store.products.get(item.product_id);
      if (!prod) continue;
      if (category && prod.category !== category) continue;
      if (!prods.has(item.product_id)) {
        prods.set(item.product_id, {
          product_id: prod.product_id, product_name: prod.product_name,
          category: prod.category, grossSales: 0, units: 0, cogs: 0,
          returns: 0, refunds: 0, orderIds: new Set(),
          negative_margin: prod.negative_margin,
        });
      }
      const p = prods.get(item.product_id);
      p.grossSales += item.line_total;
      p.units += item.quantity;
      p.cogs += item.quantity * prod.unit_cost;
      p.orderIds.add(orderId);
    }
  }

  for (const ret of store.returns.values()) {
    const order = store.orders.get(ret.order_id);
    if (!order) continue;
    if (startDate && order.order_date < startDate) continue;
    if (endDate && order.order_date > endDate) continue;
    const p = prods.get(ret.product_id);
    if (p) { p.returns++; p.refunds += ret.refund_amount; }
  }

  const sorted = Array.from(prods.values())
    .map(p => ({
      ...p,
      grossSales: round(p.grossSales),
      cogs: round(p.cogs),
      grossProfit: round(p.grossSales - p.cogs),
      margin: p.grossSales > 0 ? round((p.grossSales - p.cogs) / p.grossSales, 4) : 0,
      refunds: round(p.refunds),
      orders: p.orderIds.size,
    }));

  const sortField = sortBy === 'units' ? 'units' : sortBy === 'profit' ? 'grossProfit' : 'grossSales';
  sorted.sort((a, b) => b[sortField] - a[sortField]);

  return sorted.slice(0, Math.min(limit, sorted.length));
}

/**
 * Order status distribution (all 4 statuses)
 */
export function computeOrderStatus(params = {}) {
  const store = getStore();
  const { startDate, endDate } = params;
  const counts = {};
  for (const order of store.orders.values()) {
    if (startDate && order.order_date < startDate) continue;
    if (endDate && order.order_date > endDate) continue;
    counts[order.order_status] = (counts[order.order_status] || 0) + 1;
  }
  return Object.entries(counts).map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
}
