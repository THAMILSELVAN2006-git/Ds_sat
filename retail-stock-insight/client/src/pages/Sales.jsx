import { useState, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import { ChartCard } from '../components/ChartCard';
import { DataTable } from '../components/DataTable';
import { KpiCard, KpiGrid } from '../components/KpiCard';
import { SkeletonKpiGrid, SkeletonChart } from '../components/Skeleton';
import { ErrorState, EmptyState } from '../components/States';
import { useFetch } from '../hooks/useFetch';
import { fetchSalesTrend, fetchCategories, fetchTopProducts } from '../services/api';
import { fmtNum, fmtCompact, fmtInt, fmtPct, fmtAxisLabel } from '../utils/formatters';

const COLORS = ['#4f8ef7','#7c5cfc','#34d399','#fbbf24','#f87171','#60a5fa'];
const CATEGORIES = ['Electronics','Fashion','Home & Kitchen','Beauty & Personal Care','Sports & Fitness','Books & Stationery'];
const PAYMENT_METHODS = ['Credit Card','Debit Card','UPI','Net Banking','Wallet','Cash on Delivery'];
const REGIONS = ['APAC','North America','Europe','Middle East'];

export default function Sales() {
  const [groupBy, setGroupBy] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [category, setCategory] = useState('');
  const [region, setRegion] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [sortBy, setSortBy] = useState('revenue');
  const [search, setSearch] = useState('');
  const [includeCancelled, setIncludeCancelled] = useState(false);

  const buildParams = () => ({
    groupBy, startDate: startDate || undefined, endDate: endDate || undefined,
    category: category || undefined, region: region || undefined,
    paymentMethod: paymentMethod || undefined,
    includeCancelled: includeCancelled || undefined,
  });

  const loadTrend = useCallback(() => fetchSalesTrend(buildParams()), [groupBy, startDate, endDate, category, region, paymentMethod, includeCancelled]);
  const loadCats = useCallback(() => fetchCategories(buildParams()), [startDate, endDate, region, includeCancelled]);
  const loadTop = useCallback(() => fetchTopProducts({ ...buildParams(), sortBy, limit: 15, search: search || undefined }), [sortBy, startDate, endDate, category, region, includeCancelled, search]);

  const { data: trendData, loading: tLoading, error: tError, refetch: refetchTrend } = useFetch(loadTrend, [groupBy, startDate, endDate, category, region, paymentMethod, includeCancelled]);
  const { data: catData, loading: cLoading, error: cError } = useFetch(loadCats, [startDate, endDate, region, includeCancelled]);
  const { data: topData, loading: pLoading, error: pError } = useFetch(loadTop, [sortBy, startDate, endDate, category, region, includeCancelled, search]);

  const trend = trendData?.data || [];
  const cats = catData || [];
  const topProds = topData || [];

  // Summary KPIs from trend data
  const grossSales = trend.reduce((a, b) => a + b.grossSales, 0);
  const netSales = trend.reduce((a, b) => a + b.netSales, 0);
  const units = trend.reduce((a, b) => a + b.units, 0);
  const orders = trend.reduce((a, b) => a + b.orders, 0);

  return (
    <div>
      {/* Filters */}
      <div className="filters-bar">
        <div className="filter-group">
          <label className="filter-label" htmlFor="sales-start">Start Date</label>
          <input id="sales-start" type="date" className="filter-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="sales-end">End Date</label>
          <input id="sales-end" type="date" className="filter-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="sales-cat">Category</label>
          <select id="sales-cat" className="filter-select" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="sales-region">Region</label>
          <select id="sales-region" className="filter-select" value={region} onChange={e => setRegion(e.target.value)}>
            <option value="">All Regions</option>
            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="sales-pm">Payment</label>
          <select id="sales-pm" className="filter-select" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
            <option value="">All Methods</option>
            {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">
            <input type="checkbox" checked={includeCancelled} onChange={e => setIncludeCancelled(e.target.checked)} style={{ marginRight: 6 }} />
            Incl. Cancelled
          </label>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => { setStartDate(''); setEndDate(''); setCategory(''); setRegion(''); setPaymentMethod(''); setIncludeCancelled(false); }}>
          Reset
        </button>
      </div>

      {/* KPI strip */}
      <KpiGrid>
        <KpiCard label="Gross Sales" value={fmtCompact(grossSales)} sub={fmtNum(grossSales)} mono />
        <KpiCard label="Net Sales" value={fmtCompact(netSales)} variant="success" mono />
        <KpiCard label="Orders" value={fmtInt(orders)} />
        <KpiCard label="Units" value={fmtInt(units)} />
      </KpiGrid>

      {/* Trend Chart */}
      <ChartCard
        title="Revenue & Units Over Time"
        subtitle={`Group by ${groupBy} · Gross sales = SUM(line_total) for non-cancelled`}
        className="chart-full"
        controls={
          <div className="toggle-group">
            {['day','week','month'].map(g => (
              <button key={g} className={`toggle-btn ${groupBy === g ? 'active' : ''}`} onClick={() => setGroupBy(g)}>{g}</button>
            ))}
          </div>
        }
      >
        {tLoading ? <SkeletonChart /> : tError ? <ErrorState message={tError} onRetry={refetchTrend} /> : trend.length === 0 ? <EmptyState /> : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f8ef7" stopOpacity={0.3} /><stop offset="95%" stopColor="#4f8ef7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3650" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => fmtAxisLabel(v, groupBy)} interval="preserveStartEnd" />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={fmtCompact} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip formatter={(v, n) => [n === 'units' ? fmtInt(v) : fmtNum(v), n]} labelFormatter={l => fmtAxisLabel(l, groupBy)} contentStyle={{ background: '#1e2a40', border: '1px solid #374460', borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area yAxisId="left" type="monotone" dataKey="grossSales" name="Gross Sales" stroke="#4f8ef7" fill="url(#sg)" strokeWidth={2} dot={false} />
              <Bar yAxisId="right" dataKey="units" name="Units" fill="#7c5cfc" opacity={0.7} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <div className="charts-row">
        {/* Category comparison */}
        <ChartCard title="Category Comparison" subtitle="Gross & net sales by category">
          {cLoading ? <SkeletonChart height={220} /> : cError ? <ErrorState message={cError} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={cats} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3650" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={fmtCompact} />
                <YAxis dataKey="category" type="category" tick={{ fontSize: 10, fill: '#94a3b8' }} width={120} />
                <Tooltip formatter={(v) => fmtNum(v)} contentStyle={{ background: '#1e2a40', border: '1px solid #374460', borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="grossSales" name="Gross" fill="#4f8ef7" radius={[0,3,3,0]} />
                <Bar dataKey="netSales" name="Net" fill="#34d399" radius={[0,3,3,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Category margin */}
        <ChartCard title="Category Margin %" subtitle="(Gross sales - COGS) / Gross sales">
          {cLoading ? <SkeletonChart height={220} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={cats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3650" />
                <XAxis dataKey="category" tick={{ fontSize: 9, fill: '#64748b' }} />
                <YAxis tickFormatter={v => `${(v*100).toFixed(0)}%`} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip formatter={(v) => fmtPct(v)} contentStyle={{ background: '#1e2a40', border: '1px solid #374460', borderRadius: 8 }} />
                <Bar dataKey="margin" name="Margin" radius={[4,4,0,0]}>
                  {cats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Top Products */}
      <ChartCard
        title="Top Products"
        subtitle="Sortable by revenue, units, or profit"
        controls={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input placeholder="Search product..." className="filter-input" style={{ width: 160 }}
              value={search} onChange={e => setSearch(e.target.value)} id="sales-search" aria-label="Search products" />
            <div className="toggle-group">
              {['revenue','units','profit'].map(s => (
                <button key={s} className={`toggle-btn ${sortBy === s ? 'active' : ''}`} onClick={() => setSortBy(s)}>{s}</button>
              ))}
            </div>
          </div>
        }
      >
        {pLoading ? <SkeletonChart height={200} /> : pError ? <ErrorState message={pError} /> : (
          <DataTable
            columns={[
              { key: 'product_name', label: 'Product', render: (v, row) => <span>{row.negative_margin ? '⚠ ' : ''}{v}</span> },
              { key: 'category', label: 'Category' },
              { key: 'grossSales', label: 'Gross Sales', numeric: true, render: v => fmtNum(v) },
              { key: 'units', label: 'Units', numeric: true, render: v => fmtInt(v) },
              { key: 'grossProfit', label: 'Gross Profit', numeric: true, render: v => fmtNum(v) },
              { key: 'margin', label: 'Margin', numeric: true, render: v => fmtPct(v) },
              { key: 'returns', label: 'Returns', numeric: true, render: v => fmtInt(v) },
            ]}
            rows={topProds}
          />
        )}
      </ChartCard>
      <p className="footnote warning">⚠ Currency not specified in dataset. All monetary values are neutral numbers.</p>
    </div>
  );
}
