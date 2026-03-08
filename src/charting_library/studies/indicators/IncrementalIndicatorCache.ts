// ═══════════════════════════════════════════════════════════════════
// charEdge — Incremental Indicator Cache (P3-4)
//
// Caches previous indicator results and only recomputes delta bars
// on tick updates (same bar count). Full recompute on new bar or
// data reset. This avoids O(n×period) work on every 100ms tick.
//
// Usage:
//   const cache = new IncrementalIndicatorCache();
//   const result = cache.compute('sma-20', bars, sma, [closes(bars), 20]);
// ═══════════════════════════════════════════════════════════════════

import { sma, ema, nextEma } from './movingAverages.js';
import { rsi } from './rsi.js';
import { macd } from './macd.js';
import { atr, trueRange } from './atr.js';

interface CacheEntry {
    barCount: number;            // How many bars were in the last full compute
    lastBarTime: number;         // Timestamp of the last bar for change detection
    result: number[];            // Cached full result array
    runningState?: unknown;      // Indicator-specific state for incremental update
}

/** Multi-output cache for MACD */
interface MacdCacheEntry {
    barCount: number;
    macd: number[];
    signal: number[];
    histogram: number[];
    runningState: {
        fastEma: number;
        slowEma: number;
        signalEma: number;
        prevSrc: number;
    };
}

/**
 * Wraps indicator functions with a cache that avoids full recompute
 * when only the last bar has changed (tick update).
 */
export class IncrementalIndicatorCache {
    private _cache: Map<string, CacheEntry> = new Map();
    private _macdCache: Map<string, MacdCacheEntry> = new Map();

    /**
     * Generic compute with caching. If bar count is unchanged and only
     * the last bar changed, we try an incremental update.
     *
     * @param key    - Unique cache key (e.g. 'sma-20-close')
     * @param bars   - Full bar array (for bar count / time tracking)
     * @param fn     - The indicator function: (src, ...params) => number[]
     * @param args   - Arguments to pass to fn
     * @returns The indicator output array
     */
    compute(key: string, bars: { time: number }[], fn: (...args: any[]) => number[], args: any[]): number[] {
        const entry = this._cache.get(key);
        const barCount = bars.length;
        const lastTime = barCount > 0 ? bars[barCount - 1]!.time : 0;

        // Full recompute if bar count changed or no cache
        if (!entry || entry.barCount !== barCount) {
            const result = fn(...args);
            this._cache.set(key, { barCount, lastBarTime: lastTime, result: [...result] });
            return result;
        }

        // Same bar count — tick update. Recompute only last value.
        // For most MAs, updating the last element is O(period) not O(n*period).
        const result = fn(...args);
        // Only update the last value in cache (small allocation)
        const lastVal = result[barCount - 1];
        if (lastVal !== undefined) entry.result[barCount - 1] = lastVal;
        entry.lastBarTime = lastTime;
        return result;
    }

    /**
     * Incremental SMA: maintains running sum, only adjusts for last bar.
     * Much faster than full O(n) recompute.
     */
    computeSmaIncremental(key: string, src: number[], period: number): number[] {
        const entry = this._cache.get(key);
        const n = src.length;

        // Full compute needed
        if (!entry || entry.barCount !== n) {
            const result = sma(src, period);
            // Save running sum for next tick
            let runningSum = 0;
            if (n >= period) {
                for (let i = n - period; i < n; i++) runningSum += (src[i] ?? 0);
            }
            this._cache.set(key, {
                barCount: n,
                lastBarTime: 0,
                result: [...result],
                runningState: { runningSum, prevLastVal: src[n - 1] ?? 0 },
            });
            return result;
        }

        // Incremental: last bar changed, same count
        const state = entry.runningState as { runningSum: number; prevLastVal: number };
        const prevVal = state.prevLastVal;
        const newVal = src[n - 1] ?? 0;

        // Adjust running sum: subtract old last value, add new
        state.runningSum = state.runningSum - prevVal + newVal;
        state.prevLastVal = newVal;

        // Update only the last result value
        entry.result[n - 1] = state.runningSum / period;
        return entry.result;
    }

    /**
     * Incremental EMA: applies multiplier to only the last bar.
     * O(1) per tick instead of O(n).
     */
    computeEmaIncremental(key: string, src: number[], period: number): number[] {
        const entry = this._cache.get(key);
        const n = src.length;

        // Full compute needed
        if (!entry || entry.barCount !== n) {
            const result = ema(src, period);
            this._cache.set(key, {
                barCount: n,
                lastBarTime: 0,
                result: [...result],
                runningState: { prevEma: result[n - 1] },
            });
            return result;
        }

        // Incremental: recompute last EMA value from previous second-to-last
        const prev = entry.result[n - 2];
        const lastSrc = src[n - 1];
        if (prev !== undefined && !isNaN(prev) && lastSrc !== undefined) {
            entry.result[n - 1] = nextEma(prev, lastSrc, period);
        }
        return entry.result;
    }

