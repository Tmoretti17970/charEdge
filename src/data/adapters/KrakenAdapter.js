// ═══════════════════════════════════════════════════════════════════
// charEdge v12 — Kraken Adapter
//
// Free crypto redundancy layer — no API key, no auth required.
// Public WebSocket at wss://ws.kraken.com provides real-time:
//   - Trade stream (ticker)
//   - OHLC candles
//   - Order book depth
//   - Spread data
//
// Kraken uses XBT instead of BTC, so normalization is handled here.
//
// Usage:
//   import { krakenAdapter } from './KrakenAdapter.js';
//   const quote = await krakenAdapter.fetchQuote('BTCUSD');
//   krakenAdapter.subscribe('BTCUSD', (tick) => { ... });
// ═══════════════════════════════════════════════════════════════════

import { BaseAdapter } from './BaseAdapter.js';
import { logger } from '@/observability/logger';
const KRAKEN_REST = 'https://api.kraken.com/0/public';
const KRAKEN_WS = 'wss://ws.kraken.com';

// ─── Symbol Mapping ────────────────────────────────────────────
// Kraken uses non-standard symbols (XBT instead of BTC, etc.)

const TF_TO_KRAKEN_SYMBOL = {
  BTC: 'XBT', BTCUSD: 'XBT/USD', BTCUSDT: 'XBT/USDT',
  ETH: 'ETH', ETHUSD: 'ETH/USD', ETHUSDT: 'ETH/USDT',
  SOL: 'SOL', SOLUSD: 'SOL/USD',
  XRP: 'XRP', XRPUSD: 'XRP/USD',
  ADA: 'ADA', ADAUSD: 'ADA/USD',
  DOT: 'DOT', DOTUSD: 'DOT/USD',
  DOGE: 'DOGE', DOGEUSD: 'DOGE/USD', DOGEUSDT: 'XDG/USDT',
  AVAX: 'AVAX', AVAXUSD: 'AVAX/USD',
  LINK: 'LINK', LINKUSD: 'LINK/USD',
  MATIC: 'MATIC', MATICUSD: 'MATIC/USD',
  UNI: 'UNI', UNIUSD: 'UNI/USD',
  LTC: 'LTC', LTCUSD: 'LTC/USD', LTCUSDT: 'LTC/USDT',
  ATOM: 'ATOM', ATOMUSD: 'ATOM/USD',
  FIL: 'FIL', FILUSD: 'FIL/USD',
  NEAR: 'NEAR', NEARUSD: 'NEAR/USD',
  APT: 'APT', APTUSD: 'APT/USD',
  ARB: 'ARB', ARBUSD: 'ARB/USD',
  SUI: 'SUI', SUIUSD: 'SUI/USD',
};

const KRAKEN_TO_TF = {};
for (const [tf, kr] of Object.entries(TF_TO_KRAKEN_SYMBOL)) {
  KRAKEN_TO_TF[kr] = tf;
}

// Interval mapping: charEdge → Kraken OHLC intervals (in minutes)
const INTERVAL_MAP = {
  '1m': 1, '5m': 5, '15m': 15, '30m': 30,
  '1h': 60, '4h': 240, '1d': 1440, '1w': 10080,
};

// ─── Helpers ───────────────────────────────────────────────────

function toKrakenPair(symbol) {
  const upper = (symbol || '').toUpperCase().replace(/[/-]/g, '');
  // Direct lookup
  if (TF_TO_KRAKEN_SYMBOL[upper]) return TF_TO_KRAKEN_SYMBOL[upper];
  // Try appending USD
  if (TF_TO_KRAKEN_SYMBOL[upper + 'USD']) return TF_TO_KRAKEN_SYMBOL[upper + 'USD'];
  // Strip USDT suffix and try
  if (upper.endsWith('USDT')) {
    const base = upper.slice(0, -4);
    if (TF_TO_KRAKEN_SYMBOL[base + 'USD']) return TF_TO_KRAKEN_SYMBOL[base + 'USD'];
  }
  // Fallback: assume it's already Kraken format
  return upper.includes('/') ? upper : upper.slice(0, -3) + '/' + upper.slice(-3);
}

function fromKrakenSymbol(krakenPair) {
  // Normalize: XBT/USD → BTCUSD
  const clean = krakenPair.replace('XBT', 'BTC').replace('/', '');
  return clean;
}

