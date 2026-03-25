// ═══════════════════════════════════════════════════════════════════
// charEdge — OKX Spot Adapter
//
// Crypto market data via OKX REST + WebSocket APIs.
// Supports OHLCV, quotes, real-time trade streaming, and symbol search.
//
// WebSocket: wss://ws.okx.com:8443/ws/v5/public
// REST:      https://www.okx.com/api/v5/market/*
// Auth:      None required for public market data
//
// Symbol format: OKX uses "BTC-USDT" (hyphenated)
//                charEdge uses "BTCUSDT" (no separator)
// ═══════════════════════════════════════════════════════════════════

import { BaseAdapter } from './BaseAdapter.js';
import { logger } from '@/observability/logger';
const OKX_REST = 'https://www.okx.com';
const OKX_WS = 'wss://ws.okx.com:8443/ws/v5/public';

const INTERVAL_MAP = {
  '1m': '1m',
  '3m': '3m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1H',
  '2h': '2H',
  '4h': '4H',
  '6h': '6H',
  '12h': '12H',
  '1d': '1D',
  '1w': '1W',
  '1M': '1M',
};

// ─── Symbol Mapping ────────────────────────────────────────────

/** Convert charEdge symbol to OKX instId. BTCUSDT → BTC-USDT */
function toOKXInstId(symbol) {
  const upper = (symbol || '').toUpperCase();
  // Already hyphenated
  if (upper.includes('-')) return upper;
  // BTCUSDT → BTC-USDT, ETHUSDC → ETH-USDC
  for (const quote of ['USDT', 'USDC', 'USD', 'BTC', 'ETH']) {
    if (upper.endsWith(quote)) {
      const base = upper.slice(0, -quote.length);
      if (base.length > 0) return `${base}-${quote}`;
    }
  }
  return upper;
}

/** Convert OKX instId back to charEdge symbol. BTC-USDT → BTCUSDT */
function fromOKXInstId(instId) {
  return (instId || '').replace(/-/g, '');
}

// ─── Helpers ───────────────────────────────────────────────────

