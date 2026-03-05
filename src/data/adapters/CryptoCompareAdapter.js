// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — CryptoCompare Adapter
//
// Free crypto OHLCV data via CryptoCompare API.
// Up to 2000 daily candles (~5.5 years) per request.
// Free tier: 100K calls/month with API key.
// ═══════════════════════════════════════════════════════════════════

import { BaseAdapter } from './BaseAdapter.js';
import { logger } from '../../utils/logger.ts';
import { CRYPTO_IDS } from '../../constants.js';

const API_BASE =
  typeof window === 'undefined'
    ? `http://localhost:${globalThis.__TF_PORT || 3000}/api/cryptocompare`
    : '/api/cryptocompare';

// Map charEdge intervals to CryptoCompare endpoint + limit
const INTERVAL_CONFIG = {
  '1m':  { endpoint: 'histominute', limit: 1440 },   // 1 day of minutes
  '2m':  { endpoint: 'histominute', limit: 1440 },
  '5m':  { endpoint: 'histominute', limit: 2000 },   // ~3.5 days of 5m (aggregate=5)
  '15m': { endpoint: 'histominute', limit: 2000, aggregate: 15 },
  '30m': { endpoint: 'histohour', limit: 720 },      // 30 days of hourly
  '1h':  { endpoint: 'histohour', limit: 720 },
  '4h':  { endpoint: 'histohour', limit: 2000 },     // ~83 days of 4h (aggregate=4)
  '1d':  { endpoint: 'histoday', limit: 2000 },      // ~5.5 years
  '1w':  { endpoint: 'histoday', limit: 2000 },      // aggregate=7 for weekly
  '1M':  { endpoint: 'histoday', limit: 2000 },
};

// Aggregate values for intervals that aren't natively supported
const AGGREGATE_MAP = {
  '5m':  5,
  '15m': 15,
  '4h':  4,
  '1w':  7,
};

export class CryptoCompareAdapter extends BaseAdapter {
  constructor(apiKey = '') {
    super('cryptocompare');
    this._apiKey = apiKey;
  }

  supports(symbol) {
    const upper = (symbol || '').toUpperCase();
    const base = upper.replace(/(USDT|BUSD|USDC|USD)$/, '');
    return !!CRYPTO_IDS[base];
  }

  /**
   * Extract the base crypto symbol from a trading pair.
   * @param {string} symbol - e.g. 'BTCUSDT', 'ETH', 'SOLUSD'
   * @returns {string} Base symbol (e.g. 'BTC')
   */
  _toBaseSymbol(symbol) {
    const upper = (symbol || '').toUpperCase();
    return upper.replace(/(USDT|BUSD|USDC|USD)$/, '');
  }

  async fetchOHLCV(symbol, interval = '1d', opts = {}) {
    const base = this._toBaseSymbol(symbol);
    if (!CRYPTO_IDS[base]) return null;

    const config = INTERVAL_CONFIG[interval] || INTERVAL_CONFIG['1d'];
    const limit = opts.limit || config.limit;
    const aggregate = AGGREGATE_MAP[interval] || 1;

    let url = `${API_BASE}/data/v2/${config.endpoint}?fsym=${base}&tsym=USD&limit=${limit}`;
    if (aggregate > 1) url += `&aggregate=${aggregate}`;
    if (opts.toTs) url += `&toTs=${opts.toTs}`;

    const headers = {};
    if (this._apiKey) headers['authorization'] = `Apikey ${this._apiKey}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { signal: controller.signal, headers });
      clearTimeout(timeout);

      if (!res.ok) return null;
      const json = await res.json();

      // CryptoCompare v2 response: { Response: 'Success', Data: { Data: [...] } }
      const data = json?.Data?.Data;
      if (!Array.isArray(data) || data.length < 2) return null;

      return data
        .filter((d) => d.close > 0) // Filter zero/empty candles
        .map((d) => ({
          time: new Date(d.time * 1000).toISOString(),
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
          volume: d.volumefrom || d.volumeto || 0,
        }));
    } catch (_) {
      return null;
    }
  }

  async fetchQuote(symbol) {
    const base = this._toBaseSymbol(symbol);
    if (!CRYPTO_IDS[base]) return null;

    const url = `${API_BASE}/data/pricemultifull?fsyms=${base}&tsyms=USD`;
    const headers = {};
    if (this._apiKey) headers['authorization'] = `Apikey ${this._apiKey}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { signal: controller.signal, headers });
      clearTimeout(timeout);

      if (!res.ok) return null;
      const json = await res.json();
      const d = json?.RAW?.[base]?.USD;
      if (!d) return null;

      return {
        price: d.PRICE || 0,
        change: d.CHANGE24HOUR || 0,
        changePct: d.CHANGEPCT24HOUR || 0,
        volume: d.VOLUME24HOUR || 0,
        high: d.HIGH24HOUR || 0,
        low: d.LOW24HOUR || 0,
        open: d.OPEN24HOUR || 0,
      };
    } catch (_) {
      return null;
    }
  }

  subscribe(_symbol, _callback) {
    // CryptoCompare has WebSocket streaming but requires paid tier
    logger.data.warn('[CryptoCompareAdapter] Real-time subscriptions not supported on free tier');
    return () => {};
  }

  async searchSymbols(query, limit = 10) {
    // CryptoCompare doesn't have a search endpoint — filter from CRYPTO_IDS
    const q = (query || '').toUpperCase();
    return Object.keys(CRYPTO_IDS)
      .filter((sym) => sym.includes(q))
      .slice(0, limit)
      .map((sym) => ({
        symbol: sym,
        name: CRYPTO_IDS[sym],
        type: 'CRYPTO',
        exchange: 'CryptoCompare',
      }));
  }
}

export default CryptoCompareAdapter;
