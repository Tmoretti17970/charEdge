// ═══════════════════════════════════════════════════════════════════
// charEdge v12 — Financial Modeling Prep (FMP) Adapter
//
// Backup equity data provider for stocks/fundamentals.
// FMP free tier: 250 req/day (10x more than Alpha Vantage's 25/day).
//
// Phase 2.1.1: All requests routed through /api/proxy/fmp/ — the
// server-side proxy injects the API key from env vars, keeping it
// out of the client JS bundle.
//
// Provides:
//   - OHLCV historical data
//   - Real-time quotes
//   - Company fundamentals (income statement, balance sheet)
//   - Earnings calendar
//   - Insider trading
//   - Sector performance
//   - Stock screener
//
// Usage:
//   import { fmpAdapter } from './FMPAdapter.js';
//   const data = await fmpAdapter.fetchOHLCV('AAPL', '1d');
// ═══════════════════════════════════════════════════════════════════

import { BaseAdapter } from './BaseAdapter.js';

import { logger } from '../../utils/logger.ts';
// Phase 2.1.1: Requests go through server proxy (API key injected server-side)
const PROXY_BASE = '/api/proxy/fmp';

const CACHE = new Map();
const CACHE_TTL = 30000; // 30 sec for quotes
const LONG_CACHE_TTL = 3600000; // 1 hour for fundamentals

class FMPAdapter extends BaseAdapter {
  constructor() {
    super('fmp');
    this._available = null; // null = untested, true/false = cached result
  }

  // Phase 2.1.1: API key managed server-side — always "configured"
  get isConfigured() { return true; }

  // Legacy no-op — key is server-side now
  setApiKey(_key) { /* no-op: API key managed server-side */ }

  // ─── Availability Gate ──────────────────────────────────────
  // Probes the proxy once per session. If the key is missing (503)
  // or forbidden (403), cache that and skip all future requests
  // to avoid spamming red errors in the browser console.
  async _checkAvailability() {
    if (this._available !== null) return this._available;
    try {
      const res = await fetch(`${PROXY_BASE}/quote/AAPL`);
      this._available = res.ok;
      if (!this._available) {
        logger.data.info(`[FMPAdapter] Proxy returned ${res.status} — provider disabled for this session`);
      }
    } catch {
      this._available = false;
    }
    return this._available;
  }

  // ─── OHLCV ───────────────────────────────────────────────────

  async fetchOHLCV(symbol, interval = '1d', opts = {}) {
    // FMP uses different endpoints per timeframe
    let endpoint;
    if (['1m', '5m', '15m', '30m', '1h', '4h'].includes(interval)) {
      endpoint = `historical-chart/${interval}/${symbol}`;
    } else {
      endpoint = `historical-price-full/${symbol}`;
    }

    const params = {};
    if (opts.from) params.from = opts.from;
    if (opts.to) params.to = opts.to;

    const data = await this._request(endpoint, params);
    if (!data) return [];

    // FMP returns different shapes per endpoint
    const candles = Array.isArray(data) ? data : data.historical || [];

    return candles
      .map(c => ({
        time: new Date(c.date).getTime(),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume || 0,
        vwap: c.vwap || null,
      }))
      .sort((a, b) => a.time - b.time); // Oldest first
  }

  // ─── Quote ───────────────────────────────────────────────────

  async fetchQuote(symbol) {
    const cacheKey = `quote-${symbol}`;
    const cached = CACHE.get(cacheKey);
    if (cached && Date.now() < cached.expiry) return cached.data;

    const data = await this._request(`quote/${symbol}`);
    if (!Array.isArray(data) || !data[0]) return null;

    const q = data[0];
    const result = {
      price: q.price,
      change: q.change,
      changePct: q.changesPercentage,
      volume: q.volume,
      avgVolume: q.avgVolume,
      high: q.dayHigh,
      low: q.dayLow,
      open: q.open,
      prevClose: q.previousClose,
      marketCap: q.marketCap,
      pe: q.pe,
      eps: q.eps,
      name: q.name,
      exchange: q.exchange,
      yearHigh: q.yearHigh,
      yearLow: q.yearLow,
    };

    CACHE.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL });
    return result;
  }

  // ─── Fundamentals ────────────────────────────────────────────

  async fetchIncomeStatement(symbol, period = 'annual', limit = 5) {
    return this._cachedRequest(`income-${symbol}-${period}`,
      `income-statement/${symbol}`, { period, limit }, LONG_CACHE_TTL);
  }

  async fetchBalanceSheet(symbol, period = 'annual', limit = 5) {
    return this._cachedRequest(`balance-${symbol}-${period}`,
      `balance-sheet-statement/${symbol}`, { period, limit }, LONG_CACHE_TTL);
  }

  async fetchKeyMetrics(symbol, period = 'annual', limit = 5) {
    return this._cachedRequest(`metrics-${symbol}-${period}`,
      `key-metrics/${symbol}`, { period, limit }, LONG_CACHE_TTL);
  }

  async fetchRatios(symbol, period = 'annual', limit = 5) {
    return this._cachedRequest(`ratios-${symbol}-${period}`,
      `ratios/${symbol}`, { period, limit }, LONG_CACHE_TTL);
  }

  // ─── Earnings Calendar ───────────────────────────────────────

  async fetchEarningsCalendar(from, to) {
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    return this._request('earning_calendar', params) || [];
  }

  // ─── Sector Performance ──────────────────────────────────────

  async fetchSectorPerformance() {
    return this._cachedRequest('sector-perf',
      'sector-performance', {}, 300000) || [];
  }

  // ─── Stock Screener ──────────────────────────────────────────

  async fetchGainers() {
    return this._request('stock_market/gainers') || [];
  }

  async fetchLosers() {
    return this._request('stock_market/losers') || [];
  }

  async fetchMostActive() {
    return this._request('stock_market/actives') || [];
  }

  // ─── Symbol Search ───────────────────────────────────────────

  async searchSymbols(query, limit = 10) {
    const data = await this._request('search', { query, limit });
    if (!Array.isArray(data)) return [];
    return data.map(r => ({
      symbol: r.symbol,
      name: r.name,
      type: r.type || 'stock',
      exchange: r.stockExchange || r.exchangeShortName || '',
    }));
  }

  supports(symbol) {
    const upper = (symbol || '').toUpperCase();
    return /^[A-Z]{1,5}$/.test(upper);
  }

  // ─── Private ─────────────────────────────────────────────────

  async _request(endpoint, params = {}) {
    // Gate: skip request if proxy is unavailable (key missing / forbidden)
    if (!(await this._checkAvailability())) return null;

    const url = new URL(`${PROXY_BASE}/${endpoint}`, window.location.origin);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }

    try {
      const resp = await fetch(url.toString());
      if (!resp.ok) return null;
      return await resp.json();
    } catch (err) {
      logger.data.warn(`[FMPAdapter] Request failed:`, err.message);
      return null;
    }
  }

  async _cachedRequest(key, endpoint, params, ttl) {
    const cached = CACHE.get(key);
    if (cached && Date.now() < cached.expiry) return cached.data;
    const data = await this._request(endpoint, params);
    if (data) CACHE.set(key, { data, expiry: Date.now() + ttl });
    return data || [];
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const fmpAdapter = new FMPAdapter();
export default fmpAdapter;
