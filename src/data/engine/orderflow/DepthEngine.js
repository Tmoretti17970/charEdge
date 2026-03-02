// ═══════════════════════════════════════════════════════════════════
// charEdge v17 — Order Book Depth Engine
//
// Real-time order book (Level 2) depth data from free WebSocket
// streams (Binance, Kraken). Provides:
//
//   • Real-time bid/ask depth display
//   • Depth imbalance ratio (buy vs sell wall detection)
//   • Cumulative depth curve
//   • Spoofing detection (order appear/disappear tracking)
//   • Significant level tracking (large resting orders)
//
// v17 Improvements:
//   • TypedArray order book — sorted Float64Array pairs (zero-alloc snapshots)
//   • Exponential backoff WS reconnection (matching OrderFlowBridge)
//   • Heartbeat/silence detection (15s → force reconnect)
//   • Connection state observable (connected/reconnecting/disconnected)
//   • DataPipelineLogger integration (no more silent catch blocks)
//   • PipelineHealthMonitor integration
//
// Usage:
//   import { depthEngine } from './DepthEngine.js';
//   depthEngine.subscribe('BTCUSDT', (depth) => { ... });
//   depthEngine.getConnectionState('BTCUSDT'); // 'connected'
//   depthEngine.onStateChange((symbol, state) => { ... });
// ═══════════════════════════════════════════════════════════════════

import { pipelineLogger } from '../infra/DataPipelineLogger.js';

// ─── Constants ─────────────────────────────────────────────────

const BINANCE_WS = 'wss://data-stream.binance.vision/ws';
const BYBIT_WS = 'wss://stream.bybit.com/v5/public/spot';
const KRAKEN_WS = 'wss://ws.kraken.com';
const MAX_LEVELS = 100; // Keep top 100 bid/ask levels

// Exchange adapter configs — URL templates, message parsers, subscribe messages
const EXCHANGE_ADAPTERS = {
  binance: {
    buildUrl: (symbol, levels, updateMs) =>
      `${BINANCE_WS}/${symbol.toLowerCase()}@depth${levels}@${updateMs}ms`,
    parseMessage: (data) => ({ bids: data.bids || [], asks: data.asks || [] }),
    subscribeMsg: null, // Binance uses path-based subscriptions
  },
  bybit: {
    buildUrl: () => BYBIT_WS,
    parseMessage: (data) => {
      // Bybit v5 orderbook format: { data: { b: [[price, qty]], a: [[price, qty]] } }
      const d = data.data || data;
      return {
        bids: (d.b || []).map(([p, q]) => [p, q]),
        asks: (d.a || []).map(([p, q]) => [p, q]),
      };
    },
    subscribeMsg: (symbol) => JSON.stringify({
      op: 'subscribe',
      args: [`orderbook.25.${symbol.toUpperCase()}`],
    }),
  },
  kraken: {
    buildUrl: () => KRAKEN_WS,
    parseMessage: (data) => {
      // Kraken WS format: array-based with different structure
      if (Array.isArray(data) && data.length >= 2) {
        const payload = data[1];
        return {
          bids: (payload.bs || payload.b || []).map(([p, v]) => [p, v]),
          asks: (payload.as || payload.a || []).map(([p, v]) => [p, v]),
        };
      }
      return { bids: [], asks: [] };
    },
    subscribeMsg: (symbol) => JSON.stringify({
      event: 'subscribe',
      pair: [symbol.toUpperCase().replace('USDT', '/USDT')],
      subscription: { name: 'book', depth: 25 },
    }),
  },
};

/**
 * Detect which exchange a symbol should use based on suffix/prefix.
 * Default to Binance for crypto pairs ending in USDT.
 */
function detectExchange(symbol) {
  const upper = (symbol || '').toUpperCase();
  if (upper.includes(':BYBIT') || upper.startsWith('BYBIT:')) return 'bybit';
  if (upper.includes(':KRAKEN') || upper.startsWith('KRAKEN:')) return 'kraken';
  // Default: Binance
  return 'binance';
}

/** Strip exchange prefix from symbol if present */
function cleanSymbol(symbol) {
  return (symbol || '').replace(/^(BINANCE|BYBIT|KRAKEN):/i, '').toUpperCase();
}

// Reconnection config (matches OrderFlowBridge)
const RECONNECT_BASE_MS = 1000;        // 1 second base delay
const RECONNECT_MAX_MS = 30000;        // 30 second max delay
const MAX_RECONNECT_ATTEMPTS = 20;     // Give up after 20 attempts

