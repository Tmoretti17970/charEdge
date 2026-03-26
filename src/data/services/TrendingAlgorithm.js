// ═══════════════════════════════════════════════════════════════════
// charEdge — Trending Algorithm
//
// Ranks prediction markets by "trending" score combining
// volume momentum, probability movement, recency, and activity.
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute a trending score for each market and return sorted list.
 * Score formula:
 *   volume_score * 0.35 + probability_delta * 0.30 + recency * 0.20 + activity * 0.15
 *
 * @param {Array} markets - All markets
 * @returns {Array} Markets sorted by trending score (descending), with `trendingScore` attached
 */
export function computeTrending(markets) {
  if (!markets?.length) return [];

  // Compute max values for normalization
  const maxVolume = Math.max(...markets.map((m) => m.volume24h || 0), 1);
  const maxDelta = Math.max(...markets.map((m) => Math.abs(m.change24h || 0)), 1);

  const now = Date.now();
  const DAY_MS = 86_400_000;

  return markets
    .map((market) => {
      // Volume score (0-1): normalized volume
      const volumeScore = (market.volume24h || 0) / maxVolume;

      // Probability delta score (0-1): how much the leading outcome moved
      const deltaScore = Math.abs(market.change24h || 0) / maxDelta;

      // Recency score (0-1): markets created recently score higher
      const createdMs = market.createdDate ? new Date(market.createdDate).getTime() : 0;
      const ageMs = now - createdMs;
      const recencyScore = createdMs > 0 ? Math.max(0, 1 - ageMs / (30 * DAY_MS)) : 0.3;

      // Activity score (0-1): markets closing soon with high volume
      const closeMs = market.closeDate ? new Date(market.closeDate).getTime() : Infinity;
      const timeToClose = closeMs - now;
      const closingSoonBonus = timeToClose > 0 && timeToClose < 7 * DAY_MS ? 0.8 : 0;
      const activityScore = Math.min(1, volumeScore * 0.5 + closingSoonBonus * 0.5);

      // Weighted trending score
      const trendingScore = volumeScore * 0.35 + deltaScore * 0.3 + recencyScore * 0.2 + activityScore * 0.15;

      return { ...market, trendingScore: Math.round(trendingScore * 100) };
    })
    .sort((a, b) => b.trendingScore - a.trendingScore);
}

/**
 * Get top N trending markets.
 */
export function getTopTrending(markets, n = 10) {
  return computeTrending(markets).slice(0, n);
}

/**
 * Identify "breaking" markets — >10% probability shift in recent period.
 */
export function getBreakingMarkets(markets) {
  return markets.filter((m) => Math.abs(m.change24h || 0) >= 10);
}
