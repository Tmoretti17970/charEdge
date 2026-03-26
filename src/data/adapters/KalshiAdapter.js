// ═══════════════════════════════════════════════════════════════════
// charEdge — Kalshi Prediction Market Adapter
//
// Fetches live prediction market data from Kalshi's public API.
// CFTC-regulated, no auth needed for public market reads.
//
// API Docs: https://docs.kalshi.com
// Base URL: https://api.elections.kalshi.com/trade-api/v2
// ═══════════════════════════════════════════════════════════════════

const BASE_URL = 'https://api.elections.kalshi.com/trade-api/v2';

/**
 * Fetch active markets from Kalshi, filtered for trader relevance.
 * @param {Object} opts
 * @param {string} [opts.category] - Filter by category
 * @param {number} [opts.limit=20] - Max markets to return
 * @returns {Promise<Array<NormalizedPrediction>>}
 */
export async function fetchKalshiMarkets({ category, limit = 20 } = {}) {
  try {
    const params = new URLSearchParams({
      limit: String(limit),
      status: 'open',
    });
    if (category) params.set('series_ticker', category);

    const res = await fetch(`${BASE_URL}/markets?${params}`, {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      return getFallbackData();
    }

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
 * Normalize a Kalshi market response to our common schema.
 */
function normalizeKalshiMarket(market) {
  const probability = Math.round((market.yes_ask + (market.yes_bid || market.yes_ask)) / 2);
  return {
    id: `kalshi-${market.ticker}`,
    source: 'kalshi',
    question: market.title || market.subtitle || market.ticker,
    category: categorizeKalshi(market),
    probability,
    volume24h: market.volume_24h || 0,
    openInterest: market.open_interest || 0,
    change24h: market.previous_yes_ask ? probability - market.previous_yes_ask : 0,
    closeDate: market.close_time || market.expiration_time,
    relatedTickers: extractTickers(market.title || ''),
    url: `https://kalshi.com/markets/${market.ticker}`,
  };
}

function categorizeKalshi(market) {
  const title = (market.title || '').toLowerCase();
  const cat = (market.category || '').toLowerCase();

  if (
    cat.includes('econom') ||
    title.includes('fed') ||
    title.includes('rate') ||
    title.includes('gdp') ||
    title.includes('cpi') ||
    title.includes('inflation') ||
    title.includes('unemployment')
  )
    return 'economics';
  if (
    cat.includes('financ') ||
    title.includes('s&p') ||
    title.includes('nasdaq') ||
    title.includes('stock') ||
    title.includes('earnings')
  )
    return 'markets';
  if (
    cat.includes('crypto') ||
    title.includes('bitcoin') ||
    title.includes('btc') ||
    title.includes('ethereum') ||
    title.includes('eth')
  )
    return 'crypto';
  if (
    cat.includes('politic') ||
    title.includes('election') ||
    title.includes('president') ||
    title.includes('congress') ||
    title.includes('tariff')
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
      id: 'kalshi-fed-rate-jun',
      source: 'kalshi',
      question: 'Will the Fed cut rates at the June 2026 FOMC meeting?',
      category: 'economics',
      probability: 72,
      volume24h: 4200000,
      openInterest: 12500000,
      change24h: -3,
      closeDate: '2026-06-18T18:00:00Z',
      relatedTickers: ['SPY', 'QQQ'],
      url: 'https://kalshi.com/markets/fed-rate',
    },
    {
      id: 'kalshi-recession-q4',
      source: 'kalshi',
      question: 'Will the US enter a recession by Q4 2026?',
      category: 'economics',
      probability: 23,
      volume24h: 8100000,
      openInterest: 28000000,
      change24h: 1,
      closeDate: '2026-12-31T23:59:00Z',
      relatedTickers: ['SPY'],
      url: 'https://kalshi.com/markets/recession',
    },
    {
      id: 'kalshi-sp500-6000',
      source: 'kalshi',
      question: 'Will the S&P 500 close above 6,000 by December 2026?',
      category: 'markets',
      probability: 61,
      volume24h: 12000000,
      openInterest: 35000000,
      change24h: -2,
      closeDate: '2026-12-31T23:59:00Z',
      relatedTickers: ['SPY', 'S&P500'],
      url: 'https://kalshi.com/markets/sp500',
    },
    {
      id: 'kalshi-cpi-above-3',
      source: 'kalshi',
      question: 'Will March 2026 CPI come in above 3.0%?',
      category: 'economics',
      probability: 38,
      volume24h: 4200000,
      openInterest: 9800000,
      change24h: 2,
      closeDate: '2026-04-10T12:30:00Z',
      relatedTickers: ['SPY', 'QQQ'],
      url: 'https://kalshi.com/markets/cpi',
    },
  ];
}

export default { fetchKalshiMarkets };
