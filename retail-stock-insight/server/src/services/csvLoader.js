import { parseCSV, parseDate, parseFloat2, parseInt2 } from '../utils/parsers.js';
import { config } from '../config/index.js';

/**
 * In-memory data store — loaded once at startup.
 * PII fields (first_name, last_name, email, age, gender) are stripped from customers.
 */
const store = {
  customers: null,    // Map keyed by customer_id
  orders: null,       // Map keyed by order_id
  orderItems: null,   // Map keyed by order_item_id; also index by order_id
  products: null,     // Map keyed by product_id
  returns: null,      // Map keyed by return_id
  // indexes
  orderItemsByOrderId: null,  // Map<order_id, OI[]>
  returnsByOrderId: null,     // Map<order_id, Return[]>
  returnsByProductId: null,   // Map<product_id, Return[]>
  ordersByCustomerId: null,   // Map<customer_id, Order[]>
  dataQuality: null,
  loaded: false,
  loadedAt: null,
};

export function getStore() {
  return store;
}

export async function loadAllData() {
  if (store.loaded) return store;
  console.log('[Loader] Starting CSV load...');
  const t0 = Date.now();

  // ── 1. CUSTOMERS ──────────────────────────────────────────────
  const rawCustomers = await parseCSV('customers.csv');
  const customersBefore = rawCustomers.length;
  store.customers = new Map();
  for (const r of rawCustomers) {
    if (!r.customer_id) { console.warn('[Loader] Skipping customer row: missing customer_id'); continue; }
    store.customers.set(r.customer_id, {
      customer_id:        r.customer_id,
      // PII stripped: first_name, last_name, email, age, gender
      city:               r.city,
      country:            r.country,
      region:             r.region,
      signup_date:        parseDate(r.signup_date, 'signup_date'),
      acquisition_channel: r.acquisition_channel,
      membership_tier:    r.membership_tier,
    });
  }
  console.log(`[Loader] Customers: ${customersBefore} raw → ${store.customers.size} loaded (${customersBefore - store.customers.size} skipped)`);

  // ── 2. PRODUCTS ────────────────────────────────────────────────
  const rawProducts = await parseCSV('products.csv');
  const productsBefore = rawProducts.length;
  store.products = new Map();
  for (const r of rawProducts) {
    if (!r.product_id) { console.warn('[Loader] Skipping product row: missing product_id'); continue; }
    const unit_cost  = parseFloat2(r.unit_cost,  'unit_cost');
    const unit_price = parseFloat2(r.unit_price, 'unit_price');
    // Recompute margin — CSV margin_pct is rounded
    const margin_computed = unit_price > 0 ? (unit_price - unit_cost) / unit_price : 0;
    store.products.set(r.product_id, {
      product_id:       r.product_id,
      product_name:     r.product_name,
      category:         r.category,
      unit_cost,
      unit_price,
      margin_pct_csv:   parseFloat2(r.margin_pct, 'margin_pct'),
      margin_pct:       margin_computed,  // recomputed
      negative_margin:  unit_cost > unit_price,
    });
  }
  console.log(`[Loader] Products: ${productsBefore} raw → ${store.products.size} loaded (${productsBefore - store.products.size} skipped)`);

  // ── 3. ORDERS ──────────────────────────────────────────────────
  const rawOrders = await parseCSV('orders.csv');
  const ordersBefore = rawOrders.length;
  store.orders = new Map();
  store.ordersByCustomerId = new Map();
  for (const r of rawOrders) {
    if (!r.order_id) { console.warn('[Loader] Skipping order row: missing order_id'); continue; }
    const o = {
      order_id:       r.order_id,
      customer_id:    r.customer_id,
      order_date:     parseDate(r.order_date, 'order_date'),
      payment_method: r.payment_method,
      order_status:   r.order_status,
      shipping_fee:   parseFloat2(r.shipping_fee, 'shipping_fee'),
      order_subtotal: parseFloat2(r.order_subtotal, 'order_subtotal'),
      total_amount:   parseFloat2(r.total_amount, 'total_amount'),
    };
    store.orders.set(o.order_id, o);
    if (!store.ordersByCustomerId.has(o.customer_id)) store.ordersByCustomerId.set(o.customer_id, []);
    store.ordersByCustomerId.get(o.customer_id).push(o);
  }
  console.log(`[Loader] Orders: ${ordersBefore} raw → ${store.orders.size} loaded (${ordersBefore - store.orders.size} skipped)`);

  // ── 4. ORDER ITEMS ─────────────────────────────────────────────
  const rawItems = await parseCSV('order_items.csv');
  const itemsBefore = rawItems.length;
  store.orderItems = new Map();
  store.orderItemsByOrderId = new Map();
  let itemsSkipped = 0;
  for (const r of rawItems) {
    if (!r.order_item_id) { console.warn('[Loader] Skipping item row: missing order_item_id'); itemsSkipped++; continue; }
    if (!store.orders.has(r.order_id)) {
      console.warn(`[Loader] Orphan order_item ${r.order_item_id} references unknown order ${r.order_id} — skipping`);
      itemsSkipped++;
      continue;
    }
    const item = {
      order_item_id: r.order_item_id,
      order_id:      r.order_id,
      product_id:    r.product_id,
      quantity:      parseInt2(r.quantity, 'quantity'),
      unit_price:    parseFloat2(r.unit_price, 'unit_price'),
      discount_pct:  parseFloat2(r.discount_pct, 'discount_pct'),
      line_total:    parseFloat2(r.line_total, 'line_total'),
    };
    store.orderItems.set(item.order_item_id, item);
    if (!store.orderItemsByOrderId.has(item.order_id)) store.orderItemsByOrderId.set(item.order_id, []);
    store.orderItemsByOrderId.get(item.order_id).push(item);
  }
  console.log(`[Loader] OrderItems: ${itemsBefore} raw → ${store.orderItems.size} loaded (${itemsSkipped} skipped)`);

  // ── 5. RETURNS ─────────────────────────────────────────────────
  const rawReturns = await parseCSV('returns.csv');
  const returnsBefore = rawReturns.length;
  store.returns = new Map();
  store.returnsByOrderId = new Map();
  store.returnsByProductId = new Map();
  let returnsSkipped = 0;
  for (const r of rawReturns) {
    if (!r.return_id) { console.warn('[Loader] Skipping return row: missing return_id'); returnsSkipped++; continue; }
    const ret = {
      return_id:     r.return_id,
      order_id:      r.order_id,
      order_item_id: r.order_item_id,
      product_id:    r.product_id,
      customer_id:   r.customer_id,
      return_date:   parseDate(r.return_date, 'return_date'),
      return_reason: r.return_reason,
      refund_amount: parseFloat2(r.refund_amount, 'refund_amount'),
    };
    store.returns.set(ret.return_id, ret);
    if (!store.returnsByOrderId.has(ret.order_id)) store.returnsByOrderId.set(ret.order_id, []);
    store.returnsByOrderId.get(ret.order_id).push(ret);
    if (!store.returnsByProductId.has(ret.product_id)) store.returnsByProductId.set(ret.product_id, []);
    store.returnsByProductId.get(ret.product_id).push(ret);
  }
  console.log(`[Loader] Returns: ${returnsBefore} raw → ${store.returns.size} loaded (${returnsSkipped} skipped)`);

  // ── 6. DATA QUALITY REPORT ─────────────────────────────────────
  store.dataQuality = buildDataQuality(store);

  store.loaded = true;
  store.loadedAt = new Date().toISOString();
  console.log(`[Loader] All data loaded in ${Date.now() - t0}ms`);
  return store;
}

