// ═══════════════════════════════════════════════════════════════════
// charEdge v16 — WebSocket Failover
//
// Wraps two WebSocketService instances for automatic failover.
// Primary connects first; standby connects after 2s as warm backup.
// Automatically switches when primary degrades.
//
// Opt-in: only activates when localStorage 'charEdge:dualWs' === 'true'.
//
// Usage:
//   import { wsFailover } from './WebSocketFailover.js';
//   wsFailover.subscribe('BTC', '1h', { onCandle, onTick, onStatus });
//   wsFailover.getHealthMetrics(); // combined health for both connections
// ═══════════════════════════════════════════════════════════════════

import { WebSocketService as WSClass, WS_STATUS } from './WebSocketService';
import { logger } from '@/observability/logger';

// ─── Config ────────────────────────────────────────────────────
const STANDBY_DELAY_MS = 2_000; // Delay before standby connects
const HEALTH_CHECK_INTERVAL_MS = 5_000; // Check health every 5s
const LATENCY_THRESHOLD_MS = 2_000; // Switch if primary latency > 2s
const STALENESS_THRESHOLD_MS = 10_000; // Switch if no message in 10s

/**
 * Dual-connection failover wrapper.
 * Maintains a primary and standby WebSocket connection and automatically
 * switches when the primary connection degrades.
 */
class _WebSocketFailover {
  constructor() {
    this._enabled = false;
    this._primary = null;
    this._standby = null;
    this._active = null; // Points to whichever is currently active

    /** @type {Map<number, { args: Array, type: string }>} */
    this._subscriptions = new Map(); // Track all subs so standby can mirror

    this._healthCheckTimer = null;
    this._standbyTimer = null;

    this._switchCount = 0;
    this._switching = false; // Lock flag during connection switch
    this._pendingQueue = []; // Queue subs arriving during switch

    // Check opt-in
    try {
      this._enabled = typeof localStorage !== 'undefined' && localStorage.getItem('charEdge:dualWs') === 'true';
      // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
      /* SSR safe */
    }
  }

  /**
   * Initialize connections.
   * @private
   */
  _init() {
    if (this._primary) return;

    this._primary = new WSClass();
    this._active = this._primary;

    if (this._enabled) {
      this._standby = new WSClass();

      // Connect standby after delay
      this._standbyTimer = setTimeout(() => {
        this._mirrorSubscriptions(this._standby);
      }, STANDBY_DELAY_MS);

      // Start health monitoring
      this._startHealthCheck();
    }
  }

  /**
   * Subscribe to a symbol+timeframe stream.
   * @param {string} symbol
   * @param {string} tf
   * @param {Object} callbacks
   * @returns {number} subscriptionId
   */
  subscribe(symbol, tf, callbacks = {}) {
    if (!this._primary) this._init();

    // Queue subscriptions during a connection switch to prevent race condition
    if (this._switching) {
      const deferred = { type: 'kline', args: [symbol, tf, callbacks] };
      this._pendingQueue.push(deferred);
      // Return a temporary ID; will be re-subscribed when switch completes
      return -1;
    }

    const subId = this._active.subscribe(symbol, tf, callbacks);
    this._subscriptions.set(subId, { args: [symbol, tf, callbacks], type: 'kline' });

    // Mirror to standby if enabled
    if (this._enabled && this._standby && this._standby !== this._active) {
      this._standby.subscribe(symbol, tf, {}); // standby gets data but callbacks go to /dev/null
    }

    return subId;
  }

  /**
   * Subscribe to raw trade stream.
   * @param {string} symbol
   * @param {Object} callbacks
   * @returns {number} subscriptionId
   */
  subscribeTrades(symbol, callbacks = {}) {
    if (!this._primary) this._init();

    // Queue during switch
    if (this._switching) {
      this._pendingQueue.push({ type: 'trade', args: [symbol, callbacks] });
      return -1;
    }

    const subId = this._active.subscribeTrades(symbol, callbacks);
    this._subscriptions.set(subId, { args: [symbol, callbacks], type: 'trade' });

    if (this._enabled && this._standby && this._standby !== this._active) {
      this._standby.subscribeTrades(symbol, {});
    }

    return subId;
  }

  /**
   * Unsubscribe.
   * @param {number} [subId]
   */
  unsubscribe(subId) {
    if (subId !== undefined) {
      this._subscriptions.delete(subId);
    } else {
      this._subscriptions.clear();
    }

    if (this._active) this._active.unsubscribe(subId);
    if (this._enabled && this._standby && this._standby !== this._active) {
      this._standby.unsubscribe(subId);
    }
  }

