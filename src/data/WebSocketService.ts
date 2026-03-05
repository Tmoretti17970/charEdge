// ═══════════════════════════════════════════════════════════════════
// charEdge v16 — WebSocketService (Multiplexed + Incremental)
//
// Uses Binance combined streams to multiplex all symbol subscriptions
// onto a single WebSocket connection instead of one WS per symbol.
// Stream changes use runtime SUBSCRIBE/UNSUBSCRIBE messages to avoid
// full teardown/reconnect (eliminates data gaps during symbol changes).
//
// v16 additions:
//   - 30s heartbeat ping with 5s pong timeout (silent disconnect detection)
//   - Connection health metrics (latency, reconnect count, data staleness)
//   - Binance @trade stream for sub-second tick data
//
// API:
//   wsService.subscribe(symbol, tf, callbacks) → subscriptionId
//   wsService.unsubscribe(subscriptionId?)     → void (no args = unsubscribe all)
//   WebSocketService.isSupported(symbol)       → boolean
//
// Architecture:
//   subscribe('BTC','1h')  ──┐
//   subscribe('ETH','1h')  ──┤──→ single WS: /stream?streams=btcusdt@kline_1h/ethusdt@kline_1h
//   subscribe('SOL','5m')  ──┘
//                              ↓ onmessage
//                         dispatch by msg.stream to per-sub callbacks
// ═══════════════════════════════════════════════════════════════════

import { isCrypto } from '../constants.js';
import { TickRingBuffer } from './engine/streaming/TickRingBuffer.ts';
import { logger } from '../utils/logger';

// Cache StreamingIndicatorBridge import to avoid dynamic import() on every tick
let _streamingBridge = null;
let _streamingBridgeLoading = false;

// Lazy-load BinaryCodec for binary WS message decoding (Task 1.3.2)
let _binaryCodec = null;
let _binaryCodecLoading = false;
function _getBinaryCodec() {
  if (_binaryCodec) return _binaryCodec;
  if (_binaryCodecLoading) return null;
  _binaryCodecLoading = true;
  import('./engine/infra/BinaryCodec.js')
    .then(mod => { _binaryCodec = mod.BinaryCodec || mod.default; })
    .catch(() => { _binaryCodecLoading = false; });
  return null;
}
function _getStreamingBridge() {
  if (_streamingBridge) return _streamingBridge;
  if (_streamingBridgeLoading) return null;
  _streamingBridgeLoading = true;
  import('./engine/indicators/StreamingIndicatorBridge.js')
    .then(mod => { _streamingBridge = mod.streamingIndicatorBridge; })
    .catch(() => { _streamingBridgeLoading = false; });
  return null;
}

export const WS_STATUS = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
};

// BINANCE_SYMBOLS removed — use isCrypto() from constants.js

const TF_MAP = {
  '1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m', '30m': '30m',
  '1h': '1h', '2h': '2h', '4h': '4h', '6h': '6h', '8h': '8h',
  '12h': '12h', '1D': '1d', '1d': '1d', '3D': '3d',
  '1W': '1w', '1w': '1w', '1M': '1M',
};

function toSymbol(s) {
  const u = (s || '').toUpperCase();
  if (u.endsWith('USDT')) return u;
  return u + 'USDT';
}

/**
 * Build the Binance stream key for a symbol+timeframe pair.
 * @param {string} symbol
 * @param {string} tf
 * @returns {string} e.g. "btcusdt@kline_1h"
 */
function streamKey(symbol, tf) {
  const sym = toSymbol(symbol).toLowerCase();
  const interval = TF_MAP[tf] || '1h';
  return `${sym}@kline_${interval}`;
}

/**
 * Build the Binance trade stream key for a symbol.
 * @param {string} symbol
 * @returns {string} e.g. "btcusdt@trade"
 */
function tradeStreamKey(symbol) {
  return `${toSymbol(symbol).toLowerCase()}@trade`;
}

// ─── Heartbeat Config ──────────────────────────────────────────
const HEARTBEAT_INTERVAL_MS = 30_000;  // Send ping every 30s
const PONG_TIMEOUT_MS = 5_000;         // Close if no pong within 5s

