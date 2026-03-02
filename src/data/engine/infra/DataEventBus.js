// ═══════════════════════════════════════════════════════════════════
// charEdge — Data Event Bus
//
// Centralized event hub for all data-layer events. Components
// subscribe to the bus instead of individual emitters, providing
// a single point of observation for debugging, logging, and
// cross-cutting concerns like the Data Health Dashboard.
//
// Replaces scattered patterns:
//   - window.dispatchEvent('charEdge:data-warning')
//   - dataPipeline.dispatchEvent('source-change')
//   - tickerPlant EventTarget events
//   - connectionPool EventTarget events
//
// Usage:
//   import { dataEventBus } from './DataEventBus.js';
//   const unsub = dataEventBus.on('data-warning', (detail) => { ... });
//   dataEventBus.emit('source-change', { symbol: 'BTC', source: 'binance' });
//   unsub();
// ═══════════════════════════════════════════════════════════════════

// ─── Event Types ────────────────────────────────────────────────

export const DATA_EVENTS = {
  // Data pipeline events
  SOURCE_CHANGE:    'source-change',
  DATA_WARNING:     'data-warning',
  DATA_ERROR:       'data-error',

  // WebSocket events
  WS_STATUS:        'ws-status',
  WS_MESSAGE:       'ws-message',

  // Peer-to-peer events
  PEER_CONNECTED:   'peer-connected',
  PEER_DISCONNECTED:'peer-disconnected',
  PEER_STATS:       'peer-stats-update',

  // Cache events
  CACHE_HIT:        'cache-hit',
  CACHE_MISS:       'cache-miss',
  CACHE_EVICTION:   'cache-eviction',

  // Circuit breaker events
  CIRCUIT_OPEN:     'circuit-open',
  CIRCUIT_CLOSE:    'circuit-close',
  RATE_LIMITED:     'rate-limited',

  // Memory events
  MEMORY_WARNING:   'memory-warning',
  MEMORY_CRITICAL:  'memory-critical',

  // Indicator events
  INDICATOR_UPDATE: 'indicator-update',

  // Network events
  NETWORK_ONLINE:   'network-online',
  NETWORK_OFFLINE:  'network-offline',
};

// ─── Event Bus Implementation ──────────────────────────────────

class _DataEventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();

    /** @type {Array<{type: string, detail: any, timestamp: number}>} */
    this._history = [];
    this._maxHistory = 200;

    /** @type {Map<string, number>} */
    this._eventCounts = new Map();

    this._started = false;
  }

  // ─── Public API ──────────────────────────────────────────────

  /**
   * Subscribe to an event type.
   * @param {string} type - Event type from DATA_EVENTS
   * @param {Function} handler - (detail) => void
   * @returns {Function} unsubscribe function
   */
  on(type, handler) {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, new Set());
    }
    this._listeners.get(type).add(handler);
    return () => this._listeners.get(type)?.delete(handler);
  }

  /**
   * Subscribe to an event type, auto-unsubscribe after first fire.
   * @param {string} type
   * @param {Function} handler
   * @returns {Function} unsubscribe
   */
  once(type, handler) {
    const wrapped = (detail) => {
      unsub();
      handler(detail);
    };
    const unsub = this.on(type, wrapped);
    return unsub;
  }

  /**
   * Emit an event to all subscribers.
   * @param {string} type - Event type
   * @param {any} [detail] - Event payload
   */
  emit(type, detail) {
    const timestamp = Date.now();

    // Track event counts
    this._eventCounts.set(type, (this._eventCounts.get(type) || 0) + 1);

    // Store in history (bounded ring buffer)
    this._history.push({ type, detail, timestamp });
    if (this._history.length > this._maxHistory) {
      this._history.shift();
    }

    // Dispatch to listeners
    const handlers = this._listeners.get(type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(detail);
        } catch (err) {
          console.warn(`[DataEventBus] Handler error for '${type}':`, err);
        }
      }
    }

    // Also dispatch to wildcard listeners
    const wildcardHandlers = this._listeners.get('*');
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        try {
          handler({ type, detail, timestamp });
        } catch { /* silent */ }
      }
    }
  }

  /**
   * Start listening for native window events and proxying them.
   * Call once at app boot.
   */
  start() {
    if (this._started || typeof window === 'undefined') return;
    this._started = true;

    // Proxy native charEdge:* window events into the bus
    window.addEventListener('charEdge:data-warning', (e) => {
      this.emit(DATA_EVENTS.DATA_WARNING, e.detail);
    });

    window.addEventListener('charEdge:arbitrage-alert', (e) => {
      this.emit('arbitrage-alert', e.detail);
    });

    // Network detection
    window.addEventListener('online', () => {
      this.emit(DATA_EVENTS.NETWORK_ONLINE);
    });

    window.addEventListener('offline', () => {
      this.emit(DATA_EVENTS.NETWORK_OFFLINE);
    });
  }

  // ─── Diagnostics ─────────────────────────────────────────────

  /**
   * Get event history (most recent first).
   * @param {string} [type] - Optional filter by type
   * @param {number} [limit=50]
   * @returns {Array}
   */
  getHistory(type, limit = 50) {
    let filtered = this._history;
    if (type) {
      filtered = filtered.filter(e => e.type === type);
    }
    return filtered.slice(-limit).reverse();
  }

  /**
   * Get event count statistics.
   * @returns {Object} { type: count, ... }
   */
  getStats() {
    const stats = {};
    for (const [type, count] of this._eventCounts) {
      stats[type] = count;
    }
    stats._totalListeners = 0;
    for (const handlers of this._listeners.values()) {
      stats._totalListeners += handlers.size;
    }
    stats._historySize = this._history.length;
    return stats;
  }

  /**
   * Remove all listeners for a given type, or all listeners if no type given.
   * @param {string} [type]
   */
  off(type) {
    if (type) {
      this._listeners.delete(type);
    } else {
      this._listeners.clear();
    }
  }

  /**
   * Dispose — clear everything.
   */
  dispose() {
    this._listeners.clear();
    this._history.length = 0;
    this._eventCounts.clear();
    this._started = false;
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const dataEventBus = new _DataEventBus();
export { _DataEventBus };
export default dataEventBus;
