// ═══════════════════════════════════════════════════════════════════
// charEdge — Top Markets Adapter
//
// Multi-source aggregation for the Top discovery tab.
// Crypto: CoinGecko /coins/markets (ranked by market cap, free tier).
// Stocks/Futures/ETFs: SymbolRegistry + QuoteService for live prices.
//
// Returns a unified row format for the ranked table.
// ═══════════════════════════════════════════════════════════════════

import { logger } from '@/observability/logger';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const CACHE_TTL = 120_000; // 2 min cache for rankings
const CRYPTO_PER_PAGE = 100;

let cache = { data: null, ts: 0 };

/**
 * Normalize a CoinGecko market entry into our unified row format.
 */
function normalizeCryptoRow(coin) {
  return {
    rank: coin.market_cap_rank || 9999,
    id: `crypto-${coin.id}`,
    symbol: coin.symbol?.toUpperCase(),
    name: coin.name,
    image: coin.image,
    price: coin.current_price,
    change1h: coin.price_change_percentage_1h_in_currency ?? null,
    change24h: coin.price_change_percentage_24h_in_currency ?? coin.price_change_percentage_24h ?? null,
    change7d: coin.price_change_percentage_7d_in_currency ?? null,
    marketCap: coin.market_cap,
    volume24h: coin.total_volume,
    supply: coin.circulating_supply,
    maxSupply: coin.max_supply,
    sparkline7d: coin.sparkline_in_7d?.price || [],
    assetClass: 'crypto',
    ath: coin.ath,
    athDate: coin.ath_date,
  };
}

/**
 * Fetch top crypto assets from CoinGecko ranked by market cap.
 * Returns up to 250 coins (page 1 = 1-100, page 2 = 101-200, page 3 = 201-250).
 *
 * @param {number} pages - Number of pages to fetch (1-3). Default 1.
 * @returns {Promise<Array>} Normalized market rows.
 */
export async function fetchTopCrypto(pages = 1) {
  const rows = [];

  for (let page = 1; page <= Math.min(pages, 3); page++) {
    try {
      const url = `${COINGECKO_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${CRYPTO_PER_PAGE}&page=${page}&sparkline=true&price_change_percentage=1h,24h,7d`;
      const res = await fetch(url);

      if (!res.ok) {
        logger.warn(`[TopMarketsAdapter] CoinGecko page ${page} failed: ${res.status}`);
        break;
      }

      const coins = await res.json();
      rows.push(...coins.map(normalizeCryptoRow));

      // CoinGecko rate limit: wait 1.5s between pages
      if (page < pages) await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      logger.error('[TopMarketsAdapter] CoinGecko fetch error', err);
      break;
    }
  }

  return rows;
}

/**
 * Fetch all top markets (crypto + stocks + futures + ETFs).
 * Crypto comes from CoinGecko ranked endpoint.
 * Equities come from SymbolRegistry + QuoteService.
 *
 * @param {Object} opts
 * @param {number} opts.cryptoPages - Number of CoinGecko pages (default 1 = top 100)
 * @param {boolean} opts.includeEquities - Include stocks/futures/ETFs (default true)
 * @param {boolean} opts.forceRefresh - Bypass cache
 * @returns {Promise<{ markets: Array, sources: Object }>}
 */
export async function fetchTopMarkets({ cryptoPages = 1, includeEquities = true, forceRefresh = false } = {}) {
  // Check cache
  if (!forceRefresh && cache.data && Date.now() - cache.ts < CACHE_TTL) {
    return cache.data;
  }

  const sources = { crypto: { count: 0, error: null }, equities: { count: 0, error: null } };
  const markets = [];

  // Fetch crypto from CoinGecko
  try {
    const crypto = await fetchTopCrypto(cryptoPages);
    markets.push(...crypto);
    sources.crypto.count = crypto.length;
  } catch (err) {
    sources.crypto.error = err.message;
    logger.error('[TopMarketsAdapter] Crypto fetch failed', err);
  }

  // Fetch equities from SymbolRegistry + QuoteService
  if (includeEquities) {
    try {
      const { default: SymbolRegistry } = await import('../SymbolRegistry.js');
      const { batchGetQuotes } = await import('../QuoteService.js');

      const equityClasses = ['stock', 'etf', 'futures', 'forex'];
      const equitySymbols = [];

      for (const cls of equityClasses) {
        const items = SymbolRegistry.byClass(cls);
        if (items) equitySymbols.push(...items.map((i) => i.symbol));
      }

      if (equitySymbols.length > 0) {
        const quotes = await batchGetQuotes(equitySymbols);
        let equityRank = markets.length + 1;

        for (const symbol of equitySymbols) {
          const q = quotes?.[symbol];
          const info = SymbolRegistry.lookup(symbol);
          if (!q || !info) continue;

          markets.push({
            rank: equityRank++,
            id: `equity-${symbol}`,
            symbol: symbol.replace(/USDT$|=F$/, ''),
            name: info.displayName || symbol,
            image: null,
            price: q.price || q.lastPrice,
            change1h: null,
            change24h: q.changePct ?? q.priceChangePercent ?? null,
            change7d: null,
            marketCap: null,
            volume24h: q.volume || q.volume24h || null,
            supply: null,
            maxSupply: null,
            sparkline7d: [],
            assetClass: info.assetClass || 'stock',
            ath: null,
            athDate: null,
          });
        }

        sources.equities.count = markets.length - sources.crypto.count;
      }
    } catch (err) {
      sources.equities.error = err.message;
      logger.error('[TopMarketsAdapter] Equities fetch failed', err);
    }
  }

  const result = { markets, sources };
  cache = { data: result, ts: Date.now() };
  return result;
}

/**
 * Clear the adapter cache.
 */
export function clearTopMarketsCache() {
  cache = { data: null, ts: 0 };
}
