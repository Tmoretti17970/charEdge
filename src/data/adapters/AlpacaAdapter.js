// ═══════════════════════════════════════════════════════════════════
// charEdge — Alpaca Markets Adapter
//
// Broker adapter for Alpaca Markets (https://alpaca.markets).
// Supports:
//   - Market data: OHLCV bars, quotes, symbol search
//   - Trading: Place/cancel orders, manage positions, account info
//   - Paper + Live modes (separate API endpoints)
//
// API Docs: https://docs.alpaca.markets/reference
// Auth: APCA-API-KEY-ID + APCA-API-SECRET-KEY headers
// ═══════════════════════════════════════════════════════════════════

import { BaseAdapter } from './BaseAdapter.js';
import { logger } from '@/observability/logger';

// ─── Constants ──────────────────────────────────────────────────

const ALPACA_DATA = 'https://data.alpaca.markets/v2';
const ALPACA_PAPER = 'https://paper-api.alpaca.markets';
const ALPACA_LIVE = 'https://api.alpaca.markets';

// Map charEdge intervals → Alpaca timeframe strings
const INTERVAL_MAP = {
  '1m': '1Min', '5m': '5Min', '15m': '15Min', '30m': '30Min',
  '1h': '1Hour', '4h': '4Hour', '1d': '1Day', '1w': '1Week', '1M': '1Month',
};

// Common US equities for `supports()` heuristic
const US_EQUITY_PATTERN = /^[A-Z]{1,5}$/;

// ─── Helpers ────────────────────────────────────────────────────

function isUsEquity(symbol) {
  const s = (symbol || '').toUpperCase();
  // Must look like a stock ticker: 1–5 uppercase letters, no slash, no USDT suffix
  return US_EQUITY_PATTERN.test(s)
    && !s.endsWith('USDT')
    && !s.endsWith('BUSD')
    && !s.endsWith('USD')
    && !s.includes('/');
}

// ─── Alpaca Adapter Class ───────────────────────────────────────

export class AlpacaAdapter extends BaseAdapter {
  constructor() {
    super('alpaca');
    this._keyId = '';
    this._secretKey = '';
    this._isPaper = true;   // Default to paper trading
    this._useProxy = false; // When true, route through server-side proxy
    this._pollTimers = new Map(); // symbol → interval timer
  }

  // ─── Configuration ──────────────────────────────────────────

  /**
   * Configure Alpaca API credentials.
   * @param {string} keyId - APCA-API-KEY-ID
   * @param {string} secretKey - APCA-API-SECRET-KEY
   * @param {boolean} [isPaper=true] - Use paper trading endpoint
   * @param {{ useProxy?: boolean }} [options] - Additional options
   * @param {boolean} [options.useProxy=false] - Route through server-side proxy
   */
  configure(keyId, secretKey, isPaper = true, options = {}) {
    this._keyId = keyId;
    this._secretKey = secretKey;
    this._isPaper = isPaper;
    this._useProxy = options.useProxy || false;
  }

  /**
   * Enable server-proxy mode (credentials stored server-side).
   * In this mode, no API keys are needed on the client.
   * @param {boolean} [isPaper=true] - Use paper trading endpoint
   */
  configureServerProxy(isPaper = true) {
    this._useProxy = true;
    this._isPaper = isPaper;
    // No client-side keys needed — server reads from env vars
    this._keyId = 'server-proxy';
    this._secretKey = 'server-proxy';
  }

  get isConfigured() {
    return this._useProxy || (!!this._keyId && !!this._secretKey);
  }

  get _tradingBase() {
    return this._isPaper ? ALPACA_PAPER : ALPACA_LIVE;
  }

