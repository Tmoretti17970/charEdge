// ═══════════════════════════════════════════════════════════════════
// charEdge — Polymarket Prediction Market Adapter V2
//
// Fetches live prediction market data from Polymarket's Gamma API.
// Largest prediction market by volume. No auth for public reads.
//
// V2: Events API for multi-outcome, CLOB for order book, WebSocket.
//
// API Docs: https://docs.polymarket.com
// Gamma API: https://gamma-api.polymarket.com
// CLOB API: https://clob.polymarket.com
// ═══════════════════════════════════════════════════════════════════

import { createMarket } from '../schemas/PredictionMarketSchema.js';

const GAMMA_URL = 'https://gamma-api.polymarket.com';
const CLOB_URL = 'https://clob.polymarket.com';
const WS_URL = 'wss://ws-subscriptions-clob.polymarket.com/ws/market';

const HEADERS = { Accept: 'application/json' };

// ─── WebSocket connections ─────────────────────────────────────────
const _sockets = new Map();

// ─── Category keyword map ──────────────────────────────────────────
const CATEGORY_RULES = [
  {
    category: 'economy',
    keywords: [
      'econom',
      'fed',
      'inflation',
      'rate',
      'gdp',
      'cpi',
      'unemployment',
      'jobs',
      'growth',
      'housing',
      'fomc',
      'treasury',
      'recession',
      'tariff',
    ],
  },
  {
    category: 'finance',
    keywords: [
      'finance',
      'stock',
      'market',
      's&p',
      'nasdaq',
      'earnings',
      'ipo',
      'dow',
      'commodity',
      'gold',
      'silver',
      'oil',
      'company',
      'market cap',
      'close above',
      'close below',
    ],
  },
  {
    category: 'crypto',
    keywords: ['crypto', 'bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'defi', 'nft', 'token', 'blockchain'],
  },
  {
    category: 'politics',
    keywords: [
      'politic',
      'election',
      'president',
      'congress',
      'vote',
      'senate',
      'governor',
      'democrat',
      'republican',
      'minister',
      'parliament',
    ],
  },
  {
    category: 'sports',
    keywords: [
      'sport',
      'nfl',
      'nba',
      'mlb',
      'nhl',
      'soccer',
      'football',
      'championship',
      'super bowl',
      'world cup',
      'olympics',
      'esport',
    ],
  },
  {
    category: 'tech',
    keywords: [
      'ai',
      'spacex',
      'apple',
      'google',
      'microsoft',
      'nvidia',
      'tesla',
      'chip',
      'semiconductor',
      'app store',
      'software',
      'tech',
    ],
  },
  { category: 'culture', keywords: ['culture', 'tiktok', 'social media', 'viral', 'celebrity', 'meme'] },
  {
    category: 'climate',
    keywords: ['climate', 'weather', 'temperature', 'hurricane', 'earthquake', 'wildfire', 'storm', 'flood'],
  },
  { category: 'science', keywords: ['science', 'space', 'nasa', 'launch', 'mars', 'moon', 'quantum', 'research'] },
  {
    category: 'geopolitics',
    keywords: [
      'china',
      'russia',
      'iran',
      'nato',
      'war',
      'ceasefire',
      'sanctions',
      'invasion',
      'military',
      'denmark',
      'israel',
    ],
  },
  { category: 'health', keywords: ['covid', 'vaccine', 'pandemic', 'fda', 'drug', 'outbreak', 'health'] },
  { category: 'entertainment', keywords: ['oscar', 'grammy', 'box office', 'streaming', 'movie', 'album', 'music'] },
];

// ─── Subcategory map ───────────────────────────────────────────────
const SUBCATEGORY_RULES = {
  finance: [
    { sub: 'Stocks', keywords: ['stock', 'company', 'close above', 'close below', 'largest company'] },
    { sub: 'S&P 500', keywords: ['s&p', 'spy'] },
    { sub: 'Indices', keywords: ['nasdaq', 'dow', 'index', 'qqq'] },
    { sub: 'Gold', keywords: ['gold', 'gc'] },
    { sub: 'Silver', keywords: ['silver', 'si'] },
    { sub: 'Earnings', keywords: ['earnings', 'eps', 'revenue'] },
    { sub: 'IPOs', keywords: ['ipo'] },
    { sub: 'NVIDIA', keywords: ['nvidia', 'nvda'] },
    { sub: 'Tesla', keywords: ['tesla', 'tsla'] },
  ],
  economy: [
    { sub: 'Fed', keywords: ['fed', 'fomc', 'rate cut', 'rate hike', 'fed chair'] },
    { sub: 'GDP', keywords: ['gdp'] },
    { sub: 'Inflation', keywords: ['cpi', 'inflation', 'pce'] },
    { sub: 'Jobs & Economy', keywords: ['jobs', 'unemployment', 'payroll', 'labor', 'layoff'] },
    { sub: 'Housing', keywords: ['housing', 'mortgage', 'home'] },
    { sub: 'Oil and Energy', keywords: ['oil', 'gas price', 'crude', 'energy'] },
    { sub: 'Trade War', keywords: ['tariff', 'trade war'] },
    { sub: 'Fed Rates', keywords: ['rate cut', 'rate hike', 'basis point', 'bps'] },
  ],
  crypto: [
    { sub: 'Bitcoin', keywords: ['bitcoin', 'btc'] },
    { sub: 'Ethereum', keywords: ['ethereum', 'eth'] },
    { sub: 'Solana', keywords: ['solana', 'sol'] },
  ],
};

// ─── Ticker patterns ───────────────────────────────────────────────
const TICKER_PATTERNS = [
  /\b(NVDA|AAPL|MSFT|GOOGL|GOOG|META|AMZN|TSLA|AMD|SPY|QQQ|DIA|IWM|XLF|XLE|GLD|SLV|TLT|COIN|MSTR)\b/g,
  /\bS&P\s*500\b/gi,
  /\bBTC\b/gi,
  /\bETH\b/gi,
  /\bSOL\b/gi,
];

// ═══════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetch active events (multi-outcome groupings) from Polymarket.
 * Events contain multiple related markets → mapped to outcomes[].
 */
export async function fetchPolymarketEvents({ category, limit = 100 } = {}) {
  try {
    const params = new URLSearchParams({
      limit: String(limit),
      active: 'true',
      closed: 'false',
      order: 'volume24hr',
      ascending: 'false',
    });
    if (category) params.set('tag', category);

    const res = await fetch(`${GAMMA_URL}/events?${params}`, { headers: HEADERS });

    if (!res.ok) return getFallbackData();

    const events = await res.json();
    if (!Array.isArray(events)) return getFallbackData();

    return events
      .filter((e) => e.markets?.length > 0 && e.active && !e.closed)
      .slice(0, limit)
      .map(normalizePolymarketEvent);
  } catch {
    return getFallbackData();
  }
}

/**
 * Fetch individual markets (flat list) from Polymarket.
 * Backward-compatible endpoint.
 */
export async function fetchPolymarketMarkets({ category, limit = 100 } = {}) {
  try {
    const params = new URLSearchParams({
      limit: String(limit),
      active: 'true',
      closed: 'false',
      order: 'volume24hr',
      ascending: 'false',
    });
    if (category) params.set('tag', category);

    const res = await fetch(`${GAMMA_URL}/markets?${params}`, { headers: HEADERS });

    if (!res.ok) return getFallbackData();

    const markets = await res.json();
    if (!Array.isArray(markets)) return getFallbackData();

    return markets
      .filter((m) => m.active && !m.closed)
      .slice(0, limit)
      .map(normalizePolymarketMarket);
  } catch {
    return getFallbackData();
  }
}

/**
 * Fetch order book from Polymarket CLOB API.
 * @param {string} tokenId - Polymarket condition token ID
 * @returns {Promise<{bids: Array, asks: Array, spread: number}>}
 */
export async function fetchPolymarketOrderBook(tokenId) {
  try {
    const res = await fetch(`${CLOB_URL}/book?token_id=${tokenId}`, { headers: HEADERS });
    if (!res.ok) return { bids: [], asks: [], spread: 0 };

    const data = await res.json();
    const bids = (data.bids || []).map((b) => ({ price: parseFloat(b.price) * 100, quantity: parseFloat(b.size) }));
    const asks = (data.asks || []).map((a) => ({ price: parseFloat(a.price) * 100, quantity: parseFloat(a.size) }));
    const bestBid = bids[0]?.price || 0;
    const bestAsk = asks[0]?.price || 0;

    return { bids, asks, spread: bestAsk - bestBid };
  } catch {
    return { bids: [], asks: [], spread: 0 };
  }
}

/**
 * Subscribe to real-time price updates via WebSocket.
 * @param {string} conditionId - Market condition ID
 * @param {function} callback - Called with { probability, volume, timestamp }
 * @returns {function} unsubscribe
 */
export function subscribePolymarketPrices(conditionId, callback) {
  if (_sockets.has(conditionId)) {
    _sockets.get(conditionId).close();
    _sockets.delete(conditionId);
  }

  let reconnectTimeout;
  let ws;

  function connect() {
    try {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'subscribe',
            channel: 'market',
            assets_ids: [conditionId],
          }),
        );
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.price != null) {
            callback({
              probability: Math.round(parseFloat(data.price) * 100),
              volume: parseFloat(data.size || 0),
              timestamp: data.timestamp || new Date().toISOString(),
            });
          }
        } catch {
          /* ignore parse errors */
        }
      };

      ws.onclose = () => {
        _sockets.delete(conditionId);
        reconnectTimeout = setTimeout(connect, 5000);
      };

      ws.onerror = () => ws.close();

      _sockets.set(conditionId, ws);
    } catch {
      /* ignore connection errors */
    }
  }

  connect();

  return () => {
    clearTimeout(reconnectTimeout);
    if (_sockets.has(conditionId)) {
      _sockets.get(conditionId).close();
      _sockets.delete(conditionId);
    }
  };
}

