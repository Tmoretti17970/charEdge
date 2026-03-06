// ═══════════════════════════════════════════════════════════════════
// charEdge v11 — Forex Adapter
//
// Combines Pyth Network + Finnhub for comprehensive FX coverage.
// Pyth is primary (free, 400ms), Finnhub is secondary (free tier).
//
// Supported pairs:
//   Major: EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CAD, USD/CHF, NZD/USD
//   Cross: EUR/GBP, EUR/JPY, GBP/JPY, AUD/JPY, CAD/JPY
//   Emerging: USD/MXN, USD/ZAR, USD/TRY
//
// Usage:
//   import { forexAdapter } from './ForexAdapter.js';
//   const quote = await forexAdapter.fetchQuote('EUR/USD');
//   forexAdapter.subscribe('EUR/USD', (data) => { ... });
// ═══════════════════════════════════════════════════════════════════

import { pythAdapter } from './PythAdapter.js';
import { finnhubAdapter } from './FinnhubAdapter.js';
import { logger } from '../../utils/logger';

// ─── FX Pair Registry ───────────────────────────────────────────

const FX_PAIRS = {
  // Majors
  'EURUSD':  { pyth: 'EURUSD=X', finnhub: 'OANDA:EUR_USD', name: 'Euro / US Dollar' },
  'GBPUSD':  { pyth: 'GBPUSD=X', finnhub: 'OANDA:GBP_USD', name: 'British Pound / US Dollar' },
  'USDJPY':  { pyth: 'USDJPY=X', finnhub: 'OANDA:USD_JPY', name: 'US Dollar / Japanese Yen' },
  'AUDUSD':  { pyth: 'AUDUSD=X', finnhub: 'OANDA:AUD_USD', name: 'Australian Dollar / US Dollar' },
  'USDCAD':  { pyth: 'USDCAD=X', finnhub: 'OANDA:USD_CAD', name: 'US Dollar / Canadian Dollar' },
  'USDCHF':  { pyth: 'USDCHF=X', finnhub: 'OANDA:USD_CHF', name: 'US Dollar / Swiss Franc' },
  'NZDUSD':  { pyth: 'NZDUSD=X', finnhub: 'OANDA:NZD_USD', name: 'New Zealand Dollar / US Dollar' },

  // Crosses
  'EURGBP':  { pyth: null, finnhub: 'OANDA:EUR_GBP', name: 'Euro / British Pound' },
  'EURJPY':  { pyth: null, finnhub: 'OANDA:EUR_JPY', name: 'Euro / Japanese Yen' },
  'GBPJPY':  { pyth: null, finnhub: 'OANDA:GBP_JPY', name: 'British Pound / Japanese Yen' },
  'AUDJPY':  { pyth: null, finnhub: 'OANDA:AUD_JPY', name: 'Australian Dollar / Japanese Yen' },
  'CADJPY':  { pyth: null, finnhub: 'OANDA:CAD_JPY', name: 'Canadian Dollar / Japanese Yen' },

  // Emerging
  'USDMXN':  { pyth: null, finnhub: 'OANDA:USD_MXN', name: 'US Dollar / Mexican Peso' },
  'USDZAR':  { pyth: null, finnhub: 'OANDA:USD_ZAR', name: 'US Dollar / South African Rand' },
  'USDTRY':  { pyth: null, finnhub: 'OANDA:USD_TRY', name: 'US Dollar / Turkish Lira' },
};

// ─── Helpers ────────────────────────────────────────────────────

function normalizePair(input) {
  const clean = (input || '').toUpperCase().replace(/[^A-Z]/g, '');
  // Try direct match
  if (FX_PAIRS[clean]) return clean;
  // Try with slash removed: EUR/USD → EURUSD
  const noSlash = input?.replace('/', '') || '';
  if (FX_PAIRS[noSlash.toUpperCase()]) return noSlash.toUpperCase();
  // Try =X suffix removal
  if (clean.endsWith('X')) {
    const base = clean.slice(0, -1);
    if (FX_PAIRS[base]) return base;
  }
  return null;
}

// ─── Forex Adapter ──────────────────────────────────────────────

class _ForexAdapter {
  constructor() {
    this._subscribers = new Map(); // pair → Set<callback>
    this._unsubs = [];
  }

