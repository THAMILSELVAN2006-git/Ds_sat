import { parseDateParam } from '../utils/formatters.js';

/**
 * Validate and parse common query parameters.
 * Attaches parsed params to req.parsedParams.
 */
export function validateQueryParams(req, res, next) {
  const {
    startDate, endDate, category, productId, groupBy, region, country,
    paymentMethod, status, includeCancelled, page, limit, sortBy, sortOrder,
    search,
  } = req.query;

  const errors = [];
  const parsed = {};

  // Date params
  if (startDate) {
    parsed.startDate = parseDateParam(startDate);
    if (!parsed.startDate) errors.push(`Invalid startDate: "${startDate}". Use ISO format YYYY-MM-DD.`);
  }
  if (endDate) {
    parsed.endDate = parseDateParam(endDate);
    if (!parsed.endDate) errors.push(`Invalid endDate: "${endDate}". Use ISO format YYYY-MM-DD.`);
  }
  if (parsed.startDate && parsed.endDate && parsed.startDate > parsed.endDate) {
    errors.push('startDate must be <= endDate');
  }
  if (parsed.startDate) parsed.startDate.setUTCHours(0, 0, 0, 0);
  if (parsed.endDate) parsed.endDate.setUTCHours(23, 59, 59, 999);

  // groupBy
  const validGroupBy = ['day', 'week', 'month'];
  if (groupBy && !validGroupBy.includes(groupBy)) {
    errors.push(`Invalid groupBy: "${groupBy}". Valid values: ${validGroupBy.join(', ')}`);
  } else {
    parsed.groupBy = groupBy || autoGroupBy(parsed.startDate, parsed.endDate);
  }

  // Filters
  parsed.category = category || null;
  parsed.productId = productId || null;
  parsed.region = region || null;
  parsed.country = country || null;
  parsed.paymentMethod = paymentMethod || null;
  parsed.status = status || null;
  parsed.includeCancelled = includeCancelled === 'true';
  parsed.search = search || null;

  // Pagination
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  if (page && (isNaN(pageNum) || pageNum < 1)) errors.push('page must be a positive integer');
  if (limit && (isNaN(limitNum) || limitNum < 1 || limitNum > 100)) errors.push('limit must be 1-100');
  parsed.page = isNaN(pageNum) || pageNum < 1 ? 1 : pageNum;
  parsed.limit = isNaN(limitNum) || limitNum < 1 ? 20 : Math.min(100, limitNum);

  // sortBy / sortOrder
  parsed.sortBy = sortBy || 'revenue';
  parsed.sortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

  if (errors.length > 0) {
    return res.status(400).json({ success: false, error: errors.join('; '), data: null, meta: {} });
  }

  req.parsedParams = parsed;
  next();
}

/**
 * Auto-suggest groupBy based on date range
 */
function autoGroupBy(start, end) {
  if (!start || !end) return 'month';
  const days = (end - start) / 86400000;
  if (days <= 31) return 'day';
  if (days <= 180) return 'week';
  return 'month';
}

/**
 * Centralized error handler
 */
export function errorHandler(err, req, res, next) {
  console.error('[Error]', err.message, err.stack);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: err.message || 'Internal server error',
    data: null,
    meta: {},
  });
}

/**
 * 404 handler
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.path}`,
    data: null,
    meta: {},
  });
}

/**
 * Data-loaded guard
 */
export function requireDataLoaded(store) {
  return (req, res, next) => {
    if (!store.loaded) {
      return res.status(503).json({
        success: false,
        error: 'Data not loaded yet. Please try again in a moment.',
        data: null,
        meta: {},
      });
    }
    next();
  };
}

/**
 * Wrap async route handlers to catch errors
 */
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
