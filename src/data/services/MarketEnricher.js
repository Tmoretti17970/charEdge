// ═══════════════════════════════════════════════════════════════════
// charEdge — Market Metadata Enricher
//
// Enriches prediction markets with related asset prices, sector data,
// and upcoming economic events.
// ═══════════════════════════════════════════════════════════════════

/**
 * Enrich markets with additional context.
 * @param {Array} markets
 * @param {Object} context - { prices, events }
 * @returns {Array} Enriched markets
 */
export function enrichMarkets(markets, context = {}) {
  const { prices = {}, events = [] } = context;

  return markets.map((market) => {
    const enrichments = {};

    // Attach current prices for related tickers
    if (market.relatedTickers?.length > 0 && Object.keys(prices).length > 0) {
      enrichments.tickerPrices = market.relatedTickers
        .filter((t) => prices[t])
        .map((t) => ({ ticker: t, price: prices[t].price, change: prices[t].change24h }));
    }

    // Find related upcoming events
    if (events.length > 0) {
      enrichments.relatedEvents = events
        .filter((event) => {
          const marketText = market.question.toLowerCase();
          const eventText = (event.title || '').toLowerCase();
          return (
            market.relatedTickers?.some((t) => eventText.includes(t.toLowerCase())) ||
            ['fed', 'cpi', 'gdp', 'jobs', 'earnings'].some((kw) => marketText.includes(kw) && eventText.includes(kw))
          );
        })
        .slice(0, 3);
    }

    // Compute market health score (0-100)
    enrichments.healthScore = computeHealthScore(market);

    return Object.keys(enrichments).length > 0 ? { ...market, ...enrichments } : market;
  });
}

/**
 * Compute a health score for a market based on volume, liquidity, and activity.
 */
function computeHealthScore(market) {
  let score = 50; // Base

  // Volume factor
  if (market.volume24h >= 10_000_000) score += 25;
  else if (market.volume24h >= 1_000_000) score += 15;
  else if (market.volume24h >= 100_000) score += 8;
  else if (market.volume24h >= 10_000) score += 3;

  // Liquidity factor
  if (market.liquidity >= 1_000_000) score += 15;
  else if (market.liquidity >= 100_000) score += 8;
  else if (market.liquidity >= 10_000) score += 3;

  // Activity factor (recent probability movement suggests active trading)
  if (Math.abs(market.change24h || 0) > 0) score += 5;
  if (Math.abs(market.change24h || 0) > 5) score += 5;

  return Math.min(100, score);
}

/**
 * Get the health grade for a market.
 */
export function getHealthGrade(score) {
  if (score >= 80) return { grade: 'A', label: 'Excellent', color: '#22c55e' };
  if (score >= 60) return { grade: 'B', label: 'Good', color: '#84cc16' };
  if (score >= 40) return { grade: 'C', label: 'Fair', color: '#f59e0b' };
  if (score >= 20) return { grade: 'D', label: 'Low', color: '#f97316' };
  return { grade: 'F', label: 'Thin', color: '#ef4444' };
}