let _nextSubId = 1;

class _WebSocketService {
  constructor() {
    /** @type {WebSocket|null} */
    this._ws = null;
    this._status = WS_STATUS.DISCONNECTED;

    /**
     * Active subscriptions.
     * subId → { streamKey, symbol, tf, callbacks }
     * @type {Map<number, {streamKey:string, symbol:string, tf:string, callbacks:Object}>}
     */
    this._subs = new Map();

    /**
     * Streams currently active on the live WS connection.
     * Kept in sync so we can diff for incremental SUBSCRIBE/UNSUBSCRIBE.
     * @type {Set<string>}
     */
    this._currentStreams = new Set();

    // Monotonic request ID for SUBSCRIBE/UNSUBSCRIBE messages
    this._wsMsgId = 1;

    // Reconnection state
    this._reconnectAttempts = 0;
    this._maxReconnectAttempts = 10;
    this._reconnectTimer = null;
    this._intentionalClose = false;

    // Debounce reconnect to batch rapid subscribe/unsubscribe calls
    this._reconnectDebounce = null;

    // ── Heartbeat state ──
    this._heartbeatTimer = null;
    this._pongTimeout = null;
    this._pingSentAt = 0;       // timestamp when last ping was sent
    this._awaitingPong = false;

    // ── Connection health metrics ──
    this._latencyMs = 0;
    this._reconnectCount = 0;
    this._lastMessageTime = 0;
    this._messagesReceived = 0;

    /**
     * Trade-stream subscriptions (separate from kline subs).
     * subId → { streamKey, symbol, callbacks }
     * @type {Map<number, {streamKey:string, symbol:string, callbacks:Object}>}
     */
    this._tradeSubs = new Map();

    // ── 5A.1.1: Per-symbol tick ring buffers (zero-alloc) ──
    /** @type {Map<string, TickRingBuffer>} */
    this._tickBuffers = new Map();

    // ── 5A.1.5: rAF message batching ──
    // Queue parsed messages and dispatch once per animation frame
    // instead of on every WS callback (~200/s → ~60/s).
    /** @type {Array<{stream: string, data: Object}>} */
    this._pendingMessages = [];
    this._rafId = null;
  }

  static isSupported(symbol) {
    return isCrypto(symbol);
  }

  /**
   * Subscribe to a symbol+timeframe stream.
   * Returns a subscription ID for targeted unsubscribe.
   *
   * Backward-compatible: if called while another sub exists, previous subs
   * from the SAME caller context should be unsubscribed first (handled by
   * useWebSocket cleanup effect).
   *
   * @param {string} symbol
   * @param {string} tf
   * @param {Object} callbacks - { onBar, onCandle, onTick, onStatus }
   * @returns {number} subscriptionId
   */
  subscribe(symbol, tf, callbacks = {}) {
    const key = streamKey(symbol, tf);
    const subId = _nextSubId++;

    this._subs.set(subId, { streamKey: key, symbol, tf, callbacks });

    // Reconnect with updated stream list (debounced for batching)
    this._scheduleStreamUpdate();

    return subId;
  }

  /**
   * Subscribe to raw trade stream for a symbol.
   * Provides sub-second tick data (100+ msg/sec for BTC).
   *
   * @param {string} symbol
   * @param {Object} callbacks - { onTrade: ({price, qty, time, isBuyerMaker}) => void, onStatus }
   * @returns {number} subscriptionId
   */
  subscribeTrades(symbol, callbacks = {}) {
    const key = tradeStreamKey(symbol);
    const subId = _nextSubId++;

    this._tradeSubs.set(subId, { streamKey: key, symbol, callbacks });
    this._scheduleStreamUpdate();

    return subId;
  }

