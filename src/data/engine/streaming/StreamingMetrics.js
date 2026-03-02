// ═══════════════════════════════════════════════════════════════════
// charEdge v15 — Streaming Metrics Engine
//
// Continuous, O(1)-per-tick derived computations from raw trade data.
// Each metric maintains running state and updates incrementally —
// no batch recomputation needed.
//
// This replaces the on-demand pattern in DerivedDataEngine for
// real-time metrics. DerivedDataEngine still handles batch
// computations (correlation matrix, sector rotation, etc.).
//
// Metrics:
//   1. Order Imbalance Ratio — (buyVol - sellVol) / total per window
//   2. Trade Arrival Rate    — Poisson λ (trades/sec), institutional detector
//   3. Running TWAP          — Time-weighted average price, reset daily
//   4. Volume Clock Bars     — Bars emitted after N volume traded
//   5. Volatility Regime     — Adaptive threshold classification
//   6. Delta Divergence      — Price vs CVD divergence score
//   7. Absorption Detection  — Passive orders absorbing aggression
//   8. Price Impact Model    — ΔPrice = α + β * signedVolume regression
//
// Usage:
//   import { streamingMetrics } from './StreamingMetrics.js';
//   streamingMetrics.onTick('BTCUSDT', tick);
//   const snapshot = streamingMetrics.getSnapshot('BTCUSDT');
//   streamingMetrics.subscribe('BTCUSDT', (metrics) => { ... });
// ═══════════════════════════════════════════════════════════════════

// ─── Constants ─────────────────────────────────────────────────

const IMBALANCE_WINDOW_MS = 10000;     // 10-second sliding window
const ARRIVAL_WINDOW_MS = 5000;        // 5-second window for λ
const VOL_REGIME_LOOKBACK = 200;       // Ticks for volatility regime
const ABSORPTION_WINDOW = 50;          // Last 50 ticks for absorption
const IMPACT_WINDOW = 100;             // Last 100 ticks for price impact
const VOLUME_BAR_SIZE_DEFAULT = 100;   // Default volume per bar (auto-adjusted)
const DIVERGENCE_LOOKBACK = 300;       // CVD divergence lookback
const IMBALANCE_MAX_ENTRIES = 2000;    // Hard cap for imbalance window
const ARRIVAL_MAX_ENTRIES = 2000;      // Hard cap for arrival times

// ─── O(1) Circular Buffer ──────────────────────────────────────

/**
 * Fixed-capacity ring buffer — O(1) push with automatic oldest-eviction.
 * Replaces Array + shift() pattern which is O(n) per eviction.
 */
class CircularBuffer {
  constructor(capacity) {
    this._buf = new Array(capacity);
    this._cap = capacity;
    this._head = 0;   // Next write position
    this._size = 0;
  }

  /** Push an item. If at capacity, overwrites the oldest entry. Returns evicted item or undefined. */
  push(item) {
    let evicted;
    if (this._size === this._cap) {
      // Overwrite oldest — head is already pointing at it
      evicted = this._buf[this._head];
    } else {
      this._size++;
    }
    this._buf[this._head] = item;
    this._head = (this._head + 1) % this._cap;
    return evicted;
  }

  /** Drain (evict) items from the oldest end while predicate is true. Calls onEvict for each. */
  drainWhile(predicate, onEvict) {
    if (this._size === 0) return;
    let start = (this._head - this._size + this._cap) % this._cap;
    while (this._size > 0) {
      const item = this._buf[start];
      if (!predicate(item)) break;
      if (onEvict) onEvict(item);
      this._buf[start] = undefined; // Allow GC
      start = (start + 1) % this._cap;
      this._size--;
    }
  }

  /** Iterate all items in insertion order (oldest → newest). */
  forEach(fn) {
    if (this._size === 0) return;
    let idx = (this._head - this._size + this._cap) % this._cap;
    for (let i = 0; i < this._size; i++) {
      fn(this._buf[idx], i);
      idx = (idx + 1) % this._cap;
    }
  }

