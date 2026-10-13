import { useState, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartCard } from '../components/ChartCard';
import { DataTable } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { SkeletonChart } from '../components/Skeleton';
import { ErrorState, EmptyState } from '../components/States';
import { useFetch } from '../hooks/useFetch';
import { fetchProducts, fetchProduct } from '../services/api';
import { fmtNum, fmtCompact, fmtInt, fmtPct } from '../utils/formatters';

const CATEGORIES = ['Electronics','Fashion','Home & Kitchen','Beauty & Personal Care','Sports & Fitness','Books & Stationery'];

export default function Products() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sortBy, setSortBy] = useState('grossSales');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [groupBy, setGroupBy] = useState('month');

  const loadProducts = useCallback(
    () => fetchProducts({ page, limit: 20, search: search || undefined, category: category || undefined, sortBy, sortOrder }),
    [page, search, category, sortBy, sortOrder]
  );
  const { data: prodData, loading, error, refetch } = useFetch(loadProducts, [page, search, category, sortBy, sortOrder]);

  const loadDetail = useCallback(
    () => selectedProduct ? fetchProduct(selectedProduct, { groupBy }) : Promise.resolve(null),
    [selectedProduct, groupBy]
  );
  const { data: detail, loading: dLoading, error: dError } = useFetch(loadDetail, [selectedProduct, groupBy]);

  const products = prodData?.data || [];
  const meta = prodData?.meta || {};

  return (
    <div>
      <div className="filters-bar">
        <div className="filter-group">
          <label className="filter-label" htmlFor="prod-search">Search</label>
          <input id="prod-search" className="filter-input" placeholder="Product name or ID..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ width: 200 }} />
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="prod-cat">Category</label>
          <select id="prod-cat" className="filter-select" value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}>
            <option value="">All</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="prod-sort">Sort By</label>
          <select id="prod-sort" className="filter-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="grossSales">Revenue</option>
            <option value="units">Units</option>
            <option value="grossProfit">Profit</option>
            <option value="margin">Margin</option>
            <option value="returnCount">Returns</option>
            <option value="product_name">Name</option>
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="prod-order">Order</label>
          <select id="prod-order" className="filter-select" value={sortOrder} onChange={e => setSortOrder(e.target.value)}>
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setCategory(''); setSortBy('grossSales'); setSortOrder('desc'); setPage(1); }}>Reset</button>
      </div>

      <ChartCard title={`Products (${fmtInt(meta.total)} total)`} subtitle="Click a row to view sales history">
        {loading ? <SkeletonChart /> : error ? <ErrorState message={error} onRetry={refetch} /> : products.length === 0 ? <EmptyState message="No products found" /> : (
          <>
            <DataTable
              columns={[
                { key: 'product_id', label: 'ID', sortable: false, render: v => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{v}</span> },
                { key: 'product_name', label: 'Product', render: (v, row) => (
                  <span style={{ cursor: 'pointer', color: 'var(--color-primary)' }} onClick={() => setSelectedProduct(row.product_id)}>
                    {row.negative_margin && '⚠ '}{row.low_margin && '↓ '}{v}
                  </span>
                )},
                { key: 'category', label: 'Category', render: v => <span className="badge badge-muted">{v}</span> },
                { key: 'grossSales', label: 'Gross Sales', numeric: true, render: v => fmtNum(v) },
                { key: 'units', label: 'Units', numeric: true, render: v => fmtInt(v) },
                { key: 'grossProfit', label: 'Gross Profit', numeric: true, render: v => fmtNum(v) },
                { key: 'margin', label: 'Margin', numeric: true, render: (v, row) => (
                  <span className={row.negative_margin ? 'badge badge-danger' : row.low_margin ? 'badge badge-warning' : ''}>
                    {fmtPct(v)}
                  </span>
                )},
                { key: 'returnCount', label: 'Returns', numeric: true, render: v => fmtInt(v) },
              ]}
              rows={products.map(p => ({ ...p, _key: p.product_id }))}
            />
            <Pagination page={meta.page} pages={meta.pages} onPage={setPage} />
          </>
        )}
      </ChartCard>

      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-text-muted)' }}>
        ⚠ flagged = negative margin · ↓ flagged = low margin (&lt;10%). Click product name for history.
      </div>

      {/* Product Detail Panel */}
      {selectedProduct && (
        <ChartCard
          title={dLoading ? 'Loading...' : detail?.product?.product_name || selectedProduct}
          subtitle={detail?.product?.category}
          controls={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div className="toggle-group">
                {['month','week'].map(g => (
                  <button key={g} className={`toggle-btn ${groupBy === g ? 'active' : ''}`} onClick={() => setGroupBy(g)}>{g}</button>
                ))}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedProduct(null)}>✕ Close</button>
            </div>
          }
        >
          {dLoading ? <SkeletonChart height={200} /> : dError ? <ErrorState message={dError} /> : detail?.history?.length === 0 ? <EmptyState message="No sales data for this product" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={detail?.history || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3650" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis yAxisId="l" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={fmtCompact} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip contentStyle={{ background: '#1e2a40', border: '1px solid #374460', borderRadius: 8 }} />
                <Line yAxisId="l" type="monotone" dataKey="grossSales" name="Gross Sales" stroke="#4f8ef7" strokeWidth={2} dot={false} />
                <Line yAxisId="r" type="monotone" dataKey="units" name="Units" stroke="#34d399" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      )}
      <p className="footnote warning">⚠ Currency not specified in dataset</p>
    </div>
  );
}