  /**
   * 5A.2.2: Subscribe to kline stream ONLY for a symbol.
   * Lightweight subscription for background watchlist tracking —
   * no trade stream, no ring buffer, just candle updates.
   *
   * @param {string} symbol
   * @param {string} tf
   * @param {Object} callbacks - { onBar, onCandle }
   * @returns {number} subscriptionId
   */
  subscribeKlineOnly(symbol, tf, callbacks = {}) {
    const key = streamKey(symbol, tf);
    const subId = _nextSubId++;

    this._subs.set(subId, {
      streamKey: key,
      symbol,
      tf,
      callbacks,
      _klineOnly: true, // Flag: skip trade subscriptions
    });

    this._scheduleStreamUpdate();
    return subId;
  }

  /**
   * Unsubscribe.
   * - No args: unsubscribe ALL (backward compatible with existing code)
   * - With subId: unsubscribe that specific subscription
   * @param {number} [subId]
   */
  unsubscribe(subId) {
    if (subId !== undefined) {
      this._subs.delete(subId);
      this._tradeSubs.delete(subId);
    } else {
      // Legacy: unsubscribe everything
      this._subs.clear();
      this._tradeSubs.clear();
    }

    const totalSubs = this._subs.size + this._tradeSubs.size;
    if (totalSubs === 0) {
      // No more subscriptions — close the connection
      this._intentionalClose = true;
      this._closeWs();
    } else {
      // Still have subs — reconnect with reduced stream list
      this._scheduleStreamUpdate();
    }
  }

  /**
   * Get unique stream keys from all active subscriptions (kline + trade).
   * @returns {string[]}
   */
  _getActiveStreams() {
    const streams = new Set();
    for (const sub of this._subs.values()) {
      streams.add(sub.streamKey);
    }
    for (const sub of this._tradeSubs.values()) {
      streams.add(sub.streamKey);
    }
    return [...streams];
  }

  /**
   * Debounced stream update — batches rapid subscribe/unsubscribe calls.
   * If the WS is already connected, sends incremental SUBSCRIBE/UNSUBSCRIBE
   * messages instead of tearing down the connection.
   * @private
   */
  _scheduleStreamUpdate() {
    if (this._reconnectDebounce) clearTimeout(this._reconnectDebounce);
    this._reconnectDebounce = setTimeout(() => {
      this._reconnectDebounce = null;
      this._intentionalClose = false;
      this._reconnectAttempts = 0;
      this._applyStreamDiff();
    }, 50); // 50ms debounce for batching
  }

  /**
   * Diff desired streams vs current WS streams and apply incremental changes.
   * Falls back to full reconnect if the WS isn't in CONNECTED state.
   * @private
   */
  _applyStreamDiff() {
    const desired = new Set(this._getActiveStreams());

    // If no WS at all, do a full connect
    if (!this._ws) {
      this._connect();
      return;
    }

    // If still connecting, the onopen handler will reconcile stream diffs
    if (this._status === WS_STATUS.CONNECTING) {
      return;
    }

    // If reconnecting or disconnected, do a full connect
    if (this._status !== WS_STATUS.CONNECTED) {
      this._connect();
      return;
    }

    // Compute diff
    const toAdd = [...desired].filter(s => !this._currentStreams.has(s));
    const toRemove = [...this._currentStreams].filter(s => !desired.has(s));

    if (toAdd.length === 0 && toRemove.length === 0) return;

    // Send incremental messages
    if (toRemove.length > 0) this._sendUnsubscribe(toRemove);
    if (toAdd.length > 0) this._sendSubscribe(toAdd);
  }

  /**
   * Send a SUBSCRIBE message to the live WS for new streams.
   * @param {string[]} streams
   * @private
   */
  _sendSubscribe(streams) {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return;
    try {
      this._ws.send(JSON.stringify({
        method: 'SUBSCRIBE',
        params: streams,
        id: this._wsMsgId++,
      }));
      for (const s of streams) this._currentStreams.add(s);
    } catch (e) { logger.data.warn('Operation failed', e); }
  }

  /**
   * Send an UNSUBSCRIBE message to the live WS for removed streams.
   * @param {string[]} streams
   * @private
   */
  _sendUnsubscribe(streams) {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return;
    try {
      this._ws.send(JSON.stringify({
        method: 'UNSUBSCRIBE',
        params: streams,
        id: this._wsMsgId++,
      }));
      for (const s of streams) this._currentStreams.delete(s);
    } catch (e) { logger.data.warn('Operation failed', e); }
  }

