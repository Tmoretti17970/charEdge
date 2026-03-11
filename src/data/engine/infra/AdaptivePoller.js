// ═══════════════════════════════════════════════════════════════════
// charEdge v14 — Adaptive Poller
//
// Intelligent polling-rate controller that adjusts REST API polling
// frequency based on:
//   - Market hours (US equities: 9:30-16:00 ET)
//   - Asset class (crypto=always, equities=market hours only)
//   - Tab visibility (reduce polling when tab is hidden)
//   - Data priority (visible charts poll faster than watchlist)
//
// Usage:
//   import { adaptivePoller } from './AdaptivePoller.js';
//   const id = adaptivePoller.schedule('AAPL', () => fetchQuote('AAPL'), 'visible');
//   adaptivePoller.cancel(id);
// ═══════════════════════════════════════════════════════════════════

import { isCrypto } from '../../../constants.js';
import { logger } from '@/observability/logger';
import { isMarketOpen as _isMarketOpen } from '@/shared/marketHours';

// MARKET_HOURS config removed — now uses shared marketHours.js utility
// which includes holiday awareness and extended-hours detection.

// ─── Polling Intervals (ms) ────────────────────────────────────

const INTERVALS = {
  // Visible chart — highest priority
  // (WS provides real-time; REST is SWR backup only)
  visible: {
    marketOpen: 5000,     // 5s during market hours (was 2s — WS covers real-time)
    marketClosed: 30000,  // 30s after hours
    crypto: 5000,         // 5s for crypto (was 3s — Binance WS covers real-time)
    hidden: 15000,        // 15s when tab is hidden
  },
  // Watchlist item — medium priority
  watchlist: {
    marketOpen: 5000,     // 5s during market hours
    marketClosed: 60000,  // 60s after hours
    crypto: 10000,        // 10s for crypto
    hidden: 60000,        // 60s when tab is hidden
  },
  // Background/prefetch — lowest priority
  background: {
    marketOpen: 15000,    // 15s during market hours
    marketClosed: 120000, // 2 min after hours
    crypto: 30000,        // 30s for crypto
    hidden: 120000,       // 2 min when tab is hidden
  },
};

// ─── Helpers ───────────────────────────────────────────────────

function isUSMarketOpen() {
  return _isMarketOpen();
}

// isCryptoSymbol removed — use isCrypto() from constants.js

function isTabVisible() {
  return typeof document !== 'undefined' ? !document.hidden : true;
}

// ─── Adaptive Poller Class ─────────────────────────────────────