  /** Reduce over all items in insertion order. */
  reduce(fn, init) {
    let acc = init;
    this.forEach((item, i) => { acc = fn(acc, item, i); });
    return acc;
  }

  /** Get item at logical index (0 = oldest). */
  at(i) {
    if (i < 0 || i >= this._size) return undefined;
    return this._buf[((this._head - this._size + this._cap) % this._cap + i) % this._cap];
  }

  /** Get the oldest item. */
  first() { return this._size > 0 ? this.at(0) : undefined; }

  /** Get the newest item. */
  last() { return this._size > 0 ? this.at(this._size - 1) : undefined; }

  /** Return items as a plain array (oldest → newest). */
  toArray() {
    const arr = new Array(this._size);
    let idx = (this._head - this._size + this._cap) % this._cap;
    for (let i = 0; i < this._size; i++) {
      arr[i] = this._buf[idx];
      idx = (idx + 1) % this._cap;
    }
    return arr;
  }

  /** Slice a range [start, end) as plain array. */
  slice(start = 0, end = this._size) {
    const s = Math.max(0, start);
    const e = Math.min(this._size, end);
    const arr = new Array(Math.max(0, e - s));
    let idx = ((this._head - this._size + this._cap) % this._cap + s) % this._cap;
    for (let i = 0; i < arr.length; i++) {
      arr[i] = this._buf[idx];
      idx = (idx + 1) % this._cap;
    }
    return arr;
  }

  get length() { return this._size; }

  clear() {
    this._buf.fill(undefined);
    this._head = 0;
    this._size = 0;
  }
}

// ─── Per-Symbol Streaming State ────────────────────────────────

class SymbolMetricsState {
  constructor(symbol) {
    this.symbol = symbol;

    // ── Order Imbalance ──
    this.imbalanceWindow = new CircularBuffer(IMBALANCE_MAX_ENTRIES);  // { time, vol, isBuy }
    this.imbalanceBuyVol = 0;
    this.imbalanceSellVol = 0;

    // ── Trade Arrival Rate ──
    this.arrivalTimes = new CircularBuffer(ARRIVAL_MAX_ENTRIES);  // timestamps

    // ── Running TWAP ──
    this.twapSum = 0;           // Σ(price * Δt)
    this.twapTimeSum = 0;       // Σ(Δt)
    this.twapLastTime = 0;
    this.twapLastPrice = 0;
    this.twapResetDay = 0;      // Day of year for daily reset

    // ── Volume Clock Bars ──
    this.vcBarVolAccum = 0;     // Volume accumulated since last bar
    this.vcBarOpen = 0;
    this.vcBarHigh = 0;
    this.vcBarLow = Infinity;
    this.vcBarClose = 0;
    this.vcBarBuyVol = 0;
    this.vcBarSellVol = 0;
    this.vcBarStartTime = 0;
    this.vcBars = new CircularBuffer(500);  // Completed volume clock bars
    this.vcBarSize = VOLUME_BAR_SIZE_DEFAULT;

    // ── Volatility Regime ──
    this.volReturns = new CircularBuffer(VOL_REGIME_LOOKBACK);  // Recent log-returns
    this.volLastPrice = 0;
    this.volRegime = 'normal';  // 'low' | 'normal' | 'high' | 'extreme'
    this.volValue = 0;

    // ── Delta Divergence ──
    this.divPriceHistory = new CircularBuffer(DIVERGENCE_LOOKBACK);  // { time, price }
    this.divCvdHistory = new CircularBuffer(DIVERGENCE_LOOKBACK);    // { time, cvd }
    this.divRunningCvd = 0;
    this.divScore = 0;          // -1 (bearish) to +1 (bullish)

    // ── Absorption Detection ──
    this.absBuffer = new CircularBuffer(ABSORPTION_WINDOW);  // { price, vol, side, delta }
    this.absSignal = null;      // null | { type: 'buy_absorption'|'sell_absorption', strength }

    // ── Price Impact Model ──
    this.impactBuffer = new CircularBuffer(IMPACT_WINDOW);  // { dprice, signedVol }
    this.impactAlpha = 0;
    this.impactBeta = 0;

    // ── Subscribers ──
    this._subscribers = new Set();

    // ── Tick counter ──
    this.tickCount = 0;
  }
}

