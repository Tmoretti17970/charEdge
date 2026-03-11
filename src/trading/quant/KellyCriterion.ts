// ═══════════════════════════════════════════════════════════════════
// charEdge — Kelly Criterion Calculator (4.4.3)
//
// Computes optimal bet fraction using the Kelly Criterion.
// Includes half-Kelly and quarter-Kelly recommendations.
// ═══════════════════════════════════════════════════════════════════

export interface KellyResult {
  /** Full Kelly fraction (0-1) */
  fullKelly: number;
  /** Half-Kelly (conservative — recommended for trading) */
  halfKelly: number;
  /** Quarter-Kelly (ultra-conservative) */
  quarterKelly: number;
  /** Expected edge per trade */
  edge: number;
  /** Whether the system has positive expectancy */
  hasEdge: boolean;
  /** Formatted recommendation string */
  recommendation: string;
}

/**
 * Compute the Kelly Criterion optimal bet fraction.
 *
 * Kelly% = W - [(1 - W) / R]
 *
 * Where:
 *   W = win probability (0-1)
 *   R = win/loss ratio (avg win / avg loss)
 *
 * @param winRate - Win probability (0-1)
 * @param avgWin - Average winning trade amount (positive)
 * @param avgLoss - Average losing trade amount (positive — will be treated as loss)
 */
export function computeKelly(
  winRate: number,
  avgWin: number,
  avgLoss: number,
): KellyResult {
  // Guard against invalid inputs
  if (winRate < 0 || winRate > 1 || avgWin <= 0 || avgLoss <= 0) {
    return {
      fullKelly: 0,
      halfKelly: 0,
      quarterKelly: 0,
      edge: 0,
      hasEdge: false,
      recommendation: 'Insufficient data',
    };
  }

  const R = avgWin / avgLoss; // Win/loss ratio
  const W = winRate;

  // Kelly formula: K = W - (1 - W) / R
  const fullKelly = W - (1 - W) / R;

  // Edge = Expected value per $1 risked
  const edge = W * R - (1 - W);

  const hasEdge = fullKelly > 0;
  const halfKelly = Math.max(0, fullKelly / 2);
  const quarterKelly = Math.max(0, fullKelly / 4);

  // Generate recommendation
  let recommendation: string;
  if (!hasEdge) {
    recommendation = 'No edge detected — reduce position size or improve system';
  } else if (fullKelly > 0.25) {
    recommendation = `Aggressive edge (${(fullKelly * 100).toFixed(1)}%). Use half-Kelly (${(halfKelly * 100).toFixed(1)}%) to manage variance.`;
  } else if (fullKelly > 0.10) {
    recommendation = `Solid edge. Half-Kelly (${(halfKelly * 100).toFixed(1)}%) recommended for optimal growth.`;
  } else {
    recommendation = `Thin edge (${(fullKelly * 100).toFixed(1)}%). Consider quarter-Kelly (${(quarterKelly * 100).toFixed(1)}%) until more data.`;
  }

  return {
    fullKelly: Math.max(0, fullKelly),
    halfKelly,
    quarterKelly,
    edge,
    hasEdge,
    recommendation,
  };
}

/**
 * Compute Kelly from trade history.
 */
export function kellyFromTrades(
  trades: Array<{ pnl: number }>,
): KellyResult {
  if (trades.length < 10) {
    return computeKelly(0, 0, 1); // insufficient data
  }

  const winners = trades.filter((t) => t.pnl > 0);
  const losers = trades.filter((t) => t.pnl < 0);

  if (losers.length === 0 || winners.length === 0) {
    return computeKelly(winners.length / trades.length, 1, 1);
  }

  const winRate = winners.length / trades.length;
  const avgWin = winners.reduce((s, t) => s + t.pnl, 0) / winners.length;
  const avgLoss = Math.abs(losers.reduce((s, t) => s + t.pnl, 0) / losers.length);

  return computeKelly(winRate, avgWin, avgLoss);
}

export default { computeKelly, kellyFromTrades };
