// ═══════════════════════════════════════════════════════════════════
// charEdge v12 — News Aggregator
//
// Self-hosted news feed from free RSS sources + Finnhub.
// Aggregates, deduplicates, and serves a unified news stream.
//
// Sources (all $0):
//   - Yahoo Finance RSS (per-ticker news)
//   - Google News RSS (market/financial news)
//   - Finnhub Company News API (if key set)
//   - SEC EDGAR Filing Alerts
//
// Usage:
//   import { newsAggregator } from './NewsAggregator.js';
//   const news = await newsAggregator.fetchNews('AAPL');
//   const market = await newsAggregator.fetchMarketNews();
// ═══════════════════════════════════════════════════════════════════

import finnhubAdapter from './adapters/FinnhubAdapter.js';

const NEWS_CACHE = new Map();
const CACHE_TTL = 300000; // 5 min cache

// ─── RSS Parser ────────────────────────────────────────────────

/**
 * Parse an RSS XML string into an array of articles.
 * Works in both browser (DOMParser) and Node (regex fallback).
 */
function parseRSS(xml) {
  const articles = [];

  if (typeof DOMParser !== 'undefined') {
    // Browser environment
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'application/xml');
      const items = doc.querySelectorAll('item');

      items.forEach(item => {
        const title = item.querySelector('title')?.textContent?.trim() || '';
        const link = item.querySelector('link')?.textContent?.trim() || '';
        const pubDate = item.querySelector('pubDate')?.textContent?.trim() || '';
        const description = item.querySelector('description')?.textContent?.trim() || '';

        if (title) {
          articles.push({
            title,
            link,
            publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
            summary: description.replace(/<[^>]*>/g, '').slice(0, 200),
          });
        }
      });
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
      // Fallback if parsing fails
    }
  } else {
    // Simple regex fallback for SSR
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];
      const title = block.match(/<title>(.*?)<\/title>/)?.[1] || '';
      const link = block.match(/<link>(.*?)<\/link>/)?.[1] || '';
      const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
      if (title) {
        articles.push({
          title: title.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1'),
          link,
          publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
          summary: '',
        });
      }
    }
  }

  return articles;
}

// ─── Source Fetchers ───────────────────────────────────────────

