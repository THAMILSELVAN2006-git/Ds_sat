import request from 'supertest';
import app from '../src/app.js';
import { loadAllData } from '../src/services/csvLoader.js';

beforeAll(async () => {
  // Ensure in-memory data store is fully loaded before running tests
  await loadAllData();
}, 30000);

describe('Retail Stock Insight API Integration Tests', () => {
  describe('GET /api/health', () => {
    it('returns 200 with status ok and data loaded', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ok');
      expect(res.body.data.loaded).toBe(true);
    });
  });

  describe('GET /api/metadata', () => {
    it('returns exact dataset row counts and data quality assertions', async () => {
      const res = await request(app).get('/api/metadata');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const { rowCounts, orderDateRange, negativeMarginProducts, orderStatusCounts, customersWithNoOrders } = res.body.data;
      expect(rowCounts.customers).toBe(600);
      expect(rowCounts.orders).toBe(8000);
      expect(rowCounts.orderItems).toBe(16418);
      expect(rowCounts.products).toBe(50);
      expect(rowCounts.returns).toBe(883);

      expect(orderDateRange.start).toBe('2024-01-01');
      expect(orderDateRange.end).toBe('2025-12-31');

      expect(orderStatusCounts.Delivered).toBe(6708);
      expect(orderStatusCounts.Returned).toBe(721);
      expect(orderStatusCounts.Cancelled).toBe(409);
      expect(orderStatusCounts.Refunded).toBe(162);

      expect(customersWithNoOrders).toBe(6);
      expect(negativeMarginProducts.length).toBe(1);
      expect(negativeMarginProducts[0].product_id).toBe('PROD0048');
    });
  });

  describe('GET /api/dashboard/summary', () => {
    it('returns exact financial KPIs excluding cancelled orders by default', async () => {
      const res = await request(app).get('/api/dashboard/summary');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const summary = res.body.data.summary;
      expect(summary.grossSales).toBeCloseTo(45420250.67, 1);
      expect(summary.orders).toBe(7591);
      expect(summary.unitsSold).toBe(21558);
      expect(summary.refunds).toBeCloseTo(2289755.42, 1);
      expect(summary.netSales).toBeCloseTo(43130495.25, 1);
      expect(summary.cogs).toBeCloseTo(22015395.83, 1);
      expect(summary.shippingRevenue).toBe(203183);
      expect(summary.cancelled.orders).toBe(409);
    });

    it('returns gross sales including cancelled orders when requested', async () => {
      const res = await request(app).get('/api/dashboard/summary?includeCancelled=true');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const summary = res.body.data.summary;
      expect(summary.grossSales).toBeCloseTo(47948379.75, 1);
      expect(summary.orders).toBe(8000);
      expect(summary.unitsSold).toBe(22689);
    });
  });

  describe('GET /api/analytics/sales-trend', () => {
    it('returns 24 monthly buckets for 2024-2025', async () => {
      const res = await request(app).get('/api/analytics/sales-trend?groupBy=month');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.data)).toBe(true);
      expect(res.body.data.data.length).toBe(24);
      expect(res.body.data.data[0].label).toBe('2024-01');
      expect(res.body.data.data[23].label).toBe('2025-12');
    });
  });

  describe('GET /api/analytics/categories', () => {
    it('returns all 6 categories with correct gross sales figures', async () => {
      const res = await request(app).get('/api/analytics/categories');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(6);

      const electronics = res.body.data.find(c => c.category === 'Electronics');
      expect(electronics).toBeDefined();
      expect(electronics.grossSales).toBeCloseTo(11770997.36, 1);
    });
  });

  describe('GET /api/analytics/top-products', () => {
    it('returns top products sorted by revenue and rejects invalid sortBy', async () => {
      const okRes = await request(app).get('/api/analytics/top-products?sortBy=revenue');
      expect(okRes.status).toBe(200);
      expect(okRes.body.success).toBe(true);
      expect(okRes.body.data.length).toBeGreaterThan(0);

      const errRes = await request(app).get('/api/analytics/top-products?sortBy=unknown');
      expect(errRes.status).toBe(400);
      expect(errRes.body.success).toBe(false);
    });
  });

  describe('GET /api/products and /api/products/:productId', () => {
    it('returns paginated catalogue and handles specific product lookup', async () => {
      const catRes = await request(app).get('/api/products?limit=50');
      expect(catRes.status).toBe(200);
      expect(catRes.body.success).toBe(true);
      expect(catRes.body.meta.total).toBe(50);
      expect(catRes.body.data.length).toBe(50);

      const prodRes = await request(app).get('/api/products/PROD0048');
      expect(prodRes.status).toBe(200);
      expect(prodRes.body.success).toBe(true);
      expect(prodRes.body.data.product_name).toBe('Fountain Pen Set');
      expect(prodRes.body.data.margin_pct).toBeLessThan(0);

      const notFoundRes = await request(app).get('/api/products/NONEXISTENT');
      expect(notFoundRes.status).toBe(404);
      expect(notFoundRes.body.success).toBe(false);
    });
  });

  describe('GET /api/customers', () => {
    it('returns privacy-safe customer stats and metrics without PII', async () => {
      const res = await request(app).get('/api/customers');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.uniqueCustomers).toBe(593);
      expect(data.customersWithNoOrders).toBe(6);
      expect(data.customersWithNoOrdersList.length).toBe(6);

      // Verify no PII fields leaked
      for (const c of data.customersWithNoOrdersList) {
        expect(c.first_name).toBeUndefined();
        expect(c.last_name).toBeUndefined();
        expect(c.email).toBeUndefined();
        expect(c.age).toBeUndefined();
        expect(c.customer_id).toBeDefined();
      }
    });
  });

  describe('GET /api/returns', () => {
    it('returns return rate metrics and reasons breakdown', async () => {
      const res = await request(app).get('/api/returns');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.returnRecords).toBe(883);
      expect(data.returnRates.orderBasis.rate).toBeCloseTo(0.1163, 2);
      expect(Array.isArray(data.byReason)).toBe(true);
      expect(data.byReason.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/demand and /api/forecast', () => {
    it('returns historical demand and Holt-Winters forecast with real metrics', async () => {
      const demandRes = await request(app).get('/api/demand');
      expect(demandRes.status).toBe(200);
      expect(demandRes.body.success).toBe(true);
      expect(Array.isArray(demandRes.body.data.data)).toBe(true);

      const fcRes = await request(app).get('/api/forecast');
      expect(fcRes.status).toBe(200);
      expect(fcRes.body.success).toBe(true);

      const fc = fcRes.body.data;
      expect(fc.total).toBeDefined();
      expect(Array.isArray(fc.total.forecast)).toBe(true);
      expect(fc.total.forecast.length).toBe(8); // 8-week horizon
      expect(fc.total.evaluation).toBeDefined();
      expect(typeof fc.total.evaluation.holtwinters.mae).toBe('number');
      expect(typeof fc.total.evaluation.holtwinters.rmse).toBe('number');
      expect(typeof fc.total.evaluation.holtwinters.mape).toBe('number');
      expect(typeof fc.total.evaluation.holtwinters.wape).toBe('number');
    });
  });
});
