// ═══════════════════════════════════════════════════════════════════
// charEdge — Cross-Asset Correlation
//
// Correlates prediction market probabilities with real asset prices.
// E.g., "Fed rate cut probability" vs S&P 500 price.
// ═══════════════════════════════════════════════════════════════════

/**
 * Find prediction markets that correlate with a given asset.
 * @param {Array} markets - Prediction markets
 * @param {string} ticker - Asset ticker (SPY, BTC, etc.)
 * @returns {Array} Markets related to this asset, sorted by relevance
 */
export function findCorrelatedMarkets(markets, ticker) {
  const tickerUpper = ticker.toUpperCase();

  return markets
    .map((market) => {
      let relevance = 0;

      // Direct ticker match
      if (market.relatedTickers?.includes(tickerUpper)) relevance += 10;

      // Question text match
      const q = (market.question || '').toLowerCase();
      if (q.includes(ticker.toLowerCase())) relevance += 8;

      // Tag match
      if (market.tags?.some((t) => t.toLowerCase().includes(ticker.toLowerCase()))) relevance += 5;

      // Category-based correlation
      if (tickerUpper === 'SPY' || tickerUpper === 'QQQ') {
        if (market.category === 'economy' || market.category === 'finance') relevance += 3;
      }
      if (tickerUpper === 'BTC' || tickerUpper === 'ETH') {
        if (market.category === 'crypto') relevance += 3;
      }
      if (tickerUpper === 'GLD' || tickerUpper === 'SLV') {
        if (market.category === 'finance') relevance += 2;
      }

      return { market, relevance };
    })
    .filter((r) => r.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance)
    .map((r) => ({
      ...r.market,
      correlationRelevance: r.relevance,
    }));
}

/**
 * Build a correlation map: which assets are most referenced by prediction markets.
 * @param {Array} markets
 * @returns {Array<{ticker: string, marketCount: number, avgProbability: number, sentiment: string}>}
 */
export function buildAssetCorrelationMap(markets) {
  const tickerMap = new Map();

  for (const market of markets) {
    for (const ticker of market.relatedTickers || []) {
      if (!tickerMap.has(ticker)) {
        tickerMap.set(ticker, { ticker, markets: [], probSum: 0, count: 0 });
      }
      const entry = tickerMap.get(ticker);
      entry.markets.push(market);
      entry.probSum += market.outcomes?.[0]?.probability || 50;
      entry.count++;
    }
  }

  return [...tickerMap.values()]
    .map((entry) => ({
      ticker: entry.ticker,
      marketCount: entry.count,
      avgProbability: Math.round(entry.probSum / entry.count),
      sentiment:
        entry.probSum / entry.count >= 60 ? 'Bullish' : entry.probSum / entry.count <= 40 ? 'Bearish' : 'Mixed',
      markets: entry.markets.map((m) => ({
        id: m.id,
        question: m.question,
        probability: m.outcomes?.[0]?.probability || 0,
      })),
    }))
    .sort((a, b) => b.marketCount - a.marketCount);
}

/**
 * Get the prediction-implied outlook for a specific asset.
 */
export function getAssetOutlook(markets, ticker) {
  const correlated = findCorrelatedMarkets(markets, ticker);
  if (correlated.length === 0) return null;

  const avgProb = correlated.reduce((s, m) => s + (m.outcomes?.[0]?.probability || 50), 0) / correlated.length;
  const avgDelta = correlated.reduce((s, m) => s + (m.change24h || 0), 0) / correlated.length;

  return {
    ticker,
    marketCount: correlated.length,
    avgProbability: Math.round(avgProb),
    avgDelta24h: Math.round(avgDelta * 10) / 10,
    sentiment: avgProb >= 65 ? 'Bullish' : avgProb <= 35 ? 'Bearish' : 'Mixed',
    momentum: avgDelta > 1 ? 'Improving' : avgDelta < -1 ? 'Deteriorating' : 'Stable',
    topMarkets: correlated.slice(0, 5),
  };
}