async function fetchYahooNews(symbol) {
  try {
    const resp = await fetch(`/api/proxy/rss?url=${encodeURIComponent(`https://finance.yahoo.com/rss/headline?s=${symbol}`)}`);
    if (!resp.ok) return [];
    const xml = await resp.text();
    return parseRSS(xml).map(a => ({ ...a, source: 'Yahoo Finance', symbol }));
  // eslint-disable-next-line unused-imports/no-unused-vars
  } catch (_) {
    return [];
  }
}

async function fetchGoogleNews(query) {
  try {
    const resp = await fetch(`/api/proxy/rss?url=${encodeURIComponent(`https://news.google.com/rss/search?q=${query}+stock+market&hl=en-US&gl=US&ceid=US:en`)}`);
    if (!resp.ok) return [];
    const xml = await resp.text();
    return parseRSS(xml).map(a => ({ ...a, source: 'Google News' }));
  // eslint-disable-next-line unused-imports/no-unused-vars
  } catch (_) {
    return [];
  }
}

async function fetchFinnhubNews(symbol, from, to) {
  if (!finnhubAdapter.isConfigured) return [];

  try {
    const data = await finnhubAdapter._request('/company-news', { symbol, from, to });
    if (!Array.isArray(data)) return [];
    return data.slice(0, 20).map(a => ({
      title: a.headline || '',
      link: a.url || '',
      publishedAt: a.datetime ? new Date(a.datetime * 1000).toISOString() : new Date().toISOString(),
      summary: (a.summary || '').slice(0, 200),
      source: a.source || 'Finnhub',
      symbol,
      sentiment: a.sentiment || null,
      image: a.image || null,
    }));
  // eslint-disable-next-line unused-imports/no-unused-vars
  } catch (_) {
    return [];
  }
}

async function fetchFinnhubMarketNews() {
  if (!finnhubAdapter.isConfigured) return [];

  try {
    const data = await finnhubAdapter._request('/news', { category: 'general' });
    if (!Array.isArray(data)) return [];
    return data.slice(0, 30).map(a => ({
      title: a.headline || '',
      link: a.url || '',
      publishedAt: a.datetime ? new Date(a.datetime * 1000).toISOString() : new Date().toISOString(),
      summary: (a.summary || '').slice(0, 200),
      source: a.source || 'Finnhub',
      category: a.category || 'general',
      image: a.image || null,
    }));
  // eslint-disable-next-line unused-imports/no-unused-vars
  } catch (_) {
    return [];
  }
}

// ─── Deduplication ─────────────────────────────────────────────

function deduplicateNews(articles) {
  const seen = new Set();
  return articles.filter(article => {
    // Create a fingerprint from the first 50 chars of the title
    const fingerprint = article.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
}

// ─── News Aggregator ───────────────────────────────────────────

class _NewsAggregator {
  /**
   * Fetch news for a specific ticker symbol.
   * Aggregates from all free sources, deduplicates, sorts by date.
   * @param {string} symbol
   * @param {Object} [opts]
   * @param {number} [opts.limit=20]
   * @returns {Promise<Array>}
   */
  async fetchNews(symbol, { limit = 20 } = {}) {
    const cacheKey = `ticker-${symbol}`;
    const cached = NEWS_CACHE.get(cacheKey);
    if (cached && Date.now() < cached.expiry) return cached.data;

    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    // Fetch from all sources in parallel
    const [yahoo, finnhub] = await Promise.allSettled([
      fetchYahooNews(symbol),
      fetchFinnhubNews(symbol, weekAgo, today),
    ]);

    const articles = [
      ...(yahoo.status === 'fulfilled' ? yahoo.value : []),
      ...(finnhub.status === 'fulfilled' ? finnhub.value : []),
    ];

    // Deduplicate, sort by date (newest first), and limit
    const result = deduplicateNews(articles)
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, limit);

    NEWS_CACHE.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL });
    return result;
  }

  /**
   * Fetch general market news.
   * @param {Object} [opts]
   * @param {number} [opts.limit=30]
   * @returns {Promise<Array>}
   */
  async fetchMarketNews({ limit = 30 } = {}) {
    const cacheKey = 'market-general';
    const cached = NEWS_CACHE.get(cacheKey);
    if (cached && Date.now() < cached.expiry) return cached.data;

    const [google, finnhub] = await Promise.allSettled([
      fetchGoogleNews('market'),
      fetchFinnhubMarketNews(),
    ]);

    const articles = [
      ...(google.status === 'fulfilled' ? google.value : []),
      ...(finnhub.status === 'fulfilled' ? finnhub.value : []),
    ];

    const result = deduplicateNews(articles)
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, limit);

    NEWS_CACHE.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL });
    return result;
  }

  /**
   * Fetch crypto-specific news.
   * @param {number} [limit=20]
   * @returns {Promise<Array>}
   */
  async fetchCryptoNews(limit = 20) {
    const cacheKey = 'market-crypto';
    const cached = NEWS_CACHE.get(cacheKey);
    if (cached && Date.now() < cached.expiry) return cached.data;

    const [google] = await Promise.allSettled([
      fetchGoogleNews('cryptocurrency bitcoin ethereum'),
    ]);

    const result = deduplicateNews(
      google.status === 'fulfilled' ? google.value : []
    )
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, limit);

    NEWS_CACHE.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL });
    return result;
  }

  /** Clear all cached news. */
  clearCache() {
    NEWS_CACHE.clear();
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const newsAggregator = new _NewsAggregator();
export default newsAggregator;
