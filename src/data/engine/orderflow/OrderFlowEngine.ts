import { logger } from '../../../utils/logger';

// ═══════════════════════════════════════════════════════════════════
// charEdge v13 — Order Flow Engine
//
// Transforms raw WebSocket trade ticks into institutional-grade
// order flow analytics:
//
//   • Delta (buy vol – sell vol per candle)
//   • Cumulative Volume Delta (CVD)
//   • Volume Profile (price × volume histogram)
//   • Footprint data (bid/ask vol per price level per candle)
//   • Large trade detection (statistical outlier)
//   • Tick speed (trades/second)
//   • Trade size clustering (institutional block detection)
//   • Aggressor ratio (buyers vs sellers in control)
//
// Data Sources:
//   Binance WS @trade — classify via tick rule (price vs last price)
//   Kraken  WS trade  — already provides side ('buy'/'sell')
//   Any future source with { price, volume, time, side? }
//
// All computation is synchronous and optimized for real-time.
// Heavy batch operations (VP rebuild) can be offloaded to a Worker.
//
// Usage:
//   import { orderFlowEngine } from './OrderFlowEngine.ts';
//   orderFlowEngine.ingestTick('BTCUSDT', { price, volume, time, side });
//   const delta = orderFlowEngine.getDelta('BTCUSDT', '5m');
//   const cvd = orderFlowEngine.getCVD('BTCUSDT');
//   const vp = orderFlowEngine.getVolumeProfile('BTCUSDT');
//   const footprint = orderFlowEngine.getFootprint('BTCUSDT', candleTime, '5m');
// ═══════════════════════════════════════════════════════════════════

// ─── Constants ─────────────────────────────────────────────────

const MAX_TICKS = 50_000;       // Per-symbol tick buffer cap
const MAX_CANDLE_HISTORY = 500; // Delta/footprint candle history
const VP_BUCKET_DIVISOR = 100;  // Price bucket granularity: price / divisor → bucket ID
const LARGE_TRADE_SIGMA = 2.5;  // Standard deviations for "large trade" detection
const TICK_SPEED_WINDOW = 5000; // 5-second window for tick speed
const CLUSTER_WINDOW = 2000;    // 2-second window for cluster detection
const CLUSTER_CHECK_INTERVAL = 10; // Only run cluster detection every Nth tick
const CLUSTER_BUF_CAPACITY = 512;  // Max trades in cluster ring buffer
const CLUSTER_FIELDS = 4;          // [price, volume, time, sideAsNum]
const CVD_HISTORY_MAX = 5000;      // Max CVD history entries
const CVD_HISTORY_TRIM = 1000;     // Entries to trim when max is hit
const TRADE_SIZE_CAPACITY = 1000; // Rolling window for trade size stats
const TICK_TS_CAPACITY = 500;     // Rolling window for tick timestamps

// TypedArray field layout for tick ring buffer
// Each tick occupies 4 Float64 slots: [price, volume, time, side(0|1)]
const TICK_FIELDS = 4;

// Timeframe → milliseconds
const TF_MS = {
  '1m': 60_000,
  '3m': 180_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
};

// ─── Helpers ───────────────────────────────────────────────────

/** Snap a timestamp to the start of its candle in a given timeframe. */
function snapToCandle(ts, tfMs) {
  return Math.floor(ts / tfMs) * tfMs;
}

/** Compute price bucket for Volume Profile. */
function priceBucket(price, tickSize) {
  return Math.round(price / tickSize) * tickSize;
}

/** Determine tick size based on price magnitude. */
function autoTickSize(price) {
  if (price >= 10000) return 10;       // BTC: $10 buckets
  if (price >= 1000) return 1;        // ETH, stocks >$1k
  if (price >= 100) return 0.5;      // Mid-cap stocks
  if (price >= 10) return 0.1;      // Small stocks
  if (price >= 1) return 0.01;     // Penny range
  return 0.0001;                       // Sub-dollar / low-cap crypto
}

// ─── Per-Symbol State ──────────────────────────────────────────