function buildDataQuality(store) {
  const statusCounts = {};
  for (const o of store.orders.values()) {
    statusCounts[o.order_status] = (statusCounts[o.order_status] || 0) + 1;
  }

  // Orders with no items (should be zero)
  let ordersWithNoItems = 0;
  for (const orderId of store.orders.keys()) {
    if (!store.orderItemsByOrderId.has(orderId)) ordersWithNoItems++;
  }

  // Customers with no orders
  let customersWithNoOrders = 0;
  for (const custId of store.customers.keys()) {
    if (!store.ordersByCustomerId.has(custId)) customersWithNoOrders++;
  }

  // Returns after 2025-12-31
  const cutoff = new Date('2025-12-31');
  let returnsAfterDataRange = 0;
  for (const ret of store.returns.values()) {
    if (ret.return_date > cutoff) returnsAfterDataRange++;
  }

  // Negative-margin products
  const negativeMarginProducts = [];
  for (const p of store.products.values()) {
    if (p.negative_margin) negativeMarginProducts.push({ product_id: p.product_id, product_name: p.product_name, unit_cost: p.unit_cost, unit_price: p.unit_price, margin_pct: p.margin_pct });
  }

  return {
    rowCounts: {
      customers: store.customers.size,
      products: store.products.size,
      orders: store.orders.size,
      orderItems: store.orderItems.size,
      returns: store.returns.size,
    },
    orderStatusCounts: statusCounts,
    customersWithNoOrders,
    ordersWithNoItems,
    returnsAfterDataRange,
    negativeMarginProducts,
    limitations: [
      'Currency not specified in dataset',
      'Returned vs Refunded status distinction not documented',
      'Returns grain = one order line per return (multi-item orders: only one item returned)',
      `${returnsAfterDataRange} return records have return_date after 2025-12-31 (up to 2026-01-11)`,
      'No inventory/stock data available',
    ],
  };
}
