// ═══════════════════════════════════════════════════════════════════
// charEdge v13 — Volume Profile Engine
//
// Computes Volume Profiles from historical OHLCV candle data.
// Unlike OrderFlowEngine (which builds VP from live ticks), this
// engine works with historical bars — distributing each candle's
// volume across its [low, high] range proportionally.
//
// Provides:
//   • Session VP      — full visible range
//   • Fixed Range VP  — user-selected date range
//   • Anchored VP     — from a specific start point
//   • POC, VAH, VAL   — Point of Control, Value Area High/Low
//   • TPO (Time Price Opportunity) — market profile letters
//
// Usage:
//   import { volumeProfileEngine } from './VolumeProfileEngine.js';
//   const vp = volumeProfileEngine.compute(candles, { tickSize: 0.5 });
//   const anchored = volumeProfileEngine.computeAnchored(candles, startIndex);
// ═══════════════════════════════════════════════════════════════════

// ─── Default Config ────────────────────────────────────────────

const DEFAULT_VALUE_AREA_PCT = 0.70; // 70% of volume for Value Area

// ─── Auto Tick Size ────────────────────────────────────────────

function autoTickSize(price) {
  if (price >= 50000)  return 50;
  if (price >= 10000)  return 10;
  if (price >= 1000)   return 5;
  if (price >= 100)    return 0.5;
  if (price >= 10)     return 0.1;
  if (price >= 1)      return 0.01;
  return 0.001;
}

// ─── Volume Profile Engine ─────────────────────────────────────

class _VolumeProfileEngine {

  /**
   * Compute a Volume Profile from OHLCV candle data.
   *
   * For each candle, volume is distributed across price levels within
   * [low, high]. Volume is weighted more toward the close (60%) and
   * the rest distributed uniformly.
   *
   * @param {Array<{ open, high, low, close, volume }>} candles
   * @param {Object} [opts]
   * @param {number} [opts.tickSize]    - Price bucket size (auto-detected if omitted)
   * @param {number} [opts.valueAreaPct=0.70] - Value Area %
   * @returns {{ levels, poc, vah, val, tickSize, totalVolume }}
   */
  compute(candles, opts = {}) {
    if (!candles || candles.length === 0) {
      return { levels: [], poc: null, vah: null, val: null, tickSize: 0, totalVolume: 0 };
    }

    // Auto-detect tick size from first candle's close
    const referencePrice = candles[0].close || candles[0].open || 100;
    const tickSize = opts.tickSize || autoTickSize(referencePrice);
    const valueAreaPct = opts.valueAreaPct || DEFAULT_VALUE_AREA_PCT;

    // Accumulate volume at each price level
    const volumeMap = new Map(); // priceBucket → { totalVol, buyVol, sellVol, candles (count) }

    for (const candle of candles) {
      if (!candle.volume || candle.volume <= 0) continue;

      const high = candle.high;
      const low = candle.low;
      const close = candle.close;
      const isBullish = close >= candle.open;

      // Bucket the low and high
      const lowBucket = Math.floor(low / tickSize) * tickSize;
      const highBucket = Math.ceil(high / tickSize) * tickSize;
      const closeBucket = Math.round(close / tickSize) * tickSize;

      // Count levels in range
      const numLevels = Math.max(Math.round((highBucket - lowBucket) / tickSize), 1);
      const uniformVol = (candle.volume * 0.4) / numLevels; // 40% uniform
      const closeVol = candle.volume * 0.6; // 60% weighted to close

      // Distribute volume
      for (let p = lowBucket; p <= highBucket; p = Math.round((p + tickSize) * 1e8) / 1e8) {
        const bucket = Math.round(p * 1e8) / 1e8; // Avoid floating point issues

        let entry = volumeMap.get(bucket);
        if (!entry) {
          entry = { totalVol: 0, buyVol: 0, sellVol: 0, candles: 0 };
          volumeMap.set(bucket, entry);
        }

        // Base uniform distribution
        let vol = uniformVol;

        // Extra volume at close price bucket
        if (Math.abs(bucket - closeBucket) < tickSize * 0.5) {
          vol += closeVol;
        }

        entry.totalVol += vol;
        if (isBullish) entry.buyVol += vol;
        else entry.sellVol += vol;
        entry.candles++;
      }
    }

    // Build sorted levels array
    const levels = [];
    let maxVol = 0;
    let pocPrice = 0;
    let totalVolume = 0;

    for (const [price, data] of volumeMap) {
      levels.push({
        price,
        totalVol: Math.round(data.totalVol * 100) / 100,
        buyVol: Math.round(data.buyVol * 100) / 100,
        sellVol: Math.round(data.sellVol * 100) / 100,
        delta: Math.round((data.buyVol - data.sellVol) * 100) / 100,
        candles: data.candles,
      });
      totalVolume += data.totalVol;
      if (data.totalVol > maxVol) {
        maxVol = data.totalVol;
        pocPrice = price;
      }
    }

    levels.sort((a, b) => a.price - b.price);

    // Compute Value Area (expand from POC until 70% of volume)
    const { vah, val } = this._computeValueArea(levels, pocPrice, totalVolume, valueAreaPct);

    return {
      levels,
      poc: pocPrice,
      vah,
      val,
      tickSize,
      totalVolume: Math.round(totalVolume * 100) / 100,
    };
  }

