import axios from 'axios';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const api = axios.create({ baseURL: BASE, timeout: 30000 });

api.interceptors.response.use(
  res => res.data,
  err => {
    const msg = err.response?.data?.error || err.message || 'Network error';
    return Promise.reject(new Error(msg));
  }
);

export const fetchHealth = () => api.get('/health');
export const fetchMetadata = () => api.get('/metadata');
export const fetchDashboardSummary = (params = {}) => api.get('/dashboard/summary', { params });
export const fetchSalesTrend = (params = {}) => api.get('/analytics/sales-trend', { params });
export const fetchCategories = (params = {}) => api.get('/analytics/categories', { params });
export const fetchTopProducts = (params = {}) => api.get('/analytics/top-products', { params });
export const fetchProducts = (params = {}) => api.get('/products', { params });
export const fetchProduct = (id, params = {}) => api.get(`/products/${id}`, { params });
export const fetchOrderStatus = (params = {}) => api.get('/analytics/orders-status', { params });
export const fetchCustomers = (params = {}) => api.get('/customers', { params });
export const fetchReturns = (params = {}) => api.get('/returns', { params });
export const fetchDemand = (params = {}) => api.get('/demand', { params });
export const fetchForecast = (params = {}) => api.get('/forecast', { params });

export default api;
