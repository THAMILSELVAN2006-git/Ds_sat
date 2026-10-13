import { useCallback } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { RotateCcw, DollarSign, Percent, Clock } from 'lucide-react';
import { KpiCard, KpiGrid } from '../components/KpiCard';
import { ChartCard } from '../components/ChartCard';
import { DataTable } from '../components/DataTable';
import { SkeletonKpiGrid, SkeletonChart } from '../components/Skeleton';
import { ErrorState } from '../components/States';
import { useFetch } from '../hooks/useFetch';
import { fetchReturns } from '../services/api';
import { fmtNum, fmtCompact, fmtInt, fmtPct } from '../utils/formatters';

const COLORS = ['#4f8ef7','#7c5cfc','#34d399','#fbbf24','#f87171','#60a5fa','#a78bfa'];

export default function Returns() {
  const load = useCallback(() => fetchReturns(), []);
  const { data, loading, error, refetch } = useFetch(load, []);

  if (loading) return <div><SkeletonKpiGrid count={4} /><SkeletonChart /></div>;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  const rr = data.returnRates || {};
  const monthlyTrend = data.monthlyTrend || [];
  const byReason = data.byReason || [];
  const topProds = data.topProductsByReturns || [];
  const byCat = data.byCategoryReturns || [];
  const lag = data.returnLag || {};

  return (
    <div>
      <KpiGrid>
        <KpiCard label="Return Records" value={fmtInt(data.returnRecords)} sub="One line per return" icon={<RotateCcw size={18} color="#f87171" />} variant="danger" />
        <KpiCard label="Returned Orders" value={fmtInt(data.returnedOrders)} sub="Distinct orders" icon={<RotateCcw size={18} color="#fbbf24" />} variant="warning" />
        <KpiCard label="Total Refunds" value={fmtCompact(data.totalRefunds)} sub={fmtNum(data.totalRefunds)} icon={<DollarSign size={18} color="#f87171" />} variant="danger" mono />
        <KpiCard label="Return Rate (Orders)" value={fmtPct(rr.orderBasis?.rate)}
          sub={`${rr.orderBasis?.numerator} / ${fmtInt(rr.orderBasis?.denominator)}`}
          icon={<Percent size={18} color="#f87171" />} variant="danger"
          tooltip={rr.orderBasis?.label} />
        <KpiCard label="Return Rate (Items)" value={fmtPct(rr.itemBasis?.rate)}
          sub={`${rr.itemBasis?.numerator} / ${fmtInt(rr.itemBasis?.denominator)}`}
          tooltip={rr.itemBasis?.label} />
        <KpiCard label="Avg Return Lag" value={lag.avg ? `${lag.avg} days` : '—'}
          sub={`Range: ${lag.min ?? '?'}–${lag.max ?? '?'} days`}
          icon={<Clock size={18} color="#60a5fa" />}
          tooltip="Days from order_date to return_date" />
      </KpiGrid>

      {/* Return Rate Explainer */}
      <div style={{ padding: '14px 18px', background: 'rgba(79,142,247,0.07)', border: '1px solid rgba(79,142,247,0.2)', borderRadius: 'var(--radius-md)', marginBottom: 20, fontSize: 13 }}>
        <strong>Three Return Rate Definitions:</strong>
        <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 2, color: 'var(--color-text-secondary)' }}>
          <li><strong>Order basis:</strong> {fmtPct(rr.orderBasis?.rate)} = {rr.orderBasis?.numerator} returned orders / {fmtInt(rr.orderBasis?.denominator)} non-cancelled orders</li>
          <li><strong>Item basis:</strong> {fmtPct(rr.itemBasis?.rate)} = {rr.itemBasis?.numerator} return records / {fmtInt(rr.itemBasis?.denominator)} order lines (all-time)</li>
          <li><strong>Value basis:</strong> Refunds ÷ Gross Sales — see Overview KPI for filtered period</li>
        </ul>
      </div>

      {/* Limitations */}
      <div style={{ marginBottom: 20 }}>
        {(data.limitations || []).map((l, i) => (
          <div key={i} className="insight-item warning" style={{ marginBottom: 6 }}>
            <div className="insight-dot warning" />
            <span>{l}</span>
          </div>
        ))}
      </div>

      {/* Monthly Trend */}
      <ChartCard title="Monthly Returns Trend" subtitle="By return_date (not order_date)" className="chart-full">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={monthlyTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3650" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
            <YAxis yAxisId="l" tick={{ fontSize: 11, fill: '#64748b' }} />
            <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={fmtCompact} />
            <Tooltip contentStyle={{ background: '#1e2a40', border: '1px solid #374460', borderRadius: 8 }} formatter={(v, n) => [n === 'count' ? fmtInt(v) : fmtNum(v), n]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line yAxisId="l" type="monotone" dataKey="count" name="Returns" stroke="#f87171" strokeWidth={2} dot={false} />
            <Line yAxisId="r" type="monotone" dataKey="refunds" name="Refunds" stroke="#fbbf24" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="charts-row">
        {/* Return Reasons */}
        <ChartCard title="Return Reasons Breakdown">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={byReason} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis dataKey="reason" type="category" tick={{ fontSize: 10, fill: '#94a3b8' }} width={120} />
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3650" horizontal={false} />
              <Tooltip formatter={v => fmtInt(v)} contentStyle={{ background: '#1e2a40', border: '1px solid #374460', borderRadius: 8 }} />
              <Bar dataKey="count" name="Count" radius={[0,4,4,0]}>
                {byReason.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* By Category */}
        <ChartCard title="Returns by Category">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={byCat} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis dataKey="category" type="category" tick={{ fontSize: 10, fill: '#94a3b8' }} width={130} />
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3650" horizontal={false} />
              <Tooltip formatter={(v, n) => [n === 'count' ? fmtInt(v) : fmtNum(v), n]} contentStyle={{ background: '#1e2a40', border: '1px solid #374460', borderRadius: 8 }} />
              <Bar dataKey="count" name="Returns" fill="#f87171" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Top Products by Returns */}
      <ChartCard title="Top Products by Returns">
        <DataTable
          columns={[
            { key: 'product_id', label: 'ID', sortable: false },
            { key: 'product_name', label: 'Product' },
            { key: 'category', label: 'Category' },
            { key: 'count', label: 'Return Count', numeric: true, render: v => fmtInt(v) },
            { key: 'refunds', label: 'Refunds', numeric: true, render: v => fmtNum(v) },
          ]}
          rows={topProds}
        />
      </ChartCard>
      <p className="footnote warning">⚠ Currency not specified · Returns grain = one order line per record · 11 returns have return_date after 2025-12-31</p>
    </div>
  );
}