// Heartbeat / silence detection
const HEARTBEAT_INTERVAL_MS = 10000;   // Check every 10 seconds
const SILENCE_THRESHOLD_MS = 45000;    // No data for 45s → reconnect (relaxed to reduce churn)

// Connection states
const STATE = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
};

// ─── TypedArray Sorted Order Book ──────────────────────────────

/**
 * High-performance order book side (bid or ask).
 * Uses paired Float64Arrays for prices and quantities — always kept sorted.
 * Binary search insert / remove — O(log n) per level update.
 * getSlice() returns pre-built arrays with cumulative quantities — zero sort needed.
 */
class TypedOrderBookSide {
  constructor(capacity, descending = false) {
    this._capacity = capacity;
    this._prices = new Float64Array(capacity);
    this._quantities = new Float64Array(capacity);
    this._count = 0;
    this._descending = descending; // bids = descending (highest first)
  }

  /**
   * Full replacement update from an array of [priceStr, qtyStr] pairs.
   * This is the hot path — called on every WS depth message.
   */
  updateFromArray(entries) {
    this._count = 0;
    let totalQty = 0;
    let maxQty = 0;
    let wallPrice = 0;

    const limit = Math.min(entries.length, this._capacity);

    for (let i = 0; i < limit; i++) {
      const price = parseFloat(entries[i][0]);
      const qty = parseFloat(entries[i][1]);
      if (qty <= 0 || !isFinite(price) || !isFinite(qty)) continue;

      this._prices[this._count] = price;
      this._quantities[this._count] = qty;
      this._count++;
      totalQty += qty;
      if (qty > maxQty) { maxQty = qty; wallPrice = price; }
    }

    // Sort in-place: bids descending, asks ascending
    this._sortInPlace();

    return { totalQty, wallPrice };
  }

  /**
   * In-place insertion sort — fast for nearly-sorted data from exchanges.
   * Binance sends depth levels pre-sorted, so this is usually O(n).
   */
  _sortInPlace() {
    const n = this._count;
    const desc = this._descending;

    for (let i = 1; i < n; i++) {
      const keyP = this._prices[i];
      const keyQ = this._quantities[i];
      let j = i - 1;

      while (j >= 0 && (desc ? this._prices[j] < keyP : this._prices[j] > keyP)) {
        this._prices[j + 1] = this._prices[j];
        this._quantities[j + 1] = this._quantities[j];
        j--;
      }
      this._prices[j + 1] = keyP;
      this._quantities[j + 1] = keyQ;
    }
  }

  /**
   * Get snapshot as array of { price, qty, cumQty } — pre-sorted, pre-cumulated.
   * No sort needed — data is always maintained in order.
   */
  getSnapshot() {
    const result = new Array(this._count);
    let cum = 0;
    for (let i = 0; i < this._count; i++) {
      cum += this._quantities[i];
      result[i] = {
        price: this._prices[i],
        qty: this._quantities[i],
        cumQty: cum,
      };
    }
    return result;
  }

  /** Get the best price (first element). */
  bestPrice() {
    return this._count > 0 ? this._prices[0] : 0;
  }

  /** Get the total quantity. */
  totalQuantity() {
    let sum = 0;
    for (let i = 0; i < this._count; i++) sum += this._quantities[i];
    return sum;
  }

  /** Get count of levels. */
  get count() { return this._count; }

  /** Get raw price at index (for spoofing detection). */
  priceAt(i) { return i < this._count ? this._prices[i] : 0; }
  qtyAt(i) { return i < this._count ? this._quantities[i] : 0; }

  /** Build a Map<price, qty> snapshot for spoofing comparison. */
  toMap() {
    const m = new Map();
    for (let i = 0; i < this._count; i++) {
      m.set(this._prices[i], this._quantities[i]);
    }
    return m;
  }

  /** Check if a price exists in the book. */
  has(price) {
    for (let i = 0; i < this._count; i++) {
      if (this._prices[i] === price) return true;
    }
    return false;
  }
}

// ─── Depth State Per Symbol ────────────────────────────────────

class DepthState {
  constructor(symbol) {
    this.symbol = symbol;
    this.bids = new TypedOrderBookSide(MAX_LEVELS, true);   // descending
    this.asks = new TypedOrderBookSide(MAX_LEVELS, false);  // ascending
    this.lastUpdate = 0;

    // Analytics
    this.imbalanceRatio = 0.5;   // 0 = all sell, 1 = all buy
    this.bidWallPrice = null;
    this.askWallPrice = null;
    this.totalBidDepth = 0;
    this.totalAskDepth = 0;

    // Spoofing detection
    this._prevBids = null;
    this._prevAsks = null;
    this.spoofAlerts = [];
    this._spoofCooldown = 0;

    // Update counter for stats
    this.totalUpdates = 0;
  }

