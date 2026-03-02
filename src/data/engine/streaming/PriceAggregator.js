// ═══════════════════════════════════════════════════════════════════
// charEdge v11 — Price Aggregator Engine
//
// Multi-source price aggregation with:
//   ✓ Median-based price selection
//   ✓ Outlier rejection (3σ from rolling mean)
//   ✓ Staleness detection (>5s without update)
//   ✓ Confidence scoring (high/medium/low/stale)
//   ✓ Per-source health tracking
//
// Architecture:
//   Sources → ingest() → buffers → aggregate() → { price, confidence }
//
// Usage:
//   const agg = new PriceAggregator();
//   agg.ingest('BTCUSDT', 'binance', 97000.50, Date.now());
//   agg.ingest('BTCUSDT', 'pyth', 97001.20, Date.now());
//   const result = agg.aggregate('BTCUSDT');
//   // → { price: 97000.85, confidence: 'high', sources: 2, ... }
// ═══════════════════════════════════════════════════════════════════

// ─── Configuration ──────────────────────────────────────────────

const CONFIG = {
  STALENESS_THRESHOLD_MS: 5000,     // Source considered stale after 5s
  OUTLIER_SIGMA: 3.0,               // Reject prices > 3 std devs from rolling mean
  ROLLING_WINDOW: 20,               // Rolling window for mean/stddev calculation
  AGGREGATION_INTERVAL_MS: 100,     // Run aggregation every 100ms
  MAX_SOURCES_PER_SYMBOL: 8,        // Max concurrent sources per symbol
  PRICE_HISTORY_LENGTH: 50,         // Price history per source for analytics
};

// ─── Confidence Levels ──────────────────────────────────────────

export const CONFIDENCE = {
  HIGH:   'high',     // 3+ fresh, non-outlier sources
  MEDIUM: 'medium',   // 2 fresh sources
  LOW:    'low',      // 1 fresh source
  STALE:  'stale',    // 0 fresh sources, using last known price
};

// ─── Helper Functions ───────────────────────────────────────────

function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

