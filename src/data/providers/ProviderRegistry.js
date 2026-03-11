// ═══════════════════════════════════════════════════════════════════
// charEdge — Provider Registry
//
// Manages the ordered list of equity data providers and provider
// status reporting for the Settings page.
// ═══════════════════════════════════════════════════════════════════

import { fmpAdapter } from '../adapters/FMPAdapter.js';
import { pythAdapter } from '../adapters/PythAdapter.js';
import { tiingoAdapter } from '../adapters/TiingoAdapter.js';
import { fetchAlpaca } from './AlpacaProvider.js';
import { hasApiKey } from './ApiKeyStore.js';
import { fetchPolygon } from './PolygonProvider.js';
// AlphaVantage removed from cascade — 25 req/day provides no unique data vs Polygon/FMP (Task 1B.2)

// ─── Equity Provider Chain ──────────────────────────────────────

/**
 * Ordered list of equity data providers.
 * First one with data wins.
 */
export const EQUITY_PROVIDERS = [
  { id: 'alpaca', name: 'Alpaca Markets', fetch: fetchAlpaca, needsKey: false },
  { id: 'polygon', name: 'Polygon.io', fetch: fetchPolygon, needsKey: false },
  { id: 'fmp', name: 'Financial Modeling Prep', fetch: (sym, tf) => fmpAdapter.fetchOHLCV(sym, tf), needsKey: false },
  { id: 'tiingo', name: 'Tiingo', fetch: (sym, tf) => tiingoAdapter.fetchOHLCV(sym, tf), needsKey: false },
  // Alpha Vantage removed (Task 1B.2) — 25 req/day, no unique data. Polygon/FMP/Tiingo cover equities.
  // Yahoo is handled in FetchService directly as legacy fallback
];

/**
 * Fetch quote from Pyth for any supported symbol.
 * Pyth is free and permissionless — no key needed.
 */
export async function fetchPythQuote(sym) {
  return pythAdapter.fetchQuote(sym);
}

/**
 * Try fetching equity data from premium providers before falling back to Yahoo.
 *
 * @param {string} sym - Ticker symbol
 * @param {string} tfId - charEdge timeframe ID
 * @returns {{ data: Array|null, source: string }}
 */
export async function fetchEquityPremium(sym, tfId) {
  for (const provider of EQUITY_PROVIDERS) {
    if (provider.needsKey && !hasApiKey(provider.id)) continue;

    const data = await provider.fetch(sym, tfId);
    if (data?.length > 1) {
      return { data, source: provider.id };
    }
  }
  return { data: null, source: null };
}

// ─── Provider Status ────────────────────────────────────────────

/**
 * Get status of all configured data providers.
 * Used by Settings page to show which providers are active.
 */
