// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — CoinGecko Adapter
//
// Free crypto OHLC data via CoinGecko API (demo key).
// Up to 365 days of daily OHLC, 90 days hourly.
// Rate limit: 30 req/min on the free demo tier.
// ═══════════════════════════════════════════════════════════════════

import { BaseAdapter } from './BaseAdapter.js';
import { logger } from '../../utils/logger.ts';
import { CRYPTO_IDS } from '../../constants.js';

const API_BASE =
  typeof window === 'undefined'
    ? `http://localhost:${globalThis.__TF_PORT || 3000}/api/coingecko`
    : '/api/coingecko';

// Map charEdge intervals to CoinGecko `days` parameter.
// CoinGecko auto-selects candle granularity based on days:
//   1-2 days  → 30m candles
//   3-30 days → 4h candles
//   31+ days  → daily candles
const INTERVAL_TO_DAYS = {
  '1m':  1,
  '2m':  1,
  '5m':  1,
  '15m': 1,
  '30m': 2,
  '1h':  30,
  '4h':  90,
  '1d':  365,
  '1w':  365,
  '1M':  365,
};

// ─── Token Bucket Rate Limiter ──────────────────────────────────
const BUCKET_MAX = 30;        // 30 requests
const BUCKET_REFILL_MS = 60_000; // per minute
let _tokens = BUCKET_MAX;
let _lastRefill = Date.now();

function _consumeToken() {
  const now = Date.now();
  const elapsed = now - _lastRefill;
  if (elapsed >= BUCKET_REFILL_MS) {
    _tokens = BUCKET_MAX;
    _lastRefill = now;
  }
  if (_tokens <= 0) return false;
  _tokens--;
  return true;
}

export class CoinGeckoAdapter extends BaseAdapter {
  constructor(apiKey = '') {
    super('coingecko');
    this._apiKey = apiKey;
  }

  supports(symbol) {
    const upper = (symbol || '').toUpperCase();
    // Strip USDT/BUSD suffix to get base symbol
    const base = upper.replace(/(USDT|BUSD|USDC|USD)$/, '');
    return !!CRYPTO_IDS[base];
  }

  /**
   * Resolve a symbol to a CoinGecko coin ID.
   * @param {string} symbol - e.g. 'BTC', 'BTCUSDT', 'ethereum'
   * @returns {string|null} CoinGecko ID (e.g. 'bitcoin')
   */
  _toCoinId(symbol) {
    const upper = (symbol || '').toUpperCase();
    const base = upper.replace(/(USDT|BUSD|USDC|USD)$/, '');
    return CRYPTO_IDS[base] || null;
  }

  async fetchOHLCV(symbol, interval = '1d', opts = {}) {
    if (!_consumeToken()) {
      logger.data.warn('[CoinGecko] Rate limit exceeded — skipping');
      return null;
    }

    const coinId = this._toCoinId(symbol);
    if (!coinId) return null;

    const days = opts.days || INTERVAL_TO_DAYS[interval] || 365;

    let url = `${API_BASE}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`;
    if (this._apiKey) url += `&x_cg_demo_api_key=${this._apiKey}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) return null;
      const raw = await res.json();
      if (!Array.isArray(raw) || raw.length < 2) return null;

      // CoinGecko OHLC format: [timestamp_ms, open, high, low, close]
      // Note: CoinGecko OHLC does NOT include volume
      return raw.map(([time, open, high, low, close]) => ({
        time: new Date(time).toISOString(),
        open,
        high,
        low,
        close,
        volume: 0,
      }));
    } catch {
      return null;
    }
  }

  async fetchQuote(symbol) {
    if (!_consumeToken()) return null;

    const coinId = this._toCoinId(symbol);
    if (!coinId) return null;

    let url = `${API_BASE}/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true`;
    if (this._apiKey) url += `&x_cg_demo_api_key=${this._apiKey}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) return null;
      const data = await res.json();
      const coin = data?.[coinId];
      if (!coin) return null;

      return {
        price: coin.usd || 0,
        change: 0, // Simple price endpoint doesn't give absolute change
        changePct: coin.usd_24h_change || 0,
        volume: coin.usd_24h_vol || 0,
        high: 0,
        low: 0,
        open: 0,
      };
    } catch {
      return null;
    }
  }

  subscribe(_symbol, _callback) {
    // CoinGecko does not support WebSocket streaming
    logger.data.warn('[CoinGeckoAdapter] Real-time subscriptions not supported');
    return () => {};
  }

  async searchSymbols(query, limit = 10) {
    if (!_consumeToken()) return [];

    let url = `${API_BASE}/search?query=${encodeURIComponent(query)}`;
    if (this._apiKey) url += `&x_cg_demo_api_key=${this._apiKey}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) return [];
      const data = await res.json();
      return (data?.coins || []).slice(0, limit).map((c) => ({
        symbol: (c.symbol || '').toUpperCase(),
        name: c.name || c.symbol,
        type: 'CRYPTO',
        exchange: 'CoinGecko',
      }));
    } catch {
      return [];
    }
  }
}

export default CoinGeckoAdapter;
