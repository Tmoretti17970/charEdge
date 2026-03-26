// ═══════════════════════════════════════════════════════════════════
// charEdge — Kalshi Prediction Market Adapter V2
//
// Fetches live prediction market data from Kalshi's public API.
// CFTC-regulated, no auth needed for public market reads.
//
// V2: Events API for multi-outcome grouping, history, order book.
//
// API Docs: https://docs.kalshi.com
// Base URL: https://api.elections.kalshi.com/trade-api/v2
// ═══════════════════════════════════════════════════════════════════

import { createMarket } from '../schemas/PredictionMarketSchema.js';

const BASE_URL = 'https://api.elections.kalshi.com/trade-api/v2';

const HEADERS = { Accept: 'application/json' };

// ─── Category keyword map ──────────────────────────────────────────
const CATEGORY_RULES = [
  {
    category: 'economy',
    keywords: [
      'fed',
      'rate',
      'gdp',
      'cpi',
      'inflation',
      'unemployment',
      'jobs',
      'growth',
      'housing',
      'fomc',
      'treasury',
      'recession',
    ],
  },
  {
    category: 'finance',
    keywords: [
      's&p',
      'nasdaq',
      'stock',
      'earnings',
      'ipo',
      'market cap',
      'dow',
      'index',
      'commodity',
      'gold',
      'silver',
      'oil',
      'gas price',
      'crude',
    ],
  },
  { category: 'crypto', keywords: ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'solana', 'sol', 'defi', 'nft'] },
  {
    category: 'politics',
    keywords: [
      'election',
      'president',
      'congress',
      'tariff',
      'senate',
      'governor',
      'democrat',
      'republican',
      'vote',
      'impeach',
      'supreme court',
    ],
  },
  {
    category: 'tech',
    keywords: ['ai', 'spacex', 'apple', 'google', 'microsoft', 'nvidia', 'tesla', 'chip', 'semiconductor', 'app store'],
  },
  { category: 'sports', keywords: ['super bowl', 'nfl', 'nba', 'mlb', 'world cup', 'olympics', 'championship'] },
  {
    category: 'climate',
    keywords: ['climate', 'temperature', 'hurricane', 'earthquake', 'weather', 'wildfire', 'storm'],
  },
  {
    category: 'geopolitics',
    keywords: ['china', 'russia', 'iran', 'nato', 'war', 'ceasefire', 'sanctions', 'invasion', 'military'],
  },
  { category: 'health', keywords: ['covid', 'vaccine', 'pandemic', 'fda', 'drug', 'outbreak'] },
  { category: 'science', keywords: ['space', 'nasa', 'launch', 'mars', 'moon', 'quantum'] },
  { category: 'entertainment', keywords: ['oscar', 'grammy', 'box office', 'streaming', 'movie', 'album'] },
  { category: 'culture', keywords: ['tiktok', 'social media', 'viral', 'meme', 'celebrity'] },
];

// ─── Subcategory map (within categories) ───────────────────────────
const SUBCATEGORY_RULES = {
  economy: [
    { sub: 'Fed', keywords: ['fed', 'fomc', 'rate cut', 'rate hike'] },
    { sub: 'GDP', keywords: ['gdp'] },
    { sub: 'Inflation', keywords: ['cpi', 'inflation', 'pce'] },
    { sub: 'Jobs & Economy', keywords: ['jobs', 'unemployment', 'payroll', 'labor'] },
    { sub: 'Housing', keywords: ['housing', 'mortgage', 'home'] },
    { sub: 'Oil and Energy', keywords: ['oil', 'gas price', 'crude', 'energy', 'opec'] },
    { sub: 'Growth', keywords: ['growth', 'recession'] },
    { sub: 'Treasuries', keywords: ['treasury', 'bond', 'yield'] },
  ],
  finance: [
    { sub: 'Stocks', keywords: ['stock', 'close above', 'close below'] },
    { sub: 'S&P 500', keywords: ['s&p', 'spy'] },
    { sub: 'Indices', keywords: ['nasdaq', 'dow', 'index', 'qqq'] },
    { sub: 'Gold', keywords: ['gold', 'gc'] },
    { sub: 'Silver', keywords: ['silver', 'si'] },
    { sub: 'Earnings', keywords: ['earnings', 'eps', 'revenue'] },
    { sub: 'IPOs', keywords: ['ipo'] },
    { sub: 'Commodities', keywords: ['commodity', 'oil', 'crude', 'wheat', 'copper'] },
  ],
  crypto: [
    { sub: 'Bitcoin', keywords: ['bitcoin', 'btc'] },
    { sub: 'Ethereum', keywords: ['ethereum', 'eth'] },
    { sub: 'Solana', keywords: ['solana', 'sol'] },
    { sub: 'DeFi', keywords: ['defi', 'dex', 'protocol'] },
  ],
};

