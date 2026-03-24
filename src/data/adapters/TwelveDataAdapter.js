// ═══════════════════════════════════════════════════════════════════
// charEdge — Twelve Data Adapter
//
// Free equity, forex, and crypto OHLCV data.
// Free tier: 800 API credits/day, 8 req/minute.
//
// API Docs: https://twelvedata.com/docs
// Endpoint: https://api.twelvedata.com
//
// No API key required for basic endpoints.
// ═══════════════════════════════════════════════════════════════════

import { BaseAdapter } from './BaseAdapter.js';
import { logger } from '@/observability/logger';

const TWELVE_BASE = 'https://api.twelvedata.com';

// Twelve Data interval mapping
const INTERVAL_MAP = {
  '1m': '1min',
  '5m': '5min',
  '15m': '15min',
  '30m': '30min',
  '1h': '1h',
  '2h': '2h',
  '4h': '4h',
  '1d': '1day',
  '1w': '1week',
  '1M': '1month',
};

export class TwelveDataAdapter extends BaseAdapter {
  constructor(apiKey = null) {
    super('twelvedata');
    this._apiKey = apiKey;
    this._lastCall = 0;
    this._minInterval = 7500; // 8 req/min = 1 every 7.5s
  }

  supports(symbol) {
    // Twelve Data supports stocks, ETFs, forex, crypto
    const s = (symbol || '').toUpperCase();
    // Exclude crypto pairs (Binance handles those better)
    return !s.endsWith('USDT') && !s.endsWith('BUSD');
  }

  latencyTier() {
    return 'delayed'; // Free tier has 15-min delay
  }

  async _throttledFetch(url) {
    const now = Date.now();
    const elapsed = now - this._lastCall;
    if (elapsed < this._minInterval) {
      await new Promise((r) => setTimeout(r, this._minInterval - elapsed));
    }
    this._lastCall = Date.now();
    return fetch(url);
  }

  async fetchOHLCV(symbol, interval = '1d', opts = {}) {
    const clean = (symbol || '').toUpperCase().replace(/=X$|=F$/, '');
    const tdInterval = INTERVAL_MAP[interval] || '1day';
    const outputSize = opts.limit || 100;

    const params = new URLSearchParams({
      symbol: clean,
      interval: tdInterval,
      outputsize: String(outputSize),
      format: 'JSON',
    });
    if (this._apiKey) params.set('apikey', this._apiKey);

    try {
      const res = await this._throttledFetch(`${TWELVE_BASE}/time_series?${params}`);
      if (!res.ok) return [];
      const json = await res.json();

      if (json.status === 'error' || !json.values) {
        logger.data.warn('[TwelveData] API error:', json.message || 'unknown');
        return [];
      }

      // Twelve Data returns newest first, reverse for chronological order
      return (json.values || []).reverse().map((bar) => ({
        time: new Date(bar.datetime).getTime(),
        open: parseFloat(bar.open),
        high: parseFloat(bar.high),
        low: parseFloat(bar.low),
        close: parseFloat(bar.close),
        volume: parseFloat(bar.volume) || 0,
      }));
    } catch (e) {
      logger.data.warn('[TwelveData] fetchOHLCV failed:', e.message);
      return [];
    }
  }

  async fetchQuote(symbol) {
    const clean = (symbol || '').toUpperCase().replace(/=X$|=F$/, '');

    const params = new URLSearchParams({
      symbol: clean,
      format: 'JSON',
    });
    if (this._apiKey) params.set('apikey', this._apiKey);

    try {
      const res = await this._throttledFetch(`${TWELVE_BASE}/quote?${params}`);
      if (!res.ok) return null;
      const json = await res.json();

      if (json.status === 'error' || !json.close) return null;

      const price = parseFloat(json.close);
      const prevClose = parseFloat(json.previous_close) || price;
      const change = price - prevClose;
      const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

      return {
        price,
        change,
        changePct,
        volume: parseFloat(json.volume) || 0,
        high: parseFloat(json.high) || price,
        low: parseFloat(json.low) || price,
        open: parseFloat(json.open) || price,
      };
    } catch (e) {
      logger.data.warn('[TwelveData] fetchQuote failed:', e.message);
      return null;
    }
  }

  async searchSymbols(query, limit = 10) {
    const params = new URLSearchParams({
      symbol: query,
      outputsize: String(limit),
    });

    try {
      const res = await fetch(`${TWELVE_BASE}/symbol_search?${params}`);
      if (!res.ok) return [];
      const json = await res.json();

      return (json.data || []).slice(0, limit).map((item) => ({
        symbol: item.symbol,
        name: item.instrument_name || item.symbol,
        type: item.instrument_type || 'stock',
        exchange: item.exchange || '',
      }));
    } catch {
      return [];
    }
  }
}

export const twelveDataAdapter = new TwelveDataAdapter();