  /**
   * Compute an anchored Volume Profile starting from a specific candle index.
   *
   * @param {Array} candles - Full OHLCV array
   * @param {number} anchorIndex - Index to start from
   * @param {Object} [opts]
   * @returns {{ levels, poc, vah, val, tickSize, totalVolume }}
   */
  computeAnchored(candles, anchorIndex, opts = {}) {
    if (!candles || anchorIndex < 0 || anchorIndex >= candles.length) {
      return { levels: [], poc: null, vah: null, val: null, tickSize: 0, totalVolume: 0 };
    }
    return this.compute(candles.slice(anchorIndex), opts);
  }

  /**
   * Compute a fixed-range Volume Profile between two timestamps.
   *
   * @param {Array} candles - Full OHLCV array (must have .time property)
   * @param {number} fromTime - Start timestamp ms
   * @param {number} toTime - End timestamp ms
   * @param {Object} [opts]
   * @returns {{ levels, poc, vah, val, tickSize, totalVolume }}
   */
  computeRange(candles, fromTime, toTime, opts = {}) {
    if (!candles) return { levels: [], poc: null, vah: null, val: null, tickSize: 0, totalVolume: 0 };
    const filtered = candles.filter(c => c.time >= fromTime && c.time <= toTime);
    return this.compute(filtered, opts);
  }

  /**
   * Compute a TPO (Time-Price Opportunity) Market Profile.
   * Each 30-min period gets a letter (A, B, C...) placed at price levels.
   *
   * @param {Array} candles - Should be 30min or smaller candles
   * @param {Object} [opts]
   * @param {number} [opts.tickSize]
   * @returns {{ levels: Array<{ price, letters: string[], count: number }>, poc, tickSize }}
   */
  computeTPO(candles, opts = {}) {
    if (!candles || candles.length === 0) {
      return { levels: [], poc: null, tickSize: 0 };
    }

    const referencePrice = candles[0].close || 100;
    const tickSize = opts.tickSize || autoTickSize(referencePrice);

    const tpoMap = new Map(); // priceBucket → Set<letter>
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

    candles.forEach((candle, i) => {
      const letter = letters[i % letters.length];
      const lowBucket = Math.floor(candle.low / tickSize) * tickSize;
      const highBucket = Math.ceil(candle.high / tickSize) * tickSize;

      for (let p = lowBucket; p <= highBucket; p = Math.round((p + tickSize) * 1e8) / 1e8) {
        const bucket = Math.round(p * 1e8) / 1e8;
        if (!tpoMap.has(bucket)) tpoMap.set(bucket, new Set());
        tpoMap.get(bucket).add(letter);
      }
    });

    const levels = [];
    let maxCount = 0;
    let pocPrice = 0;

    for (const [price, letterSet] of tpoMap) {
      const count = letterSet.size;
      levels.push({ price, letters: [...letterSet], count });
      if (count > maxCount) {
        maxCount = count;
        pocPrice = price;
      }
    }

    levels.sort((a, b) => a.price - b.price);

    return { levels, poc: pocPrice, tickSize };
  }

  // ─── Value Area Computation ────────────────────────────────

  /** @private */
  _computeValueArea(levels, pocPrice, totalVol, pct) {
    if (levels.length === 0 || totalVol === 0) {
      return { vah: pocPrice, val: pocPrice };
    }

    const target = totalVol * pct;
    const pocIdx = levels.findIndex(l => l.price === pocPrice);

    if (pocIdx === -1) return { vah: pocPrice, val: pocPrice };

    let vaVol = levels[pocIdx].totalVol;
    let lo = pocIdx;
    let hi = pocIdx;

    while (vaVol < target && (lo > 0 || hi < levels.length - 1)) {
      const loVol = lo > 0 ? levels[lo - 1].totalVol : 0;
      const hiVol = hi < levels.length - 1 ? levels[hi + 1].totalVol : 0;

      if (loVol >= hiVol && lo > 0) {
        lo--;
        vaVol += levels[lo].totalVol;
      } else if (hi < levels.length - 1) {
        hi++;
        vaVol += levels[hi].totalVol;
      } else {
        break;
      }
    }

    return {
      vah: levels[hi].price,
      val: levels[lo].price,
    };
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const volumeProfileEngine = new _VolumeProfileEngine();
export default volumeProfileEngine;