  /** @private */
  _connect() {
    // If already connecting, let the in-flight connection finish — onopen will reconcile
    if (this._ws && this._ws.readyState === WebSocket.CONNECTING) {
      return;
    }

    // Stop heartbeat FIRST — prevents old timer from firing against closing socket
    this._stopHeartbeat();

    // Close existing connection
    this._closeWs();

    const streams = this._getActiveStreams();
    if (streams.length === 0) {
      this._status = WS_STATUS.DISCONNECTED;
      this._notifyStatus();
      return;
    }

    this._status = WS_STATUS.CONNECTING;
    this._notifyStatus();

    try {
      // Use combined streams endpoint for multiplexing
      const url = `wss://data-stream.binance.vision/stream?streams=${streams.join('/')}`;
      this._ws = new WebSocket(url);

      this._ws.onopen = () => {
        this._status = WS_STATUS.CONNECTED;
        this._reconnectAttempts = 0;
        // Track which streams the initial URL included
        this._currentStreams = new Set(streams);
        this._notifyStatus();

        // If streams changed while connecting, send incremental updates
        const latest = new Set(this._getActiveStreams());
        const added = [...latest].filter(s => !this._currentStreams.has(s));
        const removed = [...this._currentStreams].filter(s => !latest.has(s));
        if (added.length > 0) this._sendSubscribe(added);
        if (removed.length > 0) this._sendUnsubscribe(removed);

        // ── Start heartbeat ping ──
        this._startHeartbeat();
      };

      this._ws.onmessage = (evt) => {
        try {
          let wrapper;

          // ── Binary-first decode (Task 1.3.2) ──
          if (evt.data instanceof ArrayBuffer || evt.data instanceof Blob) {
            const codec = _getBinaryCodec();
            if (codec) {
              const decoded = codec.decodeAuto
                ? codec.decodeAuto(evt.data)
                : codec.decode(evt.data);
              if (decoded?.data) {
                wrapper = decoded.data;
              } else {
                wrapper = decoded;
              }
            } else {
              return;
            }
          } else {
            wrapper = JSON.parse(evt.data);
          }

          // ── Pong response (heartbeat reply) — handle immediately ──
          if (wrapper.pong !== undefined || wrapper.id !== undefined) {
            if (this._awaitingPong) {
              this._latencyMs = Date.now() - this._pingSentAt;
              this._awaitingPong = false;
              if (this._pongTimeout) {
                clearTimeout(this._pongTimeout);
                this._pongTimeout = null;
              }
            }
            return;
          }

          const msgStream = wrapper.stream;
          const msg = wrapper.data;
          if (!msg) return;

          // Update health metrics (always immediate)
          this._lastMessageTime = Date.now();
          this._messagesReceived++;

          // ── 5A.1.2: Push trade ticks to ring buffer IMMEDIATELY ──
          // This is O(1), zero-alloc — safe to do outside rAF batch.
          // The ring buffer captures every tick even if callback dispatch is batched.
          if (msg.e === 'trade') {
            const sym = msg.s || msgStream.split('@')[0].toUpperCase();
            let buf = this._tickBuffers.get(sym);
            if (!buf) {
              buf = new TickRingBuffer(16384);
              this._tickBuffers.set(sym, buf);
            }
            buf.push(+msg.p, +msg.q, msg.T, msg.m ? 1 : 0);
          }

          // ── 5A.1.5: Queue for rAF-batched dispatch ──
          this._pendingMessages.push({ stream: msgStream, data: msg });
          if (!this._rafId) {
            this._rafId = requestAnimationFrame(() => this._flushMessages());
          }
        } catch (_) {
          /* ignore parse errors */
        }
      };

      this._ws.onclose = () => {
        this._status = WS_STATUS.DISCONNECTED;
        this._notifyStatus();
        if (!this._intentionalClose && this._subs.size > 0) {
          this._scheduleReconnect();
        }
      };

      this._ws.onerror = () => {
        this._status = WS_STATUS.DISCONNECTED;
        this._notifyStatus();
        // onclose will fire after onerror, reconnect handled there
      };
    } catch (_) {
      this._status = WS_STATUS.DISCONNECTED;
      this._notifyStatus();
      if (!this._intentionalClose && this._subs.size > 0) {
        this._scheduleReconnect();
      }
    }
  }

