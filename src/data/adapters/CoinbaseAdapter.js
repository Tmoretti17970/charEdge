// ═══════════════════════════════════════════════════════════════════
// charEdge — Coinbase Spot Adapter
//
// Crypto market data via Coinbase Exchange REST + WebSocket APIs.
// Supports OHLCV, quotes, real-time ticker streaming, and symbol search.
//
// WebSocket: wss://ws-feed.exchange.coinbase.com
// REST:      https://api.exchange.coinbase.com
// Auth:      None required for public market data
//
// Symbol format: Coinbase uses "BTC-USD" (hyphenated, USD pairs primary)
//                charEdge uses "BTCUSDT" or "BTCUSD"
// ═══════════════════════════════════════════════════════════════════

import { BaseAdapter } from './BaseAdapter.js';

const CB_REST = 'https://api.exchange.coinbase.com';
const CB_WS   = 'wss://ws-feed.exchange.coinbase.com';

const INTERVAL_MAP = {
  '1m': 60, '5m': 300, '15m': 900,
  '1h': 3600, '6h': 21600, '1d': 86400,
};

// ─── Symbol Mapping ────────────────────────────────────────────

/**
 * Convert charEdge symbol to Coinbase product ID.
 * BTCUSDT → BTC-USD, ETHUSDC → ETH-USD, BTCUSD → BTC-USD
 */
function toCoinbaseProductId(symbol) {
  const upper = (symbol || '').toUpperCase();
  if (upper.includes('-')) return upper;

  for (const quote of ['USDT', 'USDC', 'USD', 'BTC', 'ETH']) {
    if (upper.endsWith(quote)) {
      const base = upper.slice(0, -quote.length);
      if (base.length > 0) {
        // Map USDT → USD for Coinbase (USDT pairs are limited)
        const cbQuote = quote === 'USDT' ? 'USD' : quote;
        return `${base}-${cbQuote}`;
      }
    }
  }
  return upper;
}

/** Convert Coinbase product ID back to charEdge symbol. BTC-USD → BTCUSD */
function fromCoinbaseProductId(productId) {
  return (productId || '').replace(/-/g, '');
}

// ─── Helpers ───────────────────────────────────────────────────

