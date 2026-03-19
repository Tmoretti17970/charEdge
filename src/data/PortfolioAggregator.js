// ═══════════════════════════════════════════════════════════════════
// charEdge — Portfolio Aggregator (Phase 8 Sprint 8.12)
//
// Unifies data from all connected brokers + manual trades.
// Computes total equity, daily P&L, allocation by asset class
// and broker, with in-memory caching.
// ═══════════════════════════════════════════════════════════════════

import { getOpenPositions, updateWithPrices, computeExposure } from './PositionEngine.js';

const CACHE_TTL = 60_000; // 60 seconds
let _cache = null;
let _cacheTime = 0;

// ─── Core Aggregation ───────────────────────────────────────────

/**
 * Aggregate portfolio data from trades.
 *
 * @param {Object[]} trades - All journal trades
 * @param {Record<string, number>} [prices] - Current market prices
 * @param {Array<{brokerId: string, brokerName: string}>} [connections] - Connected accounts
 * @returns {Object} Aggregated portfolio data
 */
export function aggregatePortfolio(trades, prices = {}, connections = []) {
  // Check cache
  if (_cache && Date.now() - _cacheTime < CACHE_TTL) return _cache;

  const positions = getOpenPositions(trades);
  const positionsWithPrices = updateWithPrices(positions, prices);
  const exposure = computeExposure(positionsWithPrices);

  // ─── Equity Curve ────────────────────────────────────────────
  const equityCurve = _computeEquityCurve(trades);

  // ─── Allocation by Asset Class ───────────────────────────────
  const assetAllocation = _computeAssetAllocation(trades);

  // ─── Allocation by Broker ────────────────────────────────────
  const brokerAllocation = _computeBrokerAllocation(trades, connections);

  // ─── Summary Metrics ─────────────────────────────────────────
  const totalRealizedPnl = trades.reduce((sum, t) => sum + (parseFloat(t.pnl) || 0), 0);
  const totalUnrealizedPnl = positionsWithPrices.reduce((sum, p) => sum + p.unrealizedPnl, 0);
  const totalFees = trades.reduce((sum, t) => sum + (parseFloat(t.fees || t.commission) || 0), 0);

  const winningTrades = trades.filter((t) => parseFloat(t.pnl) > 0);
  const losingTrades = trades.filter((t) => parseFloat(t.pnl) < 0);
  const winRate = trades.length > 0 ? winningTrades.length / trades.length : 0;
  const avgWin = winningTrades.length > 0
    ? winningTrades.reduce((s, t) => s + parseFloat(t.pnl), 0) / winningTrades.length
    : 0;
  const avgLoss = losingTrades.length > 0
    ? losingTrades.reduce((s, t) => s + parseFloat(t.pnl), 0) / losingTrades.length
    : 0;

  // Max drawdown from equity curve
  const maxDrawdown = _computeMaxDrawdown(equityCurve);

  // Sharpe ratio (annualized, assuming 252 trading days)
  const sharpe = _computeSharpe(equityCurve);

  const result = {
    // Positions
    openPositions: positionsWithPrices,
    exposure,

    // P&L
    totalRealizedPnl,
    totalUnrealizedPnl,
    totalPnl: totalRealizedPnl + totalUnrealizedPnl,
    totalFees,
    netPnl: totalRealizedPnl + totalUnrealizedPnl - totalFees,

    // Performance
    winRate,
    avgWin,
    avgLoss,
    profitFactor: avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0,
    maxDrawdown,
    sharpe,
    tradeCount: trades.length,

    // Series
    equityCurve,
    assetAllocation,
    brokerAllocation,

    // Metadata
    connectedAccounts: connections.length,
    lastUpdated: Date.now(),
  };

  _cache = result;
  _cacheTime = Date.now();
  return result;
}

// ─── Helpers ────────────────────────────────────────────────────

function _computeEquityCurve(trades) {
  const sorted = [...trades]
    .filter((t) => t.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let cumPnl = 0;
  const curve = [];
  const dailyMap = {};

  for (const t of sorted) {
    const day = (t.date || '').split('T')[0];
    if (!day) continue;
    const pnl = parseFloat(t.pnl) || 0;
    cumPnl += pnl;
    dailyMap[day] = cumPnl;
  }

  for (const [date, equity] of Object.entries(dailyMap)) {
    curve.push({ date, equity });
  }

  return curve;
}

function _computeAssetAllocation(trades) {
  const allocation = {};
  for (const t of trades) {
    const cls = (t.assetClass || 'unknown').toLowerCase();
    const pnl = parseFloat(t.pnl) || 0;
    if (!allocation[cls]) allocation[cls] = { count: 0, pnl: 0 };
    allocation[cls].count++;
    allocation[cls].pnl += pnl;
  }
  return allocation;
}

function _computeBrokerAllocation(trades, connections) {
  const allocation = {};
  for (const t of trades) {
    const source = t._source || 'manual';
    const pnl = parseFloat(t.pnl) || 0;
    if (!allocation[source]) allocation[source] = { count: 0, pnl: 0 };
    allocation[source].count++;
    allocation[source].pnl += pnl;
  }

  // Map broker IDs to names
  const connMap = {};
  for (const c of connections) connMap[c.brokerId] = c.brokerName;

  return Object.entries(allocation).map(([source, data]) => ({
    source,
    label: connMap[source] || source.charAt(0).toUpperCase() + source.slice(1),
    ...data,
  }));
}

function _computeMaxDrawdown(equityCurve) {
  if (equityCurve.length < 2) return 0;
  let peak = -Infinity;
  let maxDD = 0;

  for (const point of equityCurve) {
    if (point.equity > peak) peak = point.equity;
    const dd = peak > 0 ? (peak - point.equity) / peak : 0;
    if (dd > maxDD) maxDD = dd;
  }

  return maxDD;
}

function _computeSharpe(equityCurve) {
  if (equityCurve.length < 3) return 0;

  const returns = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1].equity || 0;
    const curr = equityCurve[i].equity || 0;
    if (prev !== 0) returns.push((curr - prev) / Math.abs(prev));
  }

  if (returns.length < 2) return 0;

  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;
  return (mean / stdDev) * Math.sqrt(252); // Annualized
}

/**
 * Invalidate the aggregation cache.
 */
export function invalidateCache() {
  _cache = null;
  _cacheTime = 0;
}

export default { aggregatePortfolio, invalidateCache };