// ─── Streaming Metrics Engine ──────────────────────────────────

class _StreamingMetrics {
  constructor() {
    this._symbols = new Map(); // symbol → SymbolMetricsState
    this._wsService = null;    // WebSocketService ref for connection health
  }

  /**
   * Wire up a WebSocketService instance for connection health reporting.
   * Called from AppBoot to avoid circular imports.
   * @param {Object} ws - WebSocketService instance with getHealthMetrics()
   */
  setWsService(ws) {
    this._wsService = ws;
  }

  // ─── Tick Ingestion ────────────────────────────────────────

  /**
   * Process a tick through all streaming metrics.
   * Called from OrderFlowBridge fan-out on every trade.
   *
   * @param {string} symbol - e.g., 'BTCUSDT'
   * @param {Object} tick - { price, volume, time, side }
   */
  onTick(symbol, tick) {
    const upper = (symbol || '').toUpperCase();
    if (!tick || !tick.price) return;

    let state = this._symbols.get(upper);
    if (!state) {
      state = new SymbolMetricsState(upper);
      this._symbols.set(upper, state);
    }

    const { price, volume, time, side } = tick;
    const isBuy = side === 'buy' || side === 1;
    const now = time || Date.now();

    state.tickCount++;

    // 1. Order Imbalance
    this._updateImbalance(state, volume, isBuy, now);

    // 2. Trade Arrival Rate
    this._updateArrivalRate(state, now);

    // 3. Running TWAP
    this._updateTWAP(state, price, now);

    // 4. Volume Clock Bars
    this._updateVolumeClockBar(state, price, volume, isBuy, now);

    // 5. Volatility Regime
    this._updateVolatilityRegime(state, price);

    // 6. Delta Divergence
    this._updateDeltaDivergence(state, price, volume, isBuy, now);

    // 7. Absorption Detection
    this._updateAbsorption(state, price, volume, isBuy);

    // 8. Price Impact Model
    this._updatePriceImpact(state, price, volume, isBuy);

    // Notify subscribers (every 10 ticks to avoid excessive callbacks)
    if (state.tickCount % 10 === 0) {
      this._notifySubscribers(state);
    }
  }

  // ─── Metric Implementations ──────────────────────────────────

  /** @private — Sliding window order imbalance ratio */
  _updateImbalance(state, volume, isBuy, time) {
    state.imbalanceWindow.push({ time, vol: volume, isBuy });
    if (isBuy) state.imbalanceBuyVol += volume;
    else state.imbalanceSellVol += volume;

    // Evict expired entries — O(1) circular buffer drain
    const cutoff = time - IMBALANCE_WINDOW_MS;
    state.imbalanceWindow.drainWhile(
      (entry) => entry.time < cutoff,
      (evicted) => {
        if (evicted.isBuy) state.imbalanceBuyVol -= evicted.vol;
        else state.imbalanceSellVol -= evicted.vol;
      }
    );
  }

  /** @private — Trade arrival rate (Poisson λ) */
  _updateArrivalRate(state, time) {
    state.arrivalTimes.push(time);
    const cutoff = time - ARRIVAL_WINDOW_MS;
    state.arrivalTimes.drainWhile((t) => t < cutoff);
  }

  /** @private — Running Time-Weighted Average Price */
  _updateTWAP(state, price, time) {
    // Reset daily
    const dayOfYear = Math.floor(time / 86400000);
    if (dayOfYear !== state.twapResetDay) {
      state.twapSum = 0;
      state.twapTimeSum = 0;
      state.twapLastTime = time;
      state.twapResetDay = dayOfYear;
    }

    if (state.twapLastTime > 0 && state.twapLastPrice > 0) {
      const dt = time - state.twapLastTime;
      if (dt > 0 && dt < 60000) { // Ignore gaps > 1 minute
        state.twapSum += state.twapLastPrice * dt;
        state.twapTimeSum += dt;
      }
    }

    state.twapLastTime = time;
    state.twapLastPrice = price;
  }

