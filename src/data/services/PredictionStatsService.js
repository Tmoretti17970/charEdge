// ═══════════════════════════════════════════════════════════════════
// charEdge — Prediction Market Stats Service
//
// Computes aggregate statistics across all markets.
// Powers the header stats bar (total markets, volume, OI, liquidity).
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute aggregate stats from a list of markets.
 * @param {Array} markets
 * @returns {Object} Aggregated statistics
 */
export function computeStats(markets) {
  if (!markets?.length) {
    return {
      totalActiveMarkets: 0,
      totalVolume: 0,
      volume24h: 0,
      totalOpenInterest: 0,
      totalLiquidity: 0,
      categoryCounts: {},
      sourceCounts: {},
      avgProbability: 0,
      marketsByType: { binary: 0, multi: 0, scalar: 0 },
    };
  }

  let totalVolume = 0;
  let volume24h = 0;
  let totalOpenInterest = 0;
  let totalLiquidity = 0;
  let probSum = 0;
  const categoryCounts = {};
  const sourceCounts = {};
  const marketsByType = { binary: 0, multi: 0, scalar: 0 };

  for (const m of markets) {
    totalVolume += m.totalVolume || 0;
    volume24h += m.volume24h || 0;
    totalOpenInterest += m.openInterest || 0;
    totalLiquidity += m.liquidity || 0;

    // Leading outcome probability
    const leadProb = m.outcomes?.[0]?.probability || 0;
    probSum += leadProb;

    // Category counts
    const cat = m.category || 'other';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

    // Source counts
    const src = m.source || 'unknown';
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;

    // Market type counts
    const type = m.marketType || 'binary';
    marketsByType[type] = (marketsByType[type] || 0) + 1;
  }

  return {
    totalActiveMarkets: markets.length,
    totalVolume,
    volume24h,
    totalOpenInterest,
    totalLiquidity,
    categoryCounts,
    sourceCounts,
    avgProbability: Math.round(probSum / markets.length),
    marketsByType,
  };
}

/**
 * Format a large number for stat display.
 * @param {number} value
 * @returns {string}
 */
export function formatStatValue(value) {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (value > 0) return `$${value.toFixed(0)}`;
  return '$0';
}

/**
 * Format market count with comma separators.
 * @param {number} count
 * @returns {string}
 */
export function formatCount(count) {
  return count.toLocaleString('en-US');
}
