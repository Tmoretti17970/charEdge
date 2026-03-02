// ═══════════════════════════════════════════════════════════════════
// charEdge v14 — Arbitrage Monitor
//
// Monitors cross-exchange price spreads from PriceAggregator and
// generates alerts when arbitrage opportunities exceed thresholds.
//
// Features:
//   - Tracks per-exchange spread history over time
//   - Configurable threshold alerts (bps and absolute)
//   - Latency tracking per source
//   - Rolling spread statistics (mean, max, current)
//
// Usage:
//   import { arbitrageMonitor } from './ArbitrageMonitor.js';
//   arbitrageMonitor.watch('BTCUSDT');
//   arbitrageMonitor.onAlert((alert) => console.log(alert));
// ═══════════════════════════════════════════════════════════════════

const DEFAULT_CONFIG = {
  SPREAD_THRESHOLD_BPS: 10,    // Alert when spread > 10 basis points
  HISTORY_LENGTH: 100,          // Keep last 100 spread observations
  POLL_INTERVAL_MS: 1000,       // Check spreads every 1s
  ALERT_COOLDOWN_MS: 30000,     // Min 30s between alerts for same symbol
};

// ─── Spread History Entry ──────────────────────────────────────

class SpreadEntry {
  constructor(price, spread, sources, timestamp) {
    this.price = price;
    this.spread = spread;            // Absolute spread
    this.spreadBps = price > 0 ? (spread / price) * 10000 : 0; // Basis points
    this.sources = sources;          // Array of { sourceId, price }
    this.timestamp = timestamp;
  }
}

// ─── Symbol Spread Tracker ─────────────────────────────────────

class SymbolSpreadTracker {
  constructor(symbol, config) {
    this.symbol = symbol;
    this.config = config;
    this.history = [];               // SpreadEntry[]
    this.lastAlertTime = 0;
    this.maxSpreadBps = 0;
    this.cumulativeSpread = 0;
    this.entryCount = 0;
  }

  // Record a new spread observation
  record(aggResult) {
    if (!aggResult || aggResult.sourceCount < 2) return null;

    const entry = new SpreadEntry(
      aggResult.price,
      aggResult.spread,
      (aggResult.sourcesUsed || []).map(s => ({
        sourceId: s,
        price: aggResult.price, // Individual prices not exposed — use aggregate
      })),
      aggResult.timestamp || Date.now()
    );

    this.history.push(entry);
    if (this.history.length > this.config.HISTORY_LENGTH) {
      this.history.shift();
    }

    // Track stats
    this.cumulativeSpread += entry.spreadBps;
    this.entryCount++;
    if (entry.spreadBps > this.maxSpreadBps) {
      this.maxSpreadBps = entry.spreadBps;
    }

    // Check threshold
    if (entry.spreadBps >= this.config.SPREAD_THRESHOLD_BPS) {
      const now = Date.now();
      if (now - this.lastAlertTime >= this.config.ALERT_COOLDOWN_MS) {
        this.lastAlertTime = now;
        return {
          type: 'arbitrage_spread',
          symbol: this.symbol,
          spreadBps: Math.round(entry.spreadBps * 100) / 100,
          spreadAbsolute: Math.round(entry.spread * 10000) / 10000,
          price: entry.price,
          sourceCount: aggResult.sourceCount,
          sources: entry.sources,
          timestamp: now,
          severity: entry.spreadBps > this.config.SPREAD_THRESHOLD_BPS * 3 ? 'high'
            : entry.spreadBps > this.config.SPREAD_THRESHOLD_BPS * 1.5 ? 'medium'
            : 'low',
        };
      }
    }

    return null;
  }

  // Get current stats
  getStats() {
    const recent = this.history.slice(-20);
    return {
      symbol: this.symbol,
      current: this.history.length > 0 ? this.history[this.history.length - 1] : null,
      avgSpreadBps: this.entryCount > 0
        ? Math.round((this.cumulativeSpread / this.entryCount) * 100) / 100
        : 0,
      maxSpreadBps: Math.round(this.maxSpreadBps * 100) / 100,
      recentAvgBps: recent.length > 0
        ? Math.round((recent.reduce((s, e) => s + e.spreadBps, 0) / recent.length) * 100) / 100
        : 0,
      observations: this.history.length,
      history: this.history,
    };
  }
}

