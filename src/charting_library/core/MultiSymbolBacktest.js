// ═══════════════════════════════════════════════════════════════════
// charEdge — Multi-Symbol Backtest Runner
//
// Extends BacktestEngine to run a strategy across multiple symbols
// simultaneously. Aggregates per-symbol results into portfolio-level
// metrics: combined equity curve, total Sharpe, correlation matrix,
// and symbol-by-symbol comparison table.
// ═══════════════════════════════════════════════════════════════════

import { runBacktest } from './BacktestEngine.js';

/**
 * Run a strategy across multiple symbol datasets.
 *
 * @param {Object} symbolBars - { 'BTCUSD': bars[], 'ETHUSD': bars[], ... }
 * @param {Object} strategy - Strategy object (same as BacktestEngine)
 * @param {Object} config - Backtest config
 * @returns {MultiSymbolResult}
 */
export function runMultiSymbolBacktest(symbolBars, strategy, config = {}) {
  const symbols = Object.keys(symbolBars);
  if (!symbols.length) return { success: false, error: 'No symbol data provided' };

  const perCapital = (config.initialCapital || 10000) / symbols.length;
  const perConfig = { ...config, initialCapital: perCapital };

  const results = {};
  const summaries = [];
  let totalNetPnL = 0;
  let totalTrades = 0;
  let totalWins = 0;
  let bestSymbol = null;
  let worstSymbol = null;
  let bestPnL = -Infinity;
  let worstPnL = Infinity;

  for (const sym of symbols) {
    const bars = symbolBars[sym];
    if (!bars?.length) {
      results[sym] = { success: false, error: 'No data' };
      continue;
    }

    const r = runBacktest(bars, strategy, perConfig);
    results[sym] = r;

    if (r.success) {
      const m = r.metrics;
      totalNetPnL += m.netPnL;
      totalTrades += m.totalTrades;
      totalWins += m.wins;

      if (m.netPnL > bestPnL) { bestPnL = m.netPnL; bestSymbol = sym; }
      if (m.netPnL < worstPnL) { worstPnL = m.netPnL; worstSymbol = sym; }

      summaries.push({
        symbol: sym,
        netPnL: m.netPnL,
        netPnLPercent: m.netPnLPercent,
        winRate: m.winRate,
        totalTrades: m.totalTrades,
        sharpeRatio: m.sharpeRatio,
        maxDrawdownPercent: m.maxDrawdownPercent,
        profitFactor: m.profitFactor,
      });
    }
  }

  // Portfolio equity curve (sum of individual curves)
  const maxLen = Math.max(...Object.values(results).map(r => r.equity?.length || 0));
  const portfolioEquity = new Array(maxLen).fill(0);
  for (const r of Object.values(results)) {
    if (!r.equity) continue;
    for (let i = 0; i < r.equity.length; i++) {
      portfolioEquity[i] += r.equity[i];
    }
  }

  // Portfolio drawdown
  let peak = 0;
  let maxDD = 0;
  for (const eq of portfolioEquity) {
    if (eq > peak) peak = eq;
    const dd = peak - eq;
    if (dd > maxDD) maxDD = dd;
  }

  const initialTotal = config.initialCapital || 10000;
  const finalEquity = portfolioEquity[portfolioEquity.length - 1] || initialTotal;

  // Portfolio Sharpe (from equity returns)
  const returns = [];
  for (let i = 1; i < portfolioEquity.length; i++) {
    if (portfolioEquity[i - 1] > 0) {
      returns.push((portfolioEquity[i] - portfolioEquity[i - 1]) / portfolioEquity[i - 1]);
    }
  }
  const avgReturn = returns.length ? returns.reduce((s, v) => s + v, 0) / returns.length : 0;
  const stdDev = returns.length > 1
    ? Math.sqrt(returns.reduce((s, v) => s + (v - avgReturn) ** 2, 0) / (returns.length - 1))
    : 0;
  const portfolioSharpe = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

  // Correlation matrix (simplified — pairwise return correlation)
  const correlations = {};
  const symbolReturns = {};
  for (const sym of symbols) {
    const eq = results[sym]?.equity;
    if (!eq) continue;
    const rets = [];
    for (let i = 1; i < eq.length; i++) {
      rets.push(eq[i - 1] > 0 ? (eq[i] - eq[i - 1]) / eq[i - 1] : 0);
    }
    symbolReturns[sym] = rets;
  }

  for (const a of symbols) {
    correlations[a] = {};
    for (const b of symbols) {
      if (a === b) { correlations[a][b] = 1; continue; }
      const ra = symbolReturns[a];
      const rb = symbolReturns[b];
      if (!ra || !rb) { correlations[a][b] = 0; continue; }
      const len = Math.min(ra.length, rb.length);
      if (len < 2) { correlations[a][b] = 0; continue; }
      const avgA = ra.slice(0, len).reduce((s, v) => s + v, 0) / len;
      const avgB = rb.slice(0, len).reduce((s, v) => s + v, 0) / len;
      let cov = 0, varA = 0, varB = 0;
      for (let i = 0; i < len; i++) {
        cov += (ra[i] - avgA) * (rb[i] - avgB);
        varA += (ra[i] - avgA) ** 2;
        varB += (rb[i] - avgB) ** 2;
      }
      correlations[a][b] = (varA > 0 && varB > 0) ? cov / Math.sqrt(varA * varB) : 0;
    }
  }

  return {
    success: true,
    strategy: strategy.name,
    symbols,
    symbolCount: symbols.length,
    results,
    summaries: summaries.sort((a, b) => b.netPnL - a.netPnL),
    portfolio: {
      initialCapital: initialTotal,
      finalEquity: Math.round(finalEquity * 100) / 100,
      netPnL: Math.round(totalNetPnL * 100) / 100,
      netPnLPercent: Math.round((totalNetPnL / initialTotal) * 10000) / 100,
      totalTrades,
      totalWins,
      winRate: totalTrades > 0 ? Math.round((totalWins / totalTrades) * 10000) / 100 : 0,
      sharpeRatio: Math.round(portfolioSharpe * 100) / 100,
      maxDrawdown: Math.round(maxDD * 100) / 100,
      maxDrawdownPercent: peak > 0 ? Math.round((maxDD / peak) * 10000) / 100 : 0,
      bestSymbol,
      worstSymbol,
    },
    equity: portfolioEquity,
    correlations,
  };
}