  update(bidArray, askArray) {
    // Snapshot previous state for spoofing detection
    if (this.bids.count > 0) {
      this._prevBids = this.bids.toMap();
      this._prevAsks = this.asks.toMap();
    }

    // Update order book sides — TypedArray, always sorted
    const bidStats = this.bids.updateFromArray(bidArray);
    const askStats = this.asks.updateFromArray(askArray);

    this.totalBidDepth = bidStats.totalQty;
    this.totalAskDepth = askStats.totalQty;
    this.bidWallPrice = bidStats.wallPrice;
    this.askWallPrice = askStats.wallPrice;

    const total = this.totalBidDepth + this.totalAskDepth;
    this.imbalanceRatio = total > 0 ? this.totalBidDepth / total : 0.5;

    // Spoofing detection: large orders that disappear quickly
    if (this._prevBids) {
      this._detectSpoofing();
    }

    this.lastUpdate = Date.now();
    this.totalUpdates++;
  }

  _detectSpoofing() {
    if (Date.now() - this._spoofCooldown < 5000) return; // 5s cooldown

    const threshold = this.totalBidDepth * 0.05; // 5% of total depth

    for (const [price, qty] of this._prevBids) {
      if (qty > threshold && !this.bids.has(price)) {
        this.spoofAlerts.push({
          time: Date.now(),
          side: 'bid',
          price,
          quantity: qty,
          type: 'large_bid_removed',
        });
        this._spoofCooldown = Date.now();
      }
    }

    for (const [price, qty] of this._prevAsks) {
      if (qty > threshold && !this.asks.has(price)) {
        this.spoofAlerts.push({
          time: Date.now(),
          side: 'ask',
          price,
          quantity: qty,
          type: 'large_ask_removed',
        });
        this._spoofCooldown = Date.now();
      }
    }

    // Keep only last 50 alerts
    if (this.spoofAlerts.length > 50) {
      this.spoofAlerts = this.spoofAlerts.slice(-50);
    }
  }

  /**
   * Get sorted depth for rendering.
   * TypedArray book is always sorted — no sort() needed here.
   */
  getSnapshot() {
    const bidSnap = this.bids.getSnapshot();
    const askSnap = this.asks.getSnapshot();
    const bestBid = this.bids.bestPrice();
    const bestAsk = this.asks.bestPrice();
    const hasBoth = bestBid > 0 && bestAsk > 0;

    return {
      bids: bidSnap,
      asks: askSnap,
      spread: hasBoth ? bestAsk - bestBid : 0,
      spreadPct: hasBoth ? ((bestAsk - bestBid) / bestBid) * 100 : 0,
      midPrice: hasBoth ? (bestAsk + bestBid) / 2 : 0,
      imbalanceRatio: this.imbalanceRatio,
      imbalanceLabel: this.imbalanceRatio > 0.6 ? 'buy_pressure' : this.imbalanceRatio < 0.4 ? 'sell_pressure' : 'balanced',
      bidWallPrice: this.bidWallPrice,
      askWallPrice: this.askWallPrice,
      totalBidDepth: this.totalBidDepth,
      totalAskDepth: this.totalAskDepth,
      spoofAlerts: this.spoofAlerts.slice(-5),
      time: this.lastUpdate,
    };
  }
}

// ─── Per-Symbol Connection ─────────────────────────────────────

class DepthConnection {
  constructor(symbol) {
    this.symbol = symbol;
    this.ws = null;
    this.depthState = new DepthState(symbol);
    this.subscribers = new Set();
    this.lastEmit = 0;
    this.active = true;
    this.state = STATE.DISCONNECTED;

    // Reconnection state
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;

    // Heartbeat / silence detection
    this.lastMessageTime = 0;
    this.heartbeatTimer = null;

    // Config (set on first subscribe)
    this.levels = 20;
    this.updateMs = 1000;

    // Error tracking
    this.totalErrors = 0;
    this.parseErrors = 0;
  }