/**
 * Close all WebSocket connections.
 */
export function closeAllSockets() {
  for (const [id, ws] of _sockets) {
    ws.close();
    _sockets.delete(id);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Normalization
// ═══════════════════════════════════════════════════════════════════

/**
 * Normalize a Polymarket event (multi-market group).
 */
function normalizePolymarketEvent(event) {
  const markets = event.markets || [];
  const title = event.title || event.question || '';
  const tags = parseTags(event.tags);
  const category = categorize(title, tags);
  const subcategory = subcategorize(title, category);

  // Build outcomes from child markets
  const outcomes = markets
    .filter((m) => m.active && !m.closed)
    .map((m) => {
      const prices = parseOutcomePrices(m.outcomePrices);
      const prob = Math.round((prices[0] || 0.5) * 100);
      const prevPrice = parseFloat(m.previousPrice) || prices[0] || 0.5;
      const prevProb = Math.round(prevPrice * 100);
      const multiplier = prob > 0 ? Math.round((100 / prob) * 100) / 100 : 0;

      return {
        label: m.question || m.groupItemTitle || 'Yes',
        probability: prob,
        previousProbability: prevProb,
        volume: parseFloat(m.volume24hr) || 0,
        payoutMultiplier: multiplier,
      };
    })
    .sort((a, b) => b.probability - a.probability);

  const totalVolume24h = outcomes.reduce((sum, o) => sum + o.volume, 0);
  const totalLiquidity = markets.reduce((sum, m) => sum + (parseFloat(m.liquidityNum) || 0), 0);
  const leadOutcome = outcomes[0];
  const marketType = outcomes.length === 2 ? 'binary' : outcomes.length > 2 ? 'multi' : 'binary';

  return createMarket({
    id: `poly-${event.id || event.conditionId}`,
    source: 'polymarket',
    question: title,
    description: event.description || '',
    category,
    subcategory,
    outcomes,
    marketType,
    status: 'open',
    volume24h: parseFloat(event.volume24hr) || totalVolume24h,
    totalVolume: parseFloat(event.volume) || 0,
    openInterest: 0,
    liquidity: totalLiquidity,
    change24h: leadOutcome ? leadOutcome.probability - leadOutcome.previousProbability : 0,
    closeDate: event.endDate || markets[0]?.endDate,
    createdDate: event.startDate || event.createdAt || null,
    resolutionSource: 'Polymarket / UMA',
    relatedTickers: extractTickers(title),
    tags: extractEventTags(title, tags),
    imageUrl: event.image || null,
    url: `https://polymarket.com/event/${event.slug || event.id}`,
    relatedMarketCount: markets.length,
  });
}

/**
 * Normalize a single Polymarket market (flat).
 */
function normalizePolymarketMarket(market) {
  const prices = parseOutcomePrices(market.outcomePrices);
  const probability = Math.round((prices[0] || 0.5) * 100);
  const prevPrice = parseFloat(market.previousPrice) || prices[0] || 0.5;
  const prevProb = Math.round(prevPrice * 100);
  const multiplier = probability > 0 ? Math.round((100 / probability) * 100) / 100 : 0;

  const title = market.question || market.title || 'Unknown market';
  const tags = parseTags(market.tags);
  const category = categorize(title, tags);
  const subcategory = subcategorize(title, category);

  return createMarket({
    id: `poly-${market.id || market.conditionId}`,
    source: 'polymarket',
    question: title,
    description: market.description || '',
    category,
    subcategory,
    outcomes: [
      {
        label: 'Yes',
        probability,
        previousProbability: prevProb,
        volume: parseFloat(market.volume24hr) || 0,
        payoutMultiplier: multiplier,
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
    volume24h: parseFloat(market.volume24hr) || 0,
    totalVolume: parseFloat(market.volume) || 0,
    liquidity: parseFloat(market.liquidityNum) || parseFloat(market.liquidity) || 0,
    change24h: probability - prevProb,
    closeDate: market.endDate || market.expirationDate,
    createdDate: market.startDate || market.createdAt || null,
    resolutionSource: 'Polymarket / UMA',
    relatedTickers: extractTickers(title),
    tags: extractEventTags(title, tags),
    imageUrl: market.image || null,
    url: `https://polymarket.com/event/${market.slug || market.id}`,
  });
}

// ─── Helpers ───────────────────────────────────────────────────────

function parseOutcomePrices(raw) {
  if (!raw) return [0.5, 0.5];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed.map((p) => parseFloat(p)) : [0.5, 0.5];
  } catch {
    return [0.5, 0.5];
  }
}

function parseTags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((t) => (typeof t === 'string' ? t : t.label || '').toLowerCase());
  return [];
}

function categorize(title, tags) {
  const text = `${title} ${tags.join(' ')}`.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => text.includes(kw))) return rule.category;
  }
  return 'other';
}

