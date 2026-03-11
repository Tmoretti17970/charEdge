import { logger } from '@/observability/logger';
// ═══════════════════════════════════════════════════════════════════
// charEdge v12 — Fear & Greed Index + Social Sentiment Adapters
//
// Aggregates free sentiment data from multiple sources:
//   1. CoinMarketCap Fear & Greed Index (crypto)
//   2. ApeWisdom Reddit Trending Tickers (social)
//   3. Finnhub Social Sentiment (if premium)
//
// All free tier — $0/month.
//
// Usage:
//   import { sentimentAdapter } from './SentimentAdapter.js';
//   const fg = await sentimentAdapter.fetchFearGreed();
//   const trending = await sentimentAdapter.fetchRedditTrending();
// ═══════════════════════════════════════════════════════════════════

const CACHE = new Map();
const CACHE_TTL = 300000; // 5 min

function getCached(key) {
  const cached = CACHE.get(key);
  if (cached && Date.now() < cached.expiry) return cached.data;
  return null;
}

function setCache(key, data, ttl = CACHE_TTL) {
  CACHE.set(key, { data, expiry: Date.now() + ttl });
}

// ─── Fear & Greed Index ────────────────────────────────────────
// Source: alternative.me (free, no API key required)
// CoinMarketCap API requires key; alternative.me is fully free.

async function fetchFearGreedIndex() {
  const cached = getCached('fear-greed');
  if (cached) return cached;

  try {
    // alternative.me provides a free, no-auth Fear & Greed API
    const resp = await fetch('https://api.alternative.me/fng/?limit=30&format=json');
    if (!resp.ok) return null;

    const json = await resp.json();
    if (!json.data?.length) return null;

    const latest = json.data[0];
    const history = json.data.map(d => ({
      value: parseInt(d.value, 10),
      classification: d.value_classification,
      timestamp: parseInt(d.timestamp, 10) * 1000,
      date: new Date(parseInt(d.timestamp, 10) * 1000).toISOString().slice(0, 10),
    }));

    const result = {
      current: {
        value: parseInt(latest.value, 10),
        classification: latest.value_classification,
        timestamp: parseInt(latest.timestamp, 10) * 1000,
      },
      history,
      // Color mapping for UI
      color: getFearGreedColor(parseInt(latest.value, 10)),
    };

    setCache('fear-greed', result, 600000); // 10 min cache
    return result;
  } catch (err) {
    logger.data.warn('[SentimentAdapter] Fear & Greed fetch failed:', err.message);
    return null;
  }
}

function getFearGreedColor(value) {
  if (value <= 20) return '#ea3943'; // Extreme Fear — red
  if (value <= 40) return '#ea8c00'; // Fear — orange
  if (value <= 60) return '#f5d100'; // Neutral — yellow
  if (value <= 80) return '#16c784'; // Greed — green
  return '#6bbf4e'; // Extreme Greed — bright green
}

function getFearGreedEmoji(value) {
  if (value <= 20) return '😱';
  if (value <= 40) return '😨';
  if (value <= 60) return '😐';
  if (value <= 80) return '😊';
  return '🤑';
}

// ─── Reddit Trending Tickers (ApeWisdom) ───────────────────────
// Free, no API key. Aggregates mentions from WSB and stock subreddits.

async function fetchRedditTrending(filter = 'all-stocks', page = 1) {
  const cached = getCached(`reddit-${filter}-${page}`);
  if (cached) return cached;

  try {
    const resp = await fetch(`https://apewisdom.io/api/v1.0/filter/${filter}/page/${page}`);
    if (!resp.ok) return [];

    const json = await resp.json();
    if (!json.results?.length) return [];

    const result = json.results.map(r => ({
      rank: r.rank,
      symbol: r.ticker,
      name: r.name,
      mentions: r.mentions,
      mentionsDelta: r.mentions_24h_ago ? r.mentions - r.mentions_24h_ago : 0,
      upvotes: r.upvotes || 0,
    }));

    setCache(`reddit-${filter}-${page}`, result);
    return result;
  } catch (err) {
    logger.data.warn('[SentimentAdapter] Reddit trending fetch failed:', err.message);
    return [];
  }
}

async function fetchRedditCryptoTrending() {
  return fetchRedditTrending('all-crypto');
}

// ─── Composite Sentiment Score ─────────────────────────────────
// Compute a simple composite sentiment for a symbol

async function computeSentimentScore(symbol) {
  const upper = (symbol || '').toUpperCase();

  // Check Reddit mentions
  const trending = await fetchRedditTrending('all-stocks');
  const redditEntry = trending.find(t => t.symbol === upper);

  // Check Fear & Greed (global, not per-symbol)
  const fg = await fetchFearGreedIndex();

  return {
    symbol: upper,
    reddit: redditEntry ? {
      rank: redditEntry.rank,
      mentions: redditEntry.mentions,
      mentionsDelta: redditEntry.mentionsDelta,
      upvotes: redditEntry.upvotes,
      buzz: redditEntry.mentions > 100 ? 'high' : redditEntry.mentions > 20 ? 'moderate' : 'low',
    } : null,
    fearGreed: fg?.current || null,
    fearGreedColor: fg?.color || '#666',
    composite: null, // Could compute a weighted score later
  };
}

// ─── Sentiment Adapter Class ───────────────────────────────────

class _SentimentAdapter {
  /** Fetch the Fear & Greed Index (crypto market-wide). */
  fetchFearGreed() { return fetchFearGreedIndex(); }

  /** Fetch trending tickers from Reddit (stocks). */
  fetchRedditTrending(filter, page) { return fetchRedditTrending(filter, page); }

  /** Fetch trending tickers from Reddit (crypto). */
  fetchRedditCrypto() { return fetchRedditCryptoTrending(); }

  /** Get composite sentiment score for a symbol. */
  computeSentiment(symbol) { return computeSentimentScore(symbol); }

  /** Get color for a Fear & Greed value. */
  getFearGreedColor(value) { return getFearGreedColor(value); }

  /** Get emoji for a Fear & Greed value. */
  getFearGreedEmoji(value) { return getFearGreedEmoji(value); }

  /** Clear all cached sentiment data. */
  clearCache() { CACHE.clear(); }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const sentimentAdapter = new _SentimentAdapter();

export default sentimentAdapter;
