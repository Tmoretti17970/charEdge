// ═══════════════════════════════════════════════════════════════════
// charEdge v16 — Order Flow Bridge
//
// Connects data source trade streams to the OrderFlowEngine.
// Acts as a central hub that routes raw trades from:
//   - BinanceAdapter @trade WebSocket (with auto-reconnection)
//   - KrakenAdapter trade WebSocket
//   - Any future trade stream source
//
// v16 Improvements:
//   • Exponential backoff WS reconnection
//   • Heartbeat/silence detection (30s → force reconnect)
//   • Connection state observable (connected/reconnecting/disconnected)
//   • Input validation on all incoming tick data
//   • Structured error logging (DataPipelineLogger integration)
//   • Fan-out tick micro-batching for background engines
//
// Usage:
//   import { orderFlowBridge } from './OrderFlowBridge.js';
//   orderFlowBridge.connect('BTCUSDT');
//   orderFlowBridge.disconnect('BTCUSDT');
//   orderFlowBridge.onStateChange((symbol, state) => { ... });
// ═══════════════════════════════════════════════════════════════════

import { orderFlowEngine } from './OrderFlowEngine.js';
import { krakenAdapter } from '../../adapters/KrakenAdapter.js';
import { tickPersistence } from '../streaming/TickPersistence.js';
import { derivedEngine } from '../../DerivedDataEngine.js';
import { streamingMetrics } from '../streaming/StreamingMetrics.js';
import { streamingIndicatorBridge } from '../indicators/StreamingIndicatorBridge.js';
import { pipelineLogger } from '../infra/DataPipelineLogger.js';
import { isCrypto } from '../../../constants.js';

// ─── Constants ─────────────────────────────────────────────────

const BINANCE_WS = 'wss://data-stream.binance.vision/ws';

// Reconnection config
const RECONNECT_BASE_MS = 1000;        // 1 second base delay
const RECONNECT_MAX_MS = 60000;        // 60 second max delay
const MAX_RECONNECT_ATTEMPTS = 20;     // Give up after 20 attempts

// Heartbeat / silence detection
const HEARTBEAT_INTERVAL_MS = 15000;   // Check every 15 seconds
const SILENCE_THRESHOLD_MS = 30000;    // No data for 30s → reconnect

// Tick validation
const MAX_TICKS_PER_SECOND = 2000;      // Rate limit guard (BTCUSDT peaks at ~1000/sec)
const MAX_FUTURE_MS = 60000;           // Reject timestamps >60s in future
const MAX_PAST_MS = 300000;            // Reject timestamps >5min in past

// Connection states
const STATE = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
};

// ─── Tick Validation ───────────────────────────────────────────

function validateTick(tick) {
  if (!tick) return false;
  if (typeof tick.price !== 'number' || !isFinite(tick.price) || tick.price <= 0) return false;
  if (typeof tick.volume !== 'number' || !isFinite(tick.volume) || tick.volume <= 0) return false;
  if (typeof tick.time !== 'number' || !isFinite(tick.time) || tick.time <= 0) return false;

  const now = Date.now();
  if (tick.time > now + MAX_FUTURE_MS) return false;
  if (tick.time < now - MAX_PAST_MS) return false;

  return true;
}

// ─── Rate Limiter ──────────────────────────────────────────────

class TickRateLimiter {
  constructor(maxPerSecond) {
    this._max = maxPerSecond;
    this._count = 0;
    this._lastReset = Date.now();
    this._dropped = 0;
  }

  allow() {
    const now = Date.now();
    if (now - this._lastReset >= 1000) {
      this._count = 0;
      this._lastReset = now;
    }
    if (this._count >= this._max) {
      this._dropped++;
      return false;
    }
    this._count++;
    return true;
  }

  get dropped() { return this._dropped; }
}

// ─── Binance Trade Stream Helper ───────────────────────────────

