// ═══════════════════════════════════════════════════════════════════
// charEdge v12 — Financial Modeling Prep (FMP) Adapter
//
// Replaces Alpha Vantage as the backup equity data provider.
// FMP free tier: 250 req/day (10x more than Alpha Vantage's 25/day).
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
// Get free key: https://site.financialmodelingprep.com/developer
//
// Usage:
//   import { fmpAdapter } from './FMPAdapter.js';
//   fmpAdapter.setApiKey('YOUR_FREE_KEY');
//   const data = await fmpAdapter.fetchOHLCV('AAPL', '1d');
// ═══════════════════════════════════════════════════════════════════

import { BaseAdapter } from './BaseAdapter.js';

const BASE_URL = 'https://financialmodelingprep.com/api/v3';
const CACHE = new Map();
const CACHE_TTL = 30000; // 30 sec for quotes
const LONG_CACHE_TTL = 3600000; // 1 hour for fundamentals

class FMPAdapter extends BaseAdapter {
  constructor() {
    super('fmp');
    this._apiKey = '';
  }

  setApiKey(key) { this._apiKey = key; }
  get isConfigured() { return !!this._apiKey; }

  // ─── OHLCV ───────────────────────────────────────────────────

  async fetchOHLCV(symbol, interval = '1d', opts = {}) {
    if (!this._apiKey) return [];

    // FMP uses different endpoints per timeframe
    let endpoint;
    if (['1m', '5m', '15m', '30m', '1h', '4h'].includes(interval)) {
      endpoint = `/historical-chart/${interval}/${symbol}`;
    } else {
      endpoint = `/historical-price-full/${symbol}`;
    }

    const params = { apikey: this._apiKey };
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
    if (!this._apiKey) return null;

    const cacheKey = `quote-${symbol}`;
    const cached = CACHE.get(cacheKey);
    if (cached && Date.now() < cached.expiry) return cached.data;

    const data = await this._request(`/quote/${symbol}`, { apikey: this._apiKey });
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
    if (!this._apiKey) return [];
    return this._cachedRequest(`income-${symbol}-${period}`,
      `/income-statement/${symbol}`, { period, limit, apikey: this._apiKey }, LONG_CACHE_TTL);
  }

  async fetchBalanceSheet(symbol, period = 'annual', limit = 5) {
    if (!this._apiKey) return [];
    return this._cachedRequest(`balance-${symbol}-${period}`,
      `/balance-sheet-statement/${symbol}`, { period, limit, apikey: this._apiKey }, LONG_CACHE_TTL);
  }

  async fetchKeyMetrics(symbol, period = 'annual', limit = 5) {
    if (!this._apiKey) return [];
    return this._cachedRequest(`metrics-${symbol}-${period}`,
      `/key-metrics/${symbol}`, { period, limit, apikey: this._apiKey }, LONG_CACHE_TTL);
  }

  async fetchRatios(symbol, period = 'annual', limit = 5) {
    if (!this._apiKey) return [];
    return this._cachedRequest(`ratios-${symbol}-${period}`,
      `/ratios/${symbol}`, { period, limit, apikey: this._apiKey }, LONG_CACHE_TTL);
  }

  // ─── Earnings Calendar ───────────────────────────────────────

  async fetchEarningsCalendar(from, to) {
    if (!this._apiKey) return [];
    const params = { apikey: this._apiKey };
    if (from) params.from = from;
    if (to) params.to = to;
    return this._request('/earning_calendar', params) || [];
  }

  // ─── Sector Performance ──────────────────────────────────────

  async fetchSectorPerformance() {
    if (!this._apiKey) return [];
    return this._cachedRequest('sector-perf',
      '/sector-performance', { apikey: this._apiKey }, 300000) || [];
  }

  // ─── Stock Screener ──────────────────────────────────────────

  async fetchGainers() {
    if (!this._apiKey) return [];
    return this._request('/stock_market/gainers', { apikey: this._apiKey }) || [];
  }

  async fetchLosers() {
    if (!this._apiKey) return [];
    return this._request('/stock_market/losers', { apikey: this._apiKey }) || [];
  }

  async fetchMostActive() {
    if (!this._apiKey) return [];
    return this._request('/stock_market/actives', { apikey: this._apiKey }) || [];
  }

  // ─── Symbol Search ───────────────────────────────────────────

  async searchSymbols(query, limit = 10) {
    if (!this._apiKey) return [];
    const data = await this._request('/search', { query, limit, apikey: this._apiKey });
    if (!Array.isArray(data)) return [];
    return data.map(r => ({
      symbol: r.symbol,
      name: r.name,
      type: r.type || 'stock',
      exchange: r.stockExchange || r.exchangeShortName || '',
    }));
  }

  supports(symbol) {
    if (!this._apiKey) return false;
    const upper = (symbol || '').toUpperCase();
    return /^[A-Z]{1,5}$/.test(upper);
  }

  // ─── Private ─────────────────────────────────────────────────

  async _request(endpoint, params = {}) {
    const url = new URL(`${BASE_URL}${endpoint}`);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }

    try {
      const resp = await fetch(url.toString());
      if (!resp.ok) return null;
      return await resp.json();
    } catch (err) {
      console.warn(`[FMPAdapter] Request failed:`, err.message);
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
