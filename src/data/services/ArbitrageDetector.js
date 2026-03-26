// ═══════════════════════════════════════════════════════════════════
// charEdge — Arbitrage Detector
//
// Identifies same events with different probabilities across platforms.
// Flags opportunities where cross-platform spread > threshold.
// ═══════════════════════════════════════════════════════════════════

const DEFAULT_THRESHOLD = 5; // % spread to flag

/**
 * Detect arbitrage opportunities across platforms.
 * Uses sourceVariants[] from the deduplication engine.
 *
 * @param {Array} markets - All markets (with sourceVariants populated)
 * @param {number} threshold - Minimum spread % to flag
 * @returns {Array<ArbitrageOpportunity>}
 */
export function detectArbitrage(markets, threshold = DEFAULT_THRESHOLD) {
  const opportunities = [];

  for (const market of markets) {
    if (!market.sourceVariants?.length) continue;

    const allVersions = [market, ...market.sourceVariants];
    if (allVersions.length < 2) continue;

    // Get leading outcome probability from each source
    const prices = allVersions.map((v) => ({
      source: v.source,
      probability: v.outcomes?.[0]?.probability || 0,
      volume: v.volume24h || 0,
      url: v.url,
    }));

    const maxPrice = Math.max(...prices.map((p) => p.probability));
    const minPrice = Math.min(...prices.map((p) => p.probability));
    const spread = maxPrice - minPrice;

    if (spread >= threshold) {
      const buyFrom = prices.find((p) => p.probability === minPrice);
      const sellAt = prices.find((p) => p.probability === maxPrice);

      opportunities.push({
        marketId: market.id,
        question: market.question,
        category: market.category,
        spread,
        buyFrom: { source: buyFrom.source, price: buyFrom.probability, url: buyFrom.url },
        sellAt: { source: sellAt.source, price: sellAt.probability, url: sellAt.url },
        estimatedEdge: spread,
        totalVolume: prices.reduce((sum, p) => sum + p.volume, 0),
        confidence: spread >= 10 ? 'high' : spread >= 7 ? 'medium' : 'low',
        detectedAt: Date.now(),
      });
    }
  }

  return opportunities.sort((a, b) => b.spread - a.spread);
}

/**
 * Get high-confidence arbitrage opportunities only.
 */
export function getHighConfidenceArbitrage(markets) {
  return detectArbitrage(markets, 10);
}

/**
 * Compute total potential edge across all opportunities.
 */
export function computeTotalEdge(markets) {
  const opps = detectArbitrage(markets);
  return {
    count: opps.length,
    totalSpread: opps.reduce((sum, o) => sum + o.spread, 0),
    avgSpread: opps.length > 0 ? opps.reduce((sum, o) => sum + o.spread, 0) / opps.length : 0,
    highConfidence: opps.filter((o) => o.confidence === 'high').length,
  };
}