function createBinanceTradeWS(symbol, onTick, onOpen, onClose, onError) {
  const stream = symbol.toLowerCase() + '@trade';
  const ws = new WebSocket(`${BINANCE_WS}/${stream}`);

  ws.onopen = () => {
    if (onOpen) onOpen();
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      const tick = {
        price: parseFloat(data.p),
        volume: parseFloat(data.q),
        time: data.T,
        side: data.m ? 'sell' : 'buy',
        source: 'binance',
      };
      onTick(tick);
    } catch (err) {
      pipelineLogger.warn('OrderFlowBridge', `Binance parse error for ${symbol}`, err);
    }
  };

  ws.onerror = (err) => {
    if (onError) onError(err);
  };

  ws.onclose = (event) => {
    if (onClose) onClose(event.code, event.reason);
  };

  return ws;
}

// ─── Symbol Classification ─────────────────────────────────────

function isBinanceSymbol(symbol) {
  const upper = (symbol || '').toUpperCase();
  return isCrypto(upper) && (upper.endsWith('USDT') || upper.endsWith('BUSD'));
}

function isKrakenSymbol(symbol) {
  return krakenAdapter.supports(symbol);
}

// ─── Per-Symbol Connection State ───────────────────────────────

class SymbolConnection {
  constructor(symbol) {
    this.symbol = symbol;
    this.binanceWS = null;
    this.krakenUnsub = null;
    this.active = true;
    this.state = STATE.DISCONNECTED;

    // Reconnection state
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;

    // Heartbeat / silence detection
    this.lastTickTime = 0;
    this.heartbeatTimer = null;

    // Rate limiter
    this.rateLimiter = new TickRateLimiter(MAX_TICKS_PER_SECOND);

    // Error tracking
    this.totalErrors = 0;
    this.validationRejects = 0;
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

// ─── Order Flow Bridge ─────────────────────────────────────────

class _OrderFlowBridge {
  constructor() {
    this._connections = new Map();      // symbol → SymbolConnection
    this._tickCounts = new Map();       // symbol → count
    this._stateCallbacks = new Set();   // (symbol, state) => void
    this._batchBuffer = [];             // Tick micro-batch for background engines
    this._batchScheduled = false;
    // MessageChannel for faster batch flush (~4ms vs rAF's ~16ms)
    this._batchChannel = new MessageChannel();
    this._batchChannel.port1.onmessage = () => {
      const batch = this._batchBuffer.splice(0);
      for (const { symbol: sym, tick: t } of batch) {
        derivedEngine.ingestTick(sym, t.price, t.volume, t.time);
        tickPersistence.enqueue(sym, t);
        streamingMetrics.onTick(sym, t);
        streamingIndicatorBridge.onTick(sym, t);
      }
      this._batchScheduled = false;
    };
    // Per-symbol rolling tick rate tracking
    this._tickRateWindows = new Map(); // symbol → { timestamps: number[], tps: number }
  }

  // ─── Public API ──────────────────────────────────────────────

  /**
   * Start ingesting trade ticks for a symbol from all available sources.
   * @param {string} symbol - e.g., 'BTCUSDT', 'ETHUSDT'
   */
  connect(symbol) {
    const upper = (symbol || '').toUpperCase();
    if (!upper) return;
    if (this._connections.has(upper)) return;

    const conn = new SymbolConnection(upper);
    this._connections.set(upper, conn);
    this._tickCounts.set(upper, 0);

    this._connectSources(upper, conn);
  }

  /**
   * Stop ingesting trade ticks for a symbol.
   * @param {string} symbol
   */
  disconnect(symbol) {
    const upper = (symbol || '').toUpperCase();
    const conn = this._connections.get(upper);
    if (!conn) return;

    conn.dispose();

    if (conn.binanceWS) {
      conn.binanceWS.onopen = null;
      conn.binanceWS.onmessage = null;
      conn.binanceWS.onclose = null;
      conn.binanceWS.onerror = null;
      conn.binanceWS.close();
      conn.binanceWS = null;
    }

    if (conn.krakenUnsub) {
      conn.krakenUnsub();
      conn.krakenUnsub = null;
    }

    this._connections.delete(upper);
    this._setConnectionState(upper, STATE.DISCONNECTED);
    pipelineLogger.info('OrderFlowBridge', `Disconnected: ${upper}`);
  }

  /**
   * Connect multiple symbols at once.
   * @param {string[]} symbols
   */
  connectAll(symbols) {
    for (const sym of symbols) {
      this.connect(sym);
    }
  }

  /**
   * Disconnect all active connections.
   */
  disconnectAll() {
    for (const sym of [...this._connections.keys()]) {
      this.disconnect(sym);
    }
  }

  /**
   * Check if a symbol is actively connected.
   * @param {string} symbol
   * @returns {boolean}
   */
  isConnected(symbol) {
    const conn = this._connections.get((symbol || '').toUpperCase());
    return conn?.active || false;
  }

  /**
   * Get all connected symbols.
   * @returns {string[]}
   */
  getConnectedSymbols() {
    return [...this._connections.keys()];
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
   * Get connection stats.
   * @returns {Object}
   */
  getStats() {
    const stats = {};
    for (const [sym, conn] of this._connections) {
      stats[sym] = {
        active: conn.active,
        state: conn.state,
        binance: !!conn.binanceWS,
        kraken: !!conn.krakenUnsub,
        ticksReceived: this._tickCounts.get(sym) || 0,
        ticksPerSecond: this._tickRateWindows.get(sym)?.tps || 0,
        reconnectAttempts: conn.reconnectAttempts,
        totalErrors: conn.totalErrors,
        validationRejects: conn.validationRejects,
        rateDropped: conn.rateLimiter.dropped,
        lastTickAge: conn.lastTickTime ? Date.now() - conn.lastTickTime : null,
        flowStats: orderFlowEngine.getStats(sym),
      };
    }
    return stats;
  }

  /**
   * Dispose: disconnect everything and clean up.
   */
  dispose() {
    this.disconnectAll();
    this._tickCounts.clear();
    this._stateCallbacks.clear();
  }

  // ─── Private: Source Connection ──────────────────────────────

  /** @private */
  _connectSources(symbol, conn) {
    this._setConnectionState(symbol, STATE.CONNECTING);

    // Build the validated tick handler
    const handler = (tick) => {
      // ── Input Validation ──
      if (!validateTick(tick)) {
        conn.validationRejects++;
        return;
      }

      // ── Rate Limiting ──
      if (!conn.rateLimiter.allow()) {
        return;
      }

      // ── Update heartbeat ──
      conn.lastTickTime = Date.now();

      // ── CRITICAL PATH — OrderFlowEngine always immediate ──
      orderFlowEngine.ingestTick(symbol, tick);

      // ── BATCHED PATH — background engines get micro-batched ──
      this._batchBuffer.push({ symbol, tick });
      if (!this._batchScheduled) {
        this._batchScheduled = true;
        this._batchChannel.port2.postMessage(null);
      }

      // ── Tick counter + rolling ticks/sec ──
      this._tickCounts.set(symbol, (this._tickCounts.get(symbol) || 0) + 1);
      const now = Date.now();
      let rateWindow = this._tickRateWindows.get(symbol);
      if (!rateWindow) {
        rateWindow = { timestamps: [], tps: 0 };
        this._tickRateWindows.set(symbol, rateWindow);
      }
      rateWindow.timestamps.push(now);
      // Keep only last 1 second of timestamps
      const cutoff = now - 1000;
      while (rateWindow.timestamps.length > 0 && rateWindow.timestamps[0] < cutoff) {
        rateWindow.timestamps.shift();
      }
      rateWindow.tps = rateWindow.timestamps.length;
    };

    // Connect Binance trade WS (with reconnection)
    if (isBinanceSymbol(symbol)) {
      this._connectBinance(symbol, conn, handler);
    }

    // Connect Kraken trade WS (only for symbols Kraken explicitly supports)
    if (isKrakenSymbol(symbol)) {
      try {
        conn.krakenUnsub = krakenAdapter.subscribe(symbol, (tick) => {
          handler({
            price: tick.price,
            volume: tick.volume,
            time: tick.time,
            side: tick.side || 'buy',
            source: 'kraken',
          });
        });
      } catch (err) {
        pipelineLogger.warn('OrderFlowBridge', `Kraken WS failed for ${symbol}`, err);
      }
    }

    // Start heartbeat monitoring
    this._startHeartbeat(symbol, conn, handler);

    pipelineLogger.info('OrderFlowBridge', `Connected: ${symbol} (binance: ${isBinanceSymbol(symbol)}, kraken: ${isKrakenSymbol(symbol)})`);
  }

  /** @private — Connect Binance WS with reconnection support */
  _connectBinance(symbol, conn, handler) {
    if (!conn.active) return;

    try {
      conn.binanceWS = createBinanceTradeWS(
        symbol,
        handler,
        // onOpen
        () => {
          conn.reconnectAttempts = 0;
          this._setConnectionState(symbol, STATE.CONNECTED);
          pipelineLogger.info('OrderFlowBridge', `Binance WS open: ${symbol}`);
        },
        // onClose
        (code, reason) => {
          pipelineLogger.warn('OrderFlowBridge', `Binance WS closed: ${symbol} (code=${code}, reason=${reason || 'none'})`);
          conn.binanceWS = null;
          if (conn.active) {
            this._scheduleReconnect(symbol, conn, handler);
          }
        },
        // onError
        (err) => {
          conn.totalErrors++;
          pipelineLogger.error('OrderFlowBridge', `Binance WS error: ${symbol}`, err);
        }
      );
    } catch (err) {
      conn.totalErrors++;
      pipelineLogger.error('OrderFlowBridge', `Binance WS create failed: ${symbol}`, err);
      if (conn.active) {
        this._scheduleReconnect(symbol, conn, handler);
      }
    }
  }

  /** @private — Exponential backoff reconnection */
  _scheduleReconnect(symbol, conn, handler) {
    if (!conn.active) return;
    if (conn.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      pipelineLogger.error('OrderFlowBridge',
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
    pipelineLogger.info('OrderFlowBridge',
      `Reconnecting ${symbol} in ${Math.round(jitter)}ms (attempt ${conn.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

    conn.reconnectTimer = setTimeout(() => {
      conn.reconnectTimer = null;
      if (conn.active) {
        this._connectBinance(symbol, conn, handler);
      }
    }, jitter);
  }

  /** @private — Start heartbeat / silence detection */
  _startHeartbeat(symbol, conn, handler) {
    if (conn.heartbeatTimer) clearInterval(conn.heartbeatTimer);

    conn.heartbeatTimer = setInterval(() => {
      if (!conn.active) {
        clearInterval(conn.heartbeatTimer);
        return;
      }

      // Only check if we've received at least one tick
      if (conn.lastTickTime === 0) return;

      const silenceDuration = Date.now() - conn.lastTickTime;
      if (silenceDuration > SILENCE_THRESHOLD_MS) {
        pipelineLogger.warn('OrderFlowBridge',
          `Silence detected for ${symbol}: ${Math.round(silenceDuration / 1000)}s without data. Forcing reconnect.`);

        // Close existing Binance WS to trigger reconnection (onClose handler will fire)
        if (conn.binanceWS) {
          conn.binanceWS.onopen = null;
          conn.binanceWS.onmessage = null;
          conn.binanceWS.onclose = null;
          conn.binanceWS.onerror = null;
          conn.binanceWS.close();
          conn.binanceWS = null;
          // Handlers nullified — manually schedule reconnect
          this._scheduleReconnect(symbol, conn, handler);
        } else if (isBinanceSymbol(symbol)) {
          // WS already gone — directly schedule reconnect
          this._scheduleReconnect(symbol, conn, handler);
        }
      }
    }, HEARTBEAT_INTERVAL_MS);
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
          pipelineLogger.warn('OrderFlowBridge', 'State change callback error', err);
        }
      }
    }
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const orderFlowBridge = new _OrderFlowBridge();
export default orderFlowBridge;
