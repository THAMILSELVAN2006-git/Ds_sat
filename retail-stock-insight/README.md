# Retail Stock Insight (RSI) 📊

A full-stack, data-grounded retail analytics dashboard built with **React 19 + Vite** (frontend) and **Node.js + Express** (backend).

Every single metric, card, chart, and table in this application is calculated dynamically from the five source CSV datasets loaded into memory at startup. No hardcoded KPIs, sample numbers, or mock predictions.

---

## 🌟 Key Architecture & Highlights

1. **In-Memory Analytical Engine**:
   - Zero database required; 5 CSV files (`customers.csv`, `products.csv`, `orders.csv`, `order_items.csv`, `returns.csv`) are ingested into indexed in-memory data structures at startup (~3 seconds total load time).
   - High-throughput cohort and basket aggregation directly from order items and order headers.

2. **Strict Financial & Metric Integrity**:
   - **Gross Sales** = `∑(order_items.line_total)` for non-cancelled orders ($45,420,250.67). Cancelled orders are strictly quarantined by default.
   - **Refunds** = Calculated using order cohort attribution ($2,289,755.42).
   - **Net Sales** = Gross Sales - Refunds ($43,130,495.25).
   - **Shipping Revenue** = Reported independently ($203,183.00) and never mixed with item merchandise values.
   - **COGS** = `∑(quantity × unit_cost)` ($22,015,395.83).
   - **Return Rate (Order Basis)** = `883 / 7,591 = 11.63%`.

3. **Domain Transparency & Edge-Case Flags**:
   - **Currency Disclaimer**: Currency symbol is omitted / neutral numbers used because the dataset does not specify a ISO currency code.
   - **Negative Margin Alert**: Identified `PROD0048` (*Fountain Pen Set*) with `unit_cost = 230` and `unit_price = 200` (-15.00% margin). Flagged with automated warning badges across Catalogue and Overview.
   - **Inventory Disclaimer**: "Stock-on-hand", reorders, and stockout alerts are deliberately omitted because the dataset lacks inventory snapshot fields. The demand page focuses on sales demand forecasting.
   - **Privacy Protection**: Customers are identified only by `customer_id`. PII columns (`first_name`, `last_name`, `email`, `age`, `gender`) are stripped at the loader boundary.

4. **Forecasting Engine (Demand & Forecast)**:
   - Evaluated weekly sales demand series using **Holt-Winters double exponential smoothing with damped trend** against **Naive** and **4-week Moving Average** baselines.
   - Full evaluation metrics computed on a strict out-of-sample test split: **MAE**, **RMSE**, **MAPE**, and **WAPE**.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js >= 18 (Tested on Node.js v24)
- npm >= 9

### Installation

Both server and client have their dependencies installed. If running fresh:
```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### Running the Application

In terminal 1 (start the Backend API):
```bash
cd server
npm start
# API starts at http://localhost:4000
```

In terminal 2 (start the Vite Frontend):
```bash
cd client
npm run dev
# Frontend runs at http://localhost:5173
```

Alternatively, from the project root:
```bash
npm run server       # Starts Express backend on port 4000
npm run client       # Starts Vite frontend on port 5173
npm run server:profile # Runs the dataset verification and profile assertions
npm test             # Runs the automated Jest API test suite
```

---

## 🧪 Automated Testing & Data Profiling

### 1. Data Profile & Invariant Assertions
To verify dataset integrity, line total math, subtotal math, and reference numbers:
```bash
cd server
npm run profile
```
All assertions pass with 100% precision:
- 600 Customers (594 with orders, 6 zero-order accounts)
- 8,000 Orders (6,708 Delivered, 721 Returned, 409 Cancelled, 162 Refunded)
- 16,418 Order items (all zero orphan foreign keys, line_totals match item formulas)
- 50 Products (1 negative margin product: PROD0048)
- 883 Returns (order lag 2–14 days)

### 2. Integration Test Suite
To run the automated backend test suite:
```bash
cd server
npm test
```
**Test Results**: 11 / 11 test suites passing across all REST API endpoints.

---

## 📡 REST API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | System status and dataset load timestamp |
| `/api/metadata` | GET | Row counts, date ranges, data quality limits, currency notices |
| `/api/dashboard/summary` | GET | Financial KPIs, categories, top products, trend (supports filters) |
| `/api/analytics/sales-trend`| GET | Time-series sales trend (day, week, month) |
| `/api/analytics/categories` | GET | Revenue, units, profit, and margin per product category |
| `/api/analytics/top-products`| GET | Top products ranked by revenue, units, or profit |
| `/api/products` | GET | Paginated, searchable catalogue with margin warnings |
| `/api/products/:productId` | GET | Product detail and historical monthly sales breakdown |
| `/api/customers` | GET | Distribution, tiers, channels, regions, zero-order customers |
| `/api/returns` | GET | Return rates (order and item basis), reasons, product return counts |
| `/api/demand` | GET | Historical weekly demand and month-of-year seasonality |
| `/api/forecast` | GET | Holt-Winters damped-trend forecast vs baselines with evaluation metrics |

---

## 🎨 Frontend Pages & Features

1. **Overview**: Executive summary with KPIs, 24-month gross vs net sales area chart, category share, order status distribution, top products table, and real-time data insights.
2. **Sales Analytics**: Deep filter bar (date range, category, region, payment method, cancelled toggle), comparative charts, and margin indicators.
3. **Product Catalogue**: Full 50-item table with sorting, search, pagination, negative margin pill, low margin pill, and expandable per-product historical trend.
4. **Customer Analytics**: Privacy-safe insights (tier breakdown, channel distribution, region maps, orders-per-customer distribution, and list of 6 zero-order accounts).
5. **Returns Analysis**: Explanations and calculations for all 3 return rate formulas, return lag statistics (2–14 days), return reasons breakdown, and category return volumes.
6. **Demand & Forecast**: Weekly unit demand timeline, seasonality heatmap, Holt-Winters 8-week forward forecast, baseline benchmarks, and MAE/RMSE/MAPE/WAPE error scores.