export function getProviderStatus() {
  return {
    alpaca: {
      name: 'Alpaca Markets',
      hasKey: true,
      needsKey: false,
      tier: 'free',
      features: ['US Equities OHLCV (real-time)', 'Intraday + Daily', '200 req/min', 'Paper Trading'],
      rateLimit: '200 req/min (free)',
    },
    pyth: {
      name: 'Pyth Network',
      hasKey: false,
      needsKey: false,
      tier: 'free',
      features: ['Crypto', 'Equities', 'Forex', 'Commodities', 'SSE Streaming (~400ms)'],
      rateLimit: 'Generous (thousands/min)',
      status: pythAdapter.getStatus(),
    },
    polygon: {
      name: 'Polygon.io',
      hasKey: true,
      needsKey: false,
      tier: 'free',
      features: ['Equities OHLCV', 'Options', 'Forex', 'Crypto', 'WebSocket (delayed)'],
      rateLimit: '5 req/min (free)',
    },
    alphavantage: {
      name: 'Alpha Vantage',
      hasKey: true,
      needsKey: false,
      tier: 'free',
      features: ['Equities OHLCV', 'Forex', 'Crypto', 'Fundamentals'],
      rateLimit: '25 req/day (free)',
    },
    coingecko: {
      name: 'CoinGecko',
      hasKey: false,
      needsKey: false,
      tier: 'free',
      features: ['Crypto OHLC (no volume)'],
      rateLimit: '10 req/min',
    },
    binance: {
      name: 'Binance',
      hasKey: false,
      needsKey: false,
      tier: 'free',
      features: ['Crypto OHLCV', 'WebSocket (real-time)'],
      rateLimit: '1200 req/min',
    },
    yahoo: {
      name: 'Yahoo Finance',
      hasKey: false,
      needsKey: false,
      tier: 'free',
      features: ['Equities OHLCV (unreliable)'],
      rateLimit: 'unknown (frequent 403s)',
    },
    kraken: {
      name: 'Kraken',
      hasKey: false,
      needsKey: false,
      tier: 'free',
      features: ['Crypto OHLCV', 'WebSocket (real-time)', '200+ pairs', 'Order book'],
      rateLimit: 'Generous (no published cap)',
    },
    edgar: {
      name: 'SEC EDGAR',
      hasKey: false,
      needsKey: false,
      tier: 'free',
      features: ['Fundamentals (XBRL)', '10-K/10-Q filings', 'Insider transactions', 'Financial ratios'],
      rateLimit: '10 req/sec',
    },
    fred: {
      name: 'FRED (Federal Reserve)',
      hasKey: hasApiKey('fred'),
      needsKey: true,
      tier: 'free',
      features: ['800K+ economic series', 'GDP, CPI, VIX, yields', 'Chart overlays', 'Macro dashboard'],
      rateLimit: '120 req/min',
    },
    sentiment: {
      name: 'Sentiment (Fear & Greed + Reddit)',
      hasKey: false,
      needsKey: false,
      tier: 'free',
      features: ['Fear & Greed Index', 'Reddit trending tickers', 'Social buzz score'],
      rateLimit: 'Generous',
    },
    frankfurter: {
      name: 'Frankfurter (ECB Rates)',
      hasKey: false,
      needsKey: false,
      tier: 'free',
      features: ['30+ FX pairs', 'Historical back to 1999', 'DXY proxy'],
      rateLimit: 'Unlimited',
    },
    news: {
      name: 'News Aggregator',
      hasKey: false,
      needsKey: false,
      tier: 'free',
      features: ['Yahoo Finance RSS', 'Google News', 'Finnhub news', 'Per-ticker & market-wide'],
      rateLimit: 'N/A',
    },
    fmp: {
      name: 'Financial Modeling Prep',
      hasKey: true,
      needsKey: false,
      tier: 'free',
      features: ['Equities OHLCV', 'Fundamentals', 'Earnings calendar', 'Sector performance', 'Screener'],
      rateLimit: '250 req/day (free)',
    },
    tiingo: {
      name: 'Tiingo',
      hasKey: false,
      needsKey: false,
      tier: 'free',
      features: ['Equities OHLCV (EOD)', 'ETFs', 'IEX real-time quotes', 'Adjusted prices'],
      rateLimit: '50 req/hr, 1000 req/day (free)',
    },
    whaleAlert: {
      name: 'Whale Alert',
      hasKey: hasApiKey('whale-alert'),
      needsKey: true,
      tier: 'free',
      features: ['Large crypto transactions', 'Exchange inflow/outflow', 'Whale activity summary'],
      rateLimit: '10 req/min',
    },
    binanceFutures: {
      name: 'Binance Futures (Derivatives)',
      hasKey: false,
      needsKey: false,
      tier: 'free',
      features: ['Open Interest', 'Funding Rates', 'Liquidations (WS)', 'Long/Short Ratio', 'Taker Volume', 'Mark Price'],
      rateLimit: '2400 req/min',
    },
    orderFlow: {
      name: 'Order Flow Engine',
      hasKey: false,
      needsKey: false,
      tier: 'computed',
      features: ['Delta/CVD', 'Volume Profile', 'Footprint', 'Large Trades', 'Tick Speed', 'Clustering'],
      rateLimit: 'N/A (local)',
    },
    indicators: {
      name: 'Indicator Library',
      hasKey: false,
      needsKey: false,
      tier: 'computed',
      features: ['Ichimoku', 'Supertrend', 'VWAP Bands', 'OBV', 'MFI', 'ADX', 'CMF', 'Anchored VWAP'],
      rateLimit: 'N/A (local)',
    },
    peerMesh: {
      name: 'P2P Community Mesh',
      hasKey: false,
      needsKey: false,
      tier: 'free',
      features: ['Peer Sentiment Voting', 'Trade Heatmap', 'Community Signals', 'Data Relay'],
      rateLimit: 'N/A (peer-to-peer)',
    },
  };
}
