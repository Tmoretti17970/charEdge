// ═══════════════════════════════════════════════════════════════════
// charEdge — Prediction News Linker
//
// Links news headlines to relevant prediction markets via entity
// matching. Shows "Related News" in the market detail panel.
// ═══════════════════════════════════════════════════════════════════

// ─── Entity keywords for matching ──────────────────────────────
const ENTITY_MAP = {
  // People
  trump: ['trump', 'donald trump', 'president trump'],
  biden: ['biden', 'joe biden', 'president biden'],
  powell: ['powell', 'jerome powell', 'fed chair'],
  musk: ['musk', 'elon musk', 'elon'],

  // Organizations
  fed: ['fed', 'federal reserve', 'fomc', 'rate cut', 'rate hike'],
  spacex: ['spacex', 'space x'],
  nvidia: ['nvidia', 'nvda'],
  tesla: ['tesla', 'tsla'],
  apple: ['apple', 'aapl'],

  // Topics
  bitcoin: ['bitcoin', 'btc', 'crypto'],
  ethereum: ['ethereum', 'eth'],
  inflation: ['inflation', 'cpi', 'consumer price'],
  recession: ['recession', 'economic downturn'],
  election: ['election', 'vote', 'ballot', 'midterm'],
  tariff: ['tariff', 'trade war', 'import tax'],
  ai: ['artificial intelligence', 'ai ', 'chatgpt', 'openai', 'agi'],
  ipo: ['ipo', 'initial public offering', 'going public'],
};

/**
 * Find prediction markets relevant to a news headline.
 * @param {string} headline - News headline
 * @param {Array} markets - All prediction markets
 * @returns {Array} Matching markets sorted by relevance
 */
export function findMarketsForNews(headline, markets) {
  const headlineLower = headline.toLowerCase();
  const headlineEntities = extractEntities(headlineLower);

  return markets
    .map((market) => {
      const marketLower = (market.question || '').toLowerCase();
      const marketEntities = extractEntities(marketLower);

      // Score by entity overlap
      const overlap = headlineEntities.filter((e) => marketEntities.includes(e)).length;
      const directMatch = headlineLower.split(/\s+/).some((w) => w.length > 3 && marketLower.includes(w)) ? 1 : 0;

      return { market, score: overlap * 3 + directMatch };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((r) => r.market);
}

/**
 * Find news items relevant to a specific market.
 * @param {Object} market - A prediction market
 * @param {Array} newsItems - Array of { title, url, source, timestamp }
 * @returns {Array} Matching news items
 */
export function findNewsForMarket(market, newsItems) {
  const marketLower = (market.question || '').toLowerCase();
  const marketEntities = extractEntities(marketLower);
  const marketTickers = (market.relatedTickers || []).map((t) => t.toLowerCase());

  return newsItems
    .map((news) => {
      const newsLower = (news.title || '').toLowerCase();
      const newsEntities = extractEntities(newsLower);

      let score = 0;
      // Entity overlap
      score += marketEntities.filter((e) => newsEntities.includes(e)).length * 3;
      // Ticker mention
      score += marketTickers.filter((t) => newsLower.includes(t)).length * 5;
      // Tag match
      score += (market.tags || []).filter((t) => newsLower.includes(t.toLowerCase())).length * 2;

      return { news, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((r) => r.news);
}

/**
 * Extract entity keys from text.
 */
function extractEntities(text) {
  const found = [];
  for (const [entity, keywords] of Object.entries(ENTITY_MAP)) {
    if (keywords.some((kw) => text.includes(kw))) {
      found.push(entity);
    }
  }
  return found;
}

/**
 * Compute a "news impact score" for a market.
 * Higher score = more news coverage = potentially more volatile.
 */
export function computeNewsImpact(market, newsItems) {
  const related = findNewsForMarket(market, newsItems);
  const recentCount = related.filter(
    (n) => n.timestamp && Date.now() - new Date(n.timestamp).getTime() < 24 * 60 * 60 * 1000,
  ).length;

  return {
    totalRelated: related.length,
    recent24h: recentCount,
    impactLevel: recentCount >= 5 ? 'high' : recentCount >= 2 ? 'medium' : recentCount >= 1 ? 'low' : 'none',
    relatedNews: related,
  };
}
