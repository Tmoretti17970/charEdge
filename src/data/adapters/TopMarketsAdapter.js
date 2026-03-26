// ═══════════════════════════════════════════════════════════════════
// charEdge — Top Markets Adapter (Enhanced)
//
// Multi-source aggregation for the Top discovery tab.
// Crypto: CoinGecko /coins/markets (ranked by market cap, free tier).
// Stocks/Futures/ETFs/Indices: SymbolRegistry + QuoteService for live
// prices, with enriched market cap and sparkline data.
//
// Returns a unified row format for the ranked table.
// ═══════════════════════════════════════════════════════════════════

import { logger } from '@/observability/logger';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const CACHE_TTL = 120_000; // 2 min cache for rankings
const CRYPTO_PER_PAGE = 100;

let cache = { data: null, ts: 0 };

// ─── Market cap lookup (known large-caps, updated periodically) ──

const KNOWN_MARKET_CAPS = {
  AAPL: 3.5e12, MSFT: 3.2e12, NVDA: 3.0e12, GOOGL: 2.2e12, AMZN: 2.1e12,
  META: 1.6e12, BRK_B: 1.0e12, TSLA: 900e9, JPM: 680e9, V: 620e9,
  UNH: 540e9, MA: 470e9, LLY: 800e9, AVGO: 750e9, HD: 400e9,
  PG: 400e9, JNJ: 380e9, COST: 380e9, ORCL: 370e9, NFLX: 350e9,
  BAC: 340e9, ABBV: 330e9, CRM: 310e9, XOM: 480e9, KO: 280e9,
  MRK: 270e9, PEP: 230e9, TMO: 210e9, ADBE: 230e9, AMD: 280e9,
  CSCO: 240e9, ACN: 220e9, INTC: 120e9, QCOM: 200e9, TXN: 190e9,
  WMT: 600e9, DIS: 200e9, PYPL: 80e9, UBER: 160e9, BA: 140e9,
  GS: 180e9, MS: 170e9, BLK: 150e9, C: 130e9, WFC: 220e9,
  T: 160e9, VZ: 180e9, CMCSA: 160e9, LMT: 130e9, RTX: 160e9,
  CAT: 180e9, GE: 200e9, HON: 140e9, NOW: 190e9, INTU: 190e9,
  IBM: 210e9, PLTR: 250e9, COIN: 60e9, ARM: 170e9, SMCI: 30e9,
  SHOP: 120e9, SNOW: 50e9, CRWD: 80e9, PANW: 120e9, NET: 35e9,
  ASML: 350e9, TSM: 800e9, SAP: 280e9,
  // ETFs — use AUM as proxy
  SPY: 550e9, QQQ: 250e9, IWM: 60e9, DIA: 35e9, VTI: 400e9,
  VOO: 500e9, GLD: 75e9, TLT: 50e9, IBIT: 50e9,
};

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
    sector: null,
  };
}

/**
 * Fetch top crypto assets from CoinGecko ranked by market cap.
 * Returns up to 250 coins (page 1 = 1-100, page 2 = 101-200, page 3 = 201-250).
 *
 * @param {number} pages - Number of pages to fetch (1-3). Default 2.
 * @returns {Promise<Array>} Normalized market rows.
 */