class SymbolFlowState {
  constructor(symbol) {
    this.symbol = symbol;

    // ── TypedArray tick ring buffer ──
    // Contiguous Float64Array: zero GC pressure, cache-friendly
    this._tickData = new Float64Array(MAX_TICKS * TICK_FIELDS);
    this.tickHead = 0;
    this.tickCount = 0;

    // Side and source strings stored separately (non-numeric)
    this._tickSides = new Uint8Array(MAX_TICKS);    // 1 = buy, 0 = sell
    this._tickSources = new Array(MAX_TICKS);        // source strings

    // Last trade price for tick-rule classification
    this.lastPrice = 0;

    // Running CVD (cumulative volume delta)
    this.cvd = 0;
    this.cvdHistory = [];    // [{ time, cvd }] — sampled every N ticks
    this.cvdSampleCounter = 0;

    // Delta per candle: Map<tfId, Map<candleTime, { buyVol, sellVol, delta, count }>>
    this.deltas = new Map();

    // Volume Profile: Map<priceBucket, { buyVol, sellVol, totalVol }>
    this.volumeProfile = new Map();
    this.vpTickSize = 0;

    // Footprint: Map<tfId, Map<candleTime, Map<priceBucket, { bidVol, askVol, totalVol }>>>
    this.footprints = new Map();

    // Large trade tracking — TypedArray ring buffer
    this._tradeSizeData = new Float64Array(TRADE_SIZE_CAPACITY);
    this._tradeSizeHead = 0;
    this._tradeSizeCount = 0;
    this._tradeSizeSum = 0;       // Running sum for O(1) mean
    this._tradeSizeSumSq = 0;     // Running sum of squares for O(1) variance
    this.largeTrades = [];    // [{ price, volume, time, side, sigma }]

    // Tick speed tracking — TypedArray ring buffer
    this._tickTsData = new Float64Array(TICK_TS_CAPACITY);
    this._tickTsHead = 0;
    this._tickTsCount = 0;

    // Trade clustering — TypedArray ring buffer (zero-alloc)
    this._clusterData = new Float64Array(CLUSTER_BUF_CAPACITY * CLUSTER_FIELDS);
    this._clusterHead = 0;
    this._clusterCount = 0;
    this._clusterTickCounter = 0;  // Throttle: only check every Nth tick
    this._clusterBucketMap = new Map(); // Reused per detection pass
    this.clusters = [];       // Detected clusters

    // Stats
    this.totalTicks = 0;
    this.totalBuyVol = 0;
    this.totalSellVol = 0;

    // Subscribers
    this._subscribers = new Set();
  }

  /** Push tick numeric data into the TypedArray ring buffer. O(1), zero-alloc. */
  pushTick(price, volume, time, isBuy, source) {
    const idx = this.tickHead % MAX_TICKS;
    const offset = idx * TICK_FIELDS;
    this._tickData[offset] = price;
    this._tickData[offset + 1] = volume;
    this._tickData[offset + 2] = time;
    this._tickData[offset + 3] = isBuy ? 1 : 0;
    this._tickSides[idx] = isBuy ? 1 : 0;
    this._tickSources[idx] = source || '';
    this.tickHead++;
    if (this.tickCount < MAX_TICKS) this.tickCount++;
  }

  /** Get tick entry by index (0 = oldest, tickCount-1 = newest). */
  getTick(i) {
    if (i < 0 || i >= this.tickCount) return null;
    const start = this.tickHead - this.tickCount;
    const idx = (start + i) % MAX_TICKS;
    const offset = idx * TICK_FIELDS;
    return {
      price: this._tickData[offset],
      volume: this._tickData[offset + 1],
      time: this._tickData[offset + 2],
      side: this._tickSides[idx] === 1 ? 'buy' : 'sell',
      source: this._tickSources[idx],
    };
  }

  /** Push trade size into ring buffer with running stats. O(1). */
  pushTradeSize(vol) {
    const idx = this._tradeSizeHead % TRADE_SIZE_CAPACITY;
    // If buffer is full, subtract the evicted value from running stats
    if (this._tradeSizeCount >= TRADE_SIZE_CAPACITY) {
      const old = this._tradeSizeData[idx];
      this._tradeSizeSum -= old;
      this._tradeSizeSumSq -= old * old;
    }
    this._tradeSizeData[idx] = vol;
    this._tradeSizeSum += vol;
    this._tradeSizeSumSq += vol * vol;
    this._tradeSizeHead++;
    if (this._tradeSizeCount < TRADE_SIZE_CAPACITY) this._tradeSizeCount++;
  }

  /** Get trade size mean and stddev in O(1). */
  getTradeSizeStats() {
    if (this._tradeSizeCount < 20) return null;
    const mean = this._tradeSizeSum / this._tradeSizeCount;
    const variance = (this._tradeSizeSumSq / this._tradeSizeCount) - (mean * mean);
    return { mean, stddev: Math.sqrt(Math.max(0, variance)) };
  }

  /** Push tick timestamp into ring buffer. O(1). */
  pushTickTimestamp(time) {
    const idx = this._tickTsHead % TICK_TS_CAPACITY;
    this._tickTsData[idx] = time;
    this._tickTsHead++;
    if (this._tickTsCount < TICK_TS_CAPACITY) this._tickTsCount++;
  }