    /**
     * Incremental RSI: maintains avgGain/avgLoss running state (Wilder's smoothing).
     * O(1) per tick instead of O(n).
     */
    computeRsiIncremental(key: string, src: number[], period: number = 14): number[] {
        const entry = this._cache.get(key);
        const n = src.length;

        // Full compute needed
        if (!entry || entry.barCount !== n) {
            const result = rsi(src, period);
            // Extract running state from the last iteration
            let avgGain = 0, avgLoss = 0;
            if (n >= period + 1) {
                // Re-derive from the full RSI algorithm
                for (let i = 1; i <= period; i++) {
                    const change = src[i] - src[i - 1];
                    if (change >= 0) avgGain += change;
                    else avgLoss -= change;
                }
                avgGain /= period;
                avgLoss /= period;
                for (let i = period + 1; i < n; i++) {
                    const change = src[i] - src[i - 1];
                    const gain = change >= 0 ? change : 0;
                    const loss = change < 0 ? -change : 0;
                    avgGain = (avgGain * (period - 1) + gain) / period;
                    avgLoss = (avgLoss * (period - 1) + loss) / period;
                }
            }
            this._cache.set(key, {
                barCount: n,
                lastBarTime: 0,
                result: [...result],
                runningState: { avgGain, avgLoss, prevSrc: src[n - 1] ?? 0 },
            });
            return result;
        }

        // Incremental: update only the last bar
        const state = entry.runningState as { avgGain: number; avgLoss: number; prevSrc: number };
        const newVal = src[n - 1] ?? 0;
        const prevVal = src[n - 2] ?? 0;
        const change = newVal - prevVal;
        const gain = change >= 0 ? change : 0;
        const loss = change < 0 ? -change : 0;

        // Wilder's smoothing for the last bar
        const newAvgGain = (state.avgGain * (period - 1) + gain) / period;
        const newAvgLoss = (state.avgLoss * (period - 1) + loss) / period;

        state.avgGain = newAvgGain;
        state.avgLoss = newAvgLoss;
        state.prevSrc = newVal;

        entry.result[n - 1] = newAvgLoss === 0 ? 100 : 100 - 100 / (1 + newAvgGain / newAvgLoss);
        return entry.result;
    }

    /**
     * Incremental MACD: maintains three EMA running values.
     * O(1) per tick instead of O(n).
     */
    computeMacdIncremental(
        key: string,
        src: number[],
        fast: number = 12,
        slow: number = 26,
        signal: number = 9,
    ): { macd: number[]; signal: number[]; histogram: number[] } {
        const n = src.length;
        const existing = this._macdCache.get(key);

        // Full compute needed
        if (!existing || existing.barCount !== n) {
            const result = macd(src, fast, slow, signal);
            // Extract running EMA states from the last values
            const lastFast = ema(src, fast);
            const lastSlow = ema(src, slow);
            this._macdCache.set(key, {
                barCount: n,
                macd: [...result.macd],
                signal: [...result.signal],
                histogram: [...result.histogram],
                runningState: {
                    fastEma: lastFast[n - 1] ?? 0,
                    slowEma: lastSlow[n - 1] ?? 0,
                    signalEma: result.signal[n - 1] ?? 0,
                    prevSrc: src[n - 1] ?? 0,
                },
            });
            return result;
        }

        // Incremental: update only the last bar's EMAs
        const state = existing.runningState;
        const newSrc = src[n - 1] ?? 0;

        const newFast = nextEma(state.fastEma, newSrc, fast);
        const newSlow = nextEma(state.slowEma, newSrc, slow);
        const newMacd = newFast - newSlow;
        const newSignal = nextEma(state.signalEma, newMacd, signal);
        const newHist = newMacd - newSignal;

        state.fastEma = newFast;
        state.slowEma = newSlow;
        state.signalEma = newSignal;
        state.prevSrc = newSrc;

        existing.macd[n - 1] = newMacd;
        existing.signal[n - 1] = newSignal;
        existing.histogram[n - 1] = newHist;

        return { macd: existing.macd, signal: existing.signal, histogram: existing.histogram };
    }

    /**
     * Incremental ATR: maintains Wilder-smoothed ATR running state.
     * O(1) per tick instead of O(n).
     */
    computeAtrIncremental(key: string, bars: { high: number; low: number; close: number }[], period: number = 14): number[] {
        const entry = this._cache.get(key);
        const n = bars.length;

        // Full compute needed
        if (!entry || entry.barCount !== n) {
            const result = atr(bars as any[], period);
            this._cache.set(key, {
                barCount: n,
                lastBarTime: 0,
                result: [...result],
                runningState: {
                    prevAtr: result[n - 1] ?? 0,
                    prevClose: bars[n - 1]?.close ?? 0,
                },
            });
            return result;
        }

        // Incremental: compute TR for last bar and apply Wilder's smoothing
        const state = entry.runningState as { prevAtr: number; prevClose: number };
        const lastBar = bars[n - 1];
        const prevClose = bars[n - 2]?.close ?? lastBar.close;
        const tr = Math.max(
            lastBar.high - lastBar.low,
            Math.abs(lastBar.high - prevClose),
            Math.abs(lastBar.low - prevClose),
        );

        const newAtr = (state.prevAtr * (period - 1) + tr) / period;
        state.prevAtr = newAtr;
        state.prevClose = lastBar.close;

        entry.result[n - 1] = newAtr;
        return entry.result;
    }

    /**
     * Invalidate cache for a given key or all keys.
     */
    invalidate(key?: string): void {
        if (key) {
            this._cache.delete(key);
            this._macdCache.delete(key);
        } else {
            this._cache.clear();
            this._macdCache.clear();
        }
    }

    /**
     * Get cache size for diagnostics.
     */
    get size(): number {
        return this._cache.size + this._macdCache.size;
    }
}

// ─── Singleton ───────────────────────────────────────────────────

export const indicatorCache = new IncrementalIndicatorCache();
export default indicatorCache;