  /** @private — Volume clock bars */
  _updateVolumeClockBar(state, price, volume, isBuy, time) {
    if (state.vcBarOpen === 0) {
      state.vcBarOpen = price;
      state.vcBarStartTime = time;
    }

    state.vcBarHigh = Math.max(state.vcBarHigh, price);
    state.vcBarLow = Math.min(state.vcBarLow, price);
    state.vcBarClose = price;
    state.vcBarVolAccum += volume;
    if (isBuy) state.vcBarBuyVol += volume;
    else state.vcBarSellVol += volume;

    // Emit bar when volume threshold is reached
    if (state.vcBarVolAccum >= state.vcBarSize) {
      state.vcBars.push({
        time: state.vcBarStartTime,
        open: state.vcBarOpen,
        high: state.vcBarHigh,
        low: state.vcBarLow,
        close: state.vcBarClose,
        volume: state.vcBarVolAccum,
        buyVol: state.vcBarBuyVol,
        sellVol: state.vcBarSellVol,
        delta: state.vcBarBuyVol - state.vcBarSellVol,
        duration: time - state.vcBarStartTime,
      });

      // CircularBuffer auto-evicts at capacity (500)

      // Reset
      state.vcBarOpen = price;
      state.vcBarHigh = price;
      state.vcBarLow = price;
      state.vcBarClose = price;
      state.vcBarVolAccum = 0;
      state.vcBarBuyVol = 0;
      state.vcBarSellVol = 0;
      state.vcBarStartTime = time;
    }
  }

  /** @private — Volatility regime classification */
  _updateVolatilityRegime(state, price) {
    if (state.volLastPrice > 0) {
      const logReturn = Math.log(price / state.volLastPrice);
      state.volReturns.push(logReturn); // CircularBuffer auto-evicts at VOL_REGIME_LOOKBACK
    }
    state.volLastPrice = price;

    // Classify regime once we have enough data
    if (state.volReturns.length >= 20) {
      const n = state.volReturns.length;
      const mean = state.volReturns.reduce((s, v) => s + v, 0) / n;
      const variance = state.volReturns.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
      const vol = Math.sqrt(variance) * Math.sqrt(252 * 24 * 60); // Annualized from tick returns

      state.volValue = Math.round(vol * 10000) / 100; // As percentage

      if (vol < 0.15) state.volRegime = 'low';
      else if (vol < 0.40) state.volRegime = 'normal';
      else if (vol < 0.80) state.volRegime = 'high';
      else state.volRegime = 'extreme';
    }
  }

  /** @private — Delta divergence: price vs CVD */
  _updateDeltaDivergence(state, price, volume, isBuy, time) {
    const signedVol = isBuy ? volume : -volume;
    state.divRunningCvd += signedVol;

    state.divPriceHistory.push({ time, price });  // CircularBuffer auto-evicts at DIVERGENCE_LOOKBACK
    state.divCvdHistory.push({ time, cvd: state.divRunningCvd });

    // Compute divergence every 50 ticks
    if (state.divPriceHistory.length >= 50 && state.tickCount % 50 === 0) {
      const len = state.divPriceHistory.length;
      const half = Math.floor(len / 2);

      const priceFirst = state.divPriceHistory.slice(0, half);
      const priceLast = state.divPriceHistory.slice(half, len);
      const cvdFirst = state.divCvdHistory.slice(0, half);
      const cvdLast = state.divCvdHistory.slice(half, len);

      const priceChange = (priceLast[priceLast.length - 1].price - priceFirst[0].price) / priceFirst[0].price;
      const cvdChange = cvdLast[cvdLast.length - 1].cvd - cvdFirst[0].cvd;

      // Divergence: price going up but CVD going down (or vice versa)
      if (priceChange > 0.001 && cvdChange < 0) {
        // Bearish divergence: price up, CVD down
        state.divScore = -Math.min(1, Math.abs(priceChange) * 100);
      } else if (priceChange < -0.001 && cvdChange > 0) {
        // Bullish divergence: price down, CVD up
        state.divScore = Math.min(1, Math.abs(priceChange) * 100);
      } else {
        // No divergence — decay toward 0
        state.divScore *= 0.9;
      }
    }
  }