// ─── Ticker extraction patterns ────────────────────────────────────
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
 * Fetch active events (multi-outcome groupings) from Kalshi.
 * Each event contains multiple related markets → mapped to outcomes[].
 */
export async function fetchKalshiEvents({ category, limit = 100 } = {}) {
  try {
    const params = new URLSearchParams({
      limit: String(limit),
      status: 'open',
      with_nested_markets: 'true',
    });
    if (category) params.set('series_ticker', category);

    const res = await fetch(`${BASE_URL}/events?${params}`, { headers: HEADERS });

    if (!res.ok) return getFallbackData();

    const data = await res.json();
    const events = data.events || [];

    return events
      .filter((e) => e.markets?.length > 0)
      .slice(0, limit)
      .map(normalizeKalshiEvent);
  } catch {
    return getFallbackData();
  }
}

/**
 * Fetch individual markets (flat list) from Kalshi.
 * Use when events endpoint is unavailable or for backward compat.
 */
export async function fetchKalshiMarkets({ category, limit = 100 } = {}) {
  try {
    const params = new URLSearchParams({
      limit: String(limit),
      status: 'open',
    });
    if (category) params.set('series_ticker', category);

    const res = await fetch(`${BASE_URL}/markets?${params}`, { headers: HEADERS });

    if (!res.ok) return getFallbackData();

    const data = await res.json();
    const markets = data.markets || [];

    return markets
      .filter((m) => m.status === 'open' && m.yes_ask != null)
      .slice(0, limit)
      .map(normalizeKalshiMarket);
  } catch {
    return getFallbackData();
  }
}

/**
 * Fetch probability history for a market.
 * @param {string} ticker - Kalshi market ticker
 * @param {string} [interval='1d'] - Interval: 1m, 5m, 1h, 1d
 * @returns {Promise<Array<{timestamp: string, probability: number}>>}
 */