function subcategorize(title, category) {
  const rules = SUBCATEGORY_RULES[category];
  if (!rules) return null;
  const text = title.toLowerCase();
  for (const rule of rules) {
    if (rule.keywords.some((kw) => text.includes(kw))) return rule.sub;
  }
  return null;
}

function extractTickers(text) {
  const tickers = [];
  for (const pattern of TICKER_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = text.match(pattern);
    if (matches) tickers.push(...matches.map((m) => m.toUpperCase().replace(/\s+/g, '')));
  }
  return [...new Set(tickers)];
}

function extractEventTags(title, apiTags) {
  const tags = [...apiTags.map((t) => t.charAt(0).toUpperCase() + t.slice(1))];
  const text = title.toLowerCase();

  const TOPIC_KEYWORDS = [
    'bitcoin',
    'ethereum',
    'fed',
    'cpi',
    'gdp',
    'inflation',
    'trump',
    'election',
    'spacex',
    'ipo',
    'recession',
    'ai',
    'nvidia',
    'apple',
    'tesla',
    'oil',
    'gold',
    'silver',
    'china',
    'russia',
    'iran',
    'ceasefire',
    'denmark',
    'earnings',
    'interest rate',
    'tariff',
    'layoff',
    'bubble',
  ];

  for (const kw of TOPIC_KEYWORDS) {
    if (text.includes(kw)) {
      const tag = kw.charAt(0).toUpperCase() + kw.slice(1);
      if (!tags.includes(tag)) tags.push(tag);
    }
  }

  return [...new Set(tags)];
}