  /** @private — Absorption detection */
  _updateAbsorption(state, price, volume, isBuy) {
    const delta = isBuy ? volume : -volume;
    state.absBuffer.push({ price, vol: volume, isBuy, delta }); // CircularBuffer auto-evicts at ABSORPTION_WINDOW

    if (state.absBuffer.length < 20) {
      state.absSignal = null;
      return;
    }

    // Check for absorption: large sell delta but price doesn't drop (buy absorption)
    const recentDelta = state.absBuffer.reduce((s, t) => s + t.delta, 0);
    const priceStart = state.absBuffer.first().price;
    const priceEnd = state.absBuffer.last().price;
    const priceChangePct = (priceEnd - priceStart) / priceStart;

    // Buy absorption: net selling pressure but price holds or rises
    if (recentDelta < 0 && priceChangePct > -0.001) {
      const strength = Math.min(1, Math.abs(recentDelta) / 10);
      state.absSignal = { type: 'buy_absorption', strength, delta: recentDelta, priceChange: priceChangePct };
    }
    // Sell absorption: net buying pressure but price holds or drops
    else if (recentDelta > 0 && priceChangePct < 0.001) {
      const strength = Math.min(1, Math.abs(recentDelta) / 10);
      state.absSignal = { type: 'sell_absorption', strength, delta: recentDelta, priceChange: priceChangePct };
    } else {
      state.absSignal = null;
    }
  }

  /** @private — Simple linear regression for price impact */
  _updatePriceImpact(state, price, volume, isBuy) {
    if (state.impactBuffer.length > 0) {
      const lastPrice = state.impactBuffer.last()._price;
      const dprice = price - lastPrice;
      const signedVol = isBuy ? volume : -volume;
      state.impactBuffer.push({ dprice, signedVol, _price: price }); // CircularBuffer auto-evicts
    } else {
      state.impactBuffer.push({ dprice: 0, signedVol: 0, _price: price });
    }

    // Fit linear regression every 50 ticks
    if (state.impactBuffer.length >= 30 && state.tickCount % 50 === 0) {
      const n = state.impactBuffer.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

      state.impactBuffer.forEach((pt) => {
        sumX += pt.signedVol;
        sumY += pt.dprice;
        sumXY += pt.signedVol * pt.dprice;
        sumX2 += pt.signedVol ** 2;
      });

      const denom = n * sumX2 - sumX ** 2;
      if (Math.abs(denom) > 1e-10) {
        state.impactBeta = (n * sumXY - sumX * sumY) / denom;
        state.impactAlpha = (sumY - state.impactBeta * sumX) / n;
      }
    }
  }

  // ─── Query API ───────────────────────────────────────────────