// ─── Arbitrage Monitor ─────────────────────────────────────────

class _ArbitrageMonitor {
  constructor(config = {}) {
    this._config = { ...DEFAULT_CONFIG, ...config };
    this._trackers = new Map();      // symbol → SymbolSpreadTracker
    this._alertCallbacks = [];
    this._aggregator = null;         // Reference to PriceAggregator
    this._pollTimer = null;
    this._watchList = new Set();
  }

  // ── Setup ────────────────────────────────────────────────────

  /**
   * Set the PriceAggregator instance to pull spread data from.
   * @param {PriceAggregator} aggregator
   */
  setAggregator(aggregator) {
    this._aggregator = aggregator;
  }

  // ── Watch / Unwatch ──────────────────────────────────────────

  /**
   * Start monitoring a symbol for arbitrage opportunities.
   * @param {string} symbol
   */
  watch(symbol) {
    const upper = symbol.toUpperCase();
    this._watchList.add(upper);
    if (!this._trackers.has(upper)) {
      this._trackers.set(upper, new SymbolSpreadTracker(upper, this._config));
    }
    this._ensurePolling();
  }

  /**
   * Stop monitoring a symbol.
   * @param {string} symbol
   */
  unwatch(symbol) {
    const upper = symbol.toUpperCase();
    this._watchList.delete(upper);
    if (this._watchList.size === 0) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  // ── Polling ──────────────────────────────────────────────────

  /** @private */
  _ensurePolling() {
    if (this._pollTimer) return;
    this._pollTimer = setInterval(() => this._poll(), this._config.POLL_INTERVAL_MS);
  }

  /** @private */
  _poll() {
    if (!this._aggregator) return;

    for (const symbol of this._watchList) {
      const aggResult = this._aggregator.aggregate(symbol);
      if (!aggResult) continue;

      const tracker = this._trackers.get(symbol);
      if (!tracker) continue;

      const alert = tracker.record(aggResult);
      if (alert) {
        this._emitAlert(alert);
      }
    }
  }

  // ── Alerts ───────────────────────────────────────────────────

  /**
   * Register an alert callback.
   * @param {Function} callback - ({ type, symbol, spreadBps, ... }) => void
   * @returns {Function} Unsubscribe function
   */
  onAlert(callback) {
    this._alertCallbacks.push(callback);
    return () => {
      this._alertCallbacks = this._alertCallbacks.filter(cb => cb !== callback);
    };
  }

  /** @private */
  _emitAlert(alert) {
    for (const cb of this._alertCallbacks) {
      try { cb(alert); } catch { /* ignore */ }
    }

    // Also dispatch a DOM event for UI integration
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('charEdge:arbitrage-alert', { detail: alert }));
    }
  }

  // ── Getters ──────────────────────────────────────────────────

  /**
   * Get spread stats for a symbol.
   * @param {string} symbol
   * @returns {Object|null}
   */
  getStats(symbol) {
    return this._trackers.get(symbol?.toUpperCase())?.getStats() || null;
  }

  /**
   * Get spread history for a symbol (for sparkline rendering).
   * @param {string} symbol
   * @returns {Array<{ spreadBps, timestamp }>}
   */
  getSpreadHistory(symbol) {
    const tracker = this._trackers.get(symbol?.toUpperCase());
    if (!tracker) return [];
    return tracker.history.map(e => ({
      spreadBps: e.spreadBps,
      timestamp: e.timestamp,
    }));
  }

  // ── Config ───────────────────────────────────────────────────

  /**
   * Update the spread threshold (basis points).
   * @param {number} bps
   */
  setThreshold(bps) {
    this._config.SPREAD_THRESHOLD_BPS = bps;
    // Propagate to existing trackers
    for (const tracker of this._trackers.values()) {
      tracker.config.SPREAD_THRESHOLD_BPS = bps;
    }
  }

  // ── Dispose ──────────────────────────────────────────────────

  dispose() {
    clearInterval(this._pollTimer);
    this._pollTimer = null;
    this._trackers.clear();
    this._watchList.clear();
    this._alertCallbacks = [];
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const arbitrageMonitor = new _ArbitrageMonitor();
export default arbitrageMonitor;