  /**
   * Get health metrics from the active connection.
   * @returns {Object}
   */
  getHealthMetrics() {
    if (!this._active) return { status: WS_STATUS.DISCONNECTED, isDualMode: this._enabled };

    const primary = this._primary?.getHealthMetrics() || {};
    const standby = this._enabled && this._standby ? this._standby.getHealthMetrics() : null;

    return {
      ...primary,
      isDualMode: this._enabled,
      switchCount: this._switchCount,
      standby: standby
        ? {
            status: standby.status,
            latencyMs: standby.latencyMs,
            isStale: standby.isStale,
          }
        : null,
    };
  }

  get status() {
    return this._active ? this._active.status : WS_STATUS.DISCONNECTED;
  }

  /**
   * @private — Mirror all active subscriptions onto a target WS instance.
   */
  _mirrorSubscriptions(target) {
    for (const [, sub] of this._subscriptions) {
      if (sub.type === 'kline') {
        target.subscribe(sub.args[0], sub.args[1], {});
      } else if (sub.type === 'trade') {
        target.subscribeTrades(sub.args[0], {});
      }
    }
  }

  /**
   * @private — Start periodic health checking.
   */
  _startHealthCheck() {
    this._healthCheckTimer = setInterval(() => {
      if (!this._primary || !this._standby) return;

      const primaryHealth = this._primary.getHealthMetrics();
      const standbyHealth = this._standby.getHealthMetrics();

      const primaryDegraded =
        primaryHealth.latencyMs > LATENCY_THRESHOLD_MS ||
        primaryHealth.lastMessageAge > STALENESS_THRESHOLD_MS ||
        primaryHealth.status === WS_STATUS.DISCONNECTED;

      const standbyHealthy =
        standbyHealth.status === WS_STATUS.CONNECTED &&
        standbyHealth.latencyMs < LATENCY_THRESHOLD_MS &&
        !standbyHealth.isStale;

      // Switch if primary is degraded and standby is healthy
      if (primaryDegraded && standbyHealthy && this._active === this._primary) {
        this._switchTo(this._standby);
      }

      // Switch back if primary recovered and is better than standby
      if (!primaryDegraded && this._active === this._standby) {
        const standbyDegraded =
          standbyHealth.latencyMs > LATENCY_THRESHOLD_MS || standbyHealth.lastMessageAge > STALENESS_THRESHOLD_MS;

        if (standbyDegraded) {
          this._switchTo(this._primary);
        }
      }
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  /**
   * @private — Switch active connection and re-wire callbacks.
   */
  _switchTo(target) {
    if (target === this._active) return;

    logger.data.warn(`[WebSocketFailover] Switching to ${target === this._primary ? 'primary' : 'standby'}`);
    this._switchCount++;
    this._switching = true; // Lock: queue any new subs arriving during switch

    // Re-subscribe with real callbacks on the new active
    const old = this._active;
    this._active = target;

    // A1.4: Clear standby's placeholder subs ONCE before re-subscribing all.
    target.unsubscribe();
    for (const [_subId, sub] of this._subscriptions) {
      if (sub.type === 'kline') {
        target.subscribe(sub.args[0], sub.args[1], sub.args[2]);
      } else if (sub.type === 'trade') {
        target.subscribeTrades(sub.args[0], sub.args[1]);
      }
    }

    // Demote old to standby (empty callbacks)
    old.unsubscribe();
    this._mirrorSubscriptions(old);

    this._switching = false; // Unlock

    // Drain any subscriptions that arrived during the switch
    if (this._pendingQueue.length > 0) {
      const queued = this._pendingQueue.splice(0);
      for (const pending of queued) {
        if (pending.type === 'kline') {
          this.subscribe(pending.args[0], pending.args[1], pending.args[2]);
        } else if (pending.type === 'trade') {
          this.subscribeTrades(pending.args[0], pending.args[1]);
        }
      }
    }
  }

  /**
   * Dispose of all resources.
   */
  dispose() {
    if (this._healthCheckTimer) {
      clearInterval(this._healthCheckTimer);
      this._healthCheckTimer = null;
    }
    if (this._standbyTimer) {
      clearTimeout(this._standbyTimer);
      this._standbyTimer = null;
    }
    if (this._primary) {
      this._primary.unsubscribe();
      this._primary = null;
    }
    if (this._standby) {
      this._standby.unsubscribe();
      this._standby = null;
    }
    this._active = null;
    this._subscriptions.clear();
  }
}

export const WebSocketFailover = _WebSocketFailover;
export const wsFailover = new _WebSocketFailover();
export default wsFailover;