  /**
   * Get list of all supported FX pairs.
   * @returns {Array<{ pair, name, hasPyth, hasFinnhub }>}
   */
  getPairs() {
    return Object.entries(FX_PAIRS).map(([pair, info]) => ({
      pair,
      name: info.name,
      hasPyth: !!info.pyth,
      hasFinnhub: !!info.finnhub,
    }));
  }

  /**
   * Check if a symbol is a supported FX pair.
   * @param {string} symbol
   * @returns {boolean}
   */
  supports(symbol) {
    return !!normalizePair(symbol);
  }

  /**
   * Fetch a one-time quote for an FX pair.
   * Tries Pyth first, then Finnhub.
   *
   * @param {string} symbol - e.g., 'EUR/USD', 'EURUSD', 'EURUSD=X'
   * @returns {Promise<{ price, source, pair, name }>}
   */
  async fetchQuote(symbol) {
    const pair = normalizePair(symbol);
    if (!pair) return null;

    const info = FX_PAIRS[pair];

    // Try Pyth first (fastest, free)
    if (info.pyth) {
      try {
        const quote = await pythAdapter.fetchQuote(info.pyth);
        if (quote?.price > 0) {
          return { price: quote.price, source: 'pyth', pair, name: info.name, confidence: quote.confidence };
        }
      } catch (e) { logger.data.warn('Operation failed', e); }
    }

    // Try Finnhub
    if (info.finnhub && finnhubAdapter.isConfigured) {
      try {
        const quote = await finnhubAdapter.fetchQuote(info.finnhub);
        if (quote?.price > 0) {
          return { price: quote.price, source: 'finnhub', pair, name: info.name, confidence: 0 };
        }
      } catch (e) { logger.data.warn('Operation failed', e); }
    }

    return null;
  }

  /**
   * Subscribe to real-time FX pair updates.
   * Routes to best available streaming source.
   *
   * @param {string} symbol
   * @param {Function} callback - ({ price, source, pair, timestamp }) => void
   * @returns {Function} unsubscribe
   */
  subscribe(symbol, callback) {
    const pair = normalizePair(symbol);
    if (!pair) return () => {};

    const info = FX_PAIRS[pair];

    // Subscribe to Pyth if available
    if (info.pyth) {
      try {
        const unsub = pythAdapter.subscribe(info.pyth, (data) => {
          callback({
            price: data.price,
            source: 'pyth',
            pair,
            timestamp: data.time || Date.now(),
            confidence: data.confidence || 0,
          });
        });
        if (unsub) this._unsubs.push(unsub);
      } catch (e) { logger.data.warn('Operation failed', e); }
    }

    // Subscribe to Finnhub as secondary
    if (info.finnhub && finnhubAdapter.isConfigured) {
      try {
        const unsub = finnhubAdapter.subscribe(info.finnhub, (data) => {
          callback({
            price: data.price,
            source: 'finnhub',
            pair,
            timestamp: data.timestamp || Date.now(),
            confidence: 0,
          });
        });
        if (unsub) this._unsubs.push(unsub);
      } catch (e) { logger.data.warn('Operation failed', e); }
    }

    return () => {
      // Unsubscribe all related
      this._unsubs.forEach(fn => { try { fn(); } catch (e) { logger.data.warn('Operation failed', e); } });
      this._unsubs = [];
    };
  }

  /**
   * Search FX pairs matching a query.
   * @param {string} query
   * @returns {Array<{ pair, name }>}
   */
  search(query) {
    const q = (query || '').toUpperCase();
    return Object.entries(FX_PAIRS)
      .filter(([pair, info]) =>
        pair.includes(q) || info.name.toUpperCase().includes(q)
      )
      .map(([pair, info]) => ({
        symbol: pair,
        displayName: info.name,
        assetClass: 'forex',
        provider: info.pyth ? 'pyth' : 'finnhub',
      }));
  }

  /**
   * Dispose of all connections.
   */
  dispose() {
    this._unsubs.forEach(fn => { try { fn(); } catch (e) { logger.data.warn('Operation failed', e); } });
    this._unsubs = [];
    this._subscribers.clear();
  }
}

// ─── Singleton + Exports ──────────────────────────────────────────

export const forexAdapter = new _ForexAdapter();

export default forexAdapter;