// ─── Kraken Adapter Class ──────────────────────────────────────

export class KrakenAdapter extends BaseAdapter {
  constructor() {
    super('kraken');
    this._ws = null;
    this._wsConnected = false;
    this._subscribers = new Map(); // krakenPair → Set<callback>
    this._lastPrices = new Map();  // symbol → { price, volume, time }
    this._reconnectTimer = null;
    this._heartbeatTimer = null;
  }

  // ─── Symbol Support ──────────────────────────────────────────

  supports(symbol) {
    const upper = (symbol || '').toUpperCase().replace(/[/-]/g, '');
    // Known crypto pairs
    return (
      !!TF_TO_KRAKEN_SYMBOL[upper] ||
      !!TF_TO_KRAKEN_SYMBOL[upper + 'USD'] ||
      (upper.endsWith('USDT') && !!TF_TO_KRAKEN_SYMBOL[upper.slice(0, -4) + 'USD'])
    );
  }

  latencyTier() { return 'realtime'; }

  // ─── REST: OHLCV ─────────────────────────────────────────────

  async fetchOHLCV(symbol, interval = '1h', opts = {}) {
    const pair = toKrakenPair(symbol);
    const minutes = INTERVAL_MAP[interval] || 60;

    const params = new URLSearchParams({ pair, interval: String(minutes) });
    if (opts.from) {
      params.set('since', String(Math.floor(new Date(opts.from).getTime() / 1000)));
    }

    try {
      const resp = await fetch(`${KRAKEN_REST}/OHLC?${params}`);
      if (!resp.ok) return [];

      const json = await resp.json();
      if (json.error?.length) {
        logger.data.warn('[KrakenAdapter] OHLC error:', json.error);
        return [];
      }

      // Result key is the pair name (varies, e.g. "XXBTZUSD")
      const resultKey = Object.keys(json.result || {}).find(k => k !== 'last');
      if (!resultKey) return [];

      return json.result[resultKey].map(bar => ({
        time: bar[0] * 1000,
        open: parseFloat(bar[1]),
        high: parseFloat(bar[2]),
        low: parseFloat(bar[3]),
        close: parseFloat(bar[4]),
        volume: parseFloat(bar[6]), // bar[6] = volume (bar[5] = vwap)
      }));
    } catch (err) {
      logger.data.warn('[KrakenAdapter] fetchOHLCV failed:', err.message);
      return [];
    }
  }

  // ─── REST: Quote ─────────────────────────────────────────────

  async fetchQuote(symbol) {
    const pair = toKrakenPair(symbol);

    try {
      const resp = await fetch(`${KRAKEN_REST}/Ticker?pair=${encodeURIComponent(pair)}`);
      if (!resp.ok) return null;

      const json = await resp.json();
      if (json.error?.length) return null;

      const resultKey = Object.keys(json.result || {})[0];
      if (!resultKey) return null;

      const d = json.result[resultKey];
      return {
        price: parseFloat(d.c[0]),       // Last trade close
        volume: parseFloat(d.v[1]),      // 24h volume
        high: parseFloat(d.h[1]),        // 24h high
        low: parseFloat(d.l[1]),         // 24h low
        open: parseFloat(d.o),           // Today's opening
        change: parseFloat(d.c[0]) - parseFloat(d.o),
        changePct: ((parseFloat(d.c[0]) - parseFloat(d.o)) / parseFloat(d.o)) * 100,
        vwap: parseFloat(d.p[1]),        // 24h VWAP
        trades: parseInt(d.t[1], 10),    // 24h trade count
      };
    } catch (err) {
      logger.data.warn('[KrakenAdapter] fetchQuote failed:', err.message);
      return null;
    }
  }

  // ─── WebSocket: Subscribe ────────────────────────────────────