async function fetchJSON(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`Coinbase REST ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// ─── Coinbase Adapter Class ─────────────────────────────────────

export class CoinbaseAdapter extends BaseAdapter {
  constructor() {
    super('coinbase');
    this._ws = null;
    this._wsConnected = false;
    this._subscribers = new Map(); // tfSymbol → Set<callback>
    this._reconnectTimer = null;
    this._subscribedProducts = new Set(); // active Coinbase product IDs
  }

  // ── Interface Methods ──────────────────────────────────────────

  supports(symbol) {
    const upper = (symbol || '').toUpperCase();
    // Coinbase primarily supports USD, USDT, USDC pairs
    return upper.endsWith('USDT') || upper.endsWith('USD') || upper.endsWith('USDC');
  }

  async fetchOHLCV(symbol, interval = '1h', opts = {}) {
    const productId = toCoinbaseProductId(symbol);
    const granularity = INTERVAL_MAP[interval] || 3600;
    const limit = Math.min(opts.limit || 300, 300); // Coinbase max 300

    let url = `${CB_REST}/products/${productId}/candles?granularity=${granularity}`;
    if (opts.from) url += `&start=${new Date(opts.from).toISOString()}`;
    if (opts.to) url += `&end=${new Date(opts.to).toISOString()}`;

    const data = await fetchJSON(url);
    if (!Array.isArray(data)) {
      throw new Error('Coinbase candle response invalid');
    }

    // Coinbase returns newest-first: [timestamp, low, high, open, close, volume]
    return data
      .slice(0, limit)
      .map(k => ({
        time: k[0] * 1000, // Convert Unix seconds to ms
        open: parseFloat(k[3]),
        high: parseFloat(k[2]),
        low: parseFloat(k[1]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }))
      .reverse();
  }

  async fetchQuote(symbol) {
    const productId = toCoinbaseProductId(symbol);

    try {
      // Use ticker endpoint for current price info
      const data = await fetchJSON(`${CB_REST}/products/${productId}/ticker`);
      if (!data || !data.price) return null;

      const lastPrice = parseFloat(data.price);

      // Also get 24h stats for change, high, low
      let stats = null;
      try {
        stats = await fetchJSON(`${CB_REST}/products/${productId}/stats`);
      } catch { /* optional */ }

      const openPrice = stats ? parseFloat(stats.open) : lastPrice;
      return {
        price: lastPrice,
        change: lastPrice - openPrice,
        changePct: openPrice > 0 ? ((lastPrice - openPrice) / openPrice) * 100 : 0,
        volume: parseFloat(data.volume || stats?.volume || 0),
        high: stats ? parseFloat(stats.high) : lastPrice,
        low: stats ? parseFloat(stats.low) : lastPrice,
        open: openPrice,
      };
    } catch {
      return null;
    }
  }

  subscribe(symbol, callback) {
    const upper = (symbol || '').toUpperCase();
    const productId = toCoinbaseProductId(upper);

    if (!this._subscribers.has(upper)) {
      this._subscribers.set(upper, new Set());
    }
    this._subscribers.get(upper).add(callback);

    // Ensure WebSocket
    this._ensureWebSocket();

    // Subscribe to ticker channel for this product
    if (!this._subscribedProducts.has(productId)) {
      this._subscribedProducts.add(productId);
      this._sendSubscribe([productId]);
    }

    return () => {
      const subs = this._subscribers.get(upper);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this._subscribers.delete(upper);
          this._subscribedProducts.delete(productId);
          this._sendUnsubscribe([productId]);
        }
      }
    };
  }

  async searchSymbols(query, limit = 10) {
    try {
      const data = await fetchJSON(`${CB_REST}/products`);
      if (!Array.isArray(data)) return [];

      const q = query.toUpperCase();
      return data
        .filter(p => !p.trading_disabled &&
          (p.id.includes(q) || fromCoinbaseProductId(p.id).includes(q) ||
           p.base_currency?.includes(q)))
        .slice(0, limit)
        .map(p => ({
          symbol: fromCoinbaseProductId(p.id),
          name: `${p.base_currency}/${p.quote_currency}`,
          type: 'CRYPTO',
          exchange: 'Coinbase',
        }));
    } catch {
      return [];
    }
  }

  getLastPrice(symbol) {
    return null;
  }

  dispose() {
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
    this._wsConnected = false;
    this._subscribers.clear();
    this._subscribedProducts.clear();
    clearTimeout(this._reconnectTimer);
  }

  // ── WebSocket Management ───────────────────────────────────────

  /** @private */
  _ensureWebSocket() {
    if (this._ws && this._wsConnected) return;
    if (this._ws) return; // Connecting

    try {
      this._ws = new WebSocket(CB_WS);

      this._ws.onopen = () => {
        this._wsConnected = true;
        console.log('[CoinbaseAdapter] WebSocket connected');

        // Re-subscribe to active products
        if (this._subscribedProducts.size > 0) {
          this._sendSubscribe([...this._subscribedProducts]);
        }
      };

      this._ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this._handleMessage(msg);
        } catch { /* ignore parse errors */ }
      };

      this._ws.onclose = () => {
        this._wsConnected = false;
        this._ws = null;
        console.log('[CoinbaseAdapter] WebSocket closed, reconnecting in 3s...');

        clearTimeout(this._reconnectTimer);
        this._reconnectTimer = setTimeout(() => {
          if (this._subscribers.size > 0) {
            this._ensureWebSocket();
          }
        }, 3000);
      };

      this._ws.onerror = () => {
        console.warn('[CoinbaseAdapter] WebSocket error');
      };
    } catch (err) {
      console.warn('[CoinbaseAdapter] WebSocket init failed:', err.message);
      this._ws = null;
    }
  }

  /** @private */
  _handleMessage(msg) {
    // Subscription ack
    if (msg.type === 'subscriptions') return;
    if (msg.type === 'error') {
      console.warn('[CoinbaseAdapter] WS error:', msg.message);
      return;
    }

    // Ticker updates — these come for every trade
    if (msg.type === 'ticker' && msg.product_id) {
      const tfSymbol = fromCoinbaseProductId(msg.product_id);
      const callbacks = this._subscribers.get(tfSymbol);
      if (!callbacks || callbacks.size === 0) return;

      const tick = {
        price: parseFloat(msg.price),
        volume: parseFloat(msg.last_size || msg.volume_24h || 0),
        time: msg.time ? new Date(msg.time).getTime() : Date.now(),
        symbol: tfSymbol,
        side: msg.side === 'buy' ? 'buy' : 'sell',
      };

      for (const cb of callbacks) {
        try { cb(tick); } catch { /* ignore */ }
      }
    }
  }

  /** @private */
  _sendSubscribe(productIds) {
    if (!this._ws || !this._wsConnected) return;
    this._ws.send(JSON.stringify({
      type: 'subscribe',
      product_ids: productIds,
      channels: ['ticker'],
    }));
  }

  /** @private */
  _sendUnsubscribe(productIds) {
    if (!this._ws || !this._wsConnected) return;
    this._ws.send(JSON.stringify({
      type: 'unsubscribe',
      product_ids: productIds,
      channels: ['ticker'],
    }));
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const coinbaseAdapter = new CoinbaseAdapter();
export default coinbaseAdapter;