  // ── 5A.1.5: rAF-batched message dispatch ───────────────────────

  /**
   * Drain the pending message queue and dispatch to subscribers.
   * Called once per animation frame — reduces ~200 callbacks/sec to ~60.
   * @private
   */
  _flushMessages() {
    this._rafId = null;
    const batch = this._pendingMessages;
    this._pendingMessages = [];

    for (let i = 0; i < batch.length; i++) {
      const { stream: msgStream, data: msg } = batch[i];
      this._dispatchMessage(msgStream, msg);
    }
  }

  /**
   * Dispatch a single parsed message to matching subscribers.
   * Extracted from onmessage for rAF batching.
   * @private
   */
  _dispatchMessage(msgStream, msg) {
    // ── Kline events ──
    if (msg.e === 'kline' && msg.k) {
      const k = msg.k;
      const bar = {
        time: k.t,
        open: +k.o,
        high: +k.h,
        low: +k.l,
        close: +k.c,
        volume: +k.v,
        isClosed: k.x,
      };

      for (const sub of this._subs.values()) {
        if (sub.streamKey === msgStream) {
          if (sub.callbacks.onBar) sub.callbacks.onBar(bar);
          if (sub.callbacks.onCandle) sub.callbacks.onCandle(bar);
        }
      }

      // Wire streaming indicators
      try {
        const bridge = _getStreamingBridge();
        if (bridge) {
          const sym = msg.s || msgStream.split('@')[0].toUpperCase();
          bridge.onTick(sym, {
            price: bar.close,
            volume: bar.volume,
            time: bar.time,
          });
        }
      } catch (e) { logger.data.warn('Operation failed', e); }
    }

    // ── Trade events (sub-second ticks) ──
    if (msg.e === 'trade') {
      const trade = {
        price: +msg.p,
        qty: +msg.q,
        time: msg.T,
        isBuyerMaker: msg.m,
      };

      for (const sub of this._tradeSubs.values()) {
        if (sub.streamKey === msgStream) {
          if (sub.callbacks.onTrade) sub.callbacks.onTrade(trade);
        }
      }

      // Forward to StreamingIndicatorBridge & StreamingMetrics
      try {
        const bridge = _getStreamingBridge();
        if (bridge) {
          const sym = msg.s || msgStream.split('@')[0].toUpperCase();
          bridge.onTick(sym, {
            price: trade.price,
            volume: trade.qty,
            time: trade.time,
            side: trade.isBuyerMaker ? 'sell' : 'buy',
          });
        }
      } catch (e) { logger.data.warn('Operation failed', e); }
    }
  }

  // ── 5A.1.2: Tick Buffer Access ────────────────────────────────

  /**
   * Get the tick ring buffer for a symbol.
   * Returns null if no trades have been received for that symbol yet.
   * @param {string} symbol
   * @returns {TickRingBuffer|null}
   */
  getTickBuffer(symbol) {
    const sym = (symbol || '').toUpperCase();
    return this._tickBuffers.get(sym) || null;
  }

  /** @private — Notify all subscribers of status change */
  _notifyStatus() {
    for (const sub of this._subs.values()) {
      if (sub.callbacks.onStatus) sub.callbacks.onStatus(this._status);
    }
  }

  /** @private */
  _scheduleReconnect() {
    if (this._reconnectAttempts >= this._maxReconnectAttempts) {
      logger.data.warn('[WebSocketService] Max reconnect attempts reached, giving up');
      return;
    }
    // Clear any pending reconnect timer to prevent stacking
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    const baseDelay = Math.min(1000 * Math.pow(2, this._reconnectAttempts), 30_000);
    // Phase 2 Task 2.2.3: Add jitter to prevent thundering herd on mass reconnect
    const jitter = baseDelay * (0.5 + Math.random()); // ±50% randomization
    const delay = Math.round(jitter);
    this._reconnectAttempts++;
    this._reconnectCount++;
    this._status = WS_STATUS.RECONNECTING;
    this._notifyStatus();
    this._reconnectTimer = setTimeout(() => this._connect(), delay);
  }

