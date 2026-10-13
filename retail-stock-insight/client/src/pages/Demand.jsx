import { useState, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';
import { ChartCard } from '../components/ChartCard';
import { SkeletonChart } from '../components/Skeleton';
import { ErrorState, EmptyState } from '../components/States';
import { useFetch } from '../hooks/useFetch';
import { fetchDemand, fetchForecast } from '../services/api';
import { fmtInt, fmtNum, fmtAxisLabel } from '../utils/formatters';

const CATEGORIES = ['Electronics','Fashion','Home & Kitchen','Beauty & Personal Care','Sports & Fitness','Books & Stationery'];
const CAT_COLORS = {
  'Electronics': '#4f8ef7', 'Fashion': '#7c5cfc', 'Home & Kitchen': '#34d399',
  'Beauty & Personal Care': '#fbbf24', 'Sports & Fitness': '#f87171', 'Books & Stationery': '#60a5fa',
};

export default function Demand() {
  const [groupBy, setGroupBy] = useState('week');
  const [category, setCategory] = useState('');
  const [fcCategory, setFcCategory] = useState('');

  const loadDemand = useCallback(
    () => fetchDemand({ groupBy, category: category || undefined }),
    [groupBy, category]
  );
  const loadForecast = useCallback(
    () => fetchForecast({ category: fcCategory || undefined }),
    [fcCategory]
  );

  const { data: demandData, loading: dLoading, error: dError, refetch: refetchDemand } = useFetch(loadDemand, [groupBy, category]);
  const { data: fcData, loading: fLoading, error: fError, refetch: refetchFc } = useFetch(loadForecast, [fcCategory]);

  const demand = demandData?.data || [];
  const seasonal = demandData?.seasonality || [];

  // Forecast series
  const fcSeries = fcCategory
    ? fcData?.series || fcData?.byCategory?.[fcCategory]?.series || []
    : fcData?.total?.series || [];
  const fcForecast = fcCategory
    ? fcData?.forecast || fcData?.byCategory?.[fcCategory]?.forecast || []
    : fcData?.total?.forecast || [];
  const fcTest = fcCategory
    ? fcData?.test || fcData?.byCategory?.[fcCategory]?.test
    : fcData?.total?.test;
  const fcEval = fcCategory
    ? fcData?.evaluation || fcData?.byCategory?.[fcCategory]?.evaluation
    : fcData?.total?.evaluation;
  const fcTrain = fcCategory
    ? fcData?.train || fcData?.byCategory?.[fcCategory]?.train
    : fcData?.total?.train;
  const fcLimitations = fcData?.limitations || [];

  // Combine actual + forecast for display (last 30 actual + all forecast)
  const chartSeries = [
    ...fcSeries.slice(-30).map(d => ({ weekStart: d.weekStart, actual: d.actual })),
    ...fcForecast.map(d => ({ weekStart: d.weekStart, forecast_hw: d.holtwinters, forecast_naive: d.naive, forecast_ma: d.movingAvg })),
  ];

  return (
    <div>
      {/* Page note */}
      <div style={{ padding: '12px 16px', background: 'rgba(79,142,247,0.07)', border: '1px solid rgba(79,142,247,0.2)', borderRadius: 'var(--radius-md)', marginBottom: 20, fontSize: 13 }}>
        <strong>Sales demand insights</strong> — not inventory management. No stock-on-hand, shortage, or reorder data available.
        Product-level forecasting not available (median ~1.9 units/week per product). Forecasting total and per-category only.
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="filter-group">
          <label className="filter-label" htmlFor="demand-groupby">Group By</label>
          <div className="toggle-group">
            {['week','month'].map(g => (
              <button key={g} className={`toggle-btn ${groupBy === g ? 'active' : ''}`} onClick={() => setGroupBy(g)}>{g}</button>
            ))}
          </div>
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="demand-cat">Category</label>
          <select id="demand-cat" className="filter-select" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Historical Demand Trend */}
      <ChartCard title="Historical Demand Trend" subtitle={`Units sold by ${groupBy} · non-cancelled orders`} className="chart-full">
        {dLoading ? <SkeletonChart /> : dError ? <ErrorState message={dError} onRetry={refetchDemand} /> : demand.length === 0 ? <EmptyState /> : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={demand}>
              <defs>
                <linearGradient id="dgrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f8ef7" stopOpacity={0.3} /><stop offset="95%" stopColor="#4f8ef7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3650" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => fmtAxisLabel(v, groupBy)} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip formatter={(v, n) => [fmtInt(v), n]} labelFormatter={l => fmtAxisLabel(l, groupBy)} contentStyle={{ background: '#1e2a40', border: '1px solid #374460', borderRadius: 8 }} />
              <Area type="monotone" dataKey="total" name="Total Units" stroke="#4f8ef7" fill="url(#dgrad)" strokeWidth={2} dot={false} />
              {!category && CATEGORIES.map(cat => (
                <Area key={cat} type="monotone" dataKey={cat} name={cat} stroke={CAT_COLORS[cat]} fill="none" strokeWidth={1.5} dot={false} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Seasonality */}
      <div className="charts-row">
        <ChartCard title="Monthly Seasonality" subtitle="Units by calendar month (all years combined)">
          {dLoading ? <SkeletonChart height={200} /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={seasonal}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3650" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={m => ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m]} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip formatter={v => fmtInt(v)} contentStyle={{ background: '#1e2a40', border: '1px solid #374460', borderRadius: 8 }}
                  labelFormatter={m => ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m]} />
                <Bar dataKey="units" name="Units" radius={[4,4,0,0]}>
                  {seasonal.map((d, i) => <Cell key={i} fill={d.month >= 10 ? '#fbbf24' : '#4f8ef7'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Growth Rate */}
        <ChartCard title="Period-over-Period Growth %" subtitle={`${groupBy}-over-${groupBy} units growth`}>
          {dLoading ? <SkeletonChart height={200} /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={demand.filter(d => d.growth !== null)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3650" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => fmtAxisLabel(v, groupBy)} interval="preserveStartEnd" />
                <YAxis tickFormatter={v => `${(v*100).toFixed(0)}%`} tick={{ fontSize: 11, fill: '#64748b' }} />
                <ReferenceLine y={0} stroke="#374460" />
                <Tooltip formatter={v => [`${(v*100).toFixed(1)}%`, 'Growth']} contentStyle={{ background: '#1e2a40', border: '1px solid #374460', borderRadius: 8 }} />
                <Bar dataKey="growth" name="Growth">
                  {demand.filter(d => d.growth !== null).map((d, i) => (
                    <Cell key={i} fill={d.growth >= 0 ? '#34d399' : '#f87171'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── FORECAST PANEL ── */}
      <div style={{ marginTop: 8 }}>
        <div className="section-title">📈 Demand Forecast</div>
        <div className="section-subtitle">
          Holt-Winters (damped trend) vs Naive and 4-week Moving Average baselines.
          Strict chronological split: train = first 93 weeks, test = last 12 weeks, horizon = 8 weeks.
        </div>
      </div>

      <div className="filters-bar" style={{ marginBottom: 16 }}>
        <div className="filter-group">
          <label className="filter-label" htmlFor="fc-cat">Forecast For</label>
          <select id="fc-cat" className="filter-select" value={fcCategory} onChange={e => setFcCategory(e.target.value)}>
            <option value="">Total (all categories)</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {fLoading ? <SkeletonChart /> : fError ? <ErrorState message={fError} onRetry={refetchFc} /> : (
        <>
          {/* Evaluation Metrics */}
          {fcEval && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
              {Object.entries(fcEval).filter(([k]) => !['beatsNaive','beatsMovingAvg','recommendation'].includes(k)).map(([model, metrics]) => (
                <div key={model} className="kpi-card" style={{ padding: 16 }}>
                  <div className="kpi-label">{model === 'holtwinters' ? 'Holt-Winters' : model === 'naive' ? 'Naive' : '4-Week MA'}</div>
                  {metrics && typeof metrics === 'object' && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
                      <div>MAE: <strong style={{ color: 'var(--color-text-primary)' }}>{metrics.mae}</strong></div>
                      <div>RMSE: <strong style={{ color: 'var(--color-text-primary)' }}>{metrics.rmse}</strong></div>
                      <div>MAPE: <strong style={{ color: 'var(--color-text-primary)' }}>{metrics.mape}%</strong></div>
                      <div>WAPE: <strong style={{ color: 'var(--color-text-primary)' }}>{metrics.wape}%</strong></div>
                    </div>
                  )}
                </div>
              ))}
              <div className="kpi-card" style={{ padding: 16 }}>
                <div className="kpi-label">Verdict</div>
                <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6, color: fcEval.beatsNaive && fcEval.beatsMovingAvg ? 'var(--color-success)' : 'var(--color-warning)' }}>
                  {fcEval.recommendation}
                </div>
              </div>
            </div>
          )}

          {/* Forecast Chart */}
          <ChartCard title={`Forecast: ${fcCategory || 'Total Weekly Units'}`}
            subtitle={`Train: ${fcTrain?.startWeek} → ${fcTrain?.endWeek} (${fcTrain?.weeks}w) · Test: 12w · Horizon: 8w`}>
            {chartSeries.length === 0 ? <EmptyState /> : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a3650" />
                  <XAxis dataKey="weekStart" tick={{ fontSize: 10, fill: '#64748b' }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip contentStyle={{ background: '#1e2a40', border: '1px solid #374460', borderRadius: 8 }} formatter={v => v !== null ? fmtInt(v) : '—'} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="actual" name="Actual" stroke="#4f8ef7" strokeWidth={2} dot={false} connectNulls={false} />
                  <Line type="monotone" dataKey="forecast_hw" name="Holt-Winters" stroke="#fbbf24" strokeWidth={2} strokeDasharray="5 3" dot={false} connectNulls={false} />
                  <Line type="monotone" dataKey="forecast_naive" name="Naive" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="3 3" dot={false} connectNulls={false} />
                  <Line type="monotone" dataKey="forecast_ma" name="4-Week MA" stroke="#34d399" strokeWidth={1.5} strokeDasharray="3 3" dot={false} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Test Comparison */}
          {fcTest && (
            <ChartCard title="Test Period: Actual vs Predicted" subtitle={`${fcTest.startWeek} → ${fcTest.endWeek} (${fcTest.weeks} weeks)`}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={(fcTest.weekLabels || []).map((wk, i) => ({
                  week: wk,
                  actual: fcTest.actual?.[i],
                  holtwinters: fcTest.holtwinters?.[i],
                  naive: fcTest.naive?.[i],
                  movingAvg: fcTest.movingAvg?.[i],
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a3650" />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#64748b' }} interval={1} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip contentStyle={{ background: '#1e2a40', border: '1px solid #374460', borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="actual" name="Actual" stroke="#4f8ef7" strokeWidth={2} />
                  <Line type="monotone" dataKey="holtwinters" name="HW Predicted" stroke="#fbbf24" strokeWidth={2} strokeDasharray="5 3" />
                  <Line type="monotone" dataKey="naive" name="Naive" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="3 3" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Limitations */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--color-text-secondary)', fontSize: 13 }}>⚠ Forecast Limitations</div>
            <div className="insight-list">
              {fcLimitations.map((l, i) => (
                <div key={i} className="insight-item warning">
                  <div className="insight-dot warning" /><span>{l}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
