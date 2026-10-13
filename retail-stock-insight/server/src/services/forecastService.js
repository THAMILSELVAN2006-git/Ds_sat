import { getWeeklySeriesForForecast } from './demandService.js';
import { round } from '../utils/formatters.js';

/**
 * Holt-Winters Double Exponential Smoothing (trend, no seasonality — insufficient data for 52-week cycle).
 * With damped trend to avoid overoptimistic long-horizon forecasts.
 */
function holtwinters(series, { alpha = 0.3, beta = 0.1, phi = 0.9, horizon = 8 } = {}) {
  if (series.length < 4) return { forecast: [], params: { alpha, beta, phi } };

  let level = series[0];
  let trend = series[1] - series[0];
  const fitted = [level];

  for (let i = 1; i < series.length; i++) {
    const prevLevel = level;
    const prevTrend = trend;
    level = alpha * series[i] + (1 - alpha) * (prevLevel + phi * prevTrend);
    trend = beta * (level - prevLevel) + (1 - beta) * phi * prevTrend;
    fitted.push(level + phi * trend);
  }

  // Forecast
  const forecast = [];
  let dampedTrend = trend;
  let forecastLevel = level;
  for (let h = 1; h <= horizon; h++) {
    dampedTrend = phi * dampedTrend;
    forecastLevel = forecastLevel + dampedTrend;
    forecast.push(Math.max(0, round(forecastLevel, 1)));
  }

  return { fitted: fitted.map(v => round(v, 1)), forecast, params: { alpha, beta, phi } };
}

/**
 * Naive forecast: last observed value repeated
 */
function naiveForecast(series, horizon) {
  const last = series[series.length - 1];
  return Array(horizon).fill(round(last, 1));
}

/**
 * 4-week Moving Average
 */
function movingAvgForecast(series, horizon, window = 4) {
  const slice = series.slice(-window);
  const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
  return Array(horizon).fill(round(avg, 1));
}

/**
 * Evaluate model: MAE, RMSE, MAPE, WAPE
 */
function evaluate(actual, predicted) {
  const n = Math.min(actual.length, predicted.length);
  if (n === 0) return {};
  let sumAbsErr = 0, sumSqErr = 0, sumAbsPct = 0, sumActual = 0, sumAbsErrW = 0;
  for (let i = 0; i < n; i++) {
    const err = predicted[i] - actual[i];
    sumAbsErr += Math.abs(err);
    sumSqErr += err * err;
    if (actual[i] !== 0) sumAbsPct += Math.abs(err) / actual[i];
    sumActual += Math.abs(actual[i]);
    sumAbsErrW += Math.abs(err);
  }
  const mae = round(sumAbsErr / n, 2);
  const rmse = round(Math.sqrt(sumSqErr / n), 2);
  const mape = round((sumAbsPct / n) * 100, 2);
  const wape = sumActual > 0 ? round((sumAbsErrW / sumActual) * 100, 2) : null;

  // R² vs mean
  const mean = actual.reduce((a, b) => a + b, 0) / n;
  const ssTot = actual.reduce((a, v) => a + (v - mean) ** 2, 0);
  const ssRes = actual.reduce((a, v, i) => a + (v - predicted[i]) ** 2, 0);
  const r2 = ssTot > 0 ? round(1 - ssRes / ssTot, 4) : null;

  return { mae, rmse, mape, wape, r2, n };
}

/**
 * Main forecast service.
 * Train: first 93 complete weeks, Test: last 12 complete weeks, Horizon: 8 weeks.
 * Series: total units and each of the 6 categories.
 */
