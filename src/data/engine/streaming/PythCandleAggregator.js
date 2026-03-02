// ═══════════════════════════════════════════════════════════════════
// charEdge — Pyth Candle Aggregator
//
// Converts real-time Pyth price ticks (~400ms interval) into
// standard OHLCV candles at configurable timeframes.
//
// Pyth doesn't provide historical candle data — only spot price
// ticks flowing via SSE. This module accumulates those ticks
// client-side to build progressively longer chart history.
//
// Usage:
//   import { pythCandleAggregator } from './PythCandleAggregator.js';
//   pythCandleAggregator.ingestTick('BTC', 97250.50, 15.20, Date.now());
//   const candles = pythCandleAggregator.getCandles('BTC', '1m');
// ═══════════════════════════════════════════════════════════════════

// ─── Interval Definitions ──────────────────────────────────────

const INTERVALS = {
  '1m':  60_000,
  '5m':  300_000,
  '15m': 900_000,
  '1h':  3_600_000,
  '4h':  14_400_000,
  '1d':  86_400_000,
};

const SUPPORTED_INTERVALS = Object.keys(INTERVALS);

/** Maximum candles retained per symbol+interval */
const MAX_CANDLES = 500;

// ─── Candle Aggregator Class ───────────────────────────────────

class PythCandleAggregator extends EventTarget {
  constructor() {
    super();

    /**
     * Candle storage: Map<string, Map<string, { current, history }>>
     * symbol → interval → { current: Candle|null, history: Candle[] }
     * @type {Map<string, Map<string, { current: Object|null, history: Object[] }>>}
     */
    this._data = new Map();

    /**
     * Per-symbol confidence tracking.
     * symbol → { confidence, timestamp }
     * @type {Map<string, { confidence: number, timestamp: number }>}
     */
    this._confidence = new Map();

    /**
     * Tick counters for stats.
     */
    this._stats = {
      ticksIngested: 0,
      candlesClosed: 0,
    };
  }

  // ─── Public API ─────────────────────────────────────────────

  /**
   * Ingest a single price tick from Pyth SSE stream.
   * Updates the current candle for every tracked interval.
   *
   * @param {string} symbol - e.g. 'BTC', 'AAPL', 'EURUSD'
   * @param {number} price - Current price
   * @param {number} confidence - Pyth confidence interval (± price range)
   * @param {number} timestamp - Unix ms timestamp
   */
  ingestTick(symbol, price, confidence, timestamp) {
    if (!symbol || typeof price !== 'number' || price <= 0) return;

    const upper = symbol.toUpperCase();
    this._stats.ticksIngested++;

    // Update confidence tracker
    this._confidence.set(upper, { confidence, timestamp });

    // Ensure symbol has storage for all intervals
    if (!this._data.has(upper)) {
      this._data.set(upper, new Map());
    }
    const symbolData = this._data.get(upper);

    // Update every interval
    for (const interval of SUPPORTED_INTERVALS) {
      if (!symbolData.has(interval)) {
        symbolData.set(interval, { current: null, history: [] });
      }

      const bucket = symbolData.get(interval);
      const intervalMs = INTERVALS[interval];
      const candleOpenTime = Math.floor(timestamp / intervalMs) * intervalMs;

      if (!bucket.current) {
        // First tick — start a new candle
        bucket.current = this._newCandle(candleOpenTime, price, intervalMs);
      } else if (candleOpenTime > bucket.current.time) {
        // Candle boundary crossed — close current, start new
        this._closeCandle(upper, interval, bucket);
        bucket.current = this._newCandle(candleOpenTime, price, intervalMs);
      } else {
        // Same candle — update OHLC
        this._updateCandle(bucket.current, price);
      }
    }
  }

  /**
   * Get accumulated candle history for a symbol + interval.
   * Returns closed candles plus the current in-progress candle.
   *
   * @param {string} symbol
   * @param {string} interval - '1m'|'5m'|'15m'|'1h'|'4h'|'1d'
   * @returns {Object[]} Array of OHLCV candles, oldest first
   */
  getCandles(symbol, interval = '1m') {
    const upper = (symbol || '').toUpperCase();
    const symbolData = this._data.get(upper);
    if (!symbolData) return [];

    const bucket = symbolData.get(interval);
    if (!bucket) return [];

    // Return history + current in-progress candle
    const candles = [...bucket.history];
    if (bucket.current) {
      candles.push({ ...bucket.current });
    }
    return candles;
  }