  /**
   * Get a complete snapshot of all streaming metrics for a symbol.
   *
   * @param {string} symbol
   * @returns {Object|null}
   */
  getSnapshot(symbol) {
    const state = this._symbols.get((symbol || '').toUpperCase());
    if (!state) return null;

    const totalImbalanceVol = state.imbalanceBuyVol + state.imbalanceSellVol;

    return {
      symbol: state.symbol,
      tickCount: state.tickCount,

      // Order Imbalance: -1 (all sell) to +1 (all buy)
      orderImbalance: totalImbalanceVol > 0
        ? Math.round(((state.imbalanceBuyVol - state.imbalanceSellVol) / totalImbalanceVol) * 1000) / 1000
        : 0,

      // Trade Arrival Rate (trades/sec)
      tradeArrivalRate: state.arrivalTimes.length > 1
        ? Math.round((state.arrivalTimes.length / (ARRIVAL_WINDOW_MS / 1000)) * 10) / 10
        : 0,

      // Running TWAP
      twap: state.twapTimeSum > 0
        ? Math.round((state.twapSum / state.twapTimeSum) * 100) / 100
        : state.twapLastPrice,

      // Volatility Regime
      volatilityRegime: state.volRegime,
      volatilityPct: state.volValue,

      // Delta Divergence Score: -1 (bearish div) to +1 (bullish div)
      deltaDivergence: Math.round(state.divScore * 1000) / 1000,

      // Absorption Signal
      absorption: state.absSignal,

      // Price Impact Model
      priceImpact: {
        alpha: Math.round(state.impactAlpha * 1e8) / 1e8,
        beta: Math.round(state.impactBeta * 1e8) / 1e8,
        interpretation: state.impactBeta > 0
          ? 'positive' // buying pushes price up (normal)
          : state.impactBeta < 0 ? 'negative' : 'neutral', // selling pushes price up (unusual)
      },

      // Volume Clock Bars count
      volumeClockBars: state.vcBars.length,
      currentBarProgress: state.vcBarSize > 0
        ? Math.round((state.vcBarVolAccum / state.vcBarSize) * 100)
        : 0,

      // Connection Health (wired via setWsService)
      connectionHealth: this._wsService?.getHealthMetrics?.() || null,
    };
  }

  /**
   * Get volume clock bars for a symbol.
   *
   * @param {string} symbol
   * @param {number} [limit=100]
   * @returns {Array}
   */
  getVolumeClockBars(symbol, limit = 100) {
    const state = this._symbols.get((symbol || '').toUpperCase());
    if (!state) return [];
    const len = state.vcBars.length;
    return state.vcBars.slice(Math.max(0, len - limit), len);
  }

  /**
   * Set the volume bar size (auto-adjust or manual).
   *
   * @param {string} symbol
   * @param {number} size - Volume per bar
   */
  setVolumeBarSize(symbol, size) {
    const state = this._symbols.get((symbol || '').toUpperCase());
    if (state && size > 0) {
      state.vcBarSize = size;
    }
  }

  /**
   * Subscribe to streaming metric updates for a symbol.
   * Callback fires every ~10 ticks with the latest snapshot.
   *
   * @param {string} symbol
   * @param {Function} callback - (snapshot) => void
   * @returns {Function} unsubscribe
   */
  subscribe(symbol, callback) {
    const upper = (symbol || '').toUpperCase();
    let state = this._symbols.get(upper);
    if (!state) {
      state = new SymbolMetricsState(upper);
      this._symbols.set(upper, state);
    }
    state._subscribers.add(callback);
    return () => state._subscribers.delete(callback);
  }

  /**
   * Check if metrics are active for a symbol.
   */
  isActive(symbol) {
    return this._symbols.has((symbol || '').toUpperCase());
  }

  /**
   * Get all active symbols.
   */
  getActiveSymbols() {
    return [...this._symbols.keys()];
  }

  /**
   * Reset metrics for a symbol.
   */
  reset(symbol) {
    const upper = (symbol || '').toUpperCase();
    const state = this._symbols.get(upper);
    if (state) {
      const subs = state._subscribers;
      this._symbols.set(upper, new SymbolMetricsState(upper));
      this._symbols.get(upper)._subscribers = subs;
    }
  }

  /**
   * Dispose of all state.
   */
  dispose() {
    this._symbols.clear();
  }

  // ─── Private ─────────────────────────────────────────────────

  /** @private */
  _notifySubscribers(state) {
    if (state._subscribers.size === 0) return;
    const snapshot = this.getSnapshot(state.symbol);
    for (const cb of state._subscribers) {
      try { cb(snapshot); } catch { /* ignore */ }
    }
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export { CircularBuffer };
export const streamingMetrics = new _StreamingMetrics();
export default streamingMetrics;
