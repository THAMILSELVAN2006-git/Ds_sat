import { useState, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { DollarSign, ShoppingCart, Package, Users, TrendingUp, RotateCcw, Percent, Truck } from 'lucide-react';
import { KpiCard, KpiGrid } from '../components/KpiCard';
import { ChartCard } from '../components/ChartCard';
import { DataTable } from '../components/DataTable';
import { SkeletonKpiGrid, SkeletonChart } from '../components/Skeleton';
import { ErrorState } from '../components/States';
import { useFetch } from '../hooks/useFetch';
import { fetchDashboardSummary } from '../services/api';
import { fmtCompact, fmtNum, fmtPct, fmtInt, fmtAxisLabel } from '../utils/formatters';

const COLORS = ['#4f8ef7','#7c5cfc','#34d399','#fbbf24','#f87171','#60a5fa'];
const STATUS_COLORS = { Delivered: '#34d399', Returned: '#fbbf24', Cancelled: '#f87171', Refunded: '#60a5fa' };

export default function Overview() {
  const [groupBy, setGroupBy] = useState('month');

  const load = useCallback(
    () => fetchDashboardSummary({ groupBy }),
    [groupBy]
  );
  const { data, loading, error, refetch } = useFetch(load, [groupBy]);

  const summary = data?.summary;
  const trend = data?.salesTrend?.data || [];
  const categories = data?.categories || [];
  const topProducts = data?.topProducts || [];
  const orderStatus = data?.orderStatus || [];

  if (loading) return (
    <div>
      <SkeletonKpiGrid count={8} />
      <div className="charts-row"><SkeletonChart /><SkeletonChart /></div>
    </div>
  );
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!summary) return null;

  const rr = summary.returnRates;

  return (
    <div>
      <KpiGrid>
        <KpiCard label="Gross Sales" value={fmtCompact(summary.grossSales)} sub={`${fmtNum(summary.grossSales)} total`} icon={<DollarSign size={18} color="#4f8ef7" />} mono />
        <KpiCard label="Net Sales" value={fmtCompact(summary.netSales)} sub={`After ${fmtCompact(summary.refunds)} refunds`} icon={<TrendingUp size={18} color="#34d399" />} variant="success" mono />
        <KpiCard label="Gross Profit" value={fmtCompact(summary.grossProfit)} sub={`Margin ${fmtPct(summary.grossProfit / summary.grossSales)}`} icon={<TrendingUp size={18} color="#7c5cfc" />} mono />
        <KpiCard label="Orders" value={fmtInt(summary.orders)} sub={`${fmtInt(summary.cancelled?.orders)} cancelled excluded`} icon={<ShoppingCart size={18} color="#fbbf24" />} variant="warning" />
        <KpiCard label="Units Sold" value={fmtInt(summary.unitsSold)} sub="Non-cancelled orders" icon={<Package size={18} color="#60a5fa" />} />
        <KpiCard label="Avg Order Value" value={fmtCompact(summary.aov)} sub="Gross sales ÷ orders" icon={<DollarSign size={18} color="#f87171" />}
          tooltip="AOV = Gross sales (item-level) / Distinct non-cancelled order count" />
        <KpiCard label="Unique Customers" value={fmtInt(summary.uniqueCustomers)} sub="Non-cancelled orders" icon={<Users size={18} color="#34d399" />} variant="success" />
        <KpiCard label="Return Rate" value={fmtPct(rr?.orderBasis?.rate)}
          sub={`${fmtInt(rr?.orderBasis?.numerator)} of ${fmtInt(rr?.orderBasis?.denominator)} orders`}
          icon={<RotateCcw size={18} color="#f87171" />} variant="danger"
          tooltip={`Order basis: ${rr?.orderBasis?.label}\nItem basis: ${fmtPct(rr?.itemBasis?.rate)} (${rr?.itemBasis?.numerator}/${rr?.itemBasis?.denominator})\nValue basis: ${fmtPct(rr?.valueBasis?.rate)} (${fmtCompact(rr?.valueBasis?.numerator)}/${fmtCompact(rr?.valueBasis?.denominator)})`} />
      </KpiGrid>

      {/* Shipping + COGS highlight */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <div className="kpi-card" style={{ flex: 1 }}>
          <div className="kpi-icon"><Truck size={16} color="#60a5fa" /></div>
          <div className="kpi-label">Shipping Revenue</div>
          <div className="kpi-value mono">{fmtNum(summary.shippingRevenue)}</div>
          <div className="kpi-sub">Reported separately — not in gross sales</div>
        </div>
        <div className="kpi-card" style={{ flex: 1 }}>
          <div className="kpi-icon"><Package size={16} color="#fbbf24" /></div>
          <div className="kpi-label">COGS</div>
          <div className="kpi-value mono">{fmtCompact(summary.cogs)}</div>
          <div className="kpi-sub">SUM(qty × unit_cost); discounts inside line_total</div>
        </div>
        <div className="kpi-card" style={{ flex: 1 }}>
          <div className="kpi-icon"><Percent size={16} color="#f87171" /></div>
          <div className="kpi-label">Item Return Rate</div>
          <div className="kpi-value mono">{fmtPct(rr?.itemBasis?.rate)}</div>
          <div className="kpi-sub">{rr?.itemBasis?.numerator} records / {fmtInt(rr?.itemBasis?.denominator)} lines</div>
        </div>
      </div>

      {/* Sales Trend */}
      <ChartCard
        title="Sales Trend"
        subtitle={`${data.salesTrend?.refundAttributionNote}`}
        className="chart-full"
        controls={
          <div className="toggle-group">
            {['day','week','month'].map(g => (
              <button key={g} className={`toggle-btn ${groupBy === g ? 'active' : ''}`}
                onClick={() => setGroupBy(g)} aria-label={`Group by ${g}`}>
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
        }
      >
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={trend} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="cgross" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4f8ef7" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#4f8ef7" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="cnet" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3650" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => fmtAxisLabel(v, groupBy)} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => fmtCompact(v)} />
            <Tooltip
              formatter={(v, name) => [fmtNum(v), name]}
              labelFormatter={l => fmtAxisLabel(l, groupBy)}
              contentStyle={{ background: '#1e2a40', border: '1px solid #374460', borderRadius: 8 }}
              itemStyle={{ color: '#94a3b8' }}
              labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="grossSales" name="Gross Sales" stroke="#4f8ef7" fill="url(#cgross)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="netSales" name="Net Sales" stroke="#34d399" fill="url(#cnet)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="charts-row">
        {/* Category Breakdown */}
        <ChartCard title="Category Performance" subtitle="Gross sales by category (non-cancelled)">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={categories} layout="vertical" margin={{ left: 0, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3650" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => fmtCompact(v)} />
              <YAxis dataKey="category" type="category" tick={{ fontSize: 11, fill: '#94a3b8' }} width={130} />
              <Tooltip formatter={(v) => fmtNum(v)} contentStyle={{ background: '#1e2a40', border: '1px solid #374460', borderRadius: 8 }} labelStyle={{ color: '#f1f5f9' }} itemStyle={{ color: '#94a3b8' }} />
              <Bar dataKey="grossSales" name="Gross Sales" radius={[0, 4, 4, 0]}>
                {categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Order Status Pie */}
        <ChartCard title="Order Status Distribution" subtitle="All 4 statuses including Cancelled">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={orderStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={90} paddingAngle={3} label={({ status, percent }) => `${status} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {orderStatus.map((entry, i) => (
                  <Cell key={i} fill={STATUS_COLORS[entry.status] || COLORS[i]} />
                ))}
              </Pie>
              <Tooltip formatter={(v, n) => [fmtInt(v), n]} contentStyle={{ background: '#1e2a40', border: '1px solid #374460', borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Top Products Table */}
      <ChartCard title="Top 5 Products" subtitle="By gross sales (non-cancelled)">
        <DataTable
          columns={[
            { key: 'product_id', label: 'ID', sortable: false },
            { key: 'product_name', label: 'Product' },
            { key: 'category', label: 'Category' },
            { key: 'grossSales', label: 'Gross Sales', numeric: true, render: v => fmtNum(v) },
            { key: 'units', label: 'Units', numeric: true, render: v => fmtInt(v) },
            { key: 'grossProfit', label: 'Gross Profit', numeric: true, render: v => fmtNum(v) },
            { key: 'negative_margin', label: 'Flag', render: (v) => v ? <span className="badge badge-danger">⚠ Neg. Margin</span> : null },
          ]}
          rows={topProducts}
        />
      </ChartCard>

      {/* Insights */}
      <div style={{ marginTop: 20 }}>
        <div className="section-title">Key Insights</div>
        <div className="insight-list">
          <div className="insight-item success">
            <div className="insight-dot success" />
            <span>Electronics leads with <strong>{fmtCompact(categories[0]?.grossSales)}</strong> gross sales, followed by Fashion ({fmtCompact(categories[1]?.grossSales)}).</span>
          </div>
          <div className="insight-item warning">
            <div className="insight-dot warning" />
            <span>Return rate is <strong>{fmtPct(rr?.orderBasis?.rate)}</strong> on order basis. <strong>883 returns</strong> on {fmtInt(rr?.orderBasis?.denominator)} non-cancelled orders.</span>
          </div>
          <div className="insight-item warning">
            <div className="insight-dot warning" />
            <span>PROD0048 <strong>Fountain Pen Set</strong> has a negative margin (unit_cost &gt; unit_price). Immediate review recommended.</span>
          </div>
          <div className="insight-item info">
            <div className="insight-dot" />
            <span>Cancelled orders (<strong>{fmtInt(summary.cancelled?.orders)}</strong>) excluded from all metrics. Cancelled gross sales: <strong>{fmtCompact(summary.cancelled?.grossSales)}</strong>.</span>
          </div>
          <div className="insight-item info">
            <div className="insight-dot" />
            <span>Shipping revenue (<strong>{fmtNum(summary.shippingRevenue)}</strong>) is reported separately and never included in item-level sales metrics.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
