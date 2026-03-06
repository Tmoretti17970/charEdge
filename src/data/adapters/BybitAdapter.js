// ═══════════════════════════════════════════════════════════════════
// charEdge — Bybit Spot Adapter
//
// Crypto market data via Bybit Spot REST + WebSocket APIs.
// Supports OHLCV, quotes, real-time trade streaming, and symbol search.
//
// WebSocket: wss://stream.bybit.com/v5/public/spot
// REST:      https://api.bybit.com/v5/market/*
// Auth:      None required for public market data
// ═══════════════════════════════════════════════════════════════════

import { BaseAdapter } from './BaseAdapter.js';

import { logger } from '../../utils/logger.ts';
const BYBIT_REST = 'https://api.bybit.com';
const BYBIT_WS  = 'wss://stream.bybit.com/v5/public/spot';

const INTERVAL_MAP = {
  '1m': '1', '3m': '3', '5m': '5', '15m': '15', '30m': '30',
  '1h': '60', '2h': '120', '4h': '240', '6h': '360', '12h': '720',
  '1d': 'D', '1w': 'W', '1M': 'M',
};

// ─── Helpers ───────────────────────────────────────────────────

async function fetchJSON(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`Bybit REST ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// ─── Bybit Spot Adapter ────────────────────────────────────────

export class BybitAdapter extends BaseAdapter {
  constructor() {
    super('bybit');
    this._ws = null;
    this._wsConnected = false;
    this._subscribers = new Map(); // symbol → Set<callback>
    this._reconnectTimer = null;
    this._heartbeatTimer = null;
    this._pendingSubscriptions = [];
  }

  // ── Interface Methods ──────────────────────────────────────────

  supports(symbol) {
    const upper = (symbol || '').toUpperCase();
    // Bybit spot uses the same BTCUSDT format as Binance
    return upper.endsWith('USDT') || upper.endsWith('USDC');
  }

  latencyTier() { return 'realtime'; }

  async fetchOHLCV(symbol, interval = '1h', opts = {}) {
    const bybitInterval = INTERVAL_MAP[interval] || '60';
    const limit = Math.min(opts.limit || 200, 1000);
    const upper = symbol.toUpperCase();

    let url = `${BYBIT_REST}/v5/market/kline?category=spot&symbol=${upper}&interval=${bybitInterval}&limit=${limit}`;
    if (opts.from) url += `&start=${new Date(opts.from).getTime()}`;
    if (opts.to) url += `&end=${new Date(opts.to).getTime()}`;

    const data = await fetchJSON(url);
    if (data.retCode !== 0 || !data.result?.list) {
      throw new Error(`Bybit kline error: ${data.retMsg || 'unknown'}`);
    }

    // Bybit returns newest-first, reverse for chronological order
    return data.result.list
      .map(k => ({
        time: parseInt(k[0]),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }))
      .reverse();
  }

  async fetchQuote(symbol) {
    const upper = symbol.toUpperCase();
    const data = await fetchJSON(`${BYBIT_REST}/v5/market/tickers?category=spot&symbol=${upper}`);

    if (data.retCode !== 0 || !data.result?.list?.[0]) return null;

    const t = data.result.list[0];
    return {
      price: parseFloat(t.lastPrice),
      change: parseFloat(t.lastPrice) - parseFloat(t.prevPrice24h),
      changePct: parseFloat(t.price24hPcnt) * 100,
      volume: parseFloat(t.volume24h),
      high: parseFloat(t.highPrice24h),
      low: parseFloat(t.lowPrice24h),
      open: parseFloat(t.prevPrice24h),
    };
  }

  subscribe(symbol, callback) {
    const upper = symbol.toUpperCase();
    if (!this._subscribers.has(upper)) {
      this._subscribers.set(upper, new Set());
    }
    this._subscribers.get(upper).add(callback);

    // Ensure WebSocket is connected
    this._ensureWebSocket();

    // Subscribe to trade stream
    const topic = `publicTrade.${upper}`;
    this._sendSubscribe([topic]);

    return () => {
      const subs = this._subscribers.get(upper);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this._subscribers.delete(upper);
          this._sendUnsubscribe([topic]);
        }
      }
    };
  }

  async searchSymbols(query, limit = 10) {
    try {
      const data = await fetchJSON(`${BYBIT_REST}/v5/market/instruments-info?category=spot`);
      if (data.retCode !== 0 || !data.result?.list) return [];

      const q = query.toUpperCase();
      return data.result.list
        .filter(s => s.status === 'Trading' && s.symbol.includes(q))
        .slice(0, limit)
        .map(s => ({
          symbol: s.symbol,
          name: `${s.baseCoin}/${s.quoteCoin}`,
          type: 'CRYPTO',
          exchange: 'Bybit',
        }));
    } catch (_) {
      return [];
    }
  }

  getLastPrice(symbol) {
    // No local cache maintained for last prices
    return null;
  }

  dispose() {
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
    this._wsConnected = false;
    this._subscribers.clear();
    clearTimeout(this._reconnectTimer);
    clearInterval(this._heartbeatTimer);
  }

  // ── WebSocket Management ───────────────────────────────────────

  /** @private */
  _ensureWebSocket() {
    if (this._ws && this._wsConnected) return;
    if (this._ws) return; // Connecting

    try {
      this._ws = new WebSocket(BYBIT_WS);

      this._ws.onopen = () => {
        this._wsConnected = true;
        logger.data.info('[BybitAdapter] WebSocket connected');

        // Send any pending subscriptions
        if (this._pendingSubscriptions.length > 0) {
          this._sendSubscribe(this._pendingSubscriptions);
          this._pendingSubscriptions = [];
        }

        // Bybit requires ping every 20s
        this._startHeartbeat();
      };

      this._ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this._handleMessage(msg);
        } catch (e) { logger.data.warn('Operation failed', e); }
      };

      this._ws.onclose = () => {
        this._wsConnected = false;
        this._ws = null;
        this._stopHeartbeat();
        logger.data.info('[BybitAdapter] WebSocket closed, reconnecting in 3s...');

        // Reconnect
        clearTimeout(this._reconnectTimer);
        this._reconnectTimer = setTimeout(() => {
          if (this._subscribers.size > 0) {
            this._ensureWebSocket();
          }
        }, 3000);
      };

      this._ws.onerror = () => {
        logger.data.warn('[BybitAdapter] WebSocket error');
      };
    } catch (err) {
      logger.data.warn('[BybitAdapter] WebSocket init failed:', err.message);
      this._ws = null;
    }
  }

  /** @private */
  _handleMessage(msg) {
    // Pong response
    if (msg.op === 'pong' || msg.ret_msg === 'pong') return;

    // Subscription confirmation
    if (msg.op === 'subscribe') return;

    // Trade data
    if (msg.topic?.startsWith('publicTrade.') && msg.data) {
      const symbol = msg.topic.replace('publicTrade.', '');
      const callbacks = this._subscribers.get(symbol);
      if (!callbacks || callbacks.size === 0) return;

      for (const trade of msg.data) {
        const tick = {
          price: parseFloat(trade.p),
          volume: parseFloat(trade.v),
          time: parseInt(trade.T),
          symbol: trade.s || symbol,
          side: trade.S === 'Buy' ? 'buy' : 'sell',
        };
        for (const cb of callbacks) {
          try { cb(tick); } catch (e) { logger.data.warn('Operation failed', e); }
        }
      }
    }
  }

  /** @private */
  _sendSubscribe(topics) {
    if (!this._ws || !this._wsConnected) {
      this._pendingSubscriptions.push(...topics);
      return;
    }
    this._ws.send(JSON.stringify({
      op: 'subscribe',
      args: topics,
    }));
  }

  /** @private */
  _sendUnsubscribe(topics) {
    if (!this._ws || !this._wsConnected) return;
    this._ws.send(JSON.stringify({
      op: 'unsubscribe',
      args: topics,
    }));
  }

  /** @private */
  _startHeartbeat() {
    this._stopHeartbeat();
    this._heartbeatTimer = setInterval(() => {
      if (this._ws?.readyState === WebSocket.OPEN) {
        this._ws.send(JSON.stringify({ op: 'ping' }));
      }
    }, 20000); // Bybit requires ping every 20s
  }

  /** @private */
  _stopHeartbeat() {
    clearInterval(this._heartbeatTimer);
    this._heartbeatTimer = null;
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const bybitAdapter = new BybitAdapter();
export default bybitAdapter;