  // ─── Heartbeat ────────────────────────────────────────────────

  /** @private — Start 30s heartbeat ping interval */
  _startHeartbeat() {
    this._stopHeartbeat();
    this._heartbeatTimer = setInterval(() => {
      // Double-check the WS ref is still alive and fully open
      if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return;
      this._pingSentAt = Date.now();
      this._awaitingPong = true;

      let sendOk = false;
      try {
        // readyState can transition between check and send — catch the race
        if (this._ws && this._ws.readyState === WebSocket.OPEN) {
          this._ws.send(JSON.stringify({ op: 'ping' }));
          sendOk = true;
        }
      } catch (_) {
        // WS closed between readyState check and send — skip pong timeout
        this._awaitingPong = false;
      }

      // Only schedule pong timeout if the ping was actually sent
      if (sendOk) {
        // Clear any stacked pong timeout before creating a new one
        if (this._pongTimeout) {
          clearTimeout(this._pongTimeout);
          this._pongTimeout = null;
        }
        // If no pong within timeout, treat as silent disconnect
        this._pongTimeout = setTimeout(() => {
          if (this._awaitingPong) {
            logger.data.warn('[WebSocketService] Pong timeout — reconnecting');
            this._awaitingPong = false;
            this._closeWs();
            this._scheduleReconnect();
          }
        }, PONG_TIMEOUT_MS);
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  /** @private — Stop heartbeat timers */
  _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
    if (this._pongTimeout) {
      clearTimeout(this._pongTimeout);
      this._pongTimeout = null;
    }
    this._awaitingPong = false;
  }

  // ─── Connection Health ────────────────────────────────────────

  /**
   * Get connection health metrics.
   * @returns {{ latencyMs, reconnectCount, lastMessageAge, messagesReceived, status, streamCount, isStale }}
   */
  getHealthMetrics() {
    const now = Date.now();
    const lastMessageAge = this._lastMessageTime ? now - this._lastMessageTime : Infinity;
    return {
      latencyMs: this._latencyMs,
      reconnectCount: this._reconnectCount,
      lastMessageAge,
      messagesReceived: this._messagesReceived,
      status: this._status,
      streamCount: this._getActiveStreams().length,
      isStale: lastMessageAge > 5000,
    };
  }

  /** @private — Close WebSocket and clear timers */
  _closeWs() {
    this._stopHeartbeat();
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    // Clear debounce timer to prevent a pending _applyStreamDiff from reopening
    if (this._reconnectDebounce) {
      clearTimeout(this._reconnectDebounce);
      this._reconnectDebounce = null;
    }
    // Cancel any pending rAF flush
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    // Flush any remaining queued messages synchronously before closing
    if (this._pendingMessages.length > 0) {
      this._flushMessages();
    }
    if (this._ws) {
      // Null handlers BEFORE close() to prevent late callbacks ("ping after close")
      this._ws.onopen = null;
      this._ws.onmessage = null;
      this._ws.onclose = null;
      this._ws.onerror = null;
      try {
        // Close in both OPEN and CONNECTING states to prevent
        // "Ping received after close" from half-open sockets
        if (this._ws.readyState === WebSocket.OPEN ||
          this._ws.readyState === WebSocket.CONNECTING) {
          this._ws.close();
        }
      } catch (e) { logger.data.warn('Operation failed', e); }
      this._ws = null;
    }
    this._currentStreams.clear();
  }

  get status() {
    return this._status;
  }

  /** Number of active subscriptions */
  get subscriptionCount() {
    return this._subs.size;
  }

  /** Number of unique streams (= unique symbol+tf combos) on the WS */
  get streamCount() {
    return this._getActiveStreams().length;
  }
}

export const WebSocketService = _WebSocketService;
export const wsService = new _WebSocketService();
export default wsService;
