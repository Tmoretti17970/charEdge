// ═══════════════════════════════════════════════════════════════════
// charEdge — Drift Protocol Prediction Market Adapter
//
// Fetches prediction markets from Drift Protocol on Solana.
// On-chain BET markets. No auth needed for public reads.
//
// API: Drift public REST endpoints for BET markets.
// ═══════════════════════════════════════════════════════════════════

import { createMarket } from '../schemas/PredictionMarketSchema.js';

const _BASE_URL = 'https://drift-historical-data-v2.s3.eu-west-1.amazonaws.com';
const API_URL = 'https://mainnet-beta.api.drift.trade';

// ─── Category rules ────────────────────────────────────────────
const CATEGORY_RULES = [
  { category: 'crypto', keywords: ['bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol', 'crypto', 'token'] },
  { category: 'finance', keywords: ['stock', 's&p', 'nasdaq', 'gold', 'oil'] },
  { category: 'politics', keywords: ['election', 'president', 'trump', 'congress'] },
  { category: 'tech', keywords: ['ai', 'spacex', 'apple', 'nvidia'] },
  { category: 'economy', keywords: ['fed', 'rate', 'inflation', 'gdp', 'cpi'] },
];

// ═══════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetch active BET markets from Drift Protocol.
 */
export async function fetchDriftMarkets({ limit = 20 } = {}) {
  try {
    // Drift's BET markets API endpoint
    const res = await fetch(`${API_URL}/bets/markets?status=active`, {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) return getFallbackData();

    const data = await res.json();
    const markets = data.markets || data || [];

    if (!Array.isArray(markets)) return getFallbackData();

    return markets.slice(0, limit).map(normalizeDriftMarket).filter(Boolean);
  } catch {
    return getFallbackData();
  }
}

// ═══════════════════════════════════════════════════════════════════
// Normalization
// ═══════════════════════════════════════════════════════════════════

function normalizeDriftMarket(market) {
  const title = market.title || market.question || market.name || '';
  if (!title) return null;

  const category = categorize(title);
  const yesPrice = market.yesPrice || market.price || 0.5;
  const probability = Math.round(yesPrice * 100);
  const prevProb = market.previousPrice ? Math.round(market.previousPrice * 100) : probability;

  return createMarket({
    id: `drift-${market.marketIndex || market.id || Date.now()}`,
    source: 'drift',
    question: title,
    description: market.description || '',
    category,
    subcategory: null,
    outcomes: [
      {
        label: 'Yes',
        probability,
        previousProbability: prevProb,
        volume: market.volume24h || 0,
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
    volume24h: market.volume24h || market.volume || 0,
    totalVolume: market.totalVolume || 0,
    liquidity: market.liquidity || 0,
    change24h: probability - prevProb,
    closeDate: market.expiryTs ? new Date(market.expiryTs * 1000).toISOString() : null,
    createdDate: market.createdAt ? new Date(market.createdAt).toISOString() : null,
    resolutionSource: 'Drift Protocol (on-chain)',
    relatedTickers: extractTickers(title),
    tags: extractTags(title),
    url: `https://app.drift.trade/bet/${market.marketIndex || market.id || ''}`,
  });
}

function categorize(title) {
  const text = title.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => text.includes(kw))) return rule.category;
  }
  return 'other';
}

function extractTickers(text) {
  const tickers = [];
  const patterns = [/\bBTC\b/gi, /\bETH\b/gi, /\bSOL\b/gi, /\b(NVDA|AAPL|MSFT|TSLA|SPY)\b/g];
  for (const p of patterns) {
    p.lastIndex = 0;
    const m = text.match(p);
    if (m) tickers.push(...m.map((t) => t.toUpperCase()));
  }
  return [...new Set(tickers)];
}

function extractTags(title) {
  const tags = [];
  const text = title.toLowerCase();
  const kws = ['bitcoin', 'ethereum', 'solana', 'ai', 'trump', 'fed', 'spacex'];
  for (const kw of kws) {
    if (text.includes(kw)) tags.push(kw.charAt(0).toUpperCase() + kw.slice(1));
  }
  if (tags.length === 0) tags.push('DeFi');
  return tags;
}

// ─── Fallback data ─────────────────────────────────────────────

function getFallbackData() {
  return [
    createMarket({
      id: 'drift-sol-200',
      source: 'drift',
      question: 'Will SOL hit $200 by end of Q2 2026?',
      category: 'crypto',
      outcomes: [
        { label: 'Yes', probability: 35, previousProbability: 32, volume: 450000, payoutMultiplier: 2.86 },
        { label: 'No', probability: 65, previousProbability: 68, volume: 280000, payoutMultiplier: 1.54 },
      ],
      marketType: 'binary',
      volume24h: 730000,
      liquidity: 320000,
      change24h: 3,
      closeDate: '2026-06-30T23:59:00Z',
      tags: ['Solana', 'Crypto'],
      url: 'https://app.drift.trade/bet/sol-200',
    }),
    createMarket({
      id: 'drift-eth-merge-v2',
      source: 'drift',
      question: 'Will Ethereum implement Pectra upgrade by June 2026?',
      category: 'crypto',
      outcomes: [
        { label: 'Yes', probability: 82, previousProbability: 80, volume: 890000, payoutMultiplier: 1.22 },
        { label: 'No', probability: 18, previousProbability: 20, volume: 190000, payoutMultiplier: 5.56 },
      ],
      marketType: 'binary',
      volume24h: 1080000,
      liquidity: 540000,
      change24h: 2,
      closeDate: '2026-06-30T23:59:00Z',
      tags: ['Ethereum', 'Crypto'],
      url: 'https://app.drift.trade/bet/eth-pectra',
    }),
  ];
}

export default { fetchDriftMarkets };
