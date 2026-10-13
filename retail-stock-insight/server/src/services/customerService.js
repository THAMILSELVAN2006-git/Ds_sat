import { getStore } from './csvLoader.js';
import { round } from '../utils/formatters.js';

/**
 * Customer analytics — NO PII in any returned object.
 * Allowed: customer_id, city, country, region, membership_tier, acquisition_channel, signup_date
 */
export function computeCustomerSummary(params = {}) {
  const store = getStore();
  const { startDate, endDate, region, country } = params;

  const customerFilter = (cust) => {
    if (region && cust.region !== region) return false;
    if (country && cust.country !== country) return false;
    return true;
  };

  // Unique customers with orders (non-cancelled)
  const customerOrderCounts = new Map(); // customer_id → { orders, grossSales }
  for (const [orderId, order] of store.orders) {
    if (order.order_status === 'Cancelled') continue;
    if (startDate && order.order_date < startDate) continue;
    if (endDate && order.order_date > endDate) continue;
    const cust = store.customers.get(order.customer_id);
    if (!cust || !customerFilter(cust)) continue;
    if (!customerOrderCounts.has(order.customer_id)) {
      customerOrderCounts.set(order.customer_id, { orders: 0, grossSales: 0, firstOrder: null, lastOrder: null });
    }
    const c = customerOrderCounts.get(order.customer_id);
    c.orders++;

    // Item-level gross sales
    const items = store.orderItemsByOrderId.get(orderId) || [];
    for (const item of items) c.grossSales += item.line_total;

    if (!c.firstOrder || order.order_date < c.firstOrder) c.firstOrder = order.order_date;
    if (!c.lastOrder || order.order_date > c.lastOrder) c.lastOrder = order.order_date;
  }

  // Customers with no orders
  const customersWithNoOrders = [];
  for (const [custId, cust] of store.customers) {
    const hasAnyOrder = store.ordersByCustomerId.has(custId) && store.ordersByCustomerId.get(custId).length > 0;
    if (!hasAnyOrder) {
      customersWithNoOrders.push({ customer_id: custId, city: cust.city, country: cust.country, region: cust.region, membership_tier: cust.membership_tier });
    }
  }

  // Distribution: orders per customer
  const dist = {};
  for (const [, c] of customerOrderCounts) {
    const bucket = c.orders <= 20 ? String(c.orders) : '21+';
    dist[bucket] = (dist[bucket] || 0) + 1;
  }

  // Top customers (by gross sales, no PII)
  const topCustomers = Array.from(customerOrderCounts.entries())
    .map(([id, c]) => ({
      customer_id: id,
      orders: c.orders,
      grossSales: round(c.grossSales),
      city: store.customers.get(id)?.city,
      country: store.customers.get(id)?.country,
      membership_tier: store.customers.get(id)?.membership_tier,
    }))
    .sort((a, b) => b.grossSales - a.grossSales)
    .slice(0, 20);

  // Breakdown by region
  const byRegion = {};
  for (const [custId] of customerOrderCounts) {
    const cust = store.customers.get(custId);
    if (!cust) continue;
    byRegion[cust.region] = (byRegion[cust.region] || 0) + 1;
  }

  // Breakdown by country
  const byCountry = {};
  for (const [custId] of customerOrderCounts) {
    const cust = store.customers.get(custId);
    if (!cust) continue;
    byCountry[cust.country] = (byCountry[cust.country] || 0) + 1;
  }

  // Breakdown by membership tier
  const byTier = {};
  for (const [custId] of customerOrderCounts) {
    const cust = store.customers.get(custId);
    if (!cust) continue;
    byTier[cust.membership_tier] = (byTier[cust.membership_tier] || 0) + 1;
  }

  // Breakdown by acquisition channel
  const byChannel = {};
  for (const [custId] of customerOrderCounts) {
    const cust = store.customers.get(custId);
    if (!cust) continue;
    byChannel[cust.acquisition_channel] = (byChannel[cust.acquisition_channel] || 0) + 1;
  }

  // New vs repeat (new = 1 order, repeat = 2+)
  let newCustomers = 0, repeatCustomers = 0;
  for (const [, c] of customerOrderCounts) {
    if (c.orders === 1) newCustomers++;
    else repeatCustomers++;
  }

  return {
    uniqueCustomers: customerOrderCounts.size,
    customersWithNoOrders: customersWithNoOrders.length,
    customersWithNoOrdersList: customersWithNoOrders,
    newCustomers,
    repeatCustomers,
    avgOrdersPerCustomer: round(
      customerOrderCounts.size > 0
        ? Array.from(customerOrderCounts.values()).reduce((a, c) => a + c.orders, 0) / customerOrderCounts.size
        : 0, 2),
    topCustomers,
    ordersPerCustomerDist: Object.entries(dist)
      .sort(([a], [b]) => {
        const na = a === '21+' ? 99 : parseInt(a);
        const nb = b === '21+' ? 99 : parseInt(b);
        return na - nb;
      })
      .map(([orders, count]) => ({ orders, count })),
    byRegion: Object.entries(byRegion).map(([region, count]) => ({ region, count })).sort((a,b) => b.count - a.count),
    byCountry: Object.entries(byCountry).map(([country, count]) => ({ country, count })).sort((a,b) => b.count - a.count),
    byMembershipTier: Object.entries(byTier).map(([tier, count]) => ({ tier, count })).sort((a,b) => b.count - a.count),
    byAcquisitionChannel: Object.entries(byChannel).map(([channel, count]) => ({ channel, count })).sort((a,b) => b.count - a.count),
    note: 'Customer data excludes PII (name, email, age, gender). Identified by customer_id only.',
  };
}