  /** Count tick timestamps within a time window. */
  countTicksInWindow(windowMs) {
    if (this._tickTsCount === 0) return 0;
    const cutoff = this._tickTsData[(this._tickTsHead - 1) % TICK_TS_CAPACITY] - windowMs;
    let count = 0;
    const start = this._tickTsHead - this._tickTsCount;
    for (let i = this._tickTsCount - 1; i >= 0; i--) {
      const idx = (start + i) % TICK_TS_CAPACITY;
      if (this._tickTsData[idx] >= cutoff) count++;
      else break; // timestamps are ordered, so we can stop
    }
    return count;
  }

  /** Reset all state. */
  reset() {
    this._tickData.fill(0);
    this._tickSides.fill(0);
    this._tickSources.fill(undefined);
    this.tickHead = 0;
    this.tickCount = 0;
    this.lastPrice = 0;
    this.cvd = 0;
    this.cvdHistory = [];
    this.cvdSampleCounter = 0;
    this.deltas.clear();
    this.volumeProfile.clear();
    this.footprints.clear();
    this._tradeSizeData.fill(0);
    this._tradeSizeHead = 0;
    this._tradeSizeCount = 0;
    this._tradeSizeSum = 0;
    this._tradeSizeSumSq = 0;
    this.largeTrades = [];
    this._tickTsData.fill(0);
    this._tickTsHead = 0;
    this._tickTsCount = 0;
    this._clusterData.fill(0);
    this._clusterHead = 0;
    this._clusterCount = 0;
    this._clusterTickCounter = 0;
    this._clusterBucketMap.clear();
    this.clusters = [];
    this.totalTicks = 0;
    this.totalBuyVol = 0;
    this.totalSellVol = 0;
  }
}

// ─── Order Flow Engine ─────────────────────────────────────────

class _OrderFlowEngine {
  constructor() {
    this._symbols = new Map();  // symbol → SymbolFlowState
    this._onLargeTrade = new Set(); // global large trade callbacks
    this._onCluster = new Set();    // global cluster callbacks
    this._defaultTimeframes = ['1m', '5m', '15m', '1h'];
  }

  // ─── Tick Ingestion ────────────────────────────────────────