export async function fetchKalshiMarketHistory(ticker, interval = '1d') {
  try {
    const params = new URLSearchParams({ interval });
    const res = await fetch(`${BASE_URL}/markets/${ticker}/history?${params}`, { headers: HEADERS });
    if (!res.ok) return [];

    const data = await res.json();
    return (data.history || []).map((h) => ({
      timestamp: h.ts || h.end_period_ts,
      probability: Math.round(((h.yes_ask || 0) + (h.yes_bid || 0)) / 2),
      volume: h.volume || 0,
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch order book for a market.
 * @param {string} ticker - Kalshi market ticker
 * @returns {Promise<{bids: Array, asks: Array, spread: number}>}
 */
export async function fetchKalshiOrderBook(ticker) {
  try {
    const res = await fetch(`${BASE_URL}/markets/${ticker}/orderbook`, { headers: HEADERS });
    if (!res.ok) return { bids: [], asks: [], spread: 0 };

    const data = await res.json();
    const bids = (data.orderbook?.yes || []).map(([price, qty]) => ({ price, quantity: qty }));
    const asks = (data.orderbook?.no || []).map(([price, qty]) => ({ price: 100 - price, quantity: qty }));
    const bestBid = bids[0]?.price || 0;
    const bestAsk = asks[0]?.price || 0;

    return { bids, asks, spread: bestAsk - bestBid };
  } catch {
    return { bids: [], asks: [], spread: 0 };
  }
}

// ═══════════════════════════════════════════════════════════════════
// Normalization
// ═══════════════════════════════════════════════════════════════════

/**
 * Normalize a Kalshi event (multi-market group) into our canonical schema.
 */
function normalizeKalshiEvent(event) {
  const markets = event.markets || [];
  const title = event.title || event.series_ticker || '';
  const category = categorize(title, event.category);
  const subcategory = subcategorize(title, category);

  // Build outcomes from child markets
  const outcomes = markets
    .filter((m) => m.status === 'open')
    .map((m) => {
      const prob = Math.round(((m.yes_ask || 0) + (m.yes_bid || m.yes_ask || 0)) / 2);
      const prevProb = m.previous_yes_ask || prob;
      const multiplier = prob > 0 ? Math.round((100 / prob) * 100) / 100 : 0;
      return {
        label: m.subtitle || m.title || m.ticker,
        probability: prob,
        previousProbability: prevProb,
        volume: m.volume_24h || 0,
        payoutMultiplier: multiplier,
      };
    })
    .sort((a, b) => b.probability - a.probability);

  const totalVolume24h = outcomes.reduce((sum, o) => sum + o.volume, 0);
  const totalOI = markets.reduce((sum, m) => sum + (m.open_interest || 0), 0);
  const leadOutcome = outcomes[0];
  const marketType = outcomes.length === 2 ? 'binary' : 'multi';

  return createMarket({
    id: `kalshi-${event.event_ticker || event.series_ticker || markets[0]?.ticker}`,
    source: 'kalshi',
    question: title,
    description: event.description || '',
    category,
    subcategory,
    outcomes,
    marketType,
    status: 'open',
    volume24h: totalVolume24h,
    totalVolume: event.total_volume || totalVolume24h,
    openInterest: totalOI,
    liquidity: 0,
    change24h: leadOutcome ? leadOutcome.probability - leadOutcome.previousProbability : 0,
    closeDate: event.close_time || markets[0]?.close_time || markets[0]?.expiration_time,
    createdDate: event.created_time || null,
    resolutionSource: 'Kalshi',
    relatedTickers: extractTickers(title),
    tags: extractTags(title, event.category),
    imageUrl: event.image_url || null,
    url: `https://kalshi.com/markets/${event.event_ticker || event.series_ticker || ''}`,
    relatedMarketCount: markets.length,
  });
}

/**
 * Normalize a single Kalshi market (flat) into our canonical schema.
 */
function normalizeKalshiMarket(market) {
  const probability = Math.round(((market.yes_ask || 0) + (market.yes_bid || market.yes_ask || 0)) / 2);
  const prevProb = market.previous_yes_ask || probability;
  const multiplier = probability > 0 ? Math.round((100 / probability) * 100) / 100 : 0;
  const title = market.title || market.subtitle || market.ticker;
  const category = categorize(title, market.category);
  const subcategory = subcategorize(title, category);

  return createMarket({
    id: `kalshi-${market.ticker}`,
    source: 'kalshi',
    question: title,
    description: market.description || '',
    category,
    subcategory,
    outcomes: [
      {
        label: 'Yes',
        probability,
        previousProbability: prevProb,
        volume: market.volume_24h || 0,
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
    volume24h: market.volume_24h || 0,
    openInterest: market.open_interest || 0,
    change24h: probability - prevProb,
    closeDate: market.close_time || market.expiration_time,
    createdDate: market.created_time || null,
    resolutionSource: 'Kalshi',
    relatedTickers: extractTickers(title),
    tags: extractTags(title, market.category),
    url: `https://kalshi.com/markets/${market.ticker}`,
  });
}

// ─── Categorization ────────────────────────────────────────────────

function categorize(title, apiCategory) {
  const text = `${title} ${apiCategory || ''}`.toLowerCase();
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

// ─── Tag + Ticker extraction ───────────────────────────────────────

function extractTickers(text) {
  const tickers = [];
  for (const pattern of TICKER_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = text.match(pattern);
    if (matches) tickers.push(...matches.map((m) => m.toUpperCase().replace(/\s+/g, '')));
  }
  return [...new Set(tickers)];
}

function extractTags(title, apiCategory) {
  const tags = [];
  const text = title.toLowerCase();

  // Add api category if present
  if (apiCategory) tags.push(apiCategory);

  // Extract common topics
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
    'nato',
    'covid',
    'earnings',
    'interest rate',
    'tariff',
    'housing',
  ];

  for (const kw of TOPIC_KEYWORDS) {
    if (text.includes(kw)) tags.push(kw.charAt(0).toUpperCase() + kw.slice(1));
  }

  return [...new Set(tags)];
}

// ─── Fallback data ─────────────────────────────────────────────────

function getFallbackData() {
  return [
    createMarket({
      id: 'kalshi-fed-rate-apr',
      source: 'kalshi',
      question: 'Fed decision in April?',
      description: 'What will the Federal Reserve decide at the April 2026 FOMC meeting?',
      category: 'economy',
      subcategory: 'Fed',
      outcomes: [
        {
          label: 'Fed maintains rate',
          probability: 94,
          previousProbability: 95,
          volume: 5200000,
          payoutMultiplier: 1.06,
        },
        { label: 'Cut 25bps', probability: 3, previousProbability: 2, volume: 890000, payoutMultiplier: 33.33 },
        { label: 'Hike 25bps', probability: 2, previousProbability: 2, volume: 320000, payoutMultiplier: 50.0 },
        { label: 'Cut 50bps+', probability: 1, previousProbability: 1, volume: 163000, payoutMultiplier: 100.0 },
      ],
      marketType: 'multi',
      volume24h: 6573000,
      totalVolume: 27450000,
      openInterest: 13140000,
      change24h: -1,
      closeDate: '2026-04-29T18:00:00Z',
      relatedTickers: ['SPY', 'QQQ', 'TLT'],
      tags: ['Fed', 'Interest Rate', 'FOMC'],
      url: 'https://kalshi.com/markets/fed-rate',
      relatedMarketCount: 5,
    }),
    createMarket({
      id: 'kalshi-sp500-6000',
      source: 'kalshi',
      question: 'Will the S&P 500 close above 6,000 by end of March?',
      category: 'finance',
      subcategory: 'S&P 500',
      outcomes: [
        { label: 'Yes', probability: 61, previousProbability: 63, volume: 8400000, payoutMultiplier: 1.64 },
        { label: 'No', probability: 39, previousProbability: 37, volume: 3600000, payoutMultiplier: 2.56 },
      ],
      marketType: 'binary',
      volume24h: 12000000,
      openInterest: 35000000,
      change24h: -2,
      closeDate: '2026-03-31T20:00:00Z',
      relatedTickers: ['SPY', 'S&P500'],
      tags: ['S&P 500', 'Stocks'],
      url: 'https://kalshi.com/markets/sp500',
    }),
    createMarket({
      id: 'kalshi-gas-price-mar',
      source: 'kalshi',
      question: 'Gas prices in the US this month?',
      description: 'Will the national average gas price exceed $4.00/gallon by end of March?',
      category: 'economy',
      subcategory: 'Oil and Energy',
      outcomes: [
        { label: 'Above 4.00', probability: 51, previousProbability: 48, volume: 2100000, payoutMultiplier: 1.96 },
        { label: 'Above 3.98', probability: 64, previousProbability: 61, volume: 1850000, payoutMultiplier: 1.56 },
      ],
      marketType: 'multi',
      volume24h: 4690000,
      openInterest: 11200000,
      change24h: 3,
      closeDate: '2026-03-31T21:00:00Z',
      relatedTickers: ['XLE'],
      tags: ['Oil', 'Gas Price', 'Energy'],
      url: 'https://kalshi.com/markets/gas-price',
      relatedMarketCount: 34,
    }),
    createMarket({
      id: 'kalshi-cpi-march',
      source: 'kalshi',
      question: 'CPI in March?',
      description: 'What will the March 2026 CPI reading be?',
      category: 'economy',
      subcategory: 'Inflation',
      outcomes: [
        { label: 'Above 0.8%', probability: 56, previousProbability: 54, volume: 1400000, payoutMultiplier: 1.79 },
        { label: 'Above 3.3%', probability: 41, previousProbability: 39, volume: 1100000, payoutMultiplier: 2.44 },
      ],
      marketType: 'multi',
      volume24h: 4200000,
      openInterest: 9800000,
      change24h: 2,
      closeDate: '2026-04-10T12:30:00Z',
      relatedTickers: ['SPY', 'TLT'],
      tags: ['CPI', 'Inflation'],
      url: 'https://kalshi.com/markets/cpi',
    }),
    createMarket({
      id: 'kalshi-tech-layoffs',
      source: 'kalshi',
      question: 'More tech layoffs in 2026 than in 2025?',
      category: 'economy',
      subcategory: 'Jobs & Economy',
      outcomes: [
        { label: 'Yes', probability: 85, previousProbability: 82, volume: 5600000, payoutMultiplier: 1.18 },
        { label: 'No', probability: 15, previousProbability: 18, volume: 3700000, payoutMultiplier: 6.67 },
      ],
      marketType: 'binary',
      volume24h: 9359000,
      openInterest: 18200000,
      change24h: 3,
      closeDate: '2026-03-01T14:00:00Z',
      relatedTickers: ['QQQ'],
      tags: ['Tech', 'Jobs', 'Layoffs'],
      url: 'https://kalshi.com/markets/tech-layoffs',
    }),
    createMarket({
      id: 'kalshi-largest-company-mar',
      source: 'kalshi',
      question: 'Largest Company end of March?',
      category: 'finance',
      subcategory: 'Stocks',
      outcomes: [
        { label: 'NVIDIA', probability: 99, previousProbability: 99, volume: 12800000, payoutMultiplier: 1.01 },
        { label: 'Apple', probability: 1, previousProbability: 1, volume: 4200000, payoutMultiplier: 100.0 },
      ],
      marketType: 'multi',
      volume24h: 17180000,
      openInterest: 42000000,
      change24h: 0,
      closeDate: '2026-03-31T20:00:00Z',
      relatedTickers: ['NVDA', 'AAPL', 'MSFT', 'GOOGL'],
      tags: ['Stocks', 'NVIDIA', 'Apple', 'Market Cap'],
      imageUrl: null,
      url: 'https://kalshi.com/markets/largest-company',
      relatedMarketCount: 1,
    }),
    createMarket({
      id: 'kalshi-gold-mar',
      source: 'kalshi',
      question: 'Will Gold (GC) hit __ by end of March?',
      category: 'finance',
      subcategory: 'Gold',
      outcomes: [
        { label: '↓ $4,300', probability: 18, previousProbability: 15, volume: 1800000, payoutMultiplier: 5.56 },
        { label: '↓ $4,000', probability: 4, previousProbability: 3, volume: 1200000, payoutMultiplier: 25.0 },
      ],
      marketType: 'multi',
      volume24h: 3000000,
      openInterest: 8900000,
      change24h: 3,
      closeDate: '2026-03-31T18:00:00Z',
      relatedTickers: ['GLD'],
      tags: ['Gold', 'Commodities'],
      url: 'https://kalshi.com/markets/gold',
    }),
    createMarket({
      id: 'kalshi-spacex-ipo',
      source: 'kalshi',
      question: 'SpaceX IPO by __?',
      category: 'tech',
      subcategory: null,
      outcomes: [
        { label: 'December 31', probability: 92, previousProbability: 91, volume: 198000, payoutMultiplier: 1.09 },
        { label: 'September 30', probability: 91, previousProbability: 90, volume: 62000, payoutMultiplier: 1.1 },
        { label: 'June 30', probability: 73, previousProbability: 70, volume: 24000, payoutMultiplier: 1.37 },
        { label: 'June 15', probability: 51, previousProbability: 48, volume: 13000, payoutMultiplier: 1.96 },
      ],
      marketType: 'multi',
      volume24h: 298000,
      openInterest: 835000,
      change24h: 1,
      closeDate: '2026-12-31T23:59:00Z',
      relatedTickers: [],
      tags: ['SpaceX', 'IPO', 'Elon Musk'],
      url: 'https://kalshi.com/markets/spacex-ipo',
    }),
  ];
}

export default {
  fetchKalshiEvents,
  fetchKalshiMarkets,
  fetchKalshiMarketHistory,
  fetchKalshiOrderBook,
};
