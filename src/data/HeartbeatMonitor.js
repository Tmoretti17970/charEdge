// ═══════════════════════════════════════════════════════════════════
// charEdge — HeartbeatMonitor (Task C1.1)
//
// Data-level staleness detector. The existing WS heartbeat (30s
// ping/pong) only detects dead sockets. This watches the actual bar
// stream — if no data arrives for 90s while the socket is "alive",
// we flag the stream as stale and trigger a silent reconnect.
//
//   HeartbeatMonitor.start(wsService)
//     → hooks onBar callbacks
//     → polls every 10s
//     → emits 'stale' / 'recovered' per streamKey
//
// ═══════════════════════════════════════════════════════════════════

import { logger } from '@/observability/logger.js';

// ─── Constants ─────────────────────────────────────────────────

const DEFAULT_STALENESS_MS = 90_000;    // 90s → flag as stale
const POLL_INTERVAL_MS = 10_000;        // Check every 10s
const MIN_STALENESS_MS = 10_000;        // Floor: 10s

// ─── HeartbeatMonitor ──────────────────────────────────────────

class _HeartbeatMonitor {
  constructor() {
    /** @type {Map<string, number>} streamKey → last data timestamp */
    this._lastData = new Map();

    /** @type {Map<string, boolean>} streamKey → is currently stale? */
    this._staleStreams = new Map();

    /** @type {Set<Function>} event listeners: ({ type, streamKey, gapMs }) => void */
    this._listeners = new Set();

    /** @type {number|null} polling timer */
    this._pollTimer = null;

    /** @type {number} staleness threshold in ms */
    this._stalenessMs = DEFAULT_STALENESS_MS;

    /** @type {boolean} actively monitoring */
    this._running = false;

    /** @type {Function|null} reference to the reconnect function */
    this._reconnectFn = null;
  }

  // ── Configuration ──────────────────────────────────────────

  /**
   * Set the staleness threshold.
   * @param {number} ms - Staleness threshold in milliseconds
   */
  setStalenessThreshold(ms) {
    this._stalenessMs = Math.max(ms, MIN_STALENESS_MS);
  }

  // ── Lifecycle ──────────────────────────────────────────────

  /**
   * Start monitoring. Hooks into WebSocketService or any object with
   * a similar subscription API.
   *
   * @param {Object} [options]
   * @param {Function} [options.reconnectFn] - Called when staleness detected
   */
  start(options = {}) {
    if (this._running) return;
    this._running = true;
    this._reconnectFn = options.reconnectFn || null;

    this._pollTimer = setInterval(() => this._check(), POLL_INTERVAL_MS);
    logger.data.info('[HeartbeatMonitor] Started — staleness threshold:', this._stalenessMs + 'ms');
  }

  /**
   * Stop monitoring and clean up.
   */
  stop() {
    this._running = false;

    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }

    this._lastData.clear();
    this._staleStreams.clear();
    this._reconnectFn = null;

    logger.data.info('[HeartbeatMonitor] Stopped');
  }

  // ── Data Touch ─────────────────────────────────────────────

  /**
   * Record that data was received for a stream.
   * Call this from WS onBar / onTrade handlers.
   *
   * @param {string} streamKey - e.g. "btcusdt@kline_1h"
   */
  touch(streamKey) {
    const now = Date.now();
    this._lastData.set(streamKey, now);

    // If this stream was stale, it's recovered
    if (this._staleStreams.get(streamKey)) {
      this._staleStreams.set(streamKey, false);
      const event = { type: 'recovered', streamKey, gapMs: 0 };
      this._emit(event);
      logger.data.info(`[HeartbeatMonitor] Stream recovered: ${streamKey}`);
    }
  }

  /**
   * Remove tracking for a stream (called on unsubscribe).
   * @param {string} streamKey
   */
  untrack(streamKey) {
    this._lastData.delete(streamKey);
    this._staleStreams.delete(streamKey);
  }

  /**
   * Remove all stream tracking.
   */
  untrackAll() {
    this._lastData.clear();
    this._staleStreams.clear();
  }

  // ── Event System ───────────────────────────────────────────

  /**
   * Subscribe to heartbeat events.
   * @param {Function} listener - ({ type: 'stale'|'recovered', streamKey, gapMs }) => void
   * @returns {Function} unsubscribe function
   */
  on(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  // ── Status ─────────────────────────────────────────────────

  /**
   * Get current health status for all tracked streams.
   * @returns {Object} { streams: Map<streamKey, { lastData, stale, gapMs }>, staleCount }
   */
  getStatus() {
    const now = Date.now();
    const streams = {};
    let staleCount = 0;

    for (const [key, lastTs] of this._lastData) {
      const gapMs = now - lastTs;
      const stale = this._staleStreams.get(key) || false;
      if (stale) staleCount++;
      streams[key] = { lastData: lastTs, stale, gapMs };
    }

    return { streams, staleCount, trackedCount: this._lastData.size };
  }

  /**
   * Check if any stream is currently stale.
   * @returns {boolean}
   */
  hasStaleStreams() {
    for (const stale of this._staleStreams.values()) {
      if (stale) return true;
    }
    return false;
  }

  // ── Internal ───────────────────────────────────────────────

  /** @private */
  _check() {
    if (!this._running) return;

    const now = Date.now();
    let anyNewStale = false;

    for (const [streamKey, lastTs] of this._lastData) {
      const gapMs = now - lastTs;
      const wasStale = this._staleStreams.get(streamKey) || false;

      if (gapMs >= this._stalenessMs && !wasStale) {
        // Newly stale
        this._staleStreams.set(streamKey, true);
        anyNewStale = true;

        const event = { type: 'stale', streamKey, gapMs };
        this._emit(event);
        logger.data.warn(
          `[HeartbeatMonitor] Stream stale: ${streamKey} — no data for ${(gapMs / 1000).toFixed(0)}s`
        );
      }
    }

    // If any stream became stale, trigger reconnect
    if (anyNewStale && this._reconnectFn) {
      logger.data.warn('[HeartbeatMonitor] Triggering silent reconnect');
      try {
        this._reconnectFn();
      } catch (err) {
        logger.data.warn('[HeartbeatMonitor] Reconnect failed:', err?.message);
      }
    }
  }

  /** @private */
  _emit(event) {
    for (const listener of this._listeners) {
      try {
        listener(event);
      } catch (err) {
        logger.data.warn('[HeartbeatMonitor] Listener error:', err?.message);
      }
    }
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const HeartbeatMonitor = _HeartbeatMonitor;
export const heartbeatMonitor = new _HeartbeatMonitor();
export default heartbeatMonitor;
