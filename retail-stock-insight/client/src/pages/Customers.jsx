import { useCallback } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Users, ShoppingCart, DollarSign, TrendingUp } from 'lucide-react';
import { KpiCard, KpiGrid } from '../components/KpiCard';
import { ChartCard } from '../components/ChartCard';
import { DataTable } from '../components/DataTable';
import { SkeletonKpiGrid, SkeletonChart } from '../components/Skeleton';
import { ErrorState } from '../components/States';
import { useFetch } from '../hooks/useFetch';
import { fetchCustomers } from '../services/api';
import { fmtNum, fmtInt, fmtCompact } from '../utils/formatters';

const COLORS = ['#4f8ef7','#7c5cfc','#34d399','#fbbf24','#f87171','#60a5fa','#a78bfa','#fb923c'];
const TIER_COLORS = { Gold: '#fbbf24', Platinum: '#94a3b8', Silver: '#60a5fa', Standard: '#34d399' };

export default function Customers() {
  const load = useCallback(() => fetchCustomers(), []);
  const { data, loading, error, refetch } = useFetch(load, []);

  if (loading) return <div><SkeletonKpiGrid count={4} /><SkeletonChart /></div>;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  const tierData = data.byMembershipTier || [];
  const channelData = data.byAcquisitionChannel || [];
  const regionData = data.byRegion || [];
  const countryData = data.byCountry || [];
  const distData = data.ordersPerCustomerDist || [];

  return (
    <div>
      <KpiGrid>
        <KpiCard label="Unique Customers" value={fmtInt(data.uniqueCustomers)} sub="Non-cancelled orders" icon={<Users size={18} color="#4f8ef7" />} />
        <KpiCard label="Avg Orders / Customer" value={fmtNum(data.avgOrdersPerCustomer, 1)} icon={<ShoppingCart size={18} color="#34d399" />} variant="success" />
        <KpiCard label="New Customers" value={fmtInt(data.newCustomers)} sub="1 order only" icon={<TrendingUp size={18} color="#fbbf24" />} variant="warning" />
        <KpiCard label="Repeat Customers" value={fmtInt(data.repeatCustomers)} sub="2+ orders" icon={<TrendingUp size={18} color="#7c5cfc" />} />
        <KpiCard label="Customers w/ No Orders" value={fmtInt(data.customersWithNoOrders)} sub="In dataset, never ordered" variant="danger" />
      </KpiGrid>

      <div style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--color-text-secondary)' }}>
        🔒 <strong>Privacy:</strong> PII (name, email, age, gender) excluded from all views. Customers identified by customer_id only.
      </div>

      <div className="charts-row">
        {/* Orders per customer distribution */}
        <ChartCard title="Orders per Customer Distribution" subtitle="How many orders each customer placed">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={distData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3650" />
              <XAxis dataKey="orders" tick={{ fontSize: 11, fill: '#64748b' }} label={{ value: 'Orders', position: 'insideBottom', offset: -3, fill: '#64748b', fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip contentStyle={{ background: '#1e2a40', border: '1px solid #374460', borderRadius: 8 }} formatter={v => [fmtInt(v), 'Customers']} />
              <Bar dataKey="count" name="Customers" fill="#4f8ef7" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Membership Tier */}
        <ChartCard title="Membership Tier" subtitle="Customers by tier">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={tierData} dataKey="count" nameKey="tier" cx="50%" cy="50%" outerRadius={85} paddingAngle={3}
                label={({ tier, percent }) => `${tier} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                {tierData.map((entry, i) => <Cell key={i} fill={TIER_COLORS[entry.tier] || COLORS[i]} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [fmtInt(v), n]} contentStyle={{ background: '#1e2a40', border: '1px solid #374460', borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="charts-row">
        {/* By Region */}
        <ChartCard title="Customers by Region">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={regionData} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis dataKey="region" type="category" tick={{ fontSize: 11, fill: '#94a3b8' }} width={110} />
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3650" horizontal={false} />
              <Tooltip formatter={v => fmtInt(v)} contentStyle={{ background: '#1e2a40', border: '1px solid #374460', borderRadius: 8 }} />
              <Bar dataKey="count" name="Customers" fill="#7c5cfc" radius={[0,4,4,0]}>
                {regionData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Acquisition Channel */}
        <ChartCard title="Acquisition Channel">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={channelData} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis dataKey="channel" type="category" tick={{ fontSize: 10, fill: '#94a3b8' }} width={110} />
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3650" horizontal={false} />
              <Tooltip formatter={v => fmtInt(v)} contentStyle={{ background: '#1e2a40', border: '1px solid #374460', borderRadius: 8 }} />
              <Bar dataKey="count" name="Customers" radius={[0,4,4,0]}>
                {channelData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Top Customers by Revenue */}
      <ChartCard title="Top 20 Customers by Revenue" subtitle="Identified by customer_id only · No PII">
        <DataTable
          columns={[
            { key: 'customer_id', label: 'Customer ID', render: v => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{v}</span> },
            { key: 'grossSales', label: 'Gross Sales', numeric: true, render: v => fmtNum(v) },
            { key: 'orders', label: 'Orders', numeric: true, render: v => fmtInt(v) },
            { key: 'city', label: 'City' },
            { key: 'country', label: 'Country' },
            { key: 'membership_tier', label: 'Tier', render: v => <span className={`badge badge-${v === 'Gold' ? 'warning' : v === 'Platinum' ? 'muted' : 'primary'}`}>{v}</span> },
          ]}
          rows={data.topCustomers || []}
        />
      </ChartCard>

      {/* By Country */}
      <ChartCard title="Customers by Country" subtitle="8 countries in dataset">
        <DataTable
          columns={[
            { key: 'country', label: 'Country' },
            { key: 'count', label: 'Customers', numeric: true, render: v => fmtInt(v) },
            { key: 'count', label: 'Share', render: (v) => {
              const pct = data.uniqueCustomers > 0 ? v / data.uniqueCustomers : 0;
              return <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="progress-bar" style={{ width: 80 }}>
                  <div className="progress-fill" style={{ width: `${pct*100}%` }} />
                </div>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{(pct*100).toFixed(1)}%</span>
              </div>;
            }},
          ]}
          rows={countryData}
        />
      </ChartCard>

      {/* Customers with no orders */}
      {data.customersWithNoOrdersList?.length > 0 && (
        <ChartCard title={`Customers with No Orders (${data.customersWithNoOrders})`} subtitle="These customers exist in the dataset but have never placed an order">
          <DataTable
            columns={[
              { key: 'customer_id', label: 'Customer ID' },
              { key: 'city', label: 'City' },
              { key: 'country', label: 'Country' },
              { key: 'region', label: 'Region' },
              { key: 'membership_tier', label: 'Tier' },
            ]}
            rows={data.customersWithNoOrdersList}
          />
        </ChartCard>
      )}
    </div>
  );
}
