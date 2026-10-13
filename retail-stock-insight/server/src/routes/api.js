import express from 'express';
import { getStore } from '../services/csvLoader.js';
import { config } from '../config/index.js';
import { asyncHandler, requireDataLoaded, validateQueryParams } from '../middleware/index.js';
import {
  computeSalesSummary, computeSalesTrend, computeCategoryBreakdown,
  computeTopProducts, computeOrderStatus,
} from '../services/salesService.js';
import { getProductCatalogue, getProductHistory } from '../services/productService.js';
import { computeCustomerSummary } from '../services/customerService.js';
import { computeReturnsSummary } from '../services/returnsService.js';
import { computeDemandTrend } from '../services/demandService.js';
import { computeForecast } from '../services/forecastService.js';

const router = express.Router();

function envelope(data, meta = {}) {
  return { success: true, data, meta };
}

function guard(res) {
  const store = getStore();
  if (!store.loaded) {
    res.status(503).json({ success: false, error: 'Data not loaded', data: null, meta: {} });
    return false;
  }
  return true;
}

// ─── HEALTH ────────────────────────────────────────────────────────────────
router.get('/health', (req, res) => {
  const store = getStore();
  res.json(envelope({
    status: 'ok',
    loaded: store.loaded,
    loadedAt: store.loadedAt,
    environment: config.nodeEnv,
  }));
});

// ─── METADATA ─────────────────────────────────────────────────────────────
router.get('/metadata', asyncHandler(async (req, res) => {
  if (!guard(res)) return;
  const store = getStore();
  const dq = store.dataQuality;

  let orderDateMin = null, orderDateMax = null;
  for (const o of store.orders.values()) {
    if (!orderDateMin || o.order_date < orderDateMin) orderDateMin = o.order_date;
    if (!orderDateMax || o.order_date > orderDateMax) orderDateMax = o.order_date;
  }

  res.json(envelope({
    rowCounts: dq.rowCounts,
    orderDateRange: {
      start: orderDateMin?.toISOString().slice(0, 10),
      end: orderDateMax?.toISOString().slice(0, 10),
    },
    orderStatusCounts: dq.orderStatusCounts,
    customersWithNoOrders: dq.customersWithNoOrders,
    ordersWithNoItems: dq.ordersWithNoItems,
    returnsAfterDataRange: dq.returnsAfterDataRange,
    negativeMarginProducts: dq.negativeMarginProducts,
    currencyNote: config.currencyCode
      ? `Currency: ${config.currencyCode}`
      : 'Currency not specified in dataset',
    currencyCode: config.currencyCode || null,
    dataQualityLimitations: dq.limitations,
    unsupportedFeatures: [
      'Stock-on-hand (no inventory fields in dataset)',
      'Shortage / reorder alerts (no inventory data)',
    ],
    loadedAt: store.loadedAt,
  }));
}));

// ─── DASHBOARD SUMMARY ────────────────────────────────────────────────────
router.get('/dashboard/summary', validateQueryParams, asyncHandler(async (req, res) => {
  if (!guard(res)) return;
  const p = req.parsedParams;
  const summary = computeSalesSummary(p);
  const categories = computeCategoryBreakdown(p);
  const topProducts = computeTopProducts({ ...p, limit: 5 });
  const orderStatus = computeOrderStatus(p);
  const trend = computeSalesTrend({ ...p, groupBy: 'month' });

  res.json(envelope({
    summary,
    categories,
    topProducts,
    orderStatus,
    salesTrend: trend,
    currencyNote: config.currencyCode || 'Currency not specified in dataset',
  }, {
    appliedFilters: {
      startDate: p.startDate?.toISOString().slice(0, 10) || null,
      endDate: p.endDate?.toISOString().slice(0, 10) || null,
      includeCancelled: p.includeCancelled,
    },
  }));
}));

// ─── SALES TREND ──────────────────────────────────────────────────────────
router.get('/analytics/sales-trend', validateQueryParams, asyncHandler(async (req, res) => {
  if (!guard(res)) return;
  const p = req.parsedParams;
  res.json(envelope(computeSalesTrend(p), { appliedFilters: p }));
}));

// ─── CATEGORIES ───────────────────────────────────────────────────────────
router.get('/analytics/categories', validateQueryParams, asyncHandler(async (req, res) => {
  if (!guard(res)) return;
  res.json(envelope(computeCategoryBreakdown(req.parsedParams)));
}));

// ─── TOP PRODUCTS ─────────────────────────────────────────────────────────
router.get('/analytics/top-products', validateQueryParams, asyncHandler(async (req, res) => {
  if (!guard(res)) return;
  const p = req.parsedParams;
  const sortBy = req.query.sortBy || 'revenue';
  if (!['revenue', 'units', 'profit'].includes(sortBy)) {
    return res.status(400).json({ success: false, error: 'sortBy must be revenue|units|profit', data: null, meta: {} });
  }
  res.json(envelope(computeTopProducts({ ...p, sortBy })));
}));

// ─── PRODUCTS CATALOGUE ────────────────────────────────────────────────────
router.get('/products', validateQueryParams, asyncHandler(async (req, res) => {
  if (!guard(res)) return;
  const p = req.parsedParams;
  const result = getProductCatalogue({ ...p, sortBy: req.query.sortBy });
  res.json({ success: true, ...result });
}));

// ─── PRODUCT DETAIL ────────────────────────────────────────────────────────
router.get('/products/:productId', asyncHandler(async (req, res) => {
  if (!guard(res)) return;
  const store = getStore();
  const { productId } = req.params;
  if (!store.products.has(productId)) {
    return res.status(404).json({ success: false, error: `Product not found: ${productId}`, data: null, meta: {} });
  }
  const history = getProductHistory(productId, { groupBy: req.query.groupBy || 'month' });
  const prod = store.products.get(productId);
  res.json(envelope({ ...prod, ...history }));
}));

// ─── ORDERS STATUS ─────────────────────────────────────────────────────────
router.get('/analytics/orders-status', validateQueryParams, asyncHandler(async (req, res) => {
  if (!guard(res)) return;
  res.json(envelope(computeOrderStatus(req.parsedParams)));
}));

// ─── CUSTOMERS ─────────────────────────────────────────────────────────────
router.get('/customers', validateQueryParams, asyncHandler(async (req, res) => {
  if (!guard(res)) return;
  res.json(envelope(computeCustomerSummary(req.parsedParams)));
}));

// ─── RETURNS ───────────────────────────────────────────────────────────────
router.get('/returns', validateQueryParams, asyncHandler(async (req, res) => {
  if (!guard(res)) return;
  res.json(envelope(computeReturnsSummary(req.parsedParams)));
}));

// ─── DEMAND ────────────────────────────────────────────────────────────────
router.get('/demand', validateQueryParams, asyncHandler(async (req, res) => {
  if (!guard(res)) return;
  res.json(envelope(computeDemandTrend(req.parsedParams)));
}));

// ─── FORECAST ──────────────────────────────────────────────────────────────
router.get('/forecast', validateQueryParams, asyncHandler(async (req, res) => {
  if (!guard(res)) return;
  const { category } = req.query;
  const result = computeForecast({ category });
  res.json(envelope(result));
}));

export default router;
