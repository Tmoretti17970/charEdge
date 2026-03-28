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
  // ── Mega-Cap Technology ──
  AAPL: 3.5e12, MSFT: 3.2e12, NVDA: 3.0e12, GOOGL: 2.2e12, AMZN: 2.1e12,
  META: 1.6e12, TSLA: 900e9, AVGO: 750e9, ORCL: 370e9, ADBE: 230e9,
  CRM: 310e9, CSCO: 240e9, ACN: 220e9, NFLX: 350e9, AMD: 280e9,
  INTC: 120e9, QCOM: 200e9, TXN: 190e9, IBM: 210e9, NOW: 190e9,
  INTU: 190e9, ANET: 110e9, PLTR: 250e9, SMCI: 30e9, ARM: 170e9,
  COIN: 60e9, SQ: 45e9, SHOP: 120e9, SNOW: 50e9, DDOG: 45e9,
  CRWD: 80e9, PANW: 120e9, NET: 35e9, ZS: 30e9, FTNT: 60e9,
  TTD: 45e9, MU: 120e9, MRVL: 70e9, SNPS: 80e9, CDNS: 75e9,
  KLAC: 95e9, LRCX: 100e9, AMAT: 150e9, TSM: 800e9, ASML: 350e9,
  SAP: 280e9, HPQ: 35e9, DELL: 80e9, WDAY: 60e9, TEAM: 50e9,
  DXCM: 30e9, OKTA: 15e9, TWLO: 12e9, DOCU: 14e9, MDB: 25e9,
  SPLK: 25e9, ZM: 20e9, RBLX: 30e9, U: 12e9, RDDT: 25e9,
  HOOD: 20e9, AFRM: 15e9, MSI: 70e9, NXPI: 55e9, ON: 30e9,
  SWKS: 20e9, STX: 18e9, WDC: 20e9, KEYS: 35e9, ZBRA: 18e9,
  MPWR: 35e9, GDDY: 25e9, GEN: 15e9, IT: 40e9, ANSS: 30e9,
  FICO: 45e9, CPAY: 20e9,
  // ── Financials ──
  'BRK-B': 1.0e12, JPM: 680e9, V: 620e9, MA: 470e9, BAC: 340e9,
  GS: 180e9, MS: 170e9, BLK: 150e9, SCHW: 120e9, C: 130e9,
  WFC: 220e9, AXP: 180e9, USB: 70e9, MCO: 80e9, SPGI: 150e9,
  ICE: 85e9, CME: 80e9, KKR: 100e9, APO: 70e9, BX: 170e9,
  PNC: 70e9, TFC: 50e9, MTB: 25e9, FITB: 25e9, COF: 60e9,
  DFS: 40e9, MET: 50e9, PRU: 40e9, AFL: 50e9, TRV: 55e9,
  CB: 110e9, MMC: 100e9, AON: 75e9, AIG: 45e9, ALL: 45e9,
  CINF: 20e9, PYPL: 80e9, SOFI: 12e9,
  // ── Healthcare ──
  UNH: 540e9, LLY: 800e9, JNJ: 380e9, ABBV: 330e9, TMO: 210e9,
  MRK: 270e9, PFE: 150e9, ABT: 190e9, BMY: 100e9, GILD: 100e9, ISRG: 170e9,
  MDT: 110e9, SYK: 130e9, VRTX: 120e9, REGN: 100e9, AMGN: 150e9,
  DHR: 170e9, ZTS: 80e9, ELV: 100e9, CI: 95e9, HCA: 80e9,
  BSX: 120e9, EW: 45e9, BDX: 65e9, HOLX: 20e9, IDXX: 40e9,
  A: 40e9, IQV: 40e9, GEHC: 40e9, ALGN: 18e9, ZBH: 22e9, MTD: 25e9,
  // ── Consumer ──
  HD: 400e9, LOW: 150e9, TGT: 60e9, WMT: 600e9, COST: 380e9,
  NKE: 120e9, LULU: 40e9, SBUX: 100e9, MCD: 210e9, CMG: 80e9,
  YUM: 40e9, DPZ: 15e9, DASH: 60e9, ROST: 45e9, DHI: 45e9,
  DIS: 200e9, UBER: 160e9, ABNB: 70e9, SNAP: 15e9, ROKU: 10e9,
  BKNG: 160e9, MAR: 80e9, HLT: 55e9, ORLY: 65e9, AZO: 50e9,
  LEN: 35e9, PHM: 25e9, EBAY: 30e9, RCL: 55e9, WYNN: 10e9,
  GPC: 20e9, GRMN: 30e9, POOL: 14e9, RIVN: 12e9, LCID: 5e9,
  GME: 8e9, AMC: 3e9, NIO: 8e9, LI: 20e9, XPEV: 10e9,
  BABA: 200e9, JD: 45e9, PDD: 130e9,
  PG: 400e9, KO: 280e9, PEP: 230e9, CL: 75e9, MDLZ: 85e9,
  MNST: 55e9, PM: 190e9, MO: 85e9, KDP: 45e9, SYY: 40e9,
  KR: 40e9, ADM: 25e9, STZ: 45e9, GIS: 40e9, HSY: 35e9, KMB: 45e9, MKC: 20e9,
  // ── Energy ──
  XOM: 480e9, CVX: 280e9, COP: 130e9, SLB: 60e9, EOG: 70e9,
  PSX: 50e9, VLO: 45e9, MPC: 55e9, OXY: 40e9, DVN: 25e9,
  FANG: 35e9, HAL: 25e9, BKR: 35e9, WMB: 50e9, KMI: 45e9, OKE: 55e9, TRGP: 35e9,
  // ── Industrials ──
  BA: 140e9, GE: 200e9, HON: 140e9, CAT: 180e9, DE: 120e9,
  MMM: 70e9, UPS: 100e9, FDX: 70e9, ADP: 110e9, ITW: 75e9,
  EMR: 65e9, ETN: 120e9, PH: 80e9, LMT: 130e9, RTX: 160e9,
  NOC: 70e9, GD: 75e9, WM: 85e9, RSG: 60e9, CTAS: 75e9,
  PAYX: 50e9, FAST: 40e9, ODFL: 40e9, CSX: 60e9, NSC: 50e9,
  UNP: 140e9, TDG: 70e9, AXON: 40e9, IR: 40e9, CPRT: 50e9,
  VRSK: 40e9, SHW: 85e9, MARA: 5e9, RIOT: 3e9,
  // ── Telecom / Communication ──
  T: 160e9, VZ: 180e9, CMCSA: 160e9, CHTR: 50e9, TMUS: 250e9,
  EA: 40e9, TTWO: 30e9, MTCH: 8e9, PARA: 7e9, WBD: 20e9, NWSA: 15e9,
  // ── Utilities ──
  NEE: 160e9, DUK: 85e9, SO: 90e9, D: 45e9, AEP: 50e9,
  SRE: 50e9, XEL: 35e9, WEC: 28e9, ED: 32e9, AWK: 27e9,
  // ── Real Estate ──
  PLD: 110e9, AMT: 95e9, CCI: 40e9, EQIX: 80e9, PSA: 55e9,
  SPG: 55e9, O: 50e9, WELL: 55e9, DLR: 45e9, VICI: 35e9,
  // ── Materials ──
  LIN: 210e9, APD: 65e9, ECL: 60e9, DD: 30e9, FCX: 60e9,
  NEM: 50e9, NUE: 35e9, VMC: 35e9, MLM: 35e9, PPG: 30e9,
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
          const q = quotes?.get(symbol);
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
  ACN: 'Technology', MSI: 'Technology', NXPI: 'Technology', ON: 'Technology',
  SWKS: 'Technology', STX: 'Technology', WDC: 'Technology', KEYS: 'Technology',
  ZBRA: 'Technology', MPWR: 'Technology', GDDY: 'Technology', GEN: 'Technology',
  IT: 'Technology', ANSS: 'Technology', FICO: 'Technology', CPAY: 'Technology',
  MARA: 'Technology', RIOT: 'Technology', SNAP: 'Technology', ROKU: 'Technology',
  BABA: 'Technology', JD: 'Technology', PDD: 'Technology',
  // Healthcare
  UNH: 'Healthcare', LLY: 'Healthcare', JNJ: 'Healthcare', ABBV: 'Healthcare',
  MRK: 'Healthcare', PFE: 'Healthcare', TMO: 'Healthcare', ABT: 'Healthcare',
  BMY: 'Healthcare', GILD: 'Healthcare', ISRG: 'Healthcare', MDT: 'Healthcare',
  SYK: 'Healthcare', VRTX: 'Healthcare', REGN: 'Healthcare', AMGN: 'Healthcare',
  DHR: 'Healthcare', ZTS: 'Healthcare', ELV: 'Healthcare', CI: 'Healthcare',
  HCA: 'Healthcare', DXCM: 'Healthcare', BSX: 'Healthcare', EW: 'Healthcare',
  BDX: 'Healthcare', HOLX: 'Healthcare', IDXX: 'Healthcare', A: 'Healthcare',
  IQV: 'Healthcare', GEHC: 'Healthcare', ALGN: 'Healthcare', ZBH: 'Healthcare',
  MTD: 'Healthcare',
  // Financials
  JPM: 'Financials', V: 'Financials', MA: 'Financials', BAC: 'Financials',
  GS: 'Financials', MS: 'Financials', BLK: 'Financials', SCHW: 'Financials',
  C: 'Financials', WFC: 'Financials', AXP: 'Financials', USB: 'Financials',
  MCO: 'Financials', SPGI: 'Financials', ICE: 'Financials', CME: 'Financials',
  KKR: 'Financials', APO: 'Financials', BX: 'Financials', PYPL: 'Financials',
  SOFI: 'Financials', PNC: 'Financials', TFC: 'Financials', MTB: 'Financials',
  FITB: 'Financials', COF: 'Financials', DFS: 'Financials', MET: 'Financials',
  PRU: 'Financials', AFL: 'Financials', TRV: 'Financials', CB: 'Financials',
  MMC: 'Financials', AON: 'Financials', AIG: 'Financials', ALL: 'Financials',
  CINF: 'Financials', 'BRK-B': 'Financials',
  // Consumer
  PG: 'Consumer', KO: 'Consumer', PEP: 'Consumer', COST: 'Consumer',
  WMT: 'Consumer', HD: 'Consumer', LOW: 'Consumer', TGT: 'Consumer',
  NKE: 'Consumer', LULU: 'Consumer', SBUX: 'Consumer', MCD: 'Consumer',
  CMG: 'Consumer', YUM: 'Consumer', DPZ: 'Consumer', DASH: 'Consumer',
  ROST: 'Consumer', DIS: 'Consumer', DHI: 'Consumer', UBER: 'Consumer',
  ABNB: 'Consumer', BKNG: 'Consumer', MAR: 'Consumer', HLT: 'Consumer',
  ORLY: 'Consumer', AZO: 'Consumer', LEN: 'Consumer', PHM: 'Consumer',
  EBAY: 'Consumer', RCL: 'Consumer', WYNN: 'Consumer', GPC: 'Consumer',
  GRMN: 'Consumer', POOL: 'Consumer', GME: 'Consumer', AMC: 'Consumer',
  CL: 'Consumer', MDLZ: 'Consumer', MNST: 'Consumer', PM: 'Consumer',
  MO: 'Consumer', KDP: 'Consumer', SYY: 'Consumer', KR: 'Consumer',
  ADM: 'Consumer', STZ: 'Consumer', GIS: 'Consumer', HSY: 'Consumer',
  KMB: 'Consumer', MKC: 'Consumer',
  // Energy
  XOM: 'Energy', CVX: 'Energy', COP: 'Energy', SLB: 'Energy',
  EOG: 'Energy', PSX: 'Energy', VLO: 'Energy', MPC: 'Energy', OXY: 'Energy',
  DVN: 'Energy', FANG: 'Energy', HAL: 'Energy', BKR: 'Energy',
  WMB: 'Energy', KMI: 'Energy', OKE: 'Energy', TRGP: 'Energy',
  // Industrials
  GE: 'Industrials', HON: 'Industrials', CAT: 'Industrials', DE: 'Industrials',
  MMM: 'Industrials', UPS: 'Industrials', FDX: 'Industrials', LMT: 'Industrials',
  RTX: 'Industrials', NOC: 'Industrials', GD: 'Industrials', BA: 'Industrials',
  ADP: 'Industrials', ITW: 'Industrials', EMR: 'Industrials', ETN: 'Industrials',
  PH: 'Industrials', WM: 'Industrials', RSG: 'Industrials', CTAS: 'Industrials',
  PAYX: 'Industrials', FAST: 'Industrials', ODFL: 'Industrials', CSX: 'Industrials',
  NSC: 'Industrials', UNP: 'Industrials', TDG: 'Industrials', AXON: 'Industrials',
  IR: 'Industrials', CPRT: 'Industrials', VRSK: 'Industrials', SHW: 'Industrials',
  // Telecom / Communication
  T: 'Telecom', VZ: 'Telecom', CMCSA: 'Telecom', CHTR: 'Telecom', TMUS: 'Telecom',
  EA: 'Telecom', TTWO: 'Telecom', MTCH: 'Telecom', PARA: 'Telecom',
  WBD: 'Telecom', NWSA: 'Telecom',
  // Automotive / EV
  RIVN: 'Automotive', LCID: 'Automotive', NIO: 'Automotive', LI: 'Automotive', XPEV: 'Automotive',
  // Utilities
  NEE: 'Utilities', DUK: 'Utilities', SO: 'Utilities', D: 'Utilities',
  AEP: 'Utilities', SRE: 'Utilities', XEL: 'Utilities', WEC: 'Utilities',
  ED: 'Utilities', AWK: 'Utilities',
  // Real Estate
  PLD: 'Real Estate', AMT: 'Real Estate', CCI: 'Real Estate', EQIX: 'Real Estate',
  PSA: 'Real Estate', SPG: 'Real Estate', O: 'Real Estate', WELL: 'Real Estate',
  DLR: 'Real Estate', VICI: 'Real Estate',
  // Materials
  LIN: 'Materials', APD: 'Materials', ECL: 'Materials', DD: 'Materials',
  FCX: 'Materials', NEM: 'Materials', NUE: 'Materials', VMC: 'Materials',
  MLM: 'Materials', PPG: 'Materials',
};
