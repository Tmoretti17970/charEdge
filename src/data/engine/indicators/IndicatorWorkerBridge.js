// ═══════════════════════════════════════════════════════════════════
// charEdge v14 — Indicator Worker Bridge
//
// Main-thread bridge that communicates with IndicatorWorker.js.
// Provides a clean async API for computing indicators off-thread.
//
// Features:
//   • IndexedDB cache check before computing (5 min TTL)
//   • Automatic fallback to main-thread if Worker unavailable
//   • Correlation ID matching for concurrent requests
//   • Batch computation support
//
// Usage:
//   import { indicatorBridge } from './IndicatorWorkerBridge.js';
//   const ichi = await indicatorBridge.compute('ichimoku', {}, bars);
//   const batch = await indicatorBridge.computeBatch(
//     [{ indicator: 'adx', params: {} }, { indicator: 'obv', params: {} }],
//     bars
//   );
// ═══════════════════════════════════════════════════════════════════

import { indicators } from './IndicatorLibrary.js';
import { logger } from '../../../utils/logger.ts';
import { computePool } from '../infra/ComputeWorkerPool.js';

// ─── Cache Interface ───────────────────────────────────────────
// We lazily import DataCache to avoid circular deps & keep the
// bridge usable even if IndexedDB is unavailable.

let _dataCache = null;
async function getCache() {
  if (_dataCache) return _dataCache;
  try {
    const mod = await import('../../DataCache.ts');
    _dataCache = mod.dataCache || mod.default;
    return _dataCache;
  } catch (_) {
    return null;
  }
}

// ─── Worker Bridge ─────────────────────────────────────────────
// Now routes all computation through ComputeWorkerPool for
// dynamic pool sizing, priority scheduling, and TypedArray transfers.

class _IndicatorWorkerBridge {
  constructor() {
    this._ready = false;
    this._initPromise = null;
    this._fallback = false;
  }

  // ── Initialize (checks pool availability) ─────────────────

  _init() {
    if (this._initPromise) return this._initPromise;

    this._initPromise = new Promise((resolve) => {
      try {
        const stats = computePool.getStats();
        if (stats.fallbackMode) {
          this._fallback = true;
          this._ready = false;
          resolve(false);
        } else {
          this._ready = true;
          resolve(true);
        }
      } catch (_) {
        this._fallback = true;
        resolve(false);
      }
    });

    return this._initPromise;
  }

  // ── Cache Key Generation ───────────────────────────────────

  _cacheKey(indicator, params, barsLength, firstTime, lastTime) {
    const paramStr = JSON.stringify(params || {});
    return `${indicator}:${paramStr}:${barsLength}:${firstTime}:${lastTime}`;
  }

  // ── Compute Single Indicator ───────────────────────────────

  /**
   * Compute an indicator, checking cache first, then delegating to Worker.
   * Falls back to main-thread computation if Worker is unavailable.
   *
   * @param {string} indicator - Indicator name (e.g., 'ichimoku', 'adx')
   * @param {Object} params - Indicator-specific params (e.g., { period: 14 })
   * @param {Array} bars - OHLCV candle array
   * @param {Object} [options] - { skipCache: boolean, symbol: string, tf: string }
   * @returns {Promise<Array>} Computed indicator data
   */
  async compute(indicator, params, bars, options = {}) {
    if (!bars?.length) return [];

    const { skipCache = false, symbol = '', tf = '' } = options;

    // 1. Check IndexedDB cache
    if (!skipCache && symbol && tf) {
      try {
        const cache = await getCache();
        if (cache) {
          const cached = await cache.getIndicator(symbol, tf, indicator);
          if (cached) return cached;
        }
      } catch (e) { logger.data.warn('Operation failed', e); }
    }

    // 2. Compute (worker or fallback)
    let result;
    await this._init();

    if (!this._fallback && this._ready) {
      result = await this._computeInWorker(indicator, params, bars);
    } else {
      result = this._computeOnMainThread(indicator, params, bars);
    }

    // 3. Cache the result
    if (!skipCache && symbol && tf && result?.length) {
      try {
        const cache = await getCache();
        if (cache) await cache.putIndicator(symbol, tf, indicator, result);
      } catch (e) { logger.data.warn('Operation failed', e); }
    }

    return result;
  }

  // ── Batch Compute ──────────────────────────────────────────

  /**
   * Compute multiple indicators in one Worker roundtrip.
   *
   * @param {Array<{ indicator: string, params: Object }>} tasks
   * @param {Array} bars - OHLCV candle array
   * @returns {Promise<Object>} { [indicator]: data }
   */
  async computeBatch(tasks, bars) {
    if (!bars?.length || !tasks?.length) return {};

    await this._init();

    if (!this._fallback && this._ready) {
      try {
        const promises = tasks.map(task =>
          computePool.submit({
            type: 'indicator',
            indicator: task.indicator,
            data: bars,
            params: task.params,
            priority: 'high',
          }).then(data => ({ indicator: task.indicator, data }))
            .catch(() => ({ indicator: task.indicator, data: this._computeOnMainThread(task.indicator, task.params, bars) }))
        );
        const settled = await Promise.all(promises);
        const results = {};
        for (const { indicator, data } of settled) results[indicator] = data;
        return results;
      } catch (err) {
        logger.worker.warn('[IndicatorBridge] Pool batch failed, falling back to main thread:', err?.message);
      }
    }

    // Main-thread fallback
    const results = {};
    for (const task of tasks) {
      results[task.indicator] = this._computeOnMainThread(task.indicator, task.params, bars);
    }
    return results;
  }

  // ── Worker Communication ───────────────────────────────────

  /** @private — Routes computation through ComputeWorkerPool */
  _computeInWorker(indicator, params, bars) {
    return computePool.submit({
      type: 'indicator',
      indicator,
      data: bars,
      params,
      priority: 'critical',
      timeout: 10000,
    }).catch(() => {
      // Fallback to main thread on pool failure
      return this._computeOnMainThread(indicator, params, bars);
    });
  }

  // ── Main Thread Fallback ───────────────────────────────────

  /** @private */
  _computeOnMainThread(indicator, params = {}, bars) {
    const fn = indicators[indicator];
    if (!fn) {
      logger.worker.debug(`[IndicatorBridge] Unknown indicator: ${indicator}`);
      return [];
    }

    try {
      const args = [bars];
      if (indicator === 'mfi' || indicator === 'williamsR' || indicator === 'cmf') args.push(params.period);
      else if (indicator === 'ichimoku') args.push(params);
      else if (indicator === 'supertrend') { args.push(params.period); args.push(params.multiplier); }
      else if (indicator === 'anchoredVWAP') args.push(params.anchorIndex);
      else if (indicator === 'roc') args.push(params.period);
      else if (indicator === 'adx') args.push(params.period);
      else if (indicator === 'renko') args.push(params.brickSize);
      return fn(...args);
    } catch (err) {
      logger.worker.error(`[IndicatorBridge] Main-thread compute error for ${indicator}:`, err);
      return [];
    }
  }

  // ── Status ─────────────────────────────────────────────────

  get isWorkerActive() { return this._ready && !this._fallback; }
  get isFallback() { return this._fallback; }

  // ── Dispose ────────────────────────────────────────────────

  dispose() {
    // Pool is shared — don't terminate it, just reset bridge state
    this._ready = false;
    this._fallback = false;
    this._initPromise = null;
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const indicatorBridge = new _IndicatorWorkerBridge();
export default indicatorBridge;
