// ═══════════════════════════════════════════════════════════════════
// charEdge — Manifold Markets Adapter
//
// Fetches prediction markets from Manifold Markets — play-money
// but highly liquid with diverse topics. Good signal source.
// No auth needed for public reads.
//
// API Docs: https://docs.manifold.markets/api
// ═══════════════════════════════════════════════════════════════════

import { createMarket } from '../schemas/PredictionMarketSchema.js';

const BASE_URL = 'https://api.manifold.markets/v0';
const HEADERS = { Accept: 'application/json' };

// ─── Category rules ────────────────────────────────────────────
const CATEGORY_RULES = [
  {
    category: 'economy',
    keywords: ['fed', 'gdp', 'inflation', 'cpi', 'recession', 'unemployment', 'rate', 'treasury'],
  },
  { category: 'finance', keywords: ['stock', 's&p', 'nasdaq', 'market', 'earnings', 'ipo', 'gold', 'oil'] },
  { category: 'crypto', keywords: ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'solana', 'defi'] },
  {
    category: 'politics',
    keywords: ['election', 'president', 'congress', 'vote', 'democrat', 'republican', 'trump', 'tariff'],
  },
  { category: 'tech', keywords: ['ai', 'agi', 'spacex', 'tesla', 'nvidia', 'apple', 'google', 'openai', 'gpt'] },
  { category: 'science', keywords: ['space', 'nasa', 'mars', 'research', 'physics', 'biology'] },
  { category: 'geopolitics', keywords: ['china', 'russia', 'iran', 'nato', 'war', 'ukraine', 'military'] },
  { category: 'health', keywords: ['covid', 'pandemic', 'fda', 'drug', 'outbreak'] },
  { category: 'climate', keywords: ['climate', 'temperature', 'carbon', 'hurricane', 'earthquake'] },
  { category: 'sports', keywords: ['nfl', 'nba', 'mlb', 'soccer', 'championship', 'super bowl', 'world cup'] },
  { category: 'entertainment', keywords: ['oscar', 'grammy', 'movie', 'album', 'streaming', 'box office'] },
  { category: 'culture', keywords: ['tiktok', 'social media', 'viral', 'celebrity', 'meme'] },
];

// ═══════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetch active markets from Manifold, sorted by liquidity.
 */
export async function fetchManifoldMarkets({ category: _category, limit = 50 } = {}) {
  try {
    const params = new URLSearchParams({
      sort: 'liquidity',
      filter: 'open',
      limit: String(limit),
    });

    const res = await fetch(`${BASE_URL}/search-markets?${params}`, { headers: HEADERS });

    if (!res.ok) return getFallbackData();

    const markets = await res.json();
    if (!Array.isArray(markets)) return getFallbackData();

    return markets
      .filter((m) => !m.isResolved && m.closeTime > Date.now())
      .slice(0, limit)
      .map(normalizeManifoldMarket)
      .filter(Boolean);
  } catch {
    return getFallbackData();
  }
}

// ═══════════════════════════════════════════════════════════════════
// Normalization
// ═══════════════════════════════════════════════════════════════════

function normalizeManifoldMarket(market) {
  const title = market.question || '';
  const category = categorize(title, market.groupSlugs || []);

  if (market.outcomeType === 'BINARY') {
    const probability = Math.round((market.probability || 0.5) * 100);
    const prevProb = market.prob24HoursAgo != null ? Math.round(market.prob24HoursAgo * 100) : probability;

    return createMarket({
      id: `manifold-${market.id}`,
      source: 'manifold',
      question: title,
      description: market.textDescription?.slice(0, 300) || '',
      category,
      subcategory: null,
      outcomes: [
        {
          label: 'Yes',
          probability,
          previousProbability: prevProb,
          volume: Math.round(market.volume24Hours || 0),
          payoutMultiplier: probability > 0 ? Math.round((100 / probability) * 100) / 100 : 0,
        },
        {
          label: 'No',
          probability: 100 - probability,
          previousProbability: 100 - prevProb,
          volume: 0,
          payoutMultiplier: probability < 100 ? Math.round((100 / (100 - probability)) * 100) / 100 : 0,
        },
      ],
      marketType: 'binary',
      status: 'open',
      volume24h: Math.round(market.volume24Hours || 0),
      totalVolume: Math.round(market.volume || 0),
      liquidity: Math.round(market.totalLiquidity || 0),
      change24h: probability - prevProb,
      closeDate: market.closeTime ? new Date(market.closeTime).toISOString() : null,
      createdDate: market.createdTime ? new Date(market.createdTime).toISOString() : null,
      resolutionSource: `Manifold (${market.creatorUsername || 'community'})`,
      relatedTickers: extractTickers(title),
      tags: extractTags(title, market.groupSlugs),
      imageUrl: market.coverImageUrl || null,
      url: `https://manifold.markets/${market.creatorUsername}/${market.slug}`,
    });
  }

  if (market.outcomeType === 'MULTIPLE_CHOICE' && market.answers?.length) {
    const outcomes = market.answers
      .filter((a) => !a.isOther)
      .map((a) => ({
        label: a.text || 'Unknown',
        probability: Math.round((a.probability || 0) * 100),
        previousProbability: Math.round((a.probability || 0) * 100),
        volume: 0,
        payoutMultiplier: a.probability > 0 ? Math.round((1 / a.probability) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.probability - a.probability);

    if (outcomes.length === 0) return null;

    return createMarket({
      id: `manifold-${market.id}`,
      source: 'manifold',
      question: title,
      description: market.textDescription?.slice(0, 300) || '',
      category,
      subcategory: null,
      outcomes,
      marketType: 'multi',
      status: 'open',
      volume24h: Math.round(market.volume24Hours || 0),
      totalVolume: Math.round(market.volume || 0),
      liquidity: Math.round(market.totalLiquidity || 0),
      change24h: 0,
      closeDate: market.closeTime ? new Date(market.closeTime).toISOString() : null,
      createdDate: market.createdTime ? new Date(market.createdTime).toISOString() : null,
      resolutionSource: `Manifold (${market.creatorUsername || 'community'})`,
      relatedTickers: extractTickers(title),
      tags: extractTags(title, market.groupSlugs),
      imageUrl: market.coverImageUrl || null,
      url: `https://manifold.markets/${market.creatorUsername}/${market.slug}`,
    });
  }

  return null;
}

// ─── Helpers ───────────────────────────────────────────────────

function categorize(title, groupSlugs) {
  const text = `${title} ${groupSlugs.join(' ')}`.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => text.includes(kw))) return rule.category;
  }
  return 'other';
}