class _AdaptivePoller {
  constructor() {
    this._tasks = new Map();        // taskId → { symbol, callback, priority, timerId }
    this._dedupMap = new Map();     // 'symbol:priority' → taskId (1B.9: dedup)
    this._nextId = 1;
    this._cachedMarketOpen = null;
    this._marketCheckInterval = null;

    // Listen for visibility changes
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => this._onVisibilityChange());
    }

    // Periodically re-check market hours (every 60s)
    this._marketCheckInterval = setInterval(() => {
      const wasOpen = this._cachedMarketOpen;
      this._cachedMarketOpen = isUSMarketOpen();
      if (wasOpen !== this._cachedMarketOpen) {
        this._rescheduleAll();
      }
    }, 60000);

    this._cachedMarketOpen = isUSMarketOpen();
  }

  // ── Schedule a Polling Task ──────────────────────────────────

  /**
   * Schedule a recurring poll for a symbol.
   *
   * @param {string} symbol - The symbol being polled
   * @param {Function} callback - The polling function to call
   * @param {'visible'|'watchlist'|'background'} priority - Polling priority tier
   * @returns {number} Task ID (for cancellation)
   */
  schedule(symbol, callback, priority = 'visible') {
    // Task 1B.9: Dedup — if this symbol+priority combo already has a task, 
    // cancel the old one and replace with this one (prevents double-polling
    // when a symbol is on both visible chart AND watchlist).
    const dedupKey = `${symbol}:${priority}`;
    if (this._dedupMap.has(dedupKey)) {
      const existingId = this._dedupMap.get(dedupKey);
      if (this._tasks.has(existingId)) {
        // Already polling this symbol at this priority — skip
        return existingId;
      }
      // Stale entry — clean up
      this._dedupMap.delete(dedupKey);
    }

    const id = this._nextId++;
    const interval = this._getInterval(symbol, priority);

    const timerId = setInterval(() => {
      try { callback(); } catch (err) {
        logger.data.warn(`[AdaptivePoller] Poll error for ${symbol}:`, err.message);
      }
    }, interval);

    this._tasks.set(id, {
      symbol,
      callback,
      priority,
      timerId,
      interval,
      lastPoll: Date.now(),
    });
    this._dedupMap.set(dedupKey, id);

    // Execute immediately on first schedule
    try { callback(); } catch (e) { logger.data.warn('Operation failed', e); }

    return id;
  }

  // ── Cancel a Polling Task ────────────────────────────────────

  /**
   * Cancel a previously scheduled polling task.
   * @param {number} taskId
   */
  cancel(taskId) {
    const task = this._tasks.get(taskId);
    if (task) {
      clearInterval(task.timerId);
      this._tasks.delete(taskId);
      // Clean dedup map
      const dedupKey = `${task.symbol}:${task.priority}`;
      if (this._dedupMap.get(dedupKey) === taskId) {
        this._dedupMap.delete(dedupKey);
      }
    }
  }

  // ── Update Priority ──────────────────────────────────────────

  /**
   * Update the priority of an existing task (e.g., when switching tabs).
   * @param {number} taskId
   * @param {'visible'|'watchlist'|'background'} priority
   */
  setPriority(taskId, priority) {
    const task = this._tasks.get(taskId);
    if (!task) return;
    task.priority = priority;
    this._rescheduleTask(taskId, task);
  }

  // ── Interval Calculation ─────────────────────────────────────

  /** @private */
  _getInterval(symbol, priority) {
    const tier = INTERVALS[priority] || INTERVALS.visible;

    if (!isTabVisible()) return tier.hidden;
    if (isCrypto(symbol)) return tier.crypto;
    if (this._cachedMarketOpen) return tier.marketOpen;
    return tier.marketClosed;
  }

  // ── Rescheduling ─────────────────────────────────────────────

  /** @private */
  _rescheduleTask(taskId, task) {
    clearInterval(task.timerId);
    const newInterval = this._getInterval(task.symbol, task.priority);

    task.interval = newInterval;
    task.timerId = setInterval(() => {
      try { task.callback(); } catch (err) {
        logger.data.warn(`[AdaptivePoller] Poll error for ${task.symbol}:`, err.message);
      }
    }, newInterval);
  }

  /** @private */
  _rescheduleAll() {
    for (const [id, task] of this._tasks) {
      this._rescheduleTask(id, task);
    }
  }

  /** @private */
  _onVisibilityChange() {
    this._rescheduleAll();
  }

  // ── Status ───────────────────────────────────────────────────

  /**
   * Get current polling status for all tasks.
   * @returns {Array<{ taskId, symbol, priority, interval }>}
   */
  getStatus() {
    const status = [];
    for (const [id, task] of this._tasks) {
      status.push({
        taskId: id,
        symbol: task.symbol,
        priority: task.priority,
        interval: task.interval,
        lastPoll: task.lastPoll,
      });
    }
    return status;
  }

  /**
   * Get whether the US equity market is currently open.
   */
  get isMarketOpen() {
    return this._cachedMarketOpen;
  }

  // ── Dispose ──────────────────────────────────────────────────

  dispose() {
    for (const [, task] of this._tasks) {
      clearInterval(task.timerId);
    }
    this._tasks.clear();
    this._dedupMap.clear();
    clearInterval(this._marketCheckInterval);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._onVisibilityChange);
    }
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const adaptivePoller = new _AdaptivePoller();
export default adaptivePoller;