export function computeForecast(params = {}) {
  const { category } = params;
  const { weeks, categories, partialWeekRemoved } = getWeeklySeriesForForecast();

  if (weeks.length < 20) {
    return { error: 'Insufficient data for forecasting (need at least 20 complete weeks)', weeks: weeks.length };
  }

  const TRAIN_CUTOFF = 93;
  const TEST_WEEKS = 12;
  const HORIZON = 8;

  function forecastSeries(seriesKey) {
    const series = weeks.map(w => w[seriesKey] || 0);
    const trainEnd = Math.min(TRAIN_CUTOFF, series.length - TEST_WEEKS);
    const trainSeries = series.slice(0, trainEnd);
    const testSeries = series.slice(trainEnd, trainEnd + TEST_WEEKS);
    const testWeeks = weeks.slice(trainEnd, trainEnd + TEST_WEEKS).map(w => w.weekStart);

    // Fit Holt-Winters on train
    const hw = holtwinters(trainSeries, { alpha: 0.3, beta: 0.1, phi: 0.88, horizon: TEST_WEEKS + HORIZON });
    const hwTestPred = hw.forecast.slice(0, TEST_WEEKS);
    const hwForecast = hw.forecast.slice(TEST_WEEKS, TEST_WEEKS + HORIZON);

    // Baselines on train
    const naiveTest = naiveForecast(trainSeries, TEST_WEEKS);
    const maTest = movingAvgForecast(trainSeries, TEST_WEEKS);

    const hwEval = evaluate(testSeries, hwTestPred);
    const naiveEval = evaluate(testSeries, naiveTest);
    const maEval = evaluate(testSeries, maTest);

    const beatNaive = hwEval.mae < naiveEval.mae;
    const beatMA = hwEval.mae < maEval.mae;

    // Forecast weeks (after the last week in data)
    const lastWeek = weeks[weeks.length - 1]?.weekStart;
    const forecastWeeks = [];
    if (lastWeek) {
      let cur = new Date(lastWeek);
      for (let h = 1; h <= HORIZON; h++) {
        cur = new Date(cur.getTime() + 7 * 86400000);
        forecastWeeks.push(cur.toISOString().slice(0, 10));
      }
    }

    return {
      series: series.map((v, i) => ({ weekStart: weeks[i].weekStart, actual: v })),
      train: { startWeek: weeks[0]?.weekStart, endWeek: weeks[trainEnd - 1]?.weekStart, weeks: trainEnd },
      test: {
        startWeek: testWeeks[0], endWeek: testWeeks[testWeeks.length - 1],
        weeks: TEST_WEEKS,
        actual: testSeries,
        holtwinters: hwTestPred,
        naive: naiveTest,
        movingAvg: maTest,
        weekLabels: testWeeks,
      },
      evaluation: {
        holtwinters: hwEval,
        naive: naiveEval,
        movingAvg4w: maEval,
        beatsNaive: beatNaive,
        beatsMovingAvg: beatMA,
        recommendation: beatNaive && beatMA
          ? 'Holt-Winters (damped trend) outperforms baselines on test set'
          : !beatNaive
          ? 'Holt-Winters does NOT beat naive baseline — use naive or moving average'
          : 'Holt-Winters beats naive but not 4-week moving average',
      },
      forecast: forecastWeeks.map((weekStart, i) => ({
        weekStart,
        holtwinters: hwForecast[i] ?? null,
        naive: naiveForecast(series, HORIZON)[i],
        movingAvg: movingAvgForecast(series, HORIZON)[i],
      })),
      methodology: 'Holt-Winters double exponential smoothing with damped trend (alpha=0.3, beta=0.1, phi=0.88). Strict chronological split: train on first 93 weeks, test on last 12, forecast 8 weeks ahead.',
    };
  }

  if (category) {
    if (!categories.includes(category)) {
      return { error: `Unknown category: ${category}`, availableCategories: categories };
    }
    return {
      category,
      ...forecastSeries(category),
      limitations: buildLimitations(partialWeekRemoved, weeks.length),
    };
  }

  // Return total + all categories
  const result = {
    total: forecastSeries('total'),
    byCategory: {},
    limitations: buildLimitations(partialWeekRemoved, weeks.length),
    note: 'Product-level forecasting not available — product weekly series are too sparse (median ~1.9 units/week, ~192 of 731 active days per product). Forecasting total and per-category weekly units only.',
  };

  for (const cat of categories) {
    result.byCategory[cat] = forecastSeries(cat);
  }

  return result;
}

function buildLimitations(partialWeekRemoved, totalWeeks) {
  return [
    `Only ~${totalWeeks} complete weeks of data (≈2 years) — seasonality patterns may not be fully captured`,
    'Strong upward trend in data; damped-trend model used to prevent overoptimistic long-horizon forecasts',
    'No external factors (promotions, price changes, stock availability) incorporated',
    'Returned vs Refunded semantics not documented; units sold may include some returned items',
    partialWeekRemoved ? `Partial last week (${partialWeekRemoved} to 2025-12-31) excluded from training` : null,
    'Seasonal naive not used — requires at least 2 full seasonal cycles; only ~2 years of data available',
  ].filter(Boolean);
}
