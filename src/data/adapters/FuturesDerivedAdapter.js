import { logger } from '@/observability/logger';
// ═══════════════════════════════════════════════════════════════════
// charEdge v11 — Futures Derived Adapter
//
// Receives derived analytics from the Broker Bridge (Python script)
// via WebSocket. NEVER receives raw prices — only proprietary
// computations like VWAP deviation, delta, ATR, RSI, and signals.
//
// Usage:
//   import { futuresDerivedAdapter } from './FuturesDerivedAdapter.js';
//   futuresDerivedAdapter.connect();
//   futuresDerivedAdapter.subscribe('ES', (analytics) => { ... });
// ═══════════════════════════════════════════════════════════════════

const DEFAULT_BRIDGE_URL = 'ws://localhost:3000/ws/bridge';
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

class _FuturesDerivedAdapter {
  constructor() {
    this._ws = null;
    this._url = DEFAULT_BRIDGE_URL;
    this._connected = false;
    this._reconnectAttempts = 0;
    this._reconnectTimer = null;
    this._subscribers = new Map();    // symbol → Set<callback>
    this._latest = new Map();         // symbol → latest analytics
    this._onStatusChange = new Set(); // status change callbacks
  }

  // ─── Public API ─────────────────────────────────────────────

  /**
   * Connect to the Broker Bridge WebSocket.
   * @param {string} [url] - WebSocket URL override
   */
  connect(url) {
    if (url) this._url = url;
    this._doConnect();
  }

  /**
   * Disconnect from the Broker Bridge.
   */
  disconnect() {
    this._reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // Prevent auto-reconnect
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
    this._setConnected(false);
  }

  /**
   * Subscribe to derived analytics for a futures symbol.
   * @param {string} symbol - e.g., 'ES', 'NQ', 'CL', 'GC'
   * @param {Function} callback - (analytics) => void
   * @returns {Function} unsubscribe
   */
  subscribe(symbol, callback) {
    const upper = (symbol || '').toUpperCase();
    if (!this._subscribers.has(upper)) {
      this._subscribers.set(upper, new Set());
    }
    this._subscribers.get(upper).add(callback);

    // Immediately emit latest if available
    const latest = this._latest.get(upper);
    if (latest) {
      try { callback(latest); } catch (e) { logger.data.warn('Operation failed', e); }
    }

    return () => {
      const subs = this._subscribers.get(upper);
      if (subs) subs.delete(callback);
    };
  }

  /**
   * Get the latest derived analytics for a symbol.
   * @param {string} symbol
   * @returns {Object|null}
   */
  getLatest(symbol) {
    return this._latest.get((symbol || '').toUpperCase()) || null;
  }

  /**
   * Get all available symbols with analytics.
   * @returns {string[]}
   */
  getSymbols() {
    return Array.from(this._latest.keys());
  }

  /**
   * Subscribe to connection status changes.
   * @param {Function} callback - (connected: boolean) => void
   * @returns {Function} unsubscribe
   */
  onStatus(callback) {
    this._onStatusChange.add(callback);
    return () => this._onStatusChange.delete(callback);
  }

  /** @returns {boolean} */
  get connected() {
    return this._connected;
  }

  // ─── Private Methods ────────────────────────────────────────

  /** @private */
  _doConnect() {
    try {
      this._ws = new WebSocket(this._url);

      this._ws.onopen = () => {
        this._reconnectAttempts = 0;
        this._setConnected(true);
        logger.data.info('[FuturesDerivedAdapter] Connected to Broker Bridge');
      };

      this._ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.type === 'derived_analytics' && data.symbol) {
            this._handleAnalytics(data);
          }
        // eslint-disable-next-line unused-imports/no-unused-vars
        } catch (_) {
          /* ignore malformed messages */
        }
      };

      this._ws.onclose = () => {
        this._setConnected(false);
        this._attemptReconnect();
      };

      this._ws.onerror = () => {
        this._setConnected(false);
      };
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
      this._setConnected(false);
      this._attemptReconnect();
    }
  }

  /** @private */
  _handleAnalytics(data) {
    const symbol = data.symbol.toUpperCase();
    this._latest.set(symbol, data);

    // Notify subscribers
    const subs = this._subscribers.get(symbol);
    if (subs) {
      for (const cb of subs) {
        try { cb(data); } catch (e) { logger.data.warn('Operation failed', e); }
      }
    }
  }

  /** @private */
  _attemptReconnect() {
    if (this._reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;

    this._reconnectAttempts++;
    const delay = RECONNECT_DELAY * Math.min(this._reconnectAttempts, 5);

    this._reconnectTimer = setTimeout(() => {
      logger.data.info(`[FuturesDerivedAdapter] Reconnect attempt ${this._reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
      this._doConnect();
    }, delay);
  }

  /** @private */
  _setConnected(value) {
    if (this._connected === value) return;
    this._connected = value;
    for (const cb of this._onStatusChange) {
      try { cb(value); } catch (e) { logger.data.warn('Operation failed', e); }
    }
  }
}

// ─── Singleton + Exports ──────────────────────────────────────────

export const futuresDerivedAdapter = new _FuturesDerivedAdapter();

export default futuresDerivedAdapter;
