// ═══════════════════════════════════════════════════════════════════
// charEdge — Topic Tag Generator
//
// Auto-extracts topic tags from market titles/descriptions with counts.
// Powers the left sidebar topic filter (Bitcoin 522, Trump 306, AI 112).
// Also generates subcategory pills per category.
// ═══════════════════════════════════════════════════════════════════

// ─── Known topic entities ──────────────────────────────────────────
const TOPIC_ENTITIES = [
  // Crypto
  { tag: 'Bitcoin', keywords: ['bitcoin', 'btc'], category: 'crypto' },
  { tag: 'Ethereum', keywords: ['ethereum', 'eth'], category: 'crypto' },
  { tag: 'Solana', keywords: ['solana', 'sol'], category: 'crypto' },
  { tag: 'DeFi', keywords: ['defi', 'dex'], category: 'crypto' },

  // Finance
  { tag: 'Stocks', keywords: ['stock', 'close above', 'close below', 'company'], category: 'finance' },
  { tag: 'Earnings', keywords: ['earnings', 'eps', 'revenue beat'], category: 'finance' },
  { tag: 'Indices', keywords: ['s&p', 'nasdaq', 'dow', 'index'], category: 'finance' },
  { tag: 'Gold', keywords: ['gold', 'gc'], category: 'finance' },
  { tag: 'Silver', keywords: ['silver', 'si'], category: 'finance' },
  { tag: 'Commodities', keywords: ['commodity', 'wheat', 'copper', 'crude'], category: 'finance' },
  { tag: 'Forex', keywords: ['forex', 'usd', 'eur', 'gbp', 'yen'], category: 'finance' },
  { tag: 'IPOs', keywords: ['ipo'], category: 'finance' },

  // Economy
  { tag: 'Fed Rates', keywords: ['fed', 'fomc', 'rate cut', 'rate hike', 'basis point'], category: 'economy' },
  { tag: 'Inflation', keywords: ['cpi', 'inflation', 'pce'], category: 'economy' },
  { tag: 'GDP', keywords: ['gdp'], category: 'economy' },
  { tag: 'Housing', keywords: ['housing', 'mortgage', 'home'], category: 'economy' },
  { tag: 'Jobs', keywords: ['jobs', 'unemployment', 'labor', 'payroll', 'layoff'], category: 'economy' },
  { tag: 'Oil & Energy', keywords: ['oil', 'gas price', 'energy', 'opec'], category: 'economy' },
  { tag: 'Treasuries', keywords: ['treasury', 'bond', 'yield'], category: 'economy' },

  // Politics
  { tag: 'Trump', keywords: ['trump'], category: 'politics' },
  { tag: 'Elections', keywords: ['election', 'vote', 'ballot'], category: 'politics' },
  { tag: 'Midterms', keywords: ['midterm'], category: 'politics' },
  { tag: 'Congress', keywords: ['congress', 'senate', 'house'], category: 'politics' },

  // Tech
  { tag: 'AI', keywords: ['ai', 'artificial intelligence', 'chatgpt', 'openai'], category: 'tech' },
  { tag: 'NVIDIA', keywords: ['nvidia', 'nvda'], category: 'tech' },
  { tag: 'Tesla', keywords: ['tesla', 'tsla'], category: 'tech' },
  { tag: 'Apple', keywords: ['apple', 'aapl'], category: 'tech' },
  { tag: 'SpaceX', keywords: ['spacex'], category: 'tech' },
  { tag: 'Elon Musk', keywords: ['elon musk', 'musk'], category: 'tech' },

  // Geopolitics
  { tag: 'China', keywords: ['china', 'chinese', 'beijing'], category: 'geopolitics' },
  { tag: 'Russia', keywords: ['russia', 'russian', 'moscow', 'ukraine'], category: 'geopolitics' },
  { tag: 'Iran', keywords: ['iran', 'iranian', 'tehran'], category: 'geopolitics' },
  { tag: 'NATO', keywords: ['nato'], category: 'geopolitics' },

  // Climate
  { tag: 'Weather', keywords: ['weather', 'hurricane', 'storm', 'temperature'], category: 'climate' },
  { tag: 'Earthquakes', keywords: ['earthquake', 'seismic'], category: 'climate' },
];

/**
 * Generate topic tags with counts from a list of markets.
 * @param {Array} markets
 * @returns {Array<{tag: string, count: number, category: string}>}
 */
export function generateTags(markets) {
  if (!markets?.length) return [];

  const tagCounts = new Map();

  for (const market of markets) {
    const text = `${market.question || ''} ${(market.tags || []).join(' ')}`.toLowerCase();

    for (const entity of TOPIC_ENTITIES) {
      if (entity.keywords.some((kw) => text.includes(kw))) {
        const existing = tagCounts.get(entity.tag) || { tag: entity.tag, count: 0, category: entity.category };
        existing.count++;
        tagCounts.set(entity.tag, existing);
      }
    }
  }

  return [...tagCounts.values()].sort((a, b) => b.count - a.count);
}

/**
 * Generate subcategory pills for a specific category.
 * @param {Array} markets - Filtered to a specific category
 * @param {string} category
 * @returns {Array<{sub: string, count: number}>}
 */
export function generateSubcategories(markets, _category) {
  if (!markets?.length) return [];

  const subCounts = new Map();

  for (const market of markets) {
    const sub = market.subcategory;
    if (sub) {
      subCounts.set(sub, (subCounts.get(sub) || 0) + 1);
    }
  }

  return [...subCounts.entries()].map(([sub, count]) => ({ sub, count })).sort((a, b) => b.count - a.count);
}

/**
 * Filter markets by a specific topic tag.
 * @param {Array} markets
 * @param {string} tag
 * @returns {Array}
 */
export function filterByTag(markets, tag) {
  const entity = TOPIC_ENTITIES.find((e) => e.tag === tag);
  if (!entity) return markets;

  return markets.filter((m) => {
    const text = `${m.question || ''} ${(m.tags || []).join(' ')}`.toLowerCase();
    return entity.keywords.some((kw) => text.includes(kw));
  });
}

/**
 * Filter markets by multiple tags (AND logic).
 * @param {Array} markets
 * @param {string[]} tags
 * @returns {Array}
 */
export function filterByTags(markets, tags) {
  if (!tags?.length) return markets;
  let filtered = markets;
  for (const tag of tags) {
    filtered = filterByTag(filtered, tag);
  }
  return filtered;
}