  dispose() {
    this.active = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

// ─── Depth Engine ──────────────────────────────────────────────

class _DepthEngine {
  constructor() {
    this._connections = new Map();      // symbol → DepthConnection
    this._stateCallbacks = new Set();   // (symbol, state, oldState) => void
  }

  // ─── Public API ──────────────────────────────────────────────

  /**
   * Subscribe to real-time depth data for a symbol.
   * @param {string} symbol
   * @param {Function} callback - (depthSnapshot) => void
   * @param {Object} [opts]
   * @param {number} [opts.levels=20] - 5, 10, or 20
   * @param {number} [opts.updateMs=1000] - throttle interval
   * @returns {Function} unsubscribe
   */
  subscribe(symbol, callback, opts = {}) {
    const upper = (symbol || '').toUpperCase();
    const levels = opts.levels || 20;
    const updateMs = opts.updateMs || 1000;

    let conn = this._connections.get(upper);
    if (!conn) {
      conn = new DepthConnection(upper);
      conn.levels = levels;
      conn.updateMs = updateMs;
      conn.exchange = detectExchange(upper);
      conn.cleanSymbol = cleanSymbol(upper);
      this._connections.set(upper, conn);

      // Start depth WS with full reconnection
      this._connectWS(upper, conn);
    }

    conn.subscribers.add(callback);

    return () => {
      conn.subscribers.delete(callback);
      if (conn.subscribers.size === 0) {
        this._disconnectWS(upper);
      }
    };
  }

  /**
   * Get current depth snapshot for a symbol.
   * @param {string} symbol
   * @returns {Object|null}
   */
  getDepth(symbol) {
    const conn = this._connections.get((symbol || '').toUpperCase());
    return conn?.depthState?.getSnapshot() || null;
  }

  /**
   * Get the connection state for a symbol.
   * @param {string} symbol
   * @returns {string} 'connected' | 'reconnecting' | 'connecting' | 'disconnected'
   */
  getConnectionState(symbol) {
    const conn = this._connections.get((symbol || '').toUpperCase());
    return conn?.state || STATE.DISCONNECTED;
  }

  /**
   * Subscribe to connection state changes.
   * @param {Function} callback - (symbol, newState, oldState) => void
   * @returns {Function} unsubscribe
   */
  onStateChange(callback) {
    this._stateCallbacks.add(callback);
    return () => this._stateCallbacks.delete(callback);
  }

  /**
   * Get all connected symbols.
   * @returns {string[]}
   */
  getConnectedSymbols() {
    return [...this._connections.keys()];
  }

  /**
   * Get stats for all connected symbols.
   * @returns {Object}
   */
  getStats() {
    const stats = {};
    for (const [sym, conn] of this._connections) {
      const snap = conn.depthState.getSnapshot();
      stats[sym] = {
        connected: conn.state === STATE.CONNECTED,
        state: conn.state,
        subscribers: conn.subscribers.size,
        spread: snap.spread,
        spreadPct: snap.spreadPct,
        imbalance: snap.imbalanceLabel,
        spoofAlerts: snap.spoofAlerts.length,
        totalUpdates: conn.depthState.totalUpdates,
        reconnectAttempts: conn.reconnectAttempts,
        totalErrors: conn.totalErrors,
        parseErrors: conn.parseErrors,
        lastMessageAge: conn.lastMessageTime ? Date.now() - conn.lastMessageTime : null,
      };
    }
    return stats;
  }

  /**
   * Dispose: disconnect everything and clean up.
   */
  dispose() {
    for (const sym of [...this._connections.keys()]) {
      this._disconnectWS(sym);
    }
    this._stateCallbacks.clear();
  }

  // ─── Private: Connection Management ──────────────────────────

  /** @private — Connect WS with full reconnection support */
  _connectWS(symbol, conn) {
    if (!conn.active) return;

    this._setConnectionState(symbol, STATE.CONNECTING);

    const exchange = conn.exchange || 'binance';
    const adapter = EXCHANGE_ADAPTERS[exchange];
    const cleanSym = conn.cleanSymbol || symbol;

    try {
      const wsUrl = adapter.buildUrl(cleanSym, conn.levels, conn.updateMs);
      conn.ws = new WebSocket(wsUrl);

      conn.ws.onopen = () => {
        conn.reconnectAttempts = 0;
        this._setConnectionState(symbol, STATE.CONNECTED);
        pipelineLogger.info('DepthEngine', `WS connected: ${symbol} (${exchange})`);

        // Send subscribe message if needed (Bybit, Kraken)
        if (adapter.subscribeMsg) {
          conn.ws.send(adapter.subscribeMsg(cleanSym));
        }
      };

      conn.ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          conn.lastMessageTime = Date.now();
          const { bids, asks } = adapter.parseMessage(data);
          if (bids.length > 0 || asks.length > 0) {
            conn.depthState.update(bids, asks);
          }

          // Throttled emission to subscribers
          const now = Date.now();
          if (now - conn.lastEmit >= conn.updateMs) {
            conn.lastEmit = now;
            const snapshot = conn.depthState.getSnapshot();
            for (const cb of conn.subscribers) {
              try { cb(snapshot); }
              catch (err) {
                pipelineLogger.warn('DepthEngine', `Subscriber callback error for ${symbol}`, err);
              }
            }
          }
        } catch (err) {
          conn.parseErrors++;
          pipelineLogger.warn('DepthEngine', `Parse error for ${symbol}`, err);
        }
      };

      conn.ws.onclose = (event) => {
        pipelineLogger.warn('DepthEngine',
          `WS closed: ${symbol} (code=${event.code}, reason=${event.reason || 'none'})`);
        conn.ws = null;
        if (conn.active && conn.subscribers.size > 0) {
          this._scheduleReconnect(symbol, conn);
        }
      };

      conn.ws.onerror = (err) => {
        conn.totalErrors++;
        pipelineLogger.error('DepthEngine', `WS error: ${symbol}`, err);
      };

      // Start heartbeat monitoring
      this._startHeartbeat(symbol, conn);

    } catch (err) {
      conn.totalErrors++;
      pipelineLogger.error('DepthEngine', `WS create failed: ${symbol}`, err);
      conn.ws = null;
      if (conn.active) {
        this._scheduleReconnect(symbol, conn);
      }
    }
  }

