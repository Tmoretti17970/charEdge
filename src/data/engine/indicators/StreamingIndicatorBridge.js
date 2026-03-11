import { logger } from '@/observability/logger';

// ═══════════════════════════════════════════════════════════════════
// charEdge v15 — Streaming Indicator Bridge
//
// Maintains running state for technical indicators in a dedicated
// Worker, enabling O(1) incremental updates per tick instead of
// O(N) full recomputation per candle.
//
// Supported streaming indicators:
//   • Running EMA / SMA
//   • Running RSI (maintaining up/down averages)
//   • Running MACD (three running EMAs)
//   • Running Bollinger Bands (running mean + variance)
//   • Running ATR (running true range average)
//   • Running OBV (cumulative)
//   • Running VWAP (cumulative price × vol / cumulative vol)
//
// Usage:
//   import { streamingIndicatorBridge } from './StreamingIndicatorBridge.js';
//   streamingIndicatorBridge.activate('BTCUSDT', ['ema', 'rsi', 'macd']);
//   streamingIndicatorBridge.onTick('BTCUSDT', tick);
//   const values = streamingIndicatorBridge.getValues('BTCUSDT');
// ═══════════════════════════════════════════════════════════════════

// ─── Running Indicator State Classes ───────────────────────────

class RunningEMA {
  constructor(period) {
    this.period = period;
    this.k = 2 / (period + 1);
    this.value = null;
    this.count = 0;
    this.sum = 0;
  }

  update(price) {
    this.count++;
    if (this.value === null) {
      this.sum += price;
      if (this.count >= this.period) {
        this.value = this.sum / this.period;
      }
    } else {
      this.value = price * this.k + this.value * (1 - this.k);
    }
    return this.value;
  }
}

class RunningSMA {
  constructor(period) {
    this.period = period;
    this.window = [];
    this.sum = 0;
    this.value = null;
  }

  update(price) {
    this.window.push(price);
    this.sum += price;
    if (this.window.length > this.period) {
      this.sum -= this.window.shift();
    }
    this.value = this.window.length >= this.period ? this.sum / this.period : null;
    return this.value;
  }
}

class RunningRSI {
  constructor(period = 14) {
    this.period = period;
    this.avgGain = 0;
    this.avgLoss = 0;
    this.prevPrice = null;
    this.count = 0;
    this.value = null;
  }

  update(price) {
    if (this.prevPrice === null) {
      this.prevPrice = price;
      return null;
    }

    const change = price - this.prevPrice;
    this.prevPrice = price;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    this.count++;
    if (this.count <= this.period) {
      this.avgGain += gain / this.period;
      this.avgLoss += loss / this.period;
      if (this.count === this.period) {
        const rs = this.avgLoss === 0 ? 100 : this.avgGain / this.avgLoss;
        this.value = 100 - 100 / (1 + rs);
      }
    } else {
      this.avgGain = (this.avgGain * (this.period - 1) + gain) / this.period;
      this.avgLoss = (this.avgLoss * (this.period - 1) + loss) / this.period;
      const rs = this.avgLoss === 0 ? 100 : this.avgGain / this.avgLoss;
      this.value = 100 - 100 / (1 + rs);
    }

    return this.value;
  }
}

class RunningMACD {
  constructor(fast = 12, slow = 26, signal = 9) {
    this.fastEMA = new RunningEMA(fast);
    this.slowEMA = new RunningEMA(slow);
    this.signalEMA = new RunningEMA(signal);
    this.value = { macd: null, signal: null, histogram: null };
  }

  update(price) {
    const fast = this.fastEMA.update(price);
    const slow = this.slowEMA.update(price);

    if (fast !== null && slow !== null) {
      const macd = fast - slow;
      const signal = this.signalEMA.update(macd);
      this.value = {
        macd: Math.round(macd * 1e6) / 1e6,
        signal: signal != null ? Math.round(signal * 1e6) / 1e6 : null,
        histogram: signal != null ? Math.round((macd - signal) * 1e6) / 1e6 : null,
      };
    }

    return this.value;
  }
}

class RunningBollinger {
  constructor(period = 20, multiplier = 2) {
    this.sma = new RunningSMA(period);
    this.period = period;
    this.multiplier = multiplier;
    this.window = [];
    this.value = { upper: null, middle: null, lower: null };
  }