  subscribe(symbol, callback) {
    const pair = toKrakenPair(symbol);

    if (!this._subscribers.has(pair)) {
      this._subscribers.set(pair, new Set());
    }
    this._subscribers.get(pair).add(callback);

    this._ensureWebSocket();

    // Send subscribe if already connected
    if (this._wsConnected) {
      this._sendSubscribe([pair]);
    }

    return () => {
      const subs = this._subscribers.get(pair);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this._subscribers.delete(pair);
          if (this._wsConnected) {
            this._sendUnsubscribe([pair]);
          }
        }
      }
    };
  }

  // ─── WebSocket: Internal ─────────────────────────────────────

  _ensureWebSocket() {
    if (this._ws) return;

    try {
      this._ws = new WebSocket(KRAKEN_WS);

      this._ws.onopen = () => {
        this._wsConnected = true;
        logger.data.info('[KrakenAdapter] WebSocket connected');

        // Subscribe to all pending pairs
        const pairs = [...this._subscribers.keys()];
        if (pairs.length > 0) {
          this._sendSubscribe(pairs);
        }

        // Heartbeat monitoring
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

        // Auto-reconnect if we still have subscribers
        if (this._subscribers.size > 0) {
          this._reconnectTimer = setTimeout(() => {
            this._reconnectTimer = null;
            this._ensureWebSocket();
          }, 3000);
        }
      };

      this._ws.onerror = () => {
        this._wsConnected = false;
      };
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
      this._ws = null;
    }
  }

  _handleMessage(msg) {
    // Kraken WS messages:
    // - System: { event: 'systemStatus', ... }
    // - Heartbeat: { event: 'heartbeat' }
    // - Subscription: { event: 'subscriptionStatus', ... }
    // - Trade data: [channelID, [[price, volume, time, side, type, misc]], channelName, pair]

    // Ignore system/heartbeat/subscription events
    if (msg.event) return;

    // Trade data is an array: [channelID, data, channelName, pair]
    if (Array.isArray(msg) && msg.length >= 4) {
      const channelName = msg[msg.length - 2];
      const pair = msg[msg.length - 1];
      const data = msg[1];

      if (channelName === 'trade' && Array.isArray(data)) {
        const subs = this._subscribers.get(pair);
        if (subs) {
          for (const trade of data) {
            const tick = {
              price: parseFloat(trade[0]),
              volume: parseFloat(trade[1]),
              time: Math.floor(parseFloat(trade[2]) * 1000),
              symbol: fromKrakenSymbol(pair),
              side: trade[3] === 'b' ? 'buy' : 'sell',
              source: 'kraken',
            };

            // Cache last price
            this._lastPrices.set(pair, tick);

            for (const cb of subs) {
              try { cb(tick); } catch (e) { logger.data.warn('Operation failed', e); }
            }
          }
        }
      }
    }
  }

  _sendSubscribe(pairs) {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify({
        event: 'subscribe',
        pair: pairs,
        subscription: { name: 'trade' },
      }));
    }
  }

  _sendUnsubscribe(pairs) {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify({
        event: 'unsubscribe',
        pair: pairs,
        subscription: { name: 'trade' },
      }));
    }
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    this._heartbeatTimer = setInterval(() => {
      if (this._ws?.readyState === WebSocket.OPEN) {
        this._ws.send(JSON.stringify({ event: 'ping' }));
      }
    }, 30000);
  }

  _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  // ─── Search ──────────────────────────────────────────────────

  async searchSymbols(query, limit = 10) {
    try {
      const resp = await fetch(`${KRAKEN_REST}/AssetPairs`);
      if (!resp.ok) return [];

      const json = await resp.json();
      if (json.error?.length) return [];

      const q = query.toUpperCase();
      return Object.entries(json.result || {})
        .filter(([, pair]) => {
          const wsname = pair.wsname || '';
          const altname = pair.altname || '';
          return wsname.includes(q) || altname.includes(q);
        })
        .slice(0, limit)
        .map(([key, pair]) => ({
          symbol: fromKrakenSymbol(pair.wsname || key),
          name: pair.wsname || pair.altname || key,
          type: 'CRYPTO',
          exchange: 'Kraken',
        }));
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
      return [];
    }
  }

  // ─── Get Last Known Price ────────────────────────────────────

  getLastPrice(symbol) {
    const pair = toKrakenPair(symbol);
    return this._lastPrices.get(pair) || null;
  }

  // ─── Cleanup ─────────────────────────────────────────────────

  dispose() {
    this._stopHeartbeat();
    clearTimeout(this._reconnectTimer);
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
    this._subscribers.clear();
    this._lastPrices.clear();
    this._wsConnected = false;
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const krakenAdapter = new KrakenAdapter();
export default krakenAdapter;