  _headers() {
    if (this._useProxy) return { 'Content-Type': 'application/json' };
    return {
      'APCA-API-KEY-ID': this._keyId,
      'APCA-API-SECRET-KEY': this._secretKey,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Resolve the fetch URL. In proxy mode, route through the server.
   * @param {string} url - Direct Alpaca URL
   * @returns {string} Resolved URL
   * @private
   */
  _resolveUrl(url) {
    if (!this._useProxy) return url;

    // Route through server proxy: /api/v1/alpaca/{target}/{path}
    // Determine target from URL
    let target = 'data';
    if (url.includes('paper-api.alpaca.markets')) target = 'paper';
    else if (url.includes('api.alpaca.markets') && !url.includes('data.alpaca.markets')) target = 'live';

    // Extract path after the domain
    const urlObj = new URL(url);
    const path = urlObj.pathname.replace(/^\//, '') + urlObj.search;
    return `/api/v1/alpaca/${target}/${path}`;
  }

  async _fetch(url, opts = {}, _retryCount = 0) {
    // Client-side rate limiting: 200ms between requests
    const now = Date.now();
    const wait = 200 - (now - (this._lastRequest || 0));
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    this._lastRequest = Date.now();

    const resolvedUrl = this._resolveUrl(url);
    try {
      const res = await fetch(resolvedUrl, {
        ...opts,
        headers: { ...this._headers(), ...opts.headers },
      });

      if (res.status === 204) return null; // No content (e.g. DELETE)

      if (res.ok) return res.json();

      // 429 Too Many Requests — backoff and retry once
      if (res.status === 429 && _retryCount < 1) {
        logger.data.debug('[Alpaca] Rate limited — retrying in 3s');
        await new Promise(r => setTimeout(r, 3000));
        return this._fetch(url, opts, _retryCount + 1);
      }

      // 429 after retry or 503 Service Unavailable — fail silently
      if (res.status === 429 || res.status === 503) {
        logger.data.debug(`[Alpaca] ${res.status} — skipping request`);
        return null;
      }

      // Other errors — still throw for real failures (auth, 404, etc.)
      const body = await res.text().catch(() => '');
      throw new Error(`Alpaca ${opts.method || 'GET'} ${url}: ${res.status} ${body}`);
    } catch (err) {
      // Network errors — fail silently
      if (err.name === 'TypeError' || err.message?.includes('fetch')) {
        logger.data.debug('[Alpaca] Network error:', err.message);
        return null;
      }
      throw err;
    }
  }

  // ─── BaseAdapter Interface ──────────────────────────────────

  supports(symbol) {
    return isUsEquity(symbol);
  }

  async fetchOHLCV(symbol, interval = '1d', opts = {}) {
    if (!this.isConfigured) throw new Error('Alpaca not configured. Set API keys in Settings.');

    const tf = INTERVAL_MAP[interval] || '1Day';
    const params = new URLSearchParams({ timeframe: tf });

    if (opts.limit) params.set('limit', String(Math.min(opts.limit, 10000)));
    if (opts.from) params.set('start', new Date(opts.from).toISOString());
    if (opts.to) params.set('end', new Date(opts.to).toISOString());

    // Phase 4a: SIP feed for pre-market/after-hours data + split/dividend adjustment
    params.set('feed', opts.extendedHours ? 'sip' : 'iex');
    params.set('adjustment', opts.adjustment || 'all');

    const data = await this._fetch(
      `${ALPACA_DATA}/stocks/${symbol.toUpperCase()}/bars?${params}`,
    );

    return (data.bars || []).map((b) => ({
      time: new Date(b.t).getTime(),
      open: b.o,
      high: b.h,
      low: b.l,
      close: b.c,
      volume: b.v,
    }));
  }

  /**
   * Fetch extended-hours bars (pre-market + after-hours) for an equity.
   * Uses Alpaca's SIP feed which includes 4:00 AM–8:00 PM ET data.
   * @param {string} symbol - e.g. 'AAPL'
   * @param {string} [interval='1m'] - Timeframe
   * @param {Object} [opts] - Additional options (limit, from, to)
   */
  async fetchExtendedHours(symbol, interval = '1m', opts = {}) {
    return this.fetchOHLCV(symbol, interval, { ...opts, extendedHours: true });
  }

  async fetchQuote(symbol) {
    if (!this.isConfigured) return null;

    const data = await this._fetch(
      `${ALPACA_DATA}/stocks/${symbol.toUpperCase()}/snapshot`,
    );

    if (!data) return null;

    const q = data.latestTrade || {};
    const bar = data.dailyBar || {};
    const prevBar = data.prevDailyBar || {};
    const change = (bar.c || q.p || 0) - (prevBar.c || 0);

    return {
      price: q.p || bar.c || 0,
      change,
      changePct: prevBar.c ? (change / prevBar.c) * 100 : 0,
      volume: bar.v || 0,
      high: bar.h || 0,
      low: bar.l || 0,
      open: bar.o || 0,
    };
  }

  subscribe(symbol, callback) {
    if (!this.isConfigured) return () => { };

    const upper = symbol.toUpperCase();

    // Task 1B.7: Prefer Alpaca WebSocket for real-time trade data.
    // Falls back to 5s REST poll if WS fails or proxy mode is active.
    if (!this._useProxy && this._keyId && this._keyId !== 'server-proxy' && typeof WebSocket !== 'undefined') {
      try {
        const ws = new WebSocket('wss://stream.data.alpaca.markets/v2/iex');
        let authenticated = false;

        ws.onopen = () => {
          ws.send(JSON.stringify({
            action: 'auth',
            key: this._keyId,
            secret: this._secretKey,
          }));
        };

        ws.onmessage = (event) => {
          try {
            const messages = JSON.parse(event.data);
            for (const msg of messages) {
              if (msg.T === 'success' && msg.msg === 'authenticated') {
                authenticated = true;
                ws.send(JSON.stringify({
                  action: 'subscribe',
                  trades: [upper],
                }));
              } else if (msg.T === 't' && msg.S === upper) {
                callback({
                  price: msg.p,
                  volume: msg.s || 0,
                  time: new Date(msg.t).getTime(),
                  symbol: upper,
                });
              }
            }
          } catch { /* parse error */ }
        };

        ws.onerror = () => {
          ws.close();
          this._startRestPoll(upper, callback);
        };

        ws.onclose = () => {
          if (authenticated) {
            this._startRestPoll(upper, callback);
          }
        };

        this._pollTimers.set(symbol, { type: 'ws', ws });

        return () => {
          try { ws.close(); } catch { /* already closed */ }
          this._pollTimers.delete(symbol);
        };
      } catch {
        // WebSocket construction failed — fall back
      }
    }

    // Fallback: REST poll (5s)
    this._startRestPoll(upper, callback);

    return () => {
      const entry = this._pollTimers.get(symbol);
      if (entry?.type === 'ws') {
        try { entry.ws.close(); } catch { /* */ }
      } else if (entry?.timer) {
        clearInterval(entry.timer);
      } else if (entry) {
        clearInterval(entry);
      }
      this._pollTimers.delete(symbol);
    };
  }

  /** @private REST poll fallback for subscribe() */
  _startRestPoll(symbol, callback) {
    const timer = setInterval(async () => {
      try {
        const data = await this._fetch(
          `${ALPACA_DATA}/stocks/${symbol}/snapshot`,
        );
        if (data?.latestTrade) {
          callback({
            price: data.latestTrade.p,
            volume: data.latestTrade.s || 0,
            time: new Date(data.latestTrade.t).getTime(),
            symbol,
          });
        }
      // eslint-disable-next-line unused-imports/no-unused-vars
      } catch (_) {
        /* polling error — silent retry */
      }
    }, 5000);

    this._pollTimers.set(symbol, { type: 'rest', timer });
  }

  async searchSymbols(query, limit = 10) {
    if (!this.isConfigured) return [];

    try {
      const data = await this._fetch(
        `${this._tradingBase}/v2/assets?status=active&asset_class=us_equity`,
      );

      const q = query.toUpperCase();
      return (data || [])
        .filter((a) => a.symbol.includes(q) || (a.name || '').toUpperCase().includes(q))
        .filter((a) => a.tradable)
        .slice(0, limit)
        .map((a) => ({
          symbol: a.symbol,
          name: a.name,
          type: 'EQUITY',
          exchange: a.exchange,
        }));
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
      return [];
    }
  }

  // ─── Trading API ────────────────────────────────────────────

  /**
   * Place an order via Alpaca REST API.
   * @param {Object} order
   * @param {string} order.symbol
   * @param {number} order.qty - Number of shares
   * @param {'buy'|'sell'} order.side
   * @param {'market'|'limit'|'stop'|'stop_limit'} order.type
   * @param {number} [order.limitPrice] - Required for limit/stop_limit
   * @param {number} [order.stopPrice] - Required for stop/stop_limit
   * @param {'day'|'gtc'|'ioc'|'fok'} [order.timeInForce='day']
   * @returns {Promise<Object>} Alpaca order response
   */
  async placeOrder(order) {
    if (!this.isConfigured) throw new Error('Alpaca not configured.');

    const body = {
      symbol: order.symbol.toUpperCase(),
      qty: String(order.qty),
      side: order.side,
      type: order.type,
      time_in_force: order.timeInForce || 'day',
    };

    if (order.type === 'limit' || order.type === 'stop_limit') {
      body.limit_price = String(order.limitPrice);
    }
    if (order.type === 'stop' || order.type === 'stop_limit') {
      body.stop_price = String(order.stopPrice);
    }

    return this._fetch(`${this._tradingBase}/v2/orders`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Get all open orders.
   * @param {'open'|'closed'|'all'} [status='open']
   * @returns {Promise<Object[]>}
   */
  async getOrders(status = 'open') {
    if (!this.isConfigured) return [];
    return this._fetch(`${this._tradingBase}/v2/orders?status=${status}`);
  }

  /**
   * Cancel an order by ID.
   * @param {string} orderId
   */
  async cancelOrder(orderId) {
    if (!this.isConfigured) throw new Error('Alpaca not configured.');
    return this._fetch(`${this._tradingBase}/v2/orders/${orderId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get all open positions.
   * @returns {Promise<Object[]>}
   */
  async getPositions() {
    if (!this.isConfigured) return [];
    const positions = await this._fetch(`${this._tradingBase}/v2/positions`);
    return (positions || []).map((p) => ({
      symbol: p.symbol,
      qty: parseFloat(p.qty),
      side: parseFloat(p.qty) > 0 ? 'long' : 'short',
      entryPrice: parseFloat(p.avg_entry_price),
      currentPrice: parseFloat(p.current_price),
      marketValue: parseFloat(p.market_value),
      unrealizedPl: parseFloat(p.unrealized_pl),
      unrealizedPlPct: parseFloat(p.unrealized_plpc) * 100,
      assetClass: p.asset_class,
    }));
  }

  /**
   * Close a position by symbol.
   * @param {string} symbol
   */
  async closePosition(symbol) {
    if (!this.isConfigured) throw new Error('Alpaca not configured.');
    return this._fetch(`${this._tradingBase}/v2/positions/${symbol.toUpperCase()}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get account info (balance, equity, buying power).
   * @returns {Promise<Object>}
   */
  async getAccount() {
    if (!this.isConfigured) return null;
    const a = await this._fetch(`${this._tradingBase}/v2/account`);
    return {
      id: a.id,
      status: a.status,
      currency: a.currency,
      cash: parseFloat(a.cash),
      portfolioValue: parseFloat(a.portfolio_value),
      equity: parseFloat(a.equity),
      buyingPower: parseFloat(a.buying_power),
      daytradeCount: parseInt(a.daytrade_count, 10),
      patternDayTrader: a.pattern_day_trader,
      tradingBlocked: a.trading_blocked,
      accountBlocked: a.account_blocked,
    };
  }

  /**
   * Close all WebSocket/polling connections.
   */
  dispose() {
    for (const [, entry] of this._pollTimers) {
      if (entry?.type === 'ws') {
        try { entry.ws.close(); } catch { /* */ }
      } else if (entry?.timer) {
        clearInterval(entry.timer);
      } else {
        clearInterval(entry);
      }
    }
    this._pollTimers.clear();
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const alpacaAdapter = new AlpacaAdapter();
export default alpacaAdapter;