  update(price) {
    const mid = this.sma.update(price);
    this.window.push(price);
    if (this.window.length > this.period) this.window.shift();

    if (mid !== null && this.window.length >= this.period) {
      const mean = mid;
      let variance = 0;
      for (const v of this.window) variance += (v - mean) ** 2;
      const sd = Math.sqrt(variance / this.window.length);
      this.value = {
        upper: Math.round((mid + this.multiplier * sd) * 100) / 100,
        middle: Math.round(mid * 100) / 100,
        lower: Math.round((mid - this.multiplier * sd) * 100) / 100,
      };
    }

    return this.value;
  }
}

class RunningATR {
  constructor(period = 14) {
    this.period = period;
    this.prevClose = null;
    this.count = 0;
    this.value = null;
    this.sum = 0;
  }

  updateCandle(high, low, close) {
    let tr;
    if (this.prevClose === null) {
      tr = high - low;
    } else {
      tr = Math.max(high - low, Math.abs(high - this.prevClose), Math.abs(low - this.prevClose));
    }
    this.prevClose = close;
    this.count++;

    if (this.count <= this.period) {
      this.sum += tr;
      if (this.count === this.period) {
        this.value = this.sum / this.period;
      }
    } else if (this.value !== null) {
      this.value = (this.value * (this.period - 1) + tr) / this.period;
    }

    return this.value;
  }
}

class RunningOBV {
  constructor() {
    this.value = 0;
    this.prevPrice = null;
  }

  update(price, volume) {
    if (this.prevPrice !== null) {
      if (price > this.prevPrice) this.value += volume;
      else if (price < this.prevPrice) this.value -= volume;
    }
    this.prevPrice = price;
    return this.value;
  }
}

class RunningVWAP {
  constructor() {
    this.cumPV = 0;
    this.cumVol = 0;
    this.value = 0;
    this.dayStart = 0;
  }

  update(price, volume, time) {
    // Reset daily
    const day = Math.floor(time / 86400000);
    if (day !== this.dayStart) {
      this.cumPV = 0;
      this.cumVol = 0;
      this.dayStart = day;
    }

    this.cumPV += price * volume;
    this.cumVol += volume;
    this.value = this.cumVol > 0 ? this.cumPV / this.cumVol : price;
    return Math.round(this.value * 100) / 100;
  }
}

// ─── Indicator Factory ─────────────────────────────────────────

const INDICATOR_FACTORIES = {
  ema: (params) => new RunningEMA(params?.period || 20),
  sma: (params) => new RunningSMA(params?.period || 20),
  rsi: (params) => new RunningRSI(params?.period || 14),
  macd: (params) => new RunningMACD(params?.fast || 12, params?.slow || 26, params?.signal || 9),
  bollinger: (params) => new RunningBollinger(params?.period || 20, params?.multiplier || 2),
  atr: (params) => new RunningATR(params?.period || 14),
  obv: () => new RunningOBV(),
  vwap: () => new RunningVWAP(),
};

// ─── Streaming Indicator Bridge ────────────────────────────────
// v17: Delegates tick processing to StreamingIndicatorWorker.
// Falls back to main-thread computation if Workers unavailable.

class _StreamingIndicatorBridge {
  constructor() {
    this._symbols = new Map(); // symbol → { indicators: Map<name, instance>, subscribers }
    this._worker = null;
    this._workerReady = false;
    this._lastValues = new Map(); // symbol → { ema: ..., rsi: ... }
    this._pendingRequests = new Map(); // requestId → resolve
    this._requestIdCounter = 0;

    this._initWorker();
  }

  /** @private — Try to spin up the dedicated indicator worker */
  _initWorker() {
    if (typeof Worker === 'undefined') return;

    try {
      const workerUrl = new URL('./StreamingIndicatorWorker.js', import.meta.url);
      this._worker = new Worker(workerUrl, { type: 'module' });

      this._worker.onmessage = (event) => {
        const msg = event.data;

        if (msg.type === 'ready') {
          this._workerReady = true;
          return;
        }

        if (msg.type === 'values') {
          this._lastValues.set(msg.symbol, msg.values);
          // Fan out to subscribers
          const state = this._symbols.get(msg.symbol);
          if (state && state.subscribers.size > 0) {
            for (const cb of state.subscribers) {
              try { cb(msg.values); } catch (e) { logger.data.warn('Operation failed', e); }
            }
          }
        }

        if (msg.type === 'response') {
          const pending = this._pendingRequests.get(msg.requestId);
          if (pending) {
            pending(msg.values);
            this._pendingRequests.delete(msg.requestId);
          }
        }
      };

      this._worker.onerror = () => {
        // Worker failed — fall back to main thread
        this._worker = null;
        this._workerReady = false;
      };
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
      this._worker = null;
    }
  }