  /**
   * Get the latest confidence interval for a symbol.
   * @param {string} symbol
   * @returns {{ confidence: number, timestamp: number } | null}
   */
  getConfidence(symbol) {
    return this._confidence.get((symbol || '').toUpperCase()) || null;
  }

  /**
   * Check if we have any candle data for a symbol.
   * @param {string} symbol
   * @returns {boolean}
   */
  hasData(symbol) {
    const upper = (symbol || '').toUpperCase();
    const symbolData = this._data.get(upper);
    if (!symbolData) return false;

    // Check if any interval has data
    for (const [, bucket] of symbolData) {
      if (bucket.current || bucket.history.length > 0) return true;
    }
    return false;
  }

  /**
   * Get the number of candles available for a symbol + interval.
   * @param {string} symbol
   * @param {string} interval
   * @returns {number}
   */
  getCandleCount(symbol, interval = '1m') {
    const candles = this.getCandles(symbol, interval);
    return candles.length;
  }

  /**
   * Subscribe to candle close events.
   * @param {string} symbol
   * @param {string} interval
   * @param {Function} callback - (candle) => void
   * @returns {Function} unsubscribe
   */
  onCandle(symbol, interval, callback) {
    const upper = (symbol || '').toUpperCase();
    const handler = (event) => {
      const { symbol: sym, interval: ivl, candle } = event.detail;
      if (sym === upper && ivl === interval) {
        callback(candle);
      }
    };
    this.addEventListener('candle-close', handler);
    return () => this.removeEventListener('candle-close', handler);
  }

  /**
   * Get supported intervals.
   * @returns {string[]}
   */
  getSupportedIntervals() {
    return [...SUPPORTED_INTERVALS];
  }

  /**
   * Get aggregator stats.
   * @returns {Object}
   */
  getStats() {
    const symbolCount = this._data.size;
    let totalCandles = 0;

    for (const [, intervals] of this._data) {
      for (const [, bucket] of intervals) {
        totalCandles += bucket.history.length + (bucket.current ? 1 : 0);
      }
    }

    return {
      ...this._stats,
      activeSymbols: symbolCount,
      totalCandlesStored: totalCandles,
      supportedIntervals: SUPPORTED_INTERVALS,
    };
  }

  /**
   * Clear all data for a symbol.
   * @param {string} symbol
   */
  clearSymbol(symbol) {
    const upper = (symbol || '').toUpperCase();
    this._data.delete(upper);
    this._confidence.delete(upper);
  }

  /**
   * Clear all data.
   */
  clearAll() {
    this._data.clear();
    this._confidence.clear();
    this._stats.ticksIngested = 0;
    this._stats.candlesClosed = 0;
  }

  // ─── Private Helpers ────────────────────────────────────────

  /**
   * Create a new candle starting at the given time with the given price.
   * @private
   */
  _newCandle(openTime, price, intervalMs) {
    return {
      time: openTime,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: 0,  // Pyth doesn't provide volume — always 0
      tickCount: 1,
      closeTime: openTime + intervalMs - 1,
    };
  }

  /**
   * Update an existing candle with a new price tick.
   * @private
   */
  _updateCandle(candle, price) {
    if (price > candle.high) candle.high = price;
    if (price < candle.low) candle.low = price;
    candle.close = price;
    candle.tickCount++;
  }

  /**
   * Close the current candle, push to history, and emit event.
   * @private
   */
  _closeCandle(symbol, interval, bucket) {
    const closedCandle = { ...bucket.current };
    bucket.history.push(closedCandle);
    this._stats.candlesClosed++;

    // Trim history to max
    if (bucket.history.length > MAX_CANDLES) {
      bucket.history = bucket.history.slice(-MAX_CANDLES);
    }

    // Emit event
    this.dispatchEvent(
      new CustomEvent('candle-close', {
        detail: { symbol, interval, candle: closedCandle },
      })
    );
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const pythCandleAggregator = new PythCandleAggregator();

export {
  INTERVALS,
  SUPPORTED_INTERVALS,
  MAX_CANDLES,
};

export default PythCandleAggregator;