export async function fetchTopCrypto(pages = 2) {
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
 * Try to fetch sparkline (7d close prices) for a single equity symbol.
 * Falls back gracefully — returns empty array on failure.
 * @private
 */
async function _fetchEquitySparkline(symbol) {
  try {
    const { getSparkline } = await import('../QuoteService.js');
    const data = await getSparkline(symbol);
    return data || [];
  } catch {
    return [];
  }
}

/**
 * Fetch all top markets (crypto + stocks + futures + ETFs + indices).
 * Crypto comes from CoinGecko ranked endpoint.
 * Equities come from SymbolRegistry + QuoteService.
 *
 * @param {Object} opts
 * @param {number} opts.cryptoPages - Number of CoinGecko pages (default 2 = top 200)
 * @param {boolean} opts.includeEquities - Include stocks/futures/ETFs (default true)
 * @param {boolean} opts.forceRefresh - Bypass cache
 * @returns {Promise<{ markets: Array, sources: Object }>}
 */
export async function fetchTopMarkets({ cryptoPages = 2, includeEquities = true, forceRefresh = false } = {}) {
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

      const equityClasses = ['stock', 'etf', 'futures', 'forex', 'index'];
      const equitySymbols = [];

      for (const cls of equityClasses) {
        const items = SymbolRegistry.byClass(cls);
        if (items) equitySymbols.push(...items.map((i) => i.symbol));
      }

      if (equitySymbols.length > 0) {
        const quotes = await batchGetQuotes(equitySymbols);
        let equityRank = markets.length + 1;

        // Fetch sparklines for top 30 equities (by known market cap, to avoid fetching all)
        const topEquities = equitySymbols
          .filter((s) => KNOWN_MARKET_CAPS[s.replace(/=F$|=X$|\^/, '')])
          .slice(0, 30);
        const sparklinePromises = topEquities.map((s) => _fetchEquitySparkline(s).then((d) => [s, d]));
        const sparklineResults = await Promise.allSettled(sparklinePromises);
        const sparklineMap = new Map();
        for (const r of sparklineResults) {
          if (r.status === 'fulfilled' && r.value[1]?.length > 0) {
            sparklineMap.set(r.value[0], r.value[1]);
          }
        }

        for (const symbol of equitySymbols) {
          const q = quotes?.[symbol];
          const info = SymbolRegistry.lookup(symbol);
          if (!q || !info) continue;

          const cleanSymbol = symbol.replace(/USDT$|=F$|=X$/, '');
          const knownCap = KNOWN_MARKET_CAPS[cleanSymbol] || KNOWN_MARKET_CAPS[symbol] || null;

          markets.push({
            rank: equityRank++,
            id: `equity-${symbol}`,
            symbol: cleanSymbol,
            name: info.displayName || symbol,
            image: null,
            price: q.price || q.lastPrice,
            change1h: null,
            change24h: q.changePct ?? q.priceChangePercent ?? null,
            change7d: null,
            marketCap: knownCap,
            volume24h: q.volume || q.volume24h || null,
            supply: null,
            maxSupply: null,
            sparkline7d: sparklineMap.get(symbol) || [],
            assetClass: info.assetClass || 'stock',
            ath: null,
            athDate: null,
            sector: STOCK_SECTORS[cleanSymbol] || null,
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

// ─── Sector mapping for stocks ──────────────────────────────────

const STOCK_SECTORS = {
  // Technology
  AAPL: 'Technology', MSFT: 'Technology', GOOGL: 'Technology', AMZN: 'Technology',
  META: 'Technology', NVDA: 'Technology', TSLA: 'Technology', NFLX: 'Technology',
  AMD: 'Technology', INTC: 'Technology', QCOM: 'Technology', TXN: 'Technology',
  AVGO: 'Technology', ADBE: 'Technology', CRM: 'Technology', CSCO: 'Technology',
  ORCL: 'Technology', IBM: 'Technology', NOW: 'Technology', INTU: 'Technology',
  SNPS: 'Technology', CDNS: 'Technology', KLAC: 'Technology', LRCX: 'Technology',
  AMAT: 'Technology', TSM: 'Technology', ASML: 'Technology', SAP: 'Technology',
  PLTR: 'Technology', SMCI: 'Technology', ARM: 'Technology', COIN: 'Technology',
  SQ: 'Technology', SHOP: 'Technology', NET: 'Technology', SNOW: 'Technology',
  DDOG: 'Technology', ZS: 'Technology', CRWD: 'Technology', PANW: 'Technology',
  ANET: 'Technology', DELL: 'Technology', HPQ: 'Technology', WDAY: 'Technology',
  TEAM: 'Technology', OKTA: 'Technology', TWLO: 'Technology', DOCU: 'Technology',
  MDB: 'Technology', SPLK: 'Technology', ZM: 'Technology', FTNT: 'Technology',
  MRVL: 'Technology', MU: 'Technology', TTD: 'Technology', RBLX: 'Technology',
  U: 'Technology', RDDT: 'Technology', HOOD: 'Technology', AFRM: 'Technology',
  ACN: 'Technology', MSI: 'Technology',
  // Healthcare
  UNH: 'Healthcare', LLY: 'Healthcare', JNJ: 'Healthcare', ABBV: 'Healthcare',
  MRK: 'Healthcare', PFE: 'Healthcare', TMO: 'Healthcare', ABT: 'Healthcare',
  BMY: 'Healthcare', GILD: 'Healthcare', ISRG: 'Healthcare', MDT: 'Healthcare',
  SYK: 'Healthcare', VRTX: 'Healthcare', REGN: 'Healthcare', AMGN: 'Healthcare',
  DHR: 'Healthcare', ZTS: 'Healthcare', ELV: 'Healthcare', CI: 'Healthcare',
  HCA: 'Healthcare', DXCM: 'Healthcare',
  // Financials
  JPM: 'Financials', V: 'Financials', MA: 'Financials', BAC: 'Financials',
  GS: 'Financials', MS: 'Financials', BLK: 'Financials', SCHW: 'Financials',
  C: 'Financials', WFC: 'Financials', AXP: 'Financials', USB: 'Financials',
  MCO: 'Financials', SPGI: 'Financials', ICE: 'Financials', CME: 'Financials',
  KKR: 'Financials', APO: 'Financials', BX: 'Financials', PYPL: 'Financials',
  SOFI: 'Financials',
  // Consumer
  PG: 'Consumer', KO: 'Consumer', PEP: 'Consumer', COST: 'Consumer',
  WMT: 'Consumer', HD: 'Consumer', LOW: 'Consumer', TGT: 'Consumer',
  NKE: 'Consumer', LULU: 'Consumer', SBUX: 'Consumer', MCD: 'Consumer',
  CMG: 'Consumer', YUM: 'Consumer', DPZ: 'Consumer', DASH: 'Consumer',
  ROST: 'Consumer', DIS: 'Consumer',
  // Energy
  XOM: 'Energy', CVX: 'Energy', COP: 'Energy', SLB: 'Energy',
  EOG: 'Energy', PSX: 'Energy', VLO: 'Energy', MPC: 'Energy', OXY: 'Energy',
  // Industrials
  GE: 'Industrials', HON: 'Industrials', CAT: 'Industrials', DE: 'Industrials',
  MMM: 'Industrials', UPS: 'Industrials', FDX: 'Industrials', LMT: 'Industrials',
  RTX: 'Industrials', NOC: 'Industrials', GD: 'Industrials', BA: 'Industrials',
  ADP: 'Industrials', ITW: 'Industrials', EMR: 'Industrials', ETN: 'Industrials',
  PH: 'Industrials', DHI: 'Industrials', UBER: 'Industrials', ABNB: 'Industrials',
  // Telecom
  T: 'Telecom', VZ: 'Telecom', CMCSA: 'Telecom', CHTR: 'Telecom', TMUS: 'Telecom',
  // Automotive / EV
  RIVN: 'Automotive', LCID: 'Automotive', NIO: 'Automotive', LI: 'Automotive', XPEV: 'Automotive',
  // China / International
  BABA: 'Technology', JD: 'Technology', PDD: 'Technology',
  // Crypto miners
  MARA: 'Technology', RIOT: 'Technology',
  // Social / Meme
  GME: 'Consumer', AMC: 'Consumer', SNAP: 'Technology', ROKU: 'Technology',
};
