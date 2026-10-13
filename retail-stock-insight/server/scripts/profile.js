/**
 * Phase 1: Data Profile & Reference Value Assertions
 * Run: node scripts/profile.js
 * Saves output to docs/data-profile.txt
 */
import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data');
const DOCS_DIR = path.join(__dirname, '../../docs');

const lines = [];
function log(msg = '') {
  console.log(msg);
  lines.push(msg);
}

async function readCSV(filename) {
  return new Promise((resolve, reject) => {
    const rows = [];
    createReadStream(path.join(DATA_DIR, filename))
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
      .on('data', r => rows.push(r))
      .on('error', reject)
      .on('end', () => resolve(rows));
  });
}

function assert(label, actual, expected, tolerance = 0.01) {
  const pass = typeof expected === 'number'
    ? Math.abs(actual - expected) <= tolerance
    : actual === expected;
  const icon = pass ? '✅' : '❌';
  log(`  ${icon} ${label}: got=${actual} expected=${expected}${pass ? '' : ' MISMATCH'}`);
  if (!pass) {
    log(`     ⚠️  ASSERTION FAILED: ${label}`);
    process.exitCode = 1;
  }
}

async function main() {
  log('='.repeat(70));
  log('RETAIL STOCK INSIGHT — DATA PROFILE & ASSERTIONS');
  log(`Run at: ${new Date().toISOString()}`);
  log('='.repeat(70));

  // ── Load CSVs ────────────────────────────────────────────────────────
  const customers = await readCSV('customers.csv');
  const orders = await readCSV('orders.csv');
  const items = await readCSV('order_items.csv');
  const products = await readCSV('products.csv');
  const returns = await readCSV('returns.csv');

  log('\n── ROW COUNTS ──────────────────────────────────────────────────────');
  log(`  customers:   ${customers.length}`);
  log(`  orders:      ${orders.length}`);
  log(`  order_items: ${items.length}`);
  log(`  products:    ${products.length}`);
  log(`  returns:     ${returns.length}`);

  assert('customers rows', customers.length, 600);
  assert('orders rows', orders.length, 8000);
  assert('order_items rows', items.length, 16418);
  assert('products rows', products.length, 50);
  assert('returns rows', returns.length, 883);

  // ── NULL CHECKS ────────────────────────────────────────────────────
  log('\n── NULL/EMPTY CHECKS ───────────────────────────────────────────────');
  function countNulls(rows, field) {
    return rows.filter(r => !r[field] || r[field].trim() === '').length;
  }
  const custNulls = Object.keys(customers[0]).filter(k => countNulls(customers, k) > 0);
  const ordNulls = Object.keys(orders[0]).filter(k => countNulls(orders, k) > 0);
  const itemNulls = Object.keys(items[0]).filter(k => countNulls(items, k) > 0);
  const prodNulls = Object.keys(products[0]).filter(k => countNulls(products, k) > 0);
  const retNulls = Object.keys(returns[0]).filter(k => countNulls(returns, k) > 0);
  log(`  customers nulls in columns: ${custNulls.length === 0 ? 'NONE ✅' : custNulls.join(',')}`);
  log(`  orders nulls in columns: ${ordNulls.length === 0 ? 'NONE ✅' : ordNulls.join(',')}`);
  log(`  order_items nulls: ${itemNulls.length === 0 ? 'NONE ✅' : itemNulls.join(',')}`);
  log(`  products nulls: ${prodNulls.length === 0 ? 'NONE ✅' : prodNulls.join(',')}`);
  log(`  returns nulls: ${retNulls.length === 0 ? 'NONE ✅' : retNulls.join(',')}`);

  // ── DUPLICATES ─────────────────────────────────────────────────────
  log('\n── DUPLICATE KEY CHECKS ────────────────────────────────────────────');
  function countDups(rows, key) {
    const seen = new Set();
    let dups = 0;
    for (const r of rows) { if (seen.has(r[key])) dups++; seen.add(r[key]); }
    return dups;
  }
  log(`  customer_id dups: ${countDups(customers, 'customer_id')}`);
  log(`  order_id dups: ${countDups(orders, 'order_id')}`);
  log(`  order_item_id dups: ${countDups(items, 'order_item_id')}`);
  log(`  product_id dups: ${countDups(products, 'product_id')}`);
  log(`  return_id dups: ${countDups(returns, 'return_id')}`);
  assert('customer_id duplicates', countDups(customers, 'customer_id'), 0);
  assert('order_id duplicates', countDups(orders, 'order_id'), 0);
  assert('order_item_id duplicates', countDups(items, 'order_item_id'), 0);

  // ── ORPHAN FK CHECKS ──────────────────────────────────────────────
  log('\n── ORPHAN FK CHECKS ─────────────────────────────────────────────────');
  const custIds = new Set(customers.map(c => c.customer_id));
  const orderIds = new Set(orders.map(o => o.order_id));
  const prodIds = new Set(products.map(p => p.product_id));

  const ordersOrphanCust = orders.filter(o => !custIds.has(o.customer_id)).length;
  const itemsOrphanOrder = items.filter(i => !orderIds.has(i.order_id)).length;
  const itemsOrphanProd = items.filter(i => !prodIds.has(i.product_id)).length;
  const returnsOrphanOrder = returns.filter(r => !orderIds.has(r.order_id)).length;

  log(`  orders with orphan customer_id: ${ordersOrphanCust}`);
  log(`  order_items with orphan order_id: ${itemsOrphanOrder}`);
  log(`  order_items with orphan product_id: ${itemsOrphanProd}`);
  log(`  returns with orphan order_id: ${returnsOrphanOrder}`);
  assert('orders orphan customer_id', ordersOrphanCust, 0);
  assert('items orphan order_id', itemsOrphanOrder, 0);
  assert('items orphan product_id', itemsOrphanProd, 0);
  assert('returns orphan order_id', returnsOrphanOrder, 0);

  // ── DATE RANGES ────────────────────────────────────────────────────
  log('\n── DATE RANGES ──────────────────────────────────────────────────────');
  const orderDates = orders.map(o => o.order_date).sort();
  const retDates = returns.map(r => r.return_date).sort();
  const signupDates = customers.map(c => c.signup_date).sort();
  log(`  orders date range: ${orderDates[0]} to ${orderDates[orderDates.length - 1]}`);
  log(`  returns date range: ${retDates[0]} to ${retDates[retDates.length - 1]}`);
  log(`  customers signup range: ${signupDates[0]} to ${signupDates[signupDates.length - 1]}`);
  const returnsAfter2025 = returns.filter(r => r.return_date > '2025-12-31').length;
  log(`  returns after 2025-12-31: ${returnsAfter2025}`);
  assert('orders start date', orderDates[0], '2024-01-01');
  assert('orders end date', orderDates[orderDates.length - 1], '2025-12-31');

  // ── ORDER STATUS ───────────────────────────────────────────────────
  log('\n── ORDER STATUS COUNTS ──────────────────────────────────────────────');
  const statusCounts = {};
  for (const o of orders) statusCounts[o.order_status] = (statusCounts[o.order_status] || 0) + 1;
  log(`  ${JSON.stringify(statusCounts)}`);
  assert('Delivered count', statusCounts['Delivered'], 6708);
  assert('Returned count', statusCounts['Returned'], 721);
  assert('Cancelled count', statusCounts['Cancelled'], 409);
  assert('Refunded count', statusCounts['Refunded'], 162);

  // ── PAYMENT METHODS ────────────────────────────────────────────────
  const payMethods = new Set(orders.map(o => o.payment_method));
  log(`\n── PAYMENT METHODS: ${[...payMethods].join(', ')} (${payMethods.size} distinct) ──`);
  assert('payment method count', payMethods.size, 6);

  // ── SHIPPING FEES ─────────────────────────────────────────────────
  const shippingFees = new Set(orders.map(o => o.shipping_fee));
  log(`\n── SHIPPING FEES: ${[...shippingFees].sort().join(', ')} ──`);

  // ── CUSTOMERS ─────────────────────────────────────────────────────
  log('\n── CUSTOMER ATTRIBUTES ──────────────────────────────────────────────');
  const countries = new Set(customers.map(c => c.country));
  const regions = new Set(customers.map(c => c.region));
  const cities = new Set(customers.map(c => c.city));
  const channels = new Set(customers.map(c => c.acquisition_channel));
  const tiers = new Set(customers.map(c => c.membership_tier));
  log(`  countries: ${[...countries].sort().join(', ')} (${countries.size})`);
  log(`  regions: ${[...regions].sort().join(', ')} (${regions.size})`);
  log(`  cities: ${cities.size}`);
  log(`  channels: ${[...channels].sort().join(', ')} (${channels.size})`);
  log(`  tiers: ${[...tiers].sort().join(', ')} (${tiers.size})`);
  assert('countries count', countries.size, 8);
  assert('regions count', regions.size, 4);
  assert('cities count', cities.size, 25);
  assert('channels count', channels.size, 7);
  assert('tiers count', tiers.size, 4);

  // ── CUSTOMERS WITH NO ORDERS ───────────────────────────────────────
  const custIdsWithOrders = new Set(orders.map(o => o.customer_id));
  const custsNoOrders = customers.filter(c => !custIdsWithOrders.has(c.customer_id));
  log(`\n── CUSTOMERS WITH NO ORDERS: ${custsNoOrders.length} ──`);
  assert('customers with no orders', custsNoOrders.length, 6);

  // ── DISTINCT CUSTOMERS IN ORDERS ───────────────────────────────────
  const distinctCustsInOrders = new Set(orders.map(o => o.customer_id)).size;
  log(`\n── DISTINCT CUSTOMERS IN ORDERS: ${distinctCustsInOrders} ──`);
  assert('distinct customers in orders', distinctCustsInOrders, 594);

  // ── PRODUCTS ──────────────────────────────────────────────────────
  log('\n── PRODUCTS ─────────────────────────────────────────────────────────');
  const catCounts = {};
  for (const p of products) catCounts[p.category] = (catCounts[p.category] || 0) + 1;
  log(`  categories: ${JSON.stringify(catCounts)}`);
  const negMargin = products.filter(p => parseFloat(p.unit_cost) > parseFloat(p.unit_price));
  log(`  negative margin products: ${negMargin.map(p => `${p.product_id}(${p.product_name})`).join(', ')}`);
  assert('products Electronics', catCounts['Electronics'], 10);
  assert('products Fashion', catCounts['Fashion'], 10);
  assert('products negative margin count', negMargin.length, 1);
  assert('negative margin product', negMargin[0]?.product_id, 'PROD0048');

  // ── LINE_TOTAL VERIFICATION ────────────────────────────────────────
  log('\n── LINE_TOTAL VERIFICATION (quantity*unit_price*(1-discount_pct)) ──');
  let lineTotalMismatches = 0;
  for (const item of items) {
    const computed = parseFloat(item.quantity) * parseFloat(item.unit_price) * (1 - parseFloat(item.discount_pct));
    const actual = parseFloat(item.line_total);
    if (Math.abs(computed - actual) > 0.02) lineTotalMismatches++;
  }
  log(`  line_total mismatches: ${lineTotalMismatches}`);
  assert('line_total formula matches', lineTotalMismatches, 0);

  // ── ORDER_SUBTOTAL VERIFICATION ────────────────────────────────────
  log('\n── ORDER_SUBTOTAL VERIFICATION ─────────────────────────────────────');
  const orderItemMap = new Map();
  for (const item of items) {
    orderItemMap.set(item.order_id, (orderItemMap.get(item.order_id) || 0) + parseFloat(item.line_total));
  }
  let subtotalMismatches = 0;
  for (const o of orders) {
    const computed = orderItemMap.get(o.order_id) || 0;
    if (Math.abs(computed - parseFloat(o.order_subtotal)) > 0.02) subtotalMismatches++;
  }
  log(`  order_subtotal mismatches: ${subtotalMismatches}`);
  assert('order_subtotal matches sum(line_total)', subtotalMismatches, 0);

  // ── TOTAL_AMOUNT VERIFICATION ──────────────────────────────────────
  log('\n── TOTAL_AMOUNT VERIFICATION ────────────────────────────────────────');
  let totalAmtMismatches = 0;
  for (const o of orders) {
    const computed = parseFloat(o.order_subtotal) + parseFloat(o.shipping_fee);
    if (Math.abs(computed - parseFloat(o.total_amount)) > 0.02) totalAmtMismatches++;
  }
  log(`  total_amount mismatches: ${totalAmtMismatches}`);
  assert('total_amount = subtotal + shipping_fee', totalAmtMismatches, 0);

  // ── REFERENCE VALUES ───────────────────────────────────────────────
  log('\n── REFERENCE VALUE ASSERTIONS ───────────────────────────────────────');

  // Non-cancelled orders
  const nonCancelledOrders = orders.filter(o => o.order_status !== 'Cancelled');
  const nonCancelledOrderIds = new Set(nonCancelledOrders.map(o => o.order_id));

  // Gross sales from non-cancelled order_items
  let grossSales = 0;
  let unitsSold = 0;
  for (const item of items) {
    if (nonCancelledOrderIds.has(item.order_id)) {
      grossSales += parseFloat(item.line_total);
      unitsSold += parseInt(item.quantity);
    }
  }

  // Gross sales incl. cancelled
  let grossSalesAll = 0;
  let unitsAll = 0;
  for (const item of items) {
    grossSalesAll += parseFloat(item.line_total);
    unitsAll += parseInt(item.quantity);
  }

  // Refunds
  let refunds = 0;
  for (const r of returns) refunds += parseFloat(r.refund_amount);

  // COGS non-cancelled
  const prodMap = new Map(products.map(p => [p.product_id, p]));
  let cogs = 0;
  for (const item of items) {
    if (nonCancelledOrderIds.has(item.order_id)) {
      const prod = prodMap.get(item.product_id);
      if (prod) cogs += parseInt(item.quantity) * parseFloat(prod.unit_cost);
    }
  }

  // Shipping non-cancelled
  let shipping = 0;
  for (const o of nonCancelledOrders) shipping += parseFloat(o.shipping_fee);

  // Unique customers non-cancelled
  const uniqueCustsNC = new Set(nonCancelledOrders.map(o => o.customer_id)).size;

  log(`  Gross sales (non-cancelled): ${grossSales.toFixed(2)}`);
  log(`  Gross sales (all incl. cancelled): ${grossSalesAll.toFixed(2)}`);
  log(`  Orders (non-cancelled): ${nonCancelledOrders.length}`);
  log(`  Units sold (non-cancelled): ${unitsSold}`);
  log(`  Units sold (all): ${unitsAll}`);
  log(`  Refunds: ${refunds.toFixed(2)}`);
  log(`  Net sales: ${(grossSales - refunds).toFixed(2)}`);
  log(`  COGS: ${cogs.toFixed(2)}`);
  log(`  Shipping revenue: ${shipping}`);
  log(`  Unique customers (non-cancelled): ${uniqueCustsNC}`);

  assert('Gross sales non-cancelled', Math.round(grossSales * 100) / 100, 45420250.67, 0.02);
  assert('Gross sales incl cancelled', Math.round(grossSalesAll * 100) / 100, 47948379.75, 0.02);
  assert('Orders non-cancelled', nonCancelledOrders.length, 7591);
  assert('Units non-cancelled', unitsSold, 21558);
  assert('Units all', unitsAll, 22689);
  assert('Refunds', Math.round(refunds * 100) / 100, 2289755.42, 0.02);
  assert('Net sales', Math.round((grossSales - refunds) * 100) / 100, 43130495.25, 0.02);
  assert('COGS non-cancelled', Math.round(cogs * 100) / 100, 22015395.83, 0.02);
  assert('Shipping revenue non-cancelled', shipping, 203183);
  assert('Unique customers non-cancelled', uniqueCustsNC, 593);

  // Return rates
  const returnedOrderIdsSet = new Set(returns.map(r => r.order_id));
  const returnRateOrderBasis = returnedOrderIdsSet.size / nonCancelledOrders.length;
  log(`\n  Return rate (order basis): ${returnedOrderIdsSet.size}/${nonCancelledOrders.length} = ${(returnRateOrderBasis * 100).toFixed(2)}%`);
  assert('Return rate order basis %', Math.round(returnRateOrderBasis * 10000) / 100, 11.63, 0.05);

  // Category breakdown
  log('\n── CATEGORY GROSS SALES (non-cancelled) ─────────────────────────────');
  const catSales = {};
  for (const item of items) {
    if (!nonCancelledOrderIds.has(item.order_id)) continue;
    const prod = prodMap.get(item.product_id);
    if (!prod) continue;
    catSales[prod.category] = (catSales[prod.category] || 0) + parseFloat(item.line_total);
  }
  const catSorted = Object.entries(catSales).sort((a, b) => b[1] - a[1]);
  for (const [cat, val] of catSorted) log(`  ${cat}: ${val.toFixed(2)}`);

  assert('Electronics gross sales', Math.round(catSales['Electronics']) / 1000000, 11.77, 0.05);
  assert('Fashion gross sales', Math.round(catSales['Fashion']) / 1000000, 10.99, 0.05);
  assert('Home & Kitchen gross sales', Math.round(catSales['Home & Kitchen']) / 1000000, 8.54, 0.05);
  assert('Sports & Fitness gross sales', Math.round(catSales['Sports & Fitness']) / 1000000, 8.01, 0.05);
  assert('Beauty & Personal Care gross sales', Math.round(catSales['Beauty & Personal Care']) / 1000000, 3.29, 0.05);
  assert('Books & Stationery gross sales', Math.round(catSales['Books & Stationery']) / 1000000, 2.82, 0.05);

  // ── REFUND AMOUNT = LINE_TOTAL ─────────────────────────────────────
  log('\n── REFUND AMOUNT = LINE_TOTAL VERIFICATION ──────────────────────────');
  const itemMap = new Map(items.map(i => [i.order_item_id, i]));
  let refundLineMismatches = 0;
  for (const r of returns) {
    const item = itemMap.get(r.order_item_id);
    if (!item) { log(`  ⚠️  Return ${r.return_id} has no matching order_item_id`); continue; }
    if (Math.abs(parseFloat(r.refund_amount) - parseFloat(item.line_total)) > 0.02) {
      log(`  ⚠️  Mismatch: ${r.return_id} refund=${r.refund_amount} vs line_total=${item.line_total}`);
      refundLineMismatches++;
    }
  }
  log(`  refund_amount = line_total mismatches: ${refundLineMismatches}`);
  assert('refund_amount equals line_total', refundLineMismatches, 0);

  // ── RETURN ORDER_ITEM_ID UNIQUENESS ────────────────────────────────
  const returnItemIds = returns.map(r => r.order_item_id);
  const uniqueReturnItemIds = new Set(returnItemIds).size;
  log(`\n── RETURNS order_item_id uniqueness: ${uniqueReturnItemIds} unique / ${returns.length} total ──`);
  assert('return order_item_id unique', uniqueReturnItemIds, 883);

  // ── SAVE OUTPUT ────────────────────────────────────────────────────
  if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });
  const outPath = path.join(DOCS_DIR, 'data-profile.txt');
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  log(`\n📄 Profile saved to: ${outPath}`);
  log('\n' + '='.repeat(70));

  if (process.exitCode === 1) {
    console.error('\n❌ ONE OR MORE ASSERTIONS FAILED. Investigate before Phase 2.\n');
  } else {
    console.log('\n✅ ALL ASSERTIONS PASSED\n');
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