  /**
   * Ingest a raw trade tick from any WebSocket source.
   *
   * @param {string} symbol - e.g., 'BTCUSDT'
   * @param {Object} tick
   * @param {number} tick.price  - Trade price
   * @param {number} tick.volume - Trade quantity
   * @param {number} tick.time   - Unix timestamp ms
   * @param {string} [tick.side] - 'buy' | 'sell' (Kraken provides this)
   * @param {string} [tick.source] - 'binance' | 'kraken' | etc.
   */
  ingestTick(symbol, tick) {
    const upper = (symbol || '').toUpperCase();
    if (!tick || !tick.price || !tick.volume) return;

    let state = this._symbols.get(upper);
    if (!state) {
      state = new SymbolFlowState(upper);
      this._symbols.set(upper, state);
    }

    // 1. Classify side if not provided (tick rule)
    const side = tick.side || this._classifySide(tick.price, state);

    // 2. Set tick size on first tick
    if (!state.vpTickSize) {
      state.vpTickSize = autoTickSize(tick.price);
    }

    const vol = tick.volume;
    const price = tick.price;
    const time = tick.time || Date.now();
    const isBuy = side === 'buy';

    // 3. Store in TypedArray tick ring buffer (zero-alloc)
    state.pushTick(price, vol, time, isBuy, tick.source);
    state.totalTicks++;
    state.lastPrice = price;

    // 4. Update CVD
    const deltaVol = isBuy ? vol : -vol;
    state.cvd += deltaVol;

    // Sample CVD history every 10 ticks
    state.cvdSampleCounter++;
    if (state.cvdSampleCounter >= 10) {
      state.cvdHistory.push({ time, cvd: state.cvd });
      // Trim in bulk instead of O(N) shift() per tick
      if (state.cvdHistory.length > CVD_HISTORY_MAX) {
        state.cvdHistory = state.cvdHistory.slice(CVD_HISTORY_TRIM);
      }
      state.cvdSampleCounter = 0;
    }

    // 5+7. Update delta AND footprint per candle in a SINGLE pass
    //       (merged from two separate loops to halve Map lookups)
    const bucket = priceBucket(price, state.vpTickSize);
    for (const tf of this._defaultTimeframes) {
      const tfMs = TF_MS[tf];
      if (!tfMs) continue;
      const candleTime = snapToCandle(time, tfMs);

      // ── Delta update ──
      if (!state.deltas.has(tf)) state.deltas.set(tf, new Map());
      const candleMap = state.deltas.get(tf);
      let candle = candleMap.get(candleTime);
      if (!candle) {
        candle = { buyVol: 0, sellVol: 0, delta: 0, count: 0, time: candleTime };
        candleMap.set(candleTime, candle);
        if (candleMap.size > MAX_CANDLE_HISTORY) {
          const oldest = candleMap.keys().next().value;
          candleMap.delete(oldest);
        }
      }
      if (isBuy) candle.buyVol += vol;
      else candle.sellVol += vol;
      candle.delta = candle.buyVol - candle.sellVol;
      candle.count++;

      // ── Footprint update ──
      if (!state.footprints.has(tf)) state.footprints.set(tf, new Map());
      const fpMap = state.footprints.get(tf);
      if (!fpMap.has(candleTime)) {
        fpMap.set(candleTime, new Map());
        if (fpMap.size > MAX_CANDLE_HISTORY) {
          const oldest = fpMap.keys().next().value;
          fpMap.delete(oldest);
        }
      }
      const priceLevels = fpMap.get(candleTime);
      let level = priceLevels.get(bucket);
      if (!level) {
        level = { bidVol: 0, askVol: 0, totalVol: 0 };
        priceLevels.set(bucket, level);
      }
      if (isBuy) level.askVol += vol;
      else level.bidVol += vol;
      level.totalVol += vol;
    }

    // 6. Update volume profile
    let vpEntry = state.volumeProfile.get(bucket);
    if (!vpEntry) {
      vpEntry = { buyVol: 0, sellVol: 0, totalVol: 0 };
      state.volumeProfile.set(bucket, vpEntry);
    }
    if (isBuy) vpEntry.buyVol += vol;
    else vpEntry.sellVol += vol;
    vpEntry.totalVol += vol;

    // 8. Track total buy/sell
    if (isBuy) state.totalBuyVol += vol;
    else state.totalSellVol += vol;

    // 9. Large trade detection — O(1) stats via running sum/sumSq
    state.pushTradeSize(vol);
    const sizeStats = state.getTradeSizeStats();

    if (sizeStats) {
      const sigma = sizeStats.stddev > 0 ? (vol - sizeStats.mean) / sizeStats.stddev : 0;

      if (sigma >= LARGE_TRADE_SIGMA) {
        const largeTrade = { price, volume: vol, time, side, sigma: Math.round(sigma * 10) / 10, source: tick.source };
        state.largeTrades.push(largeTrade);
        if (state.largeTrades.length > 200) state.largeTrades.shift();

        // Notify global large trade subscribers
        for (const cb of this._onLargeTrade) {
          try { cb({ symbol: upper, ...largeTrade }); } catch (e) { logger.data.warn('Operation failed', e); }
        }
      }
    }

    // 10. Tick speed tracking — TypedArray ring buffer, no shift() calls
    state.pushTickTimestamp(time);

    // 11. Trade clustering detection — TypedArray ring buffer, throttled
    // Push into ring buffer (O(1), zero-alloc)
    const clIdx = state._clusterHead % CLUSTER_BUF_CAPACITY;
    const clOff = clIdx * CLUSTER_FIELDS;
    state._clusterData[clOff] = price;
    state._clusterData[clOff + 1] = vol;
    state._clusterData[clOff + 2] = time;
    state._clusterData[clOff + 3] = isBuy ? 1 : 0;
    state._clusterHead++;
    if (state._clusterCount < CLUSTER_BUF_CAPACITY) state._clusterCount++;

    // Only run detection every Nth tick (clusters are 2s windows, checking
    // every ~100ms at 100 t/s is plenty)
    state._clusterTickCounter++;
    if (state._clusterTickCounter >= CLUSTER_CHECK_INTERVAL && state._clusterCount >= 5) {
      state._clusterTickCounter = 0;
      const clCutoff = time - CLUSTER_WINDOW;
      const bucketCounts = state._clusterBucketMap;
      bucketCounts.clear();

      // Scan ring buffer for trades within the cluster window
      const clStart = state._clusterHead - state._clusterCount;
      for (let ci = state._clusterCount - 1; ci >= 0; ci--) {
        const ri = (clStart + ci) % CLUSTER_BUF_CAPACITY;
        const ro = ri * CLUSTER_FIELDS;
        const tTime = state._clusterData[ro + 2];
        if (tTime < clCutoff) break; // timestamps are ordered
        const tPrice = state._clusterData[ro];
        const tVol = state._clusterData[ro + 1];
        const tBuy = state._clusterData[ro + 3] === 1;
        const b = priceBucket(tPrice, state.vpTickSize);
        let prev = bucketCounts.get(b);
        if (!prev) {
          prev = { count: 0, vol: 0, buyVol: 0, sellVol: 0 };
          bucketCounts.set(b, prev);
        }
        prev.count++;
        prev.vol += tVol;
        if (tBuy) prev.buyVol += tVol;
        else prev.sellVol += tVol;
      }

      for (const [b, data] of bucketCounts) {
        if (data.count >= 5) {
          const cluster = {
            price: b,
            count: data.count,
            totalVol: data.vol,
            buyVol: data.buyVol,
            sellVol: data.sellVol,
            delta: data.buyVol - data.sellVol,
            time,
            side: data.buyVol > data.sellVol ? 'buy' : 'sell',
          };

          const lastCluster = state.clusters[state.clusters.length - 1];
          if (!lastCluster || lastCluster.price !== b || time - lastCluster.time > CLUSTER_WINDOW) {
            state.clusters.push(cluster);
            if (state.clusters.length > 100) state.clusters.shift();

            for (const cb of this._onCluster) {
              try { cb({ symbol: upper, ...cluster }); } catch (e) { logger.data.warn('Operation failed', e); }
            }
          }
        }
      }
    }

    // 12. Notify symbol subscribers — build object only if subscribers exist
    if (state._subscribers.size > 0) {
      const entry = { price, volume: vol, time, side, source: tick.source };
      for (const cb of state._subscribers) {
        try { cb(entry); } catch (e) { logger.data.warn('Operation failed', e); }
      }
    }
  }

