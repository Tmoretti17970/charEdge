// ═══════════════════════════════════════════════════════════════════
// charEdge v16 — WebSocketService (Multiplexed + Incremental)
//
// Uses Binance combined streams to multiplex all symbol subscriptions
// onto a single WebSocket connection instead of one WS per symbol.
// Stream changes use runtime SUBSCRIBE/UNSUBSCRIBE messages to avoid
// full teardown/reconnect (eliminates data gaps during symbol changes).
//
// Sprint 9 #69: Constants, helpers, and lazy imports extracted to ws/.
//   - ws/constants.ts    — WS_STATUS, TF_MAP, symbol helpers, security
//   - ws/lazyImports.ts  — Lazy BinaryCodec + StreamingBridge
// ═══════════════════════════════════════════════════════════════════

import { TickRingBuffer } from './engine/streaming/TickRingBuffer.ts';
import { logger } from '@/observability/logger';

// Sprint 9 #69: Import from extracted ws/ modules
import {
  WS_STATUS, streamKey, tradeStreamKey,
  HEARTBEAT_INTERVAL_MS, PONG_TIMEOUT_MS, ALLOWED_WS_HOSTS,
  isStreamingSupported
} from './ws/constants.ts';
import { getBinaryCodec, getStreamingBridge } from './ws/lazyImports.ts';
// #14: Wire RTT into heartbeat — feed ping/pong to connectionQuality
import { connectionQuality } from './connectionQuality';

// Re-export WS_STATUS for backward compatibility
export { WS_STATUS };

// Alias lazy imports to match original local variable names
const _getBinaryCodec = getBinaryCodec;
const _getStreamingBridge = getStreamingBridge;

let _nextSubId = 1;

