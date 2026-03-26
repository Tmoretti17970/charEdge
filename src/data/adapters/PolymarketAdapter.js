// ═══════════════════════════════════════════════════════════════════
// charEdge — Polymarket Prediction Market Adapter
//
// Fetches live prediction market data from Polymarket's Gamma API.
// Largest prediction market by volume. No auth for public reads.
//
// API Docs: https://docs.polymarket.com
// Gamma API: https://gamma-api.polymarket.com
// ═══════════════════════════════════════════════════════════════════

const GAMMA_URL = 'https://gamma-api.polymarket.com';

/**
 * Fetch active markets from Polymarket, filtered for trader relevance.
 * @param {Object} opts
 * @param {string} [opts.category] - Filter by tag
 * @param {number} [opts.limit=20] - Max markets to return
 * @returns {Promise<Array<NormalizedPrediction>>}
 */
export async function fetchPolymarketMarkets({ category, limit = 20 } = {}) {
  try {
    const params = new URLSearchParams({
      limit: String(limit),
      active: 'true',
      closed: 'false',
      order: 'volume24hr',
      ascending: 'false',
    });
    if (category) params.set('tag', category);

    const res = await fetch(`${GAMMA_URL}/markets?${params}`, {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      return getFallbackData();
    }

    const markets = await res.json();
    if (!Array.isArray(markets)) {
      return getFallbackData();
    }

    return markets
      .filter((m) => m.active && !m.closed)
      .slice(0, limit)
      .map(normalizePolymarketMarket);
  } catch {
    return getFallbackData();
  }
}

/**
 * Normalize a Polymarket market response to our common schema.
 */
function normalizePolymarketMarket(market) {
  // Polymarket returns outcome prices as decimal (0.72 = 72%)
  const outcomePrices = market.outcomePrices
    ? JSON.parse(typeof market.outcomePrices === 'string' ? market.outcomePrices : JSON.stringify(market.outcomePrices))
    : [0.5, 0.5];

  const probability = Math.round((parseFloat(outcomePrices[0]) || 0.5) * 100);

  return {
    id: `poly-${market.id || market.conditionId}`,
    source: 'polymarket',
    question: market.question || market.title || 'Unknown market',
    category: categorizePolymarket(market),
    probability,
    volume24h: parseFloat(market.volume24hr) || 0,
    openInterest: parseFloat(market.liquidityNum) || parseFloat(market.liquidity) || 0,
    change24h: market.previousPrice ? probability - Math.round(parseFloat(market.previousPrice) * 100) : 0,
    closeDate: market.endDate || market.expirationDate,
    relatedTickers: extractTickers(market.question || market.title || ''),
    url: `https://polymarket.com/event/${market.slug || market.id}`,
  };
}

function categorizePolymarket(market) {
  const tags = (market.tags || []).map((t) => (typeof t === 'string' ? t : t.label || '').toLowerCase());
  const question = (market.question || market.title || '').toLowerCase();

  if (
    tags.some((t) => t.includes('econom') || t.includes('fed') || t.includes('inflation')) ||
    question.includes('fed') ||
    question.includes('rate') ||
    question.includes('gdp') ||
    question.includes('inflation')
  )
    return 'economics';
  if (
    tags.some((t) => t.includes('finance') || t.includes('stock') || t.includes('market')) ||
    question.includes('s&p') ||
    question.includes('nasdaq') ||
    question.includes('earnings')
  )
    return 'markets';
  if (
    tags.some((t) => t.includes('crypto') || t.includes('bitcoin')) ||
    question.includes('bitcoin') ||
    question.includes('btc') ||
    question.includes('ethereum')
  )
    return 'crypto';
  if (
    tags.some((t) => t.includes('politic') || t.includes('election')) ||
    question.includes('election') ||
    question.includes('president') ||
    question.includes('tariff')
  )
    return 'politics';
  return 'other';
}

function extractTickers(text) {
  const tickers = [];
  const patterns = [
    /\b(NVDA|AAPL|MSFT|GOOGL|META|AMZN|TSLA|AMD|SPY|QQQ)\b/g,
    /\bS&P\s*500\b/gi,
    /\bBTC\b/gi,
    /\bETH\b/gi,
  ];
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) tickers.push(...matches.map((m) => m.toUpperCase().replace(/\s+/g, '')));
  }
  return [...new Set(tickers)];
}

/**
 * Fallback data when API is unavailable (demo/offline mode).
 */
function getFallbackData() {
  return [
    {
      id: 'poly-nvda-beat',
      source: 'polymarket',
      question: 'Will NVDA beat Q2 2026 earnings expectations?',
      category: 'markets',
      probability: 85,
      volume24h: 2100000,
      openInterest: 6500000,
      change24h: 5,
      closeDate: '2026-05-28T20:00:00Z',
      relatedTickers: ['NVDA'],
      url: 'https://polymarket.com/event/nvda-earnings',
    },
    {
      id: 'poly-btc-150k',
      source: 'polymarket',
      question: 'Will Bitcoin exceed $150,000 by December 2026?',
      category: 'crypto',
      probability: 44,
      volume24h: 6500000,
      openInterest: 18000000,
      change24h: 3,
      closeDate: '2026-12-31T23:59:00Z',
      relatedTickers: ['BTC'],
      url: 'https://polymarket.com/event/btc-150k',
    },
    {
      id: 'poly-tariff-china',
      source: 'polymarket',
      question: 'Will US impose additional tariffs on China before July 2026?',
      category: 'politics',
      probability: 67,
      volume24h: 3400000,
      openInterest: 11000000,
      change24h: -4,
      closeDate: '2026-07-01T00:00:00Z',
      relatedTickers: [],
      url: 'https://polymarket.com/event/china-tariffs',
    },
    {
      id: 'poly-eth-5k',
      source: 'polymarket',
      question: 'Will Ethereum reach $5,000 by Q3 2026?',
      category: 'crypto',
      probability: 31,
      volume24h: 1800000,
      openInterest: 5200000,
      change24h: -2,
      closeDate: '2026-09-30T23:59:00Z',
      relatedTickers: ['ETH'],
      url: 'https://polymarket.com/event/eth-5k',
    },
  ];
}

export default { fetchPolymarketMarkets };
