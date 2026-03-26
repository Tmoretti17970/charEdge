// ═══════════════════════════════════════════════════════════════════
// charEdge — Prediction Backtester
//
// Replays historical market data to test prediction strategies.
// Simulates: "What if I always bet Yes when probability < 30%
// on economics markets?" → P&L, win rate, Sharpe ratio.
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} BacktestStrategy
 * @property {string} name
 * @property {string} [category] - Filter by category (null = all)
 * @property {string} side - 'yes' | 'no'
 * @property {number} minProb - Min probability to enter (0-100)
 * @property {number} maxProb - Max probability to enter (0-100)
 * @property {number} positionSize - USD per trade
 */

/**
 * @typedef {Object} BacktestResult
 * @property {string} strategyName
 * @property {number} totalTrades
 * @property {number} wins
 * @property {number} losses
 * @property {number} winRate
 * @property {number} totalPnL
 * @property {number} avgPnL
 * @property {number} maxDrawdown
 * @property {number} sharpeRatio
 * @property {Array} trades - Individual trade results
 * @property {Array} equityCurve - Running P&L over time
 */

/**
 * Run a backtest against resolved market data.
 * @param {BacktestStrategy} strategy
 * @param {Array} resolvedMarkets - Markets with known outcomes
 * @returns {BacktestResult}
 */
export function runBacktest(strategy, resolvedMarkets) {
  const {
    name = 'Unnamed Strategy',
    category = null,
    side = 'yes',
    minProb = 0,
    maxProb = 100,
    positionSize = 100,
  } = strategy;

  // Filter markets matching strategy criteria
  let eligible = resolvedMarkets.filter((m) => m.resolvedOutcome != null);
  if (category) eligible = eligible.filter((m) => m.category === category);

  const trades = [];
  let totalPnL = 0;
  let maxEquity = 0;
  let maxDrawdown = 0;
  const equityCurve = [];

  for (const market of eligible) {
    const leadProb = market.outcomes?.[0]?.probability || 50;

    // Check if probability falls within strategy range
    const entryProb = side === 'yes' ? leadProb : 100 - leadProb;
    if (entryProb < minProb || entryProb > maxProb) continue;

    // Calculate P&L
    const entryPrice = entryProb / 100; // Cost per contract
    const betAmount = positionSize;
    const contracts = betAmount / entryPrice;

    // Did our side win?
    const leadWon = market.outcomes?.[0]?.label === market.resolvedOutcome;
    const weWon = side === 'yes' ? leadWon : !leadWon;

    const pnl = weWon
      ? contracts * (1 - entryPrice) // Win: payout - cost
      : -betAmount; // Loss: lose entire position

    totalPnL += pnl;
    maxEquity = Math.max(maxEquity, totalPnL);
    const drawdown = maxEquity - totalPnL;
    maxDrawdown = Math.max(maxDrawdown, drawdown);

    trades.push({
      marketId: market.id,
      question: market.question,
      category: market.category,
      entryProb,
      side,
      outcome: weWon ? 'win' : 'loss',
      pnl: Math.round(pnl * 100) / 100,
      runningPnL: Math.round(totalPnL * 100) / 100,
    });

    equityCurve.push({
      tradeNum: trades.length,
      pnl: Math.round(totalPnL * 100) / 100,
    });
  }

  const wins = trades.filter((t) => t.outcome === 'win').length;
  const losses = trades.filter((t) => t.outcome === 'loss').length;
  const pnlValues = trades.map((t) => t.pnl);
  const avgPnL = pnlValues.length > 0 ? pnlValues.reduce((s, v) => s + v, 0) / pnlValues.length : 0;
  const stdDev = computeStdDev(pnlValues);
  const sharpeRatio = stdDev > 0 ? (avgPnL / stdDev) * Math.sqrt(252) : 0; // Annualized

  return {
    strategyName: name,
    totalTrades: trades.length,
    wins,
    losses,
    winRate: trades.length > 0 ? Math.round((wins / trades.length) * 100) : 0,
    totalPnL: Math.round(totalPnL * 100) / 100,
    avgPnL: Math.round(avgPnL * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    trades,
    equityCurve,
  };
}

/**
 * Run multiple strategies and compare results.
 */
export function compareStrategies(strategies, resolvedMarkets) {
  return strategies.map((s) => runBacktest(s, resolvedMarkets));
}

/**
 * Preset strategies for quick testing.
 */
export const PRESET_STRATEGIES = [
  { name: 'Contrarian Low-Prob', side: 'yes', minProb: 5, maxProb: 25, positionSize: 100, category: null },
  { name: 'Follow the Crowd', side: 'yes', minProb: 70, maxProb: 95, positionSize: 100, category: null },
  { name: 'Crypto Contrarian', side: 'yes', minProb: 10, maxProb: 35, positionSize: 100, category: 'crypto' },
  { name: 'Economic Consensus', side: 'yes', minProb: 60, maxProb: 90, positionSize: 100, category: 'economy' },
  { name: 'Fade High Confidence', side: 'no', minProb: 90, maxProb: 99, positionSize: 100, category: null },
];

// ─── Helpers ───────────────────────────────────────────────────

function computeStdDev(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}