  // ─── Side Classification (Tick Rule) ───────────────────────

  /**
   * Classify a trade as buy or sell using the "tick rule":
   * - If price > lastPrice → buyer aggressor (buy)
   * - If price < lastPrice → seller aggressor (sell)
   * - If price == lastPrice → same as last classification
   */
  _classifySide(price, state) {
    if (state.lastPrice === 0) return 'buy'; // First tick defaults to buy
    if (price > state.lastPrice) return 'buy';
    if (price < state.lastPrice) return 'sell';
    return 'buy'; // Unchanged price defaults to buy (most exchanges)
  }

  // ─── Query: Delta ──────────────────────────────────────────

  /**
   * Get delta (buy vol − sell vol) for each candle in a timeframe.
   * @param {string} symbol
   * @param {string} tf - Timeframe ('1m', '5m', '15m', '1h')
   * @returns {Array<{ time, buyVol, sellVol, delta, count }>}
   */
  getDelta(symbol, tf = '5m') {
    const state = this._symbols.get((symbol || '').toUpperCase());
    if (!state) return [];
    const candleMap = state.deltas.get(tf);
    if (!candleMap) return [];
    return [...candleMap.values()].sort((a, b) => a.time - b.time);
  }

  /**
   * Get delta for a specific candle.
   * @returns {{ buyVol, sellVol, delta, count } | null}
   */
  getCandleDelta(symbol, tf, candleTime) {
    const state = this._symbols.get((symbol || '').toUpperCase());
    if (!state) return null;
    const candleMap = state.deltas.get(tf);
    if (!candleMap) return null;
    return candleMap.get(candleTime) || null;
  }

  // ─── Query: CVD ────────────────────────────────────────────

  /**
   * Get cumulative volume delta.
   * @param {string} symbol
   * @returns {{ current: number, history: Array<{ time, cvd }> }}
   */
  getCVD(symbol) {
    const state = this._symbols.get((symbol || '').toUpperCase());
    if (!state) return { current: 0, history: [] };
    return { current: state.cvd, history: [...state.cvdHistory] };
  }

  // ─── Query: Volume Profile ─────────────────────────────────

  /**
   * Get the session volume profile.
   * @param {string} symbol
   * @returns {{ levels: Array<{ price, buyVol, sellVol, totalVol }>, poc, vah, val, tickSize }}
   */
  getVolumeProfile(symbol) {
    const state = this._symbols.get((symbol || '').toUpperCase());
    if (!state || state.volumeProfile.size === 0) {
      return { levels: [], poc: null, vah: null, val: null, tickSize: 0 };
    }

    const levels = [];
    let maxVol = 0;
    let pocPrice = 0;

    for (const [price, data] of state.volumeProfile) {
      levels.push({ price, ...data });
      if (data.totalVol > maxVol) {
        maxVol = data.totalVol;
        pocPrice = price;
      }
    }

    levels.sort((a, b) => a.price - b.price);

    // Compute Value Area (70% of total volume centered on POC)
    const totalVol = levels.reduce((s, l) => s + l.totalVol, 0);
    const valueAreaTarget = totalVol * 0.70;
    let vaVol = 0;
    let val = pocPrice;
    let vah = pocPrice;

    // Expand outward from POC
    const pocIdx = levels.findIndex(l => l.price === pocPrice);
    let lo = pocIdx;
    let hi = pocIdx;
    vaVol = levels[pocIdx]?.totalVol || 0;

    while (vaVol < valueAreaTarget && (lo > 0 || hi < levels.length - 1)) {
      const loVol = lo > 0 ? levels[lo - 1].totalVol : 0;
      const hiVol = hi < levels.length - 1 ? levels[hi + 1].totalVol : 0;

      if (loVol >= hiVol && lo > 0) {
        lo--;
        vaVol += levels[lo].totalVol;
        val = levels[lo].price;
      } else if (hi < levels.length - 1) {
        hi++;
        vaVol += levels[hi].totalVol;
        vah = levels[hi].price;
      } else {
        break;
      }
    }

    return {
      levels,
      poc: pocPrice,
      vah,
      val,
      tickSize: state.vpTickSize,
    };
  }