  /**
   * Activate streaming indicators for a symbol.
   *
   * @param {string} symbol - e.g., 'BTCUSDT'
   * @param {Array<string|Object>} indicators - ['ema', 'rsi'] or [{ name: 'ema', period: 12 }]
   */
  activate(symbol, indicators = ['ema', 'rsi', 'macd', 'obv', 'vwap']) {
    const upper = (symbol || '').toUpperCase();
    if (!this._symbols.has(upper)) {
      this._symbols.set(upper, { indicators: new Map(), subscribers: new Set() });
    }

    const state = this._symbols.get(upper);

    // Create main-thread fallback instances
    for (const ind of indicators) {
      const name = typeof ind === 'string' ? ind : ind.name;
      const params = typeof ind === 'string' ? {} : ind;
      const key = typeof ind === 'string' ? ind : `${ind.name}_${ind.period || ''}`;

      if (!state.indicators.has(key) && INDICATOR_FACTORIES[name]) {
        state.indicators.set(key, {
          name,
          instance: INDICATOR_FACTORIES[name](params),
          lastValue: null,
        });
      }
    }

    // Tell the worker to activate too
    if (this._worker) {
      this._worker.postMessage({ type: 'activate', symbol: upper, indicators });
    }
  }

  /**
   * Process a tick through all active streaming indicators.
   * Delegates to Worker if available, else runs on main thread.
   *
   * @param {string} symbol
   * @param {Object} tick - { price, volume, time, side }
   */
  onTick(symbol, tick) {
    const upper = (symbol || '').toUpperCase();
    const state = this._symbols.get(upper);
    if (!state) return;

    const { price, volume, time } = tick;

    // Delegate to worker (off main thread)
    if (this._worker && this._workerReady) {
      this._worker.postMessage({ type: 'tick', symbol: upper, price, volume, time: time || Date.now() });
      return;
    }

    // Fallback: main-thread computation
    for (const [_key, entry] of state.indicators) {
      const inst = entry.instance;
      let value;

      if (inst instanceof RunningVWAP) {
        value = inst.update(price, volume, time || Date.now());
      } else if (inst instanceof RunningOBV) {
        value = inst.update(price, volume);
      } else if (inst instanceof RunningATR) {
        value = inst.updateCandle(price, price, price);
      } else if (inst.update) {
        value = inst.update(price);
      }

      entry.lastValue = value;
    }

    // Notify subscribers
    if (state.subscribers.size > 0) {
      const values = this.getValues(upper);
      for (const cb of state.subscribers) {
        try { cb(values); } catch (e) { logger.data.warn('Operation failed', e); }
      }
    }
  }

  /**
   * Get current values of all active indicators for a symbol.
   * Returns cached worker values if available, else main-thread values.
   *
   * @param {string} symbol
   * @returns {Object} { ema: value, rsi: value, macd: { ... }, ... }
   */
  getValues(symbol) {
    const upper = (symbol || '').toUpperCase();

    // Prefer worker-emitted values (most recent)
    const workerValues = this._lastValues.get(upper);
    if (workerValues) return workerValues;

    // Fallback to main-thread values
    const state = this._symbols.get(upper);
    if (!state) return {};

    const values = {};
    for (const [key, entry] of state.indicators) {
      values[key] = entry.lastValue;
    }
    return values;
  }

  /**
   * Subscribe to streaming indicator updates.
   *
   * @param {string} symbol
   * @param {Function} callback
   * @returns {Function} unsubscribe
   */
  subscribe(symbol, callback) {
    const upper = (symbol || '').toUpperCase();
    const state = this._symbols.get(upper);
    if (!state) return () => {};

    state.subscribers.add(callback);
    return () => state.subscribers.delete(callback);
  }

  /**
   * Deactivate all indicators for a symbol.
   */
  deactivate(symbol) {
    const upper = (symbol || '').toUpperCase();
    this._symbols.delete(upper);
    this._lastValues.delete(upper);

    if (this._worker) {
      this._worker.postMessage({ type: 'deactivate', symbol: upper });
    }
  }

  /**
   * Get active symbols and their indicators.
   */
  getActiveSymbols() {
    const result = {};
    for (const [sym, state] of this._symbols) {
      result[sym] = [...state.indicators.keys()];
    }
    return result;
  }

  /**
   * Is worker offload active?
   */
  isWorkerActive() {
    return this._worker !== null && this._workerReady;
  }

  /**
   * Dispose.
   */
  dispose() {
    this._symbols.clear();
    this._lastValues.clear();
    if (this._worker) {
      this._worker.terminate();
      this._worker = null;
    }
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const streamingIndicatorBridge = new _StreamingIndicatorBridge();
export default streamingIndicatorBridge;