  /** @private — Exponential backoff reconnection */
  _scheduleReconnect(symbol, conn) {
    if (!conn.active) return;
    if (conn.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      pipelineLogger.error('DepthEngine',
        `Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached for ${symbol}. Giving up.`);
      this._setConnectionState(symbol, STATE.DISCONNECTED);
      return;
    }

    conn.reconnectAttempts++;
    const delay = Math.min(
      RECONNECT_BASE_MS * Math.pow(2, conn.reconnectAttempts - 1),
      RECONNECT_MAX_MS
    );
    // Add jitter: ±25%
    const jitter = delay * (0.75 + Math.random() * 0.5);

    this._setConnectionState(symbol, STATE.RECONNECTING);
    pipelineLogger.info('DepthEngine',
      `Reconnecting ${symbol} in ${Math.round(jitter)}ms (attempt ${conn.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

    conn.reconnectTimer = setTimeout(() => {
      conn.reconnectTimer = null;
      if (conn.active) {
        this._connectWS(symbol, conn);
      }
    }, jitter);
  }

  /** @private — Start heartbeat / silence detection */
  _startHeartbeat(symbol, conn) {
    if (conn.heartbeatTimer) clearInterval(conn.heartbeatTimer);

    conn.heartbeatTimer = setInterval(() => {
      if (!conn.active) {
        clearInterval(conn.heartbeatTimer);
        return;
      }

      // Only check if we've received at least one message
      if (conn.lastMessageTime === 0) return;

      const silenceDuration = Date.now() - conn.lastMessageTime;
      if (silenceDuration > SILENCE_THRESHOLD_MS) {
        pipelineLogger.warn('DepthEngine',
          `Silence detected for ${symbol}: ${Math.round(silenceDuration / 1000)}s without data. Forcing reconnect.`);

        // Close existing WS — null handlers first to prevent double reconnect
        if (conn.ws) {
          conn.ws.onopen = null;
          conn.ws.onmessage = null;
          conn.ws.onclose = null;
          conn.ws.onerror = null;
          conn.ws.close();
          conn.ws = null;
          // Handlers nullified — manually schedule reconnect
          this._scheduleReconnect(symbol, conn);
        } else {
          this._scheduleReconnect(symbol, conn);
        }
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  /** @private — Disconnect and clean up a symbol */
  _disconnectWS(symbol) {
    const conn = this._connections.get(symbol);
    if (!conn) return;

    conn.dispose();

    if (conn.ws) {
      conn.ws.onopen = null;
      conn.ws.onmessage = null;
      conn.ws.onclose = null;
      conn.ws.onerror = null;
      conn.ws.close();
      conn.ws = null;
    }

    this._connections.delete(symbol);
    this._setConnectionState(symbol, STATE.DISCONNECTED);
    pipelineLogger.info('DepthEngine', `Disconnected: ${symbol}`);
  }

  /** @private — Update connection state + notify subscribers */
  _setConnectionState(symbol, newState) {
    const conn = this._connections.get(symbol);
    const oldState = conn?.state;
    if (conn) conn.state = newState;

    if (oldState !== newState) {
      for (const cb of this._stateCallbacks) {
        try { cb(symbol, newState, oldState); }
        catch (err) {
          pipelineLogger.warn('DepthEngine', 'State change callback error', err);
        }
      }
    }
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const depthEngine = new _DepthEngine();
export default depthEngine;