  // ─── Query: Footprint ──────────────────────────────────────

  /**
   * Get footprint data for a specific candle (for FootprintRenderer).
   * Returns the format expected by FootprintRenderer: { [price]: { bidVol, askVol, totalVol } }
   *
   * @param {string} symbol
   * @param {number} candleTime - Candle start timestamp ms
   * @param {string} tf - Timeframe
   * @returns {{ footprint: Object, poc: number | null }}
   */
  getFootprint(symbol, candleTime, tf = '5m') {
    const state = this._symbols.get((symbol || '').toUpperCase());
    if (!state) return { footprint: null, poc: null };

    const fpMap = state.footprints.get(tf);
    if (!fpMap) return { footprint: null, poc: null };

    const priceLevels = fpMap.get(candleTime);
    if (!priceLevels) return { footprint: null, poc: null };

    // Convert Map → plain object for renderer
    const footprint = {};
    let maxVol = 0;
    let pocPrice = null;

    for (const [price, data] of priceLevels) {
      footprint[price] = { ...data };
      if (data.totalVol > maxVol) {
        maxVol = data.totalVol;
        pocPrice = price;
      }
    }

    return { footprint, poc: pocPrice };
  }

  /**
   * Attach footprint data to an array of OHLCV bars for chart rendering.
   * Modifies bars in-place by adding .footprint and .poc properties.
   *
   * @param {string} symbol
   * @param {Array} bars - OHLCV bars array
   * @param {string} tf - Timeframe
   * @returns {Array} Same bars array with .footprint/.poc attached
   */
  attachFootprints(symbol, bars, tf = '5m') {
    if (!bars || !bars.length) return bars;

    const tfMs = TF_MS[tf];
    for (const bar of bars) {
      const candleTime = snapToCandle(bar.time, tfMs);
      const { footprint, poc } = this.getFootprint(symbol, candleTime, tf);
      bar.footprint = footprint;
      bar.poc = poc;

      // Also attach delta to each bar
      const delta = this.getCandleDelta(symbol, tf, candleTime);
      if (delta) {
        bar.delta = delta.delta;
        bar.buyVol = delta.buyVol;
        bar.sellVol = delta.sellVol;
      }
    }

    return bars;
  }

  // ─── Query: Large Trades ───────────────────────────────────

  /**
   * Get recent large (anomalous) trades.
   * @param {string} symbol
   * @param {number} [limit=50]
   * @returns {Array<{ price, volume, time, side, sigma }>}
   */
  getLargeTrades(symbol, limit = 50) {
    const state = this._symbols.get((symbol || '').toUpperCase());
    if (!state) return [];
    return state.largeTrades.slice(-limit);
  }

  // ─── Query: Tick Speed ─────────────────────────────────────

  /**
   * Get current tick speed (trades per second).
   * @param {string} symbol
   * @returns {{ ticksPerSecond: number, ticksInWindow: number }}
   */
  getTickSpeed(symbol) {
    const state = this._symbols.get((symbol || '').toUpperCase());
    if (!state || state._tickTsCount < 2) {
      return { ticksPerSecond: 0, ticksInWindow: 0 };
    }

    const count = state.countTicksInWindow(TICK_SPEED_WINDOW);
    return {
      ticksPerSecond: Math.round((count / TICK_SPEED_WINDOW) * 1000 * 10) / 10,
      ticksInWindow: count,
    };
  }

  // ─── Query: Trade Clusters ─────────────────────────────────

  /**
   * Get detected trade clusters (institutional block activity).
   * @param {string} symbol
   * @param {number} [limit=20]
   * @returns {Array<{ price, count, totalVol, buyVol, sellVol, delta, time, side }>}
   */
  getClusters(symbol, limit = 20) {
    const state = this._symbols.get((symbol || '').toUpperCase());
    if (!state) return [];
    return state.clusters.slice(-limit);
  }

  // ─── Query: Aggressor Ratio ────────────────────────────────

  /**
   * Get the buy/sell aggressor ratio.
   * @param {string} symbol
   * @returns {{ buyPct, sellPct, ratio, totalBuyVol, totalSellVol }}
   */
  getAggressorRatio(symbol) {
    const state = this._symbols.get((symbol || '').toUpperCase());
    if (!state || (state.totalBuyVol + state.totalSellVol) === 0) {
      return { buyPct: 50, sellPct: 50, ratio: 1, totalBuyVol: 0, totalSellVol: 0 };
    }

    const total = state.totalBuyVol + state.totalSellVol;
    return {
      buyPct: Math.round((state.totalBuyVol / total) * 1000) / 10,
      sellPct: Math.round((state.totalSellVol / total) * 1000) / 10,
      ratio: state.totalSellVol > 0
        ? Math.round((state.totalBuyVol / state.totalSellVol) * 100) / 100
        : Infinity,
      totalBuyVol: state.totalBuyVol,
      totalSellVol: state.totalSellVol,
    };
  }