// eslint-disable-next-line @typescript-eslint/naming-convention
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

    // ── P1 Task B1: Latest-wins message map ──
    // Only the most recent message per stream survives rAF throttling.
    // Replaces unbounded array to prevent backpressure buildup.
    /** @type {Map<string, Object>} */
    this._pendingMessages = new Map();
    this._rafId = null;

    // ── P1 Task P2: Subscriber stream indexes ──
    // O(1) dispatch lookup instead of iterating all subs per message.
    /** @type {Map<string, Set<number>>} */
    this._klineSubsByStream = new Map();
    /** @type {Map<string, Set<number>>} */
    this._tradeSubsByStream = new Map();

    // ── Task 2.3.16: Pre-allocated scratch objects (zero-alloc hot path) ──
    this._scratchBar = { time: 0, open: 0, high: 0, low: 0, close: 0, volume: 0, isClosed: false };
    this._scratchTrade = { price: 0, qty: 0, time: 0, isBuyerMaker: false };
    this._scratchBridgeTick = { price: 0, volume: 0, time: 0, side: '' };

    // ── P2 1.4: Last known prices for sanity checking ──
    /** @type {Map<string, number>} */
    this._lastKnownPrice = new Map();

    // ── P1 Task R5: Drop stale queue on tab return ──
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this._pendingMessages.clear();
          if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
          }
        }
      });
    }
  }

  static isSupported(symbol) {
    return isStreamingSupported(symbol);
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

    // P1 Task P2: Update stream index
    if (!this._klineSubsByStream.has(key)) this._klineSubsByStream.set(key, new Set());
    this._klineSubsByStream.get(key).add(subId);

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

    // P1 Task P2: Update stream index
    if (!this._tradeSubsByStream.has(key)) this._tradeSubsByStream.set(key, new Set());
    this._tradeSubsByStream.get(key).add(subId);

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

    // P1 Task P2: Update stream index
    if (!this._klineSubsByStream.has(key)) this._klineSubsByStream.set(key, new Set());
    this._klineSubsByStream.get(key).add(subId);

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
      // P1 Task P2: Remove from stream indexes before deleting
      const klineSub = this._subs.get(subId);
      if (klineSub) {
        const idx = this._klineSubsByStream.get(klineSub.streamKey);
        if (idx) { idx.delete(subId); if (idx.size === 0) this._klineSubsByStream.delete(klineSub.streamKey); }
      }
      const tradeSub = this._tradeSubs.get(subId);
      if (tradeSub) {
        const idx = this._tradeSubsByStream.get(tradeSub.streamKey);
        if (idx) { idx.delete(subId); if (idx.size === 0) this._tradeSubsByStream.delete(tradeSub.streamKey); }
      }
      this._subs.delete(subId);
      this._tradeSubs.delete(subId);
    } else {
      // Legacy: unsubscribe everything
      this._subs.clear();
      this._tradeSubs.clear();
      this._klineSubsByStream.clear();
      this._tradeSubsByStream.clear();
    }

    const totalSubs = this._subs.size + this._tradeSubs.size;
    if (totalSubs === 0) {
      this._intentionalClose = true;
      this._closeWs();
    } else {
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

      // P2 1.4: Hostname pinning — reject connections to unknown hosts
      try {
        const hostname = new URL(url).hostname;
        if (!ALLOWED_WS_HOSTS.has(hostname)) {
          logger.data.warn(`[WebSocketService] Blocked connection to disallowed host: ${hostname}`);
          this._status = WS_STATUS.DISCONNECTED;
          this._notifyStatus();
          return;
        }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (__urlErr) {
        logger.data.warn('[WebSocketService] Invalid WebSocket URL');
        this._status = WS_STATUS.DISCONNECTED;
        this._notifyStatus();
        return;
      }

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

          // ── Subscription response (SUBSCRIBE/UNSUBSCRIBE ack) ──
          if (wrapper.id !== undefined && wrapper.result !== undefined) {
            return;
          }

          const msgStream = wrapper.stream;
          const msg = wrapper.data;
          if (!msg) return;

          // Update health metrics (always immediate)
          this._lastMessageTime = Date.now();
          this._messagesReceived++;

          // #14: Record data arrival as proxy-pong for RTT measurement
          connectionQuality.recordPong();

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

          // ── P1 Task B1: Latest-wins — overwrite previous msg for same stream ──
          this._pendingMessages.set(msgStream, msg);
          if (!this._rafId) {
            this._rafId = requestAnimationFrame(() => this._flushMessages());
          }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_) {
          /* ignore parse errors */
        }
      };

      this._ws.onclose = () => {
        this._status = WS_STATUS.DISCONNECTED;
        this._notifyStatus();
        // A1.2: Include _tradeSubs in reconnect check — trade-only streams must also reconnect
        if (!this._intentionalClose && (this._subs.size + this._tradeSubs.size) > 0) {
          this._scheduleReconnect();
        }
      };

      this._ws.onerror = () => {
        this._status = WS_STATUS.DISCONNECTED;
        this._notifyStatus();
        // onclose will fire after onerror, reconnect handled there
      };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
      this._status = WS_STATUS.DISCONNECTED;
      this._notifyStatus();
      // A1.2: Include _tradeSubs in reconnect check
      if (!this._intentionalClose && (this._subs.size + this._tradeSubs.size) > 0) {
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
    if (batch.size === 0) return;

    // P1 Task B1: Iterate latest-wins map
    for (const [msgStream, msg] of batch) {
      this._dispatchMessage(msgStream, msg);
    }
    batch.clear();
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
      // Task 2.3.16: Write to pre-allocated scratch bar (zero-alloc)
      const bar = this._scratchBar;
      bar.time = k.t;
      bar.open = +k.o;
      bar.high = +k.h;
      bar.low = +k.l;
      bar.close = +k.c;
      bar.volume = +k.v;
      bar.isClosed = k.x;

      // P2 1.4: Price sanity check — reject zero, negative, or extreme spikes
      const sym = msg.s || msgStream.split('@')[0].toUpperCase();
      if (!this._isReasonablePrice(bar.close, sym)) {
        logger.data.warn(`[WebSocketService] Rejected unreasonable price ${bar.close} for ${sym}`);
        return;
      }
      this._lastKnownPrice.set(sym, bar.close);

      // P1 Task P2: O(1) lookup via stream index
      const klineSubIds = this._klineSubsByStream.get(msgStream);
      if (klineSubIds) {
        for (const subId of klineSubIds) {
          const sub = this._subs.get(subId);
          if (sub) {
            if (sub.callbacks.onBar) sub.callbacks.onBar(bar);
            if (sub.callbacks.onCandle) sub.callbacks.onCandle(bar);
          }
        }
      }

      try {
        const bridge = _getStreamingBridge();
        if (bridge) {
          const sym = msg.s || msgStream.split('@')[0].toUpperCase();
          // Task 2.3.16: Reuse scratch tick object
          const tick = this._scratchBridgeTick;
          tick.price = bar.close;
          tick.volume = bar.volume;
          tick.time = bar.time;
          tick.side = '';
          bridge.onTick(sym, tick);
        }
      } catch (e) { logger.data.warn('Operation failed', e); }
    }

    // ── Trade events (sub-second ticks) ──
    if (msg.e === 'trade') {
      // Task 2.3.16: Write to pre-allocated scratch trade (zero-alloc)
      const trade = this._scratchTrade;
      trade.price = +msg.p;
      trade.qty = +msg.q;
      trade.time = msg.T;
      trade.isBuyerMaker = msg.m;

      // P1 Task P2: O(1) lookup via stream index
      const tradeSubIds = this._tradeSubsByStream.get(msgStream);
      if (tradeSubIds) {
        for (const subId of tradeSubIds) {
          const sub = this._tradeSubs.get(subId);
          if (sub && sub.callbacks.onTrade) sub.callbacks.onTrade(trade);
        }
      }

      // Forward to StreamingIndicatorBridge & StreamingMetrics
      try {
        const bridge = _getStreamingBridge();
        if (bridge) {
          const sym = msg.s || msgStream.split('@')[0].toUpperCase();
          // Task 2.3.16: Reuse scratch tick object
          const tick = this._scratchBridgeTick;
          tick.price = trade.price;
          tick.volume = trade.qty;
          tick.time = trade.time;
          tick.side = trade.isBuyerMaker ? 'sell' : 'buy';
          bridge.onTick(sym, tick);
        }
      } catch (e) { logger.data.warn('Operation failed', e); }
    }
  }

  // ── P2 1.4: Price sanity check ──────────────────────────────────

  /**
   * Check if a price is reasonable by comparing against last known price.
   * Rejects zero, negative, or >100× jump from last known price.
   * First tick for a symbol is always accepted.
   * @private
   */
  _isReasonablePrice(price, symbol) {
    if (price <= 0) return false;
    const lastPrice = this._lastKnownPrice.get(symbol);
    if (!lastPrice) return true; // First tick — accept
    const ratio = price / lastPrice;
    return ratio > 0.01 && ratio < 100; // Reject >100× spike or >99% crash
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
    // A1.3: Notify trade-stream subscribers too — prevents stale UI health indicators
    for (const sub of this._tradeSubs.values()) {
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
  //
  // Previous implementation sent { op: 'ping' } which Binance silently
  // ignores (it uses native WebSocket ping/pong frames at the protocol
  // level, not JSON application-level pings). This meant the heartbeat
  // was a no-op — we had NO disconnect detection.
  //
  // New approach: Data-staleness monitoring. If we receive no data
  // messages within HEARTBEAT_INTERVAL_MS, the connection is likely
  // dead. After an additional PONG_TIMEOUT_MS grace period, reconnect.
  // This works for ANY WebSocket provider, not just Binance.

  /** @private — Start data-staleness heartbeat monitor */
  _startHeartbeat() {
    this._stopHeartbeat();
    this._lastMessageTime = Date.now(); // Reset on fresh connection
    this._heartbeatTimer = setInterval(() => {
      // Double-check the WS ref is still alive and fully open
      if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return;

      const now = Date.now();
      const staleness = now - this._lastMessageTime;

      // Data has arrived recently — connection is healthy
      if (staleness < HEARTBEAT_INTERVAL_MS) return;

      // #14: Record heartbeat as proxy-ping for RTT measurement
      connectionQuality.recordPing();

      // No data for 30s — connection may be dead.
      // Wait an additional PONG_TIMEOUT_MS grace period.
      if (staleness > HEARTBEAT_INTERVAL_MS + PONG_TIMEOUT_MS) {
        logger.data.warn(
          `[WebSocketService] Data stale for ${Math.round(staleness / 1000)}s — reconnecting`
        );
        this._closeWs();
        this._scheduleReconnect();
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  /** @private — Stop heartbeat timers */
  _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
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
    if (this._pendingMessages.size > 0) {
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