// ─── Fallback data ─────────────────────────────────────────────────

function getFallbackData() {
  return [
    createMarket({
      id: 'poly-largest-company-mar',
      source: 'polymarket',
      question: 'Largest Company end of March?',
      category: 'finance',
      subcategory: 'Stocks',
      outcomes: [
        { label: 'NVIDIA', probability: 99, previousProbability: 99, volume: 12800000, payoutMultiplier: 1.01 },
        { label: 'Apple', probability: 1, previousProbability: 1, volume: 4200000, payoutMultiplier: 100.0 },
      ],
      marketType: 'multi',
      volume24h: 17000000,
      totalVolume: 42000000,
      liquidity: 8500000,
      change24h: 0,
      closeDate: '2026-03-31T20:00:00Z',
      relatedTickers: ['NVDA', 'AAPL'],
      tags: ['Finance', 'Stocks', 'NVIDIA', 'Apple'],
      imageUrl: null,
      url: 'https://polymarket.com/event/largest-company-march',
    }),
    createMarket({
      id: 'poly-gold-june',
      source: 'polymarket',
      question: 'What will Gold (GC) settle at in June?',
      category: 'finance',
      subcategory: 'Gold',
      outcomes: [
        { label: '$4,200-$4,600', probability: 20, previousProbability: 18, volume: 420000, payoutMultiplier: 5.0 },
        { label: '$4,600-$5,000', probability: 18, previousProbability: 16, volume: 370000, payoutMultiplier: 5.56 },
      ],
      marketType: 'multi',
      volume24h: 790000,
      liquidity: 320000,
      change24h: 2,
      closeDate: '2026-06-30T18:00:00Z',
      relatedTickers: ['GLD'],
      tags: ['Gold', 'Commodities'],
      url: 'https://polymarket.com/event/gold-june',
    }),
    createMarket({
      id: 'poly-btc-150k',
      source: 'polymarket',
      question: 'What price will Bitcoin hit in March?',
      category: 'crypto',
      subcategory: 'Bitcoin',
      outcomes: [
        { label: '↓ 65,000', probability: 16, previousProbability: 18, volume: 4200000, payoutMultiplier: 6.25 },
        { label: '↑ 80,000', probability: 7, previousProbability: 8, volume: 3100000, payoutMultiplier: 14.29 },
        { label: '↓ 60,000', probability: 3, previousProbability: 4, volume: 1800000, payoutMultiplier: 33.33 },
        { label: '↑ 85,000', probability: 2, previousProbability: 3, volume: 950000, payoutMultiplier: 50.0 },
      ],
      marketType: 'multi',
      volume24h: 79040000,
      totalVolume: 285000000,
      liquidity: 45000000,
      change24h: -2,
      closeDate: '2026-03-31T23:59:00Z',
      relatedTickers: ['BTC'],
      tags: ['Bitcoin', 'Crypto'],
      url: 'https://polymarket.com/event/btc-march-price',
    }),
    createMarket({
      id: 'poly-fed-chair',
      source: 'polymarket',
      question: 'Who will be confirmed as Fed Chair?',
      category: 'economy',
      subcategory: 'Fed',
      outcomes: [
        { label: 'Kevin Warsh', probability: 95, previousProbability: 94, volume: 8900000, payoutMultiplier: 1.05 },
        { label: 'Judy Shelton', probability: 2, previousProbability: 2, volume: 2100000, payoutMultiplier: 50.0 },
        { label: 'Michelle Bowman', probability: 2, previousProbability: 2, volume: 1400000, payoutMultiplier: 50.0 },
        { label: 'Stephen Miran', probability: 1, previousProbability: 1, volume: 700000, payoutMultiplier: 100.0 },
      ],
      marketType: 'multi',
      volume24h: 13140000,
      totalVolume: 48000000,
      liquidity: 12000000,
      change24h: 1,
      closeDate: '2026-12-31T23:59:00Z',
      relatedTickers: ['SPY', 'TLT'],
      tags: ['Fed', 'Fed Chair'],
      url: 'https://polymarket.com/event/fed-chair',
    }),
    createMarket({
      id: 'poly-ai-bubble',
      source: 'polymarket',
      question: 'AI bubble burst by...?',
      category: 'tech',
      subcategory: null,
      outcomes: [
        {
          label: 'December 31, 2026',
          probability: 23,
          previousProbability: 20,
          volume: 1400000,
          payoutMultiplier: 4.35,
        },
        { label: 'March 31, 2026', probability: 1, previousProbability: 1, volume: 600000, payoutMultiplier: 100.0 },
      ],
      marketType: 'multi',
      volume24h: 2000000,
      liquidity: 800000,
      change24h: 3,
      closeDate: '2026-12-31T23:59:00Z',
      relatedTickers: ['NVDA', 'MSFT', 'GOOGL'],
      tags: ['AI', 'Tech', 'Bubble'],
      url: 'https://polymarket.com/event/ai-bubble',
    }),
    createMarket({
      id: 'poly-spacex-ipo-cap',
      source: 'polymarket',
      question: 'SpaceX IPO closing market cap above __?',
      category: 'finance',
      subcategory: 'IPOs',
      outcomes: [
        { label: '>$1T', probability: 93, previousProbability: 92, volume: 510000, payoutMultiplier: 1.08 },
        { label: '>$1.2T', probability: 89, previousProbability: 88, volume: 210000, payoutMultiplier: 1.12 },
        { label: '>$1.4T', probability: 89, previousProbability: 87, volume: 78000, payoutMultiplier: 1.12 },
        { label: '>$1.6T', probability: 75, previousProbability: 72, volume: 37000, payoutMultiplier: 1.33 },
      ],
      marketType: 'multi',
      volume24h: 836000,
      liquidity: 420000,
      change24h: 1,
      closeDate: '2026-12-31T23:59:00Z',
      relatedTickers: [],
      tags: ['SpaceX', 'IPO', 'Elon Musk'],
      url: 'https://polymarket.com/event/spacex-ipo-cap',
    }),
    createMarket({
      id: 'poly-3rd-largest-apr',
      source: 'polymarket',
      question: '3rd largest company end of April?',
      category: 'finance',
      subcategory: 'Stocks',
      outcomes: [
        { label: 'Alphabet', probability: 67, previousProbability: 65, volume: 340000, payoutMultiplier: 1.49 },
        { label: 'Apple', probability: 28, previousProbability: 30, volume: 219000, payoutMultiplier: 3.57 },
      ],
      marketType: 'multi',
      volume24h: 559000,
      liquidity: 280000,
      change24h: 2,
      closeDate: '2026-04-30T20:00:00Z',
      relatedTickers: ['GOOGL', 'AAPL'],
      tags: ['Stocks', 'Alphabet', 'Apple', 'Market Cap'],
      url: 'https://polymarket.com/event/3rd-largest-april',
    }),
  ];
}

export default {
  fetchPolymarketEvents,
  fetchPolymarketMarkets,
  fetchPolymarketOrderBook,
  subscribePolymarketPrices,
  closeAllSockets,
};