async function fetchJSON(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`OKX REST ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// ─── OKX Adapter Class ─────────────────────────────────────────

export class OKXAdapter extends BaseAdapter {
  constructor() {
    super('okx');
    this._ws = null;
    this._wsConnected = false;
    this._subscribers = new Map(); // tfSymbol → Set<callback>
    this._reconnectTimer = null;
    this._heartbeatTimer = null;
    this._pendingSubscriptions = [];
    this._disposed = false; // Phase 1.3: Guard against post-dispose method calls
  }

  // ── Interface Methods ──────────────────────────────────────────

  supports(symbol) {
    const upper = (symbol || '').toUpperCase();
    return upper.endsWith('USDT') || upper.endsWith('USDC');
  }

  latencyTier() {
    return 'realtime';
  }

  async fetchOHLCV(symbol, interval = '1h', opts = {}) {
    const instId = toOKXInstId(symbol);
    const bar = INTERVAL_MAP[interval] || '1H';
    const limit = Math.min(opts.limit || 100, 300); // OKX max 300

    let url = `${OKX_REST}/api/v5/market/candles?instId=${instId}&bar=${bar}&limit=${limit}`;
    if (opts.to) url += `&after=${new Date(opts.to).getTime()}`;
    if (opts.from) url += `&before=${new Date(opts.from).getTime()}`;

    const data = await fetchJSON(url);
    if (data.code !== '0' || !data.data) {
      throw new Error(`OKX kline error: ${data.msg || 'unknown'}`);
    }

    // OKX returns newest-first [[ts, o, h, l, c, vol, ...]]
    return data.data
      .map((k) => ({
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
    const instId = toOKXInstId(symbol);
    const data = await fetchJSON(`${OKX_REST}/api/v5/market/ticker?instId=${instId}`);

    if (data.code !== '0' || !data.data?.[0]) return null;

    const t = data.data[0];
    const lastPrice = parseFloat(t.last);
    const openPrice = parseFloat(t.open24h);
    return {
      price: lastPrice,
      change: lastPrice - openPrice,
      changePct: openPrice > 0 ? ((lastPrice - openPrice) / openPrice) * 100 : 0,
      volume: parseFloat(t.vol24h),
      high: parseFloat(t.high24h),
      low: parseFloat(t.low24h),
      open: openPrice,
    };
  }

  subscribe(symbol, callback) {
    const upper = (symbol || '').toUpperCase();
    const instId = toOKXInstId(upper);

    if (!this._subscribers.has(upper)) {
      this._subscribers.set(upper, new Set());
    }
    this._subscribers.get(upper).add(callback);

    // Ensure WebSocket is connected
    this._ensureWebSocket();

    // Subscribe to trades channel
    const arg = { channel: 'trades', instId };
    this._sendSubscribe([arg]);

    return () => {
      const subs = this._subscribers.get(upper);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this._subscribers.delete(upper);
          this._sendUnsubscribe([arg]);
        }
      }
    };
  }

  /**
   * Phase 2.1: Subscribe to OKX server-computed candle stream.
   * OKX channel format: candle{interval} (e.g. candle1m, candle1H)
   *
   * @param {string} symbol - e.g. 'BTCUSDT'
   * @param {string} interval - charEdge interval e.g. '1m', '5m', '1h'
   * @param {Function} callback - ({ time, open, high, low, close, volume, isClosed }) => void
   * @returns {Function} unsubscribe
   */
  subscribeKline(symbol, interval, callback) {
    const upper = (symbol || '').toUpperCase();
    const instId = toOKXInstId(upper);
    const okxInterval = INTERVAL_MAP[interval] || '1H';
    const channel = `candle${okxInterval}`;
    const key = `kline:${upper}:${interval}`;

    if (!this._subscribers.has(key)) {
      this._subscribers.set(key, new Set());
    }
    this._subscribers.get(key).add(callback);

    this._ensureWebSocket();
    this._sendSubscribe([{ channel, instId }]);

    return () => {
      const subs = this._subscribers.get(key);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this._subscribers.delete(key);
          this._sendUnsubscribe([{ channel, instId }]);
        }
      }
    };
  }

  async searchSymbols(query, limit = 10) {
    try {
      const data = await fetchJSON(`${OKX_REST}/api/v5/public/instruments?instType=SPOT`);
      if (data.code !== '0' || !data.data) return [];

      const q = query.toUpperCase();
      return data.data
        .filter((s) => s.state === 'live' && (s.instId.includes(q) || fromOKXInstId(s.instId).includes(q)))
        .slice(0, limit)
        .map((s) => ({
          symbol: fromOKXInstId(s.instId),
          name: `${s.baseCcy}/${s.quoteCcy}`,
          type: 'CRYPTO',
          exchange: 'OKX',
        }));
      // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
      return [];
    }
  }

  getLastPrice(_symbol) {
    return null;
  }

  dispose() {
    this._disposed = true;
    this._stopHeartbeat();
    clearTimeout(this._reconnectTimer);
    this._reconnectTimer = null;
    if (this._ws) {
      // Phase 1.3: Null handlers before close to prevent late callbacks
      this._ws.onopen = null;
      this._ws.onmessage = null;
      this._ws.onclose = null;
      this._ws.onerror = null;
      try {
        this._ws.close();
      } catch {
        /* ignore */
      }
      this._ws = null;
    }
    this._wsConnected = false;
    this._subscribers.clear();
    this._pendingSubscriptions = [];
  }

  // ── WebSocket Management ───────────────────────────────────────

  /** @private */
  _ensureWebSocket() {
    if (this._disposed) return; // Phase 1.3: Guard
    if (this._ws && this._wsConnected) return;
    if (this._ws) return; // Connecting

    try {
      this._ws = new WebSocket(OKX_WS);

      this._ws.onopen = () => {
        this._wsConnected = true;
        logger.data.info('[OKXAdapter] WebSocket connected');

        // Send pending subscriptions
        if (this._pendingSubscriptions.length > 0) {
          this._sendSubscribe(this._pendingSubscriptions);
          this._pendingSubscriptions = [];
        }

        // OKX requires ping every 30s
        this._startHeartbeat();
      };

      this._ws.onmessage = (event) => {
        try {
          // OKX sends "pong" as plain text
          if (event.data === 'pong') return;
          const msg = JSON.parse(event.data);
          this._handleMessage(msg);
        } catch (e) {
          logger.data.warn('Operation failed', e);
        }
      };

      this._ws.onclose = () => {
        this._wsConnected = false;
        this._ws = null;
        this._stopHeartbeat();
        logger.data.info('[OKXAdapter] WebSocket closed, reconnecting in 3s...');

        clearTimeout(this._reconnectTimer);
        this._reconnectTimer = setTimeout(() => {
          if (this._subscribers.size > 0) {
            this._ensureWebSocket();
          }
        }, 3000);
      };

      this._ws.onerror = () => {
        logger.data.warn('[OKXAdapter] WebSocket error');
      };
    } catch (err) {
      logger.data.warn('[OKXAdapter] WebSocket init failed:', err.message);
      this._ws = null;
    }
  }

  /** @private */
  _handleMessage(msg) {
    // Subscription confirmation
    if (msg.event === 'subscribe' || msg.event === 'unsubscribe') return;
    if (msg.event === 'error') {
      logger.data.warn('[OKXAdapter] WS error:', msg.msg);
      return;
    }

    // Trade data
    if (msg.arg?.channel === 'trades' && msg.data) {
      const instId = msg.arg.instId;
      const tfSymbol = fromOKXInstId(instId);
      const callbacks = this._subscribers.get(tfSymbol);
      if (!callbacks || callbacks.size === 0) return;

      for (const trade of msg.data) {
        const tick = {
          price: parseFloat(trade.px),
          volume: parseFloat(trade.sz),
          time: parseInt(trade.ts),
          symbol: tfSymbol,
          side: trade.side,
        };
        for (const cb of callbacks) {
          try {
            cb(tick);
          } catch (e) {
            logger.data.warn('Operation failed', e);
          }
        }
      }
    }

    // Phase 2.1: Candle data — server-computed OHLCV
    // OKX candle channel: candle1m, candle1H, candle1D, etc.
    if (msg.arg?.channel?.startsWith('candle') && msg.data) {
      const instId = msg.arg.instId;
      const tfSymbol = fromOKXInstId(instId);
      const okxInterval = msg.arg.channel.replace('candle', '');
      // Reverse-lookup charEdge interval from OKX interval
      const charEdgeInterval = Object.entries(INTERVAL_MAP).find(([, v]) => v === okxInterval)?.[0] || '1h';
      const key = `kline:${tfSymbol}:${charEdgeInterval}`;

      const callbacks = this._subscribers.get(key);
      if (!callbacks || callbacks.size === 0) return;

      // OKX candle data: [[ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm]]
      for (const candle of msg.data) {
        const bar = {
          time: parseInt(candle[0]),
          open: parseFloat(candle[1]),
          high: parseFloat(candle[2]),
          low: parseFloat(candle[3]),
          close: parseFloat(candle[4]),
          volume: parseFloat(candle[5]),
          isClosed: candle[8] === '1',
          symbol: tfSymbol,
          source: 'okx',
        };
        for (const cb of callbacks) {
          try {
            cb(bar);
          } catch (e) {
            logger.data.warn('Operation failed', e);
          }
        }
      }
    }
  }

  /** @private */
  _sendSubscribe(args) {
    if (!this._ws || !this._wsConnected) {
      this._pendingSubscriptions.push(...args);
      return;
    }
    this._ws.send(
      JSON.stringify({
        op: 'subscribe',
        args,
      }),
    );
  }

  /** @private */
  _sendUnsubscribe(args) {
    if (!this._ws || !this._wsConnected) return;
    this._ws.send(
      JSON.stringify({
        op: 'unsubscribe',
        args,
      }),
    );
  }

  /** @private */
  _startHeartbeat() {
    this._stopHeartbeat();
    this._heartbeatTimer = setInterval(() => {
      if (this._ws?.readyState === WebSocket.OPEN) {
        this._ws.send('ping'); // OKX expects plain text "ping"
      }
    }, 25000); // Send every 25s (timeout is 30s)
  }

  /** @private */
  _stopHeartbeat() {
    clearInterval(this._heartbeatTimer);
    this._heartbeatTimer = null;
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const okxAdapter = new OKXAdapter();
export default okxAdapter;