function extractTickers(text) {
  const tickers = [];
  const patterns = [/\b(NVDA|AAPL|MSFT|GOOGL|META|AMZN|TSLA|AMD|SPY|QQQ)\b/g, /\bBTC\b/gi, /\bETH\b/gi, /\bSOL\b/gi];
  for (const p of patterns) {
    p.lastIndex = 0;
    const m = text.match(p);
    if (m) tickers.push(...m.map((t) => t.toUpperCase()));
  }
  return [...new Set(tickers)];
}

function extractTags(title, groupSlugs = []) {
  const tags = groupSlugs
    .filter((s) => s.length > 2 && s.length < 30)
    .slice(0, 5)
    .map((s) => s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));

  const text = title.toLowerCase();
  const TOPIC_KEYWORDS = [
    'ai',
    'bitcoin',
    'climate',
    'china',
    'russia',
    'election',
    'fed',
    'inflation',
    'spacex',
    'tesla',
    'war',
    'trump',
    'openai',
    'gpt',
  ];
  for (const kw of TOPIC_KEYWORDS) {
    if (text.includes(kw)) {
      const tag = kw.charAt(0).toUpperCase() + kw.slice(1);
      if (!tags.includes(tag)) tags.push(tag);
    }
  }
  return [...new Set(tags)];
}

// ─── Fallback data ─────────────────────────────────────────────

function getFallbackData() {
  return [
    createMarket({
      id: 'manifold-ai-2026',
      source: 'manifold',
      question: 'Will GPT-5 be released by end of 2026?',
      category: 'tech',
      outcomes: [
        { label: 'Yes', probability: 78, previousProbability: 75, volume: 45000, payoutMultiplier: 1.28 },
        { label: 'No', probability: 22, previousProbability: 25, volume: 12000, payoutMultiplier: 4.55 },
      ],
      marketType: 'binary',
      volume24h: 8500,
      totalVolume: 142000,
      liquidity: 35000,
      change24h: 3,
      closeDate: '2026-12-31T23:59:00Z',
      tags: ['AI', 'Openai', 'Gpt'],
      url: 'https://manifold.markets/example/gpt5-2026',
    }),
    createMarket({
      id: 'manifold-ww3-2030',
      source: 'manifold',
      question: 'Will World War 3 begin before 2030?',
      category: 'geopolitics',
      outcomes: [
        { label: 'Yes', probability: 5, previousProbability: 6, volume: 28000, payoutMultiplier: 20.0 },
        { label: 'No', probability: 95, previousProbability: 94, volume: 0, payoutMultiplier: 1.05 },
      ],
      marketType: 'binary',
      volume24h: 3200,
      totalVolume: 89000,
      liquidity: 22000,
      change24h: -1,
      closeDate: '2030-01-01T00:00:00Z',
      tags: ['War', 'Geopolitics'],
      url: 'https://manifold.markets/example/ww3-2030',
    }),
    createMarket({
      id: 'manifold-btc-200k',
      source: 'manifold',
      question: 'Will Bitcoin reach $200,000 by 2027?',
      category: 'crypto',
      outcomes: [
        { label: 'Yes', probability: 32, previousProbability: 30, volume: 67000, payoutMultiplier: 3.13 },
        { label: 'No', probability: 68, previousProbability: 70, volume: 0, payoutMultiplier: 1.47 },
      ],
      marketType: 'binary',
      volume24h: 12400,
      totalVolume: 210000,
      liquidity: 55000,
      change24h: 2,
      closeDate: '2027-01-01T00:00:00Z',
      tags: ['Bitcoin', 'Crypto'],
      url: 'https://manifold.markets/example/btc-200k',
    }),
  ];
}

export default { fetchManifoldMarkets };