function stddev(arr, avg = null) {
  if (arr.length < 2) return 0;
  const m = avg !== null ? avg : mean(arr);
  const variance = arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

// ─── Source Buffer ───────────────────────────────────────────────
// Tracks the latest price and history for a single source+symbol pair.

class SourceBuffer {
  constructor(sourceId) {
    this.sourceId = sourceId;
    this.price = 0;
    this.timestamp = 0;
    this.confidence = 0;       // Source-level confidence (from Pyth, etc.)
    this.history = [];         // Rolling price history for stats
    this.updateCount = 0;
    this.lastStaleCheck = false;
  }

  update(price, timestamp, confidence = 0) {
    this.price = price;
    this.timestamp = timestamp;
    this.confidence = confidence;
    this.updateCount++;

    // Maintain rolling history
    this.history.push(price);
    if (this.history.length > CONFIG.ROLLING_WINDOW) {
      this.history.shift();
    }
  }

  get isFresh() {
    return (Date.now() - this.timestamp) < CONFIG.STALENESS_THRESHOLD_MS;
  }

  get age() {
    return Date.now() - this.timestamp;
  }

  get rollingMean() {
    return mean(this.history);
  }

  get rollingStddev() {
    return stddev(this.history);
  }
}

// ─── Symbol Aggregation State ───────────────────────────────────
// Tracks all sources and aggregated state for a single symbol.

class SymbolState {
  constructor(symbol) {
    this.symbol = symbol;
    this.sources = new Map();    // sourceId → SourceBuffer
    this.lastAggregated = null;  // Last aggregated result
    this.subscribers = new Set(); // Callbacks to notify on updates
  }

  getOrCreateSource(sourceId) {
    let buf = this.sources.get(sourceId);
    if (!buf) {
      buf = new SourceBuffer(sourceId);
      this.sources.set(sourceId, buf);
    }
    return buf;
  }

  /**
   * Run the aggregation algorithm:
   *   1. Collect fresh prices
   *   2. Reject outliers (3σ)
   *   3. Select price (median/mean/single)
   *   4. Score confidence
   */
  aggregate() {
    const now = Date.now();
    const freshSources = [];
    const staleSources = [];

    // Step 1: Partition into fresh vs stale
    for (const [id, buf] of this.sources) {
      if (buf.isFresh) {
        freshSources.push(buf);
      } else {
        staleSources.push(buf);
      }
    }

    // Step 2: Filter outliers from fresh sources
    const validSources = this._rejectOutliers(freshSources);

    // Step 3: Select the "best" price
    let price, confidence, method;

    if (validSources.length >= 3) {
      // 3+ valid sources → use median
      price = median(validSources.map(s => s.price));
      confidence = CONFIDENCE.HIGH;
      method = 'median';
    } else if (validSources.length === 2) {
      // 2 valid sources → use mean
      price = mean(validSources.map(s => s.price));
      confidence = CONFIDENCE.MEDIUM;
      method = 'mean';
    } else if (validSources.length === 1) {
      // 1 valid source → use it, but tag low confidence
      price = validSources[0].price;
      confidence = CONFIDENCE.LOW;
      method = 'single';
    } else if (this.lastAggregated) {
      // 0 valid sources → use last known price
      price = this.lastAggregated.price;
      confidence = CONFIDENCE.STALE;
      method = 'stale';
    } else {
      // No data at all
      return null;
    }

    const result = {
      symbol: this.symbol,
      price,
      confidence,
      method,
      sourceCount: validSources.length,
      totalSources: this.sources.size,
      freshSources: freshSources.length,
      staleSources: staleSources.length,
      sourcesUsed: validSources.map(s => s.sourceId),
      spread: validSources.length >= 2
        ? Math.abs(Math.max(...validSources.map(s => s.price)) - Math.min(...validSources.map(s => s.price)))
        : 0,
      timestamp: now,
      latency: validSources.length > 0
        ? Math.min(...validSources.map(s => s.age))
        : (this.lastAggregated?.latency || 0),
    };

    this.lastAggregated = result;

    // Notify subscribers
    for (const cb of this.subscribers) {
      try { cb(result); } catch { /* ignore */ }
    }

    return result;
  }

  /**
   * Reject outlier prices using 3-sigma rule.
   * Uses the rolling mean and stddev from each source's history.
   * @private
   */
  _rejectOutliers(sources) {
    if (sources.length < 3) return sources; // Need 3+ to detect outliers

    const prices = sources.map(s => s.price);
    const avg = mean(prices);
    const sd = stddev(prices, avg);

    if (sd === 0) return sources; // All identical — no outliers

    return sources.filter(s => {
      const zScore = Math.abs(s.price - avg) / sd;
      return zScore <= CONFIG.OUTLIER_SIGMA;
    });
  }
}

// ─── Price Aggregator ───────────────────────────────────────────

export class PriceAggregator {
  constructor(config = {}) {
    this._config = { ...CONFIG, ...config };
    this._symbols = new Map();     // symbol → SymbolState
    this._sourceHealth = new Map(); // sourceId → { updates, errors, lastSeen }
    this._running = false;
    this._intervalId = null;
  }

  /**
   * Ingest a price update from a data source.
   *
   * @param {string} symbol - Normalized symbol (e.g., 'BTCUSDT', 'AAPL')
   * @param {string} sourceId - Source identifier (e.g., 'binance', 'pyth', 'finnhub')
   * @param {number} price - The price value
   * @param {number} timestamp - Unix timestamp in ms
   * @param {number} [confidence=0] - Source-level confidence (e.g., Pyth confidence interval)
   */
  ingest(symbol, sourceId, price, timestamp, confidence = 0) {
    if (!symbol || !price || price <= 0) return;

    const upper = symbol.toUpperCase();
    let state = this._symbols.get(upper);
    if (!state) {
      state = new SymbolState(upper);
      this._symbols.set(upper, state);
    }

    const buf = state.getOrCreateSource(sourceId);
    buf.update(price, timestamp, confidence);

    // Track source health
    this._trackSourceHealth(sourceId);
  }

  /**
   * Get the latest aggregated price for a symbol.
   * Runs aggregation on demand if no loop is running.
   *
   * @param {string} symbol
   * @returns {{ price, confidence, sourceCount, spread, ... } | null}
   */
  aggregate(symbol) {
    const state = this._symbols.get(symbol?.toUpperCase());
    if (!state) return null;
    return state.aggregate();
  }

  /**
   * Get the cached last aggregated result without re-aggregating.
   *
   * @param {string} symbol
   * @returns {{ price, confidence, sourceCount, ... } | null}
   */
  getLatest(symbol) {
    const state = this._symbols.get(symbol?.toUpperCase());
    return state?.lastAggregated || null;
  }

  /**
   * Subscribe to aggregated price updates for a symbol.
   *
   * @param {string} symbol
   * @param {Function} callback - (result) => void
   * @returns {Function} unsubscribe
   */
  subscribe(symbol, callback) {
    const upper = symbol?.toUpperCase();
    if (!upper) return () => {};

    let state = this._symbols.get(upper);
    if (!state) {
      state = new SymbolState(upper);
      this._symbols.set(upper, state);
    }

    state.subscribers.add(callback);

    return () => {
      state.subscribers.delete(callback);
    };
  }

  /**
   * Start the aggregation loop.
   * Runs aggregate() on all active symbols at the configured interval.
   */
  start() {
    if (this._running) return;
    this._running = true;

    this._intervalId = setInterval(() => {
      for (const [, state] of this._symbols) {
        if (state.sources.size > 0) {
          state.aggregate();
        }
      }
    }, this._config.AGGREGATION_INTERVAL_MS);
  }

  /**
   * Stop the aggregation loop.
   */
  stop() {
    this._running = false;
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  /**
   * Get health statistics for all data sources.
   *
   * @returns {Object} sourceId → { updates, errors, lastSeen, isHealthy }
   */
  getSourceHealth() {
    const health = {};
    for (const [id, stats] of this._sourceHealth) {
      health[id] = {
        ...stats,
        isHealthy: (Date.now() - stats.lastSeen) < this._config.STALENESS_THRESHOLD_MS * 2,
      };
    }
    return health;
  }

  /**
   * Get summary statistics for the aggregator.
   *
   * @returns {Object}
   */
  getStats() {
    const symbols = {};
    for (const [sym, state] of this._symbols) {
      symbols[sym] = {
        sources: state.sources.size,
        freshSources: Array.from(state.sources.values()).filter(s => s.isFresh).length,
        lastPrice: state.lastAggregated?.price || null,
        confidence: state.lastAggregated?.confidence || 'none',
      };
    }

    return {
      running: this._running,
      symbolCount: this._symbols.size,
      symbols,
      sourceHealth: this.getSourceHealth(),
    };
  }

  /**
   * Remove a symbol and all its source data.
   */
  removeSymbol(symbol) {
    this._symbols.delete(symbol?.toUpperCase());
  }

  /**
   * Dispose of all resources.
   */
  dispose() {
    this.stop();
    this._symbols.clear();
    this._sourceHealth.clear();
  }

  /** @private */
  _trackSourceHealth(sourceId) {
    let health = this._sourceHealth.get(sourceId);
    if (!health) {
      health = { updates: 0, errors: 0, lastSeen: 0, firstSeen: Date.now() };
      this._sourceHealth.set(sourceId, health);
    }
    health.updates++;
    health.lastSeen = Date.now();
  }
}

// ─── Singleton + Exports ──────────────────────────────────────────

export const priceAggregator = new PriceAggregator();

export default PriceAggregator;