  // ─── Query: Full Stats ─────────────────────────────────────

  /**
   * Get comprehensive order flow stats for a symbol.
   * @param {string} symbol
   * @returns {Object}
   */
  getStats(symbol) {
    const upper = (symbol || '').toUpperCase();
    const state = this._symbols.get(upper);
    if (!state) {
      return { symbol: upper, active: false, totalTicks: 0 };
    }

    return {
      symbol: upper,
      active: true,
      totalTicks: state.totalTicks,
      cvd: state.cvd,
      aggressorRatio: this.getAggressorRatio(upper),
      tickSpeed: this.getTickSpeed(upper),
      recentLargeTrades: state.largeTrades.length,
      recentClusters: state.clusters.length,
      volumeProfileLevels: state.volumeProfile.size,
      tickBufferSize: state.tickCount,
    };
  }

  // ─── Subscriptions ─────────────────────────────────────────

  /**
   * Subscribe to all ticks for a symbol (post-processed).
   * @param {string} symbol
   * @param {Function} callback
   * @returns {Function} unsubscribe
   */
  subscribe(symbol, callback) {
    const upper = (symbol || '').toUpperCase();
    let state = this._symbols.get(upper);
    if (!state) {
      state = new SymbolFlowState(upper);
      this._symbols.set(upper, state);
    }
    state._subscribers.add(callback);
    return () => state._subscribers.delete(callback);
  }

  /**
   * Subscribe to large trade alerts (all symbols).
   * @param {Function} callback - ({ symbol, price, volume, time, side, sigma }) => void
   * @returns {Function} unsubscribe
   */
  onLargeTrade(callback) {
    this._onLargeTrade.add(callback);
    return () => this._onLargeTrade.delete(callback);
  }

  /**
   * Subscribe to trade cluster alerts (all symbols).
   * @param {Function} callback - ({ symbol, price, count, totalVol, delta, time, side }) => void
   * @returns {Function} unsubscribe
   */
  onCluster(callback) {
    this._onCluster.add(callback);
    return () => this._onCluster.delete(callback);
  }

  // ─── Management ────────────────────────────────────────────

  /**
   * Get all actively tracked symbols.
   * @returns {string[]}
   */
  getActiveSymbols() {
    return [...this._symbols.keys()].filter(s => {
      const state = this._symbols.get(s);
      return state && state.totalTicks > 0;
    });
  }

  /**
   * Set which timeframes to track delta/footprint data for.
   * Call this before ingesting ticks if you want different TFs.
   * @param {string[]} timeframes
   */
  setTimeframes(timeframes) {
    this._defaultTimeframes = timeframes.filter(tf => TF_MS[tf]);
  }

  /**
   * Reset state for a symbol.
   * @param {string} symbol
   */
  resetSymbol(symbol) {
    const state = this._symbols.get((symbol || '').toUpperCase());
    if (state) state.reset();
  }

  /**
   * Reset all state.
   */
  resetAll() {
    for (const state of this._symbols.values()) {
      state.reset();
    }
  }

  /**
   * Remove a symbol entirely (frees memory).
   * @param {string} symbol
   */
  removeSymbol(symbol) {
    this._symbols.delete((symbol || '').toUpperCase());
  }

  // ─── Warm Start ──────────────────────────────────────────────

