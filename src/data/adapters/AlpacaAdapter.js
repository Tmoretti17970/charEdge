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
    this._pollTimers = new Map(); // symbol → interval timer
  }

  // ─── Configuration ──────────────────────────────────────────

  /**
   * Configure Alpaca API credentials.
   * @param {string} keyId - APCA-API-KEY-ID
   * @param {string} secretKey - APCA-API-SECRET-KEY
   * @param {boolean} [isPaper=true] - Use paper trading endpoint
   */
  configure(keyId, secretKey, isPaper = true) {
    this._keyId = keyId;
    this._secretKey = secretKey;
    this._isPaper = isPaper;
  }

  get isConfigured() {
    return !!this._keyId && !!this._secretKey;
  }

  get _tradingBase() {
    return this._isPaper ? ALPACA_PAPER : ALPACA_LIVE;
  }

  _headers() {
    return {
      'APCA-API-KEY-ID': this._keyId,
      'APCA-API-SECRET-KEY': this._secretKey,
      'Content-Type': 'application/json',
    };
  }

  async _fetch(url, opts = {}) {
    const res = await fetch(url, {
      ...opts,
      headers: { ...this._headers(), ...opts.headers },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Alpaca ${opts.method || 'GET'} ${url}: ${res.status} ${body}`);
    }
    if (res.status === 204) return null; // No content (e.g. DELETE)
    return res.json();
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
    if (!this.isConfigured) return () => {};

    // Alpaca real-time requires SSE or WebSocket subscription.
    // For simplicity, poll the snapshot endpoint every 5 seconds.
    const upper = symbol.toUpperCase();
    const timer = setInterval(async () => {
      try {
        const data = await this._fetch(
          `${ALPACA_DATA}/stocks/${upper}/snapshot`,
        );
        if (data?.latestTrade) {
          callback({
            price: data.latestTrade.p,
            volume: data.latestTrade.s || 0,
            time: new Date(data.latestTrade.t).getTime(),
            symbol: upper,
          });
        }
      } catch {
        /* polling error — silent retry */
      }
    }, 5000);

    this._pollTimers.set(symbol, timer);

    return () => {
      clearInterval(timer);
      this._pollTimers.delete(symbol);
    };
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
    } catch {
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
    for (const [, timer] of this._pollTimers) {
      clearInterval(timer);
    }
    this._pollTimers.clear();
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const alpacaAdapter = new AlpacaAdapter();
export default alpacaAdapter;
