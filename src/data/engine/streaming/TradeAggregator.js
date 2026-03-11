import { logger } from '@/observability/logger';

// ═══════════════════════════════════════════════════════════════════
// charEdge v16 — Trade Aggregator
//
// Builds OHLCV candles from raw trade ticks client-side.
// Enables sub-second price updates + custom timeframes.
//
// Usage:
//   const agg = new TradeAggregator({ bucketMs: 60_000 }); // 1m candles
//   agg.onBar = (bar) => { /* completed candle */ };
//   agg.onUpdate = (partialBar) => { /* live partial */ };
//   agg.ingest({ price: 95000, qty: 0.5, time: Date.now(), isBuyerMaker: false });
// ═══════════════════════════════════════════════════════════════════

// ─── Timeframe Bucket Sizes ────────────────────────────────────
export const BUCKET_SIZES = {
  '1s':   1_000,
  '5s':   5_000,
  '15s':  15_000,
  '30s':  30_000,
  '1m':   60_000,
  '3m':   180_000,
  '5m':   300_000,
  '15m':  900_000,
  '30m':  1_800_000,
  '1h':   3_600_000,
  '4h':   14_400_000,
  '1d':   86_400_000,
};

// ─── Default Config ────────────────────────────────────────────
const DEFAULTS = {
  bucketMs: 60_000,      // Default: 1-minute candles
  maxBars: 500,          // Rolling buffer of completed bars
  throttleMs: 250,       // Throttle onUpdate calls (4 FPS)
};

/**
 * TradeAggregator — builds OHLCV candles from raw trade ticks.
 *
 * @param {Object} [config]
 * @param {number} [config.bucketMs=60000] - Candle duration in ms
 * @param {number} [config.maxBars=500] - Max completed bars to retain
 * @param {number} [config.throttleMs=250] - Min interval between onUpdate emissions
 */
export class TradeAggregator {
  constructor(config = {}) {
    this._config = { ...DEFAULTS, ...config };
    this._bucketMs = this._config.bucketMs;

    /** @type {Array<Object>} Completed bars (oldest → newest) */
    this._bars = [];

    /** @type {Object|null} Current open bar being built */
    this._currentBar = null;

    /** @type {number} Bucket start time for current bar */
    this._currentBucketStart = 0;

    /** @type {number} Total trade count for metrics */
    this._tradeCount = 0;

    /** @type {number} Throttle: last onUpdate emission time */
    this._lastUpdateTime = 0;

    // ── Callbacks ──
    /** @type {Function|null} Called when a candle completes */
    this.onBar = null;

    /** @type {Function|null} Called on partial bar updates (throttled) */
    this.onUpdate = null;
  }

  /**
   * Ingest a raw trade tick.
   * @param {{ price: number, qty: number, time: number, isBuyerMaker: boolean }} trade
   */
  ingest(trade) {
    const { price, qty, time, isBuyerMaker } = trade;
    if (!price || !time) return;

    this._tradeCount++;

    const bucketStart = Math.floor(time / this._bucketMs) * this._bucketMs;

    // If we've moved to a new bucket, finalize the current bar
    if (this._currentBar && bucketStart > this._currentBucketStart) {
      this._finalizeBar();
    }

    // Start a new bar if needed
    if (!this._currentBar || bucketStart > this._currentBucketStart) {
      this._currentBucketStart = bucketStart;
      this._currentBar = {
        time: bucketStart,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: qty,
        buyVolume: isBuyerMaker ? 0 : qty,
        sellVolume: isBuyerMaker ? qty : 0,
        tradeCount: 1,
      };
    } else {
      // Update existing bar
      const bar = this._currentBar;
      bar.high = Math.max(bar.high, price);
      bar.low = Math.min(bar.low, price);
      bar.close = price;
      bar.volume += qty;
      if (isBuyerMaker) {
        bar.sellVolume += qty;
      } else {
        bar.buyVolume += qty;
      }
      bar.tradeCount++;
    }

    // Emit throttled partial update
    this._emitUpdate();
  }

  /**
   * Finalize the current bar and emit onBar.
   * @private
   */
  _finalizeBar() {
    if (!this._currentBar) return;

    const bar = { ...this._currentBar };
    this._bars.push(bar);

    // Trim to max bars
    while (this._bars.length > this._config.maxBars) {
      this._bars.shift();
    }

    if (this.onBar) {
      try { this.onBar(bar); } catch (e) { logger.data.warn('Operation failed', e); }
    }

    this._currentBar = null;
  }

  /**
   * Emit throttled partial update.
   * @private
   */
  _emitUpdate() {
    if (!this.onUpdate || !this._currentBar) return;

    const now = Date.now();
    if (now - this._lastUpdateTime < this._config.throttleMs) return;

    this._lastUpdateTime = now;
    try { this.onUpdate({ ...this._currentBar }); } catch (e) { logger.data.warn('Operation failed', e); }
  }

  /**
   * Get all completed bars.
   * @returns {Array<Object>}
   */
  getBars() {
    return [...this._bars];
  }

  /**
   * Get the current partial (open) bar.
   * @returns {Object|null}
   */
  getCurrentBar() {
    return this._currentBar ? { ...this._currentBar } : null;
  }

  /**
   * Get aggregator statistics.
   * @returns {{ tradeCount, barCount, bucketMs, currentBar }}
   */
  getStats() {
    return {
      tradeCount: this._tradeCount,
      barCount: this._bars.length,
      bucketMs: this._bucketMs,
      currentBar: this.getCurrentBar(),
    };
  }

  /**
   * Change the timeframe bucket size.
   * Finalizes current bar first.
   * @param {number} bucketMs
   */
  setBucketMs(bucketMs) {
    if (bucketMs === this._bucketMs) return;
    this._finalizeBar();
    this._bucketMs = bucketMs;
    this._bars = [];
  }

  /**
   * Reset all state.
   */
  reset() {
    this._finalizeBar();
    this._bars = [];
    this._currentBar = null;
    this._currentBucketStart = 0;
    this._tradeCount = 0;
    this._lastUpdateTime = 0;
  }

  /**
   * Dispose of all resources.
   */
  dispose() {
    this.reset();
    this.onBar = null;
    this.onUpdate = null;
  }
}

export default TradeAggregator;