  /**
   * Warm-start the engine from persisted tick data in IndexedDB.
   * Replays historical ticks through ingestTick() in "silent mode":
   *   - No subscriber notifications (avoids UI flicker)
   *   - No large trade / cluster alerts (historical noise)
   * This pre-populates CVD, delta, volume profile, and footprint.
   *
   * Call this BEFORE connecting live WS for instant analytics.
   *
   * @param {string} symbol - e.g., 'BTCUSDT'
   * @param {number} [windowMs=600000] - How far back to replay (default 10 min)
   * @returns {Promise<{ replayed: number, durationMs: number }>}
   */
  async warmStart(symbol, windowMs = 600_000) {
    const upper = (symbol || '').toUpperCase();
    if (!upper) return { replayed: 0, durationMs: 0 };

    // Dynamically import to avoid circular dependency
    let tickPersistence, pipelineLogger;
    try {
      const tp = await import('../streaming/TickPersistence.js');
      tickPersistence = tp.tickPersistence;
      const pl = await import('../infra/DataPipelineLogger.js');
      pipelineLogger = pl.pipelineLogger;
    } catch (_) {
      return { replayed: 0, durationMs: 0 };
    }

    const startTime = performance.now();
    const now = Date.now();

    try {
      const ticks = await tickPersistence.getTickRange(upper, now - windowMs, now, 50000);

      if (!ticks || ticks.length === 0) {
        pipelineLogger.info('OrderFlowEngine', `Warm start: no persisted ticks for ${upper}`);
        return { replayed: 0, durationMs: 0 };
      }

      // Get or create state
      let state = this._symbols.get(upper);
      if (!state) {
        state = new SymbolFlowState(upper);
        this._symbols.set(upper, state);
      }

      // Mark as warming — suppress subscriber notifications
      state._isWarming = true;

      // Replay ticks in order (they come sorted by time from IDB)
      for (const tick of ticks) {
        if (!tick.price || !tick.volume) continue;

        const side = tick.side || this._classifySide(tick.price, state);
        if (!state.vpTickSize) state.vpTickSize = autoTickSize(tick.price);

        const vol = tick.volume;
        const price = tick.price;
        const time = tick.time || 0;
        const isBuy = side === 'buy';

        // Store in ring buffer
        state.pushTick(price, vol, time, isBuy, tick.source || 'replay');
        state.totalTicks++;
        state.lastPrice = price;

        // Update CVD
        state.cvd += isBuy ? vol : -vol;
        state.cvdSampleCounter++;
        if (state.cvdSampleCounter >= 10) {
          state.cvdHistory.push({ time, cvd: state.cvd });
          if (state.cvdHistory.length > 5000) state.cvdHistory.shift();
          state.cvdSampleCounter = 0;
        }

        // Update deltas
        for (const tf of this._defaultTimeframes) {
          const tfMs = TF_MS[tf];
          if (!tfMs) continue;
          if (!state.deltas.has(tf)) state.deltas.set(tf, new Map());
          const candleMap = state.deltas.get(tf);
          const candleTime = snapToCandle(time, tfMs);
          let candle = candleMap.get(candleTime);
          if (!candle) {
            candle = { buyVol: 0, sellVol: 0, delta: 0, count: 0, time: candleTime };
            candleMap.set(candleTime, candle);
          }
          if (isBuy) candle.buyVol += vol; else candle.sellVol += vol;
          candle.delta = candle.buyVol - candle.sellVol;
          candle.count++;
        }

        // Update volume profile
        const bucket = priceBucket(price, state.vpTickSize);
        let vpEntry = state.volumeProfile.get(bucket);
        if (!vpEntry) {
          vpEntry = { buyVol: 0, sellVol: 0, totalVol: 0 };
          state.volumeProfile.set(bucket, vpEntry);
        }
        if (isBuy) vpEntry.buyVol += vol; else vpEntry.sellVol += vol;
        vpEntry.totalVol += vol;

        // Update footprint
        for (const tf of this._defaultTimeframes) {
          const tfMs = TF_MS[tf];
          if (!tfMs) continue;
          if (!state.footprints.has(tf)) state.footprints.set(tf, new Map());
          const fpMap = state.footprints.get(tf);
          const candleTime = snapToCandle(time, tfMs);
          if (!fpMap.has(candleTime)) fpMap.set(candleTime, new Map());
          const priceLevels = fpMap.get(candleTime);
          let level = priceLevels.get(bucket);
          if (!level) { level = { bidVol: 0, askVol: 0, totalVol: 0 }; priceLevels.set(bucket, level); }
          if (isBuy) level.askVol += vol; else level.bidVol += vol;
          level.totalVol += vol;
        }

        // Track totals
        if (isBuy) state.totalBuyVol += vol; else state.totalSellVol += vol;

        // Trade size stats (for large trade detection once live)
        state.pushTradeSize(vol);
        state.pushTickTimestamp(time);
      }

      // Done warming
      state._isWarming = false;

      const durationMs = Math.round(performance.now() - startTime);
      pipelineLogger.info('OrderFlowEngine',
        `Warm start complete: ${upper} — ${ticks.length} ticks replayed in ${durationMs}ms`);

      return { replayed: ticks.length, durationMs };

    } catch (err) {
      pipelineLogger?.warn?.('OrderFlowEngine', `Warm start failed for ${upper}`, err);
      return { replayed: 0, durationMs: Math.round(performance.now() - startTime) };
    }
  }

  /**
   * Check if the engine is currently warming from persisted data.
   * @param {string} symbol
   * @returns {boolean}
   */
  isWarming(symbol) {
    const state = this._symbols.get((symbol || '').toUpperCase());
    return state?._isWarming || false;
  }

  /**
   * Dispose: clear everything.
   */
  dispose() {
    this._symbols.clear();
    this._onLargeTrade.clear();
    this._onCluster.clear();
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const orderFlowEngine = new _OrderFlowEngine();
export default orderFlowEngine;
