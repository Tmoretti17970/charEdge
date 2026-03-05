// ═══════════════════════════════════════════════════════════════════
// charEdge — Built-in Screener
// Scan watchlist symbols against indicator-based conditions.
//
// Condition DSL:
//   { indicator: 'rsi', params: { period: 14 }, op: '<', value: 30 }
//   { indicator: 'sma', params: { period: 200 }, op: 'crossAbove', ref: 'close' }
//
// Operators:
//   '<', '>', '<=', '>=', '==',
//   'crossAbove', 'crossBelow'  — require at least 2 bars of history
//
// Usage:
//   import { screenSymbols } from './Screener.js';
//   const results = screenSymbols(watchlist, conditions, barsMap);
// ═══════════════════════════════════════════════════════════════════

import * as C from '../studies/indicators/computations.js';
import { INDICATORS } from '../studies/indicators/registry.js';

/**
 * Evaluate a single condition against bar data.
 *
 * @param {Object} condition - { indicator, params, op, value, ref }
 * @param {Object[]} bars - OHLCV bar array
 * @returns {{ pass: boolean, actual: number|null, detail: string }}
 */
function evaluateCondition(condition, bars) {
  if (!bars?.length) return { pass: false, actual: null, detail: 'No data' };

  const { indicator, params = {}, op, value, ref } = condition;
  const indDef = INDICATORS[indicator];
  if (!indDef) return { pass: false, actual: null, detail: `Unknown indicator: ${indicator}` };

  // Compute indicator
  const mergedParams = {};
  for (const [k, cfg] of Object.entries(indDef.params)) {
    mergedParams[k] = params[k] !== undefined ? params[k] : cfg.default;
  }

  let computed;
  try {
    computed = indDef.compute(bars, mergedParams);
  } catch (_) {
    return { pass: false, actual: null, detail: 'Computation error' };
  }

  // Get the primary output (first output key)
  const primaryKey = indDef.outputs[0]?.key;
  if (!primaryKey || !computed[primaryKey]) {
    return { pass: false, actual: null, detail: 'No output' };
  }

  const series = computed[primaryKey];
  const current = series[series.length - 1];
  const prev = series.length >= 2 ? series[series.length - 2] : null;

  if (current == null || isNaN(current)) {
    return { pass: false, actual: current, detail: 'NaN result' };
  }

  // Get comparison target
  let target = value;
  if (ref === 'close') {
    target = bars[bars.length - 1].close;
  } else if (ref === 'open') {
    target = bars[bars.length - 1].open;
  } else if (ref === 'high') {
    target = bars[bars.length - 1].high;
  } else if (ref === 'low') {
    target = bars[bars.length - 1].low;
  }

  let pass = false;
  switch (op) {
    case '<':  pass = current < target; break;
    case '>':  pass = current > target; break;
    case '<=': pass = current <= target; break;
    case '>=': pass = current >= target; break;
    case '==': pass = Math.abs(current - target) < 0.0001; break;
    case 'crossAbove':
      if (prev != null && !isNaN(prev)) {
        pass = prev <= target && current > target;
      }
      break;
    case 'crossBelow':
      if (prev != null && !isNaN(prev)) {
        pass = prev >= target && current < target;
      }
      break;
    default:
      return { pass: false, actual: current, detail: `Unknown op: ${op}` };
  }

  const label = indDef.shortName || indicator;
  const paramStr = Object.values(mergedParams).join(',');
  return {
    pass,
    actual: current,
    detail: `${label}(${paramStr}) = ${current.toFixed(2)} ${op} ${typeof target === 'number' ? target.toFixed(2) : ref}`,
  };
}

/**
 * Screen a list of symbols against a set of indicator conditions.
 * All conditions must pass for a symbol to match (AND logic).
 *
 * @param {string[]} watchlist - List of symbol strings
 * @param {Object[]} conditions - Array of condition objects
 * @param {Object} barsMap - Map of symbol → OHLCV bar arrays, e.g. { 'BTC': [...], 'ETH': [...] }
 * @returns {Object[]} Array of { symbol, matches, details: string[] }
 */
export function screenSymbols(watchlist, conditions, barsMap) {
  if (!watchlist?.length || !conditions?.length) return [];

  const results = [];

  for (const symbol of watchlist) {
    const bars = barsMap[symbol] || barsMap[symbol.toUpperCase()] || barsMap[symbol.toLowerCase()];
    if (!bars?.length) {
      results.push({ symbol, matches: false, details: ['No data available'] });
      continue;
    }

    const details = [];
    let allPass = true;

    for (const cond of conditions) {
      const result = evaluateCondition(cond, bars);
      details.push(result.detail);
      if (!result.pass) allPass = false;
    }

    results.push({ symbol, matches: allPass, details });
  }

  return results;
}

/**
 * Get a list of all available indicators that can be used in screener conditions.
 * Returns id, name, outputs, and default params for UI rendering.
 *
 * @returns {Object[]}
 */
export function getScreenableIndicators() {
  return Object.values(INDICATORS).map(ind => ({
    id: ind.id,
    name: ind.name,
    shortName: ind.shortName,
    category: ind.mode,
    params: Object.entries(ind.params).map(([key, cfg]) => ({
      key,
      label: cfg.label || key,
      default: cfg.default,
      min: cfg.min,
      max: cfg.max,
    })),
    outputs: ind.outputs.map(o => o.key),
  }));
}
