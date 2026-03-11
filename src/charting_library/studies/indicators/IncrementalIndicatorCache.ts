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
import { atr } from './atr.js';
import { bollingerBands } from './bollingerBands.js';
import { stochastic } from './stochastic.js';

interface CacheEntry {
    barCount: number;            // How many bars were in the last full compute
    lastBarTime: number;         // Timestamp of the last bar for change detection
    dataHash: number;            // Identity hash — detects dataset swap with same count
    result: number[];            // Cached full result array
    runningState?: unknown;      // Indicator-specific state for incremental update
}

/** Multi-output cache for MACD */
interface MacdCacheEntry {
    barCount: number;
    dataHash: number;
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

/** Multi-output cache for Bollinger Bands */
interface BollingerCacheEntry {
    barCount: number;
    dataHash: number;
    middle: number[];
    upper: number[];
    lower: number[];
    runningState: {
        runningSum: number;
        runningSumSq: number;
        prevLastVal: number;
    };
}

/** Multi-output cache for Stochastic */
interface StochCacheEntry {
    barCount: number;
    dataHash: number;
    k: number[];
    d: number[];
    runningState: {
        prevLastClose: number;
        /** Running sum for %D SMA smoothing */
        dSum: number;
        prevDLastVal: number;
    };
}

/**
 * Wraps indicator functions with a cache that avoids full recompute
 * when only the last bar has changed (tick update).
 */
export class IncrementalIndicatorCache {
    private _cache: Map<string, CacheEntry> = new Map();
    private _macdCache: Map<string, MacdCacheEntry> = new Map();
    private _bbCache: Map<string, BollingerCacheEntry> = new Map();
    private _stochCache: Map<string, StochCacheEntry> = new Map();

    /** Cheap identity hash for number[] sources (first + last values) */
    private _srcHash(src: number[]): number {
        if (src.length === 0) return 0;
        return (Math.round((src[0] ?? 0) * 1e6) ^ Math.round((src[src.length - 1] ?? 0) * 1e6)) | 0;
    }

    /** Cheap identity hash for bar arrays (first + last timestamps) */
    private _barsHash(bars: { time?: number; close?: number }[]): number {
        if (bars.length === 0) return 0;
        return ((bars[0]?.time ?? 0) ^ (bars[bars.length - 1]?.time ?? 0)) | 0;
    }

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
    compute(key: string, bars: { time: number }[], fn: (...args: unknown[]) => number[], args: unknown[]): number[] {
        const entry = this._cache.get(key);
        const barCount = bars.length;
        const lastTime = barCount > 0 ? bars[barCount - 1]!.time : 0;
        const hash = this._barsHash(bars);

        // Full recompute if bar count changed, no cache, or dataset identity changed
        if (!entry || entry.barCount !== barCount || entry.dataHash !== hash) {
            const result = fn(...args);
            this._cache.set(key, { barCount, lastBarTime: lastTime, dataHash: hash, result: [...result] });
            return result;
        }

        // Same bar count & same dataset — tick update. Recompute only last value.
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
        const hash = this._srcHash(src);

        // Full compute needed
        if (!entry || entry.barCount !== n || entry.dataHash !== hash) {
            const result = sma(src, period);
            // Save running sum for next tick
            let runningSum = 0;
            if (n >= period) {
                for (let i = n - period; i < n; i++) runningSum += (src[i] ?? 0);
            }
            this._cache.set(key, {
                barCount: n,
                lastBarTime: 0,
                dataHash: hash,
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
        const hash = this._srcHash(src);

        // Full compute needed
        if (!entry || entry.barCount !== n || entry.dataHash !== hash) {
            const result = ema(src, period);
            this._cache.set(key, {
                barCount: n,
                lastBarTime: 0,
                dataHash: hash,
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
     *
     * P1 Fix (H2): State is saved at bar N-2 (before the last bar's contribution).
     * The incremental path re-derives bar N-1 from the N-2 state each tick,
     * making tick updates idempotent — repeated ticks on the same forming bar
     * no longer compound the Wilder smoothing.
     */
    computeRsiIncremental(key: string, src: number[], period: number = 14): number[] {
        const entry = this._cache.get(key);
        const n = src.length;
        const hash = this._srcHash(src);

        // Full compute needed
        if (!entry || entry.barCount !== n || entry.dataHash !== hash) {
            const result = rsi(src, period);
            // Extract running state at bar N-2 (before last bar's contribution)
            let avgGain = 0, avgLoss = 0;
            if (n >= period + 1) {
                // Re-derive from the full RSI algorithm up to bar N-2
                for (let i = 1; i <= period; i++) {
                    const change = src[i]! - src[i - 1]!;
                    if (change >= 0) avgGain += change;
                    else avgLoss -= change;
                }
                avgGain /= period;
                avgLoss /= period;
                // P1 Fix: Stop at n-1 (not n) to save state BEFORE last bar
                for (let i = period + 1; i < n - 1; i++) {
                    const change = src[i]! - src[i - 1]!;
                    const gain = change >= 0 ? change : 0;
                    const loss = change < 0 ? -change : 0;
                    avgGain = (avgGain * (period - 1) + gain) / period;
                    avgLoss = (avgLoss * (period - 1) + loss) / period;
                }
            }
            this._cache.set(key, {
                barCount: n,
                lastBarTime: 0,
                dataHash: hash,
                result: [...result],
                // State at bar N-2 — before last bar's smoothing
                runningState: { avgGain, avgLoss, prevSrc: src[n - 2] ?? 0 },
            });
            return result;
        }

        // Incremental: re-derive last bar from saved N-2 state (idempotent)
        const state = entry.runningState as { avgGain: number; avgLoss: number; prevSrc: number };
        const newVal = src[n - 1] ?? 0;
        const prevVal = src[n - 2] ?? 0;
        const change = newVal - prevVal;
        const gain = change >= 0 ? change : 0;
        const loss = change < 0 ? -change : 0;

        // Wilder's smoothing from the N-2 base state (NOT from last tick's result)
        const newAvgGain = (state.avgGain * (period - 1) + gain) / period;
        const newAvgLoss = (state.avgLoss * (period - 1) + loss) / period;

        // Do NOT overwrite state — it stays at N-2

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
        const hash = this._srcHash(src);
        const existing = this._macdCache.get(key);

        // Full compute needed
        if (!existing || existing.barCount !== n || existing.dataHash !== hash) {
            const result = macd(src, fast, slow, signal);
            // Extract running EMA states from the last values
            const lastFast = ema(src, fast);
            const lastSlow = ema(src, slow);
            this._macdCache.set(key, {
                barCount: n,
                dataHash: hash,
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
        const hash = this._barsHash(bars);

        // Full compute needed
        if (!entry || entry.barCount !== n || entry.dataHash !== hash) {
            const result = atr(bars as unknown[], period);
            this._cache.set(key, {
                barCount: n,
                lastBarTime: 0,
                dataHash: hash,
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
        const lastBar = bars[n - 1]!;
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
     * Incremental Bollinger Bands: maintains running sum and sumSq.
     * O(1) per tick instead of O(n×period).
     */
    computeBollingerIncremental(
        key: string,
        src: number[],
        period: number = 20,
        stdDevMult: number = 2,
    ): { middle: number[]; upper: number[]; lower: number[] } {
        const n = src.length;
        const hash = this._srcHash(src);
        const existing = this._bbCache.get(key);

        // Full compute needed
        if (!existing || existing.barCount !== n || existing.dataHash !== hash) {
            const result = bollingerBands(src, period, stdDevMult);

            // Build running sum/sumSq for the last window
            let runningSum = 0;
            let runningSumSq = 0;
            if (n >= period) {
                for (let i = n - period; i < n; i++) {
                    runningSum += src[i] ?? 0;
                    runningSumSq += (src[i] ?? 0) * (src[i] ?? 0);
                }
            }

            this._bbCache.set(key, {
                barCount: n,
                dataHash: hash,
                middle: [...result.middle],
                upper: [...result.upper],
                lower: [...result.lower],
                runningState: {
                    runningSum,
                    runningSumSq,
                    prevLastVal: src[n - 1] ?? 0,
                },
            });
            return result;
        }

        // Incremental: only the last bar changed
        if (n < period) {
            return { middle: existing.middle, upper: existing.upper, lower: existing.lower };
        }

        const state = existing.runningState;
        const oldVal = state.prevLastVal;
        const newVal = src[n - 1] ?? 0;

        // Adjust running sums: remove old last-bar contribution, add new
        state.runningSum = state.runningSum - oldVal + newVal;
        state.runningSumSq = state.runningSumSq - oldVal * oldVal + newVal * newVal;
        state.prevLastVal = newVal;

        const mean = state.runningSum / period;
        const variance = state.runningSumSq / period - mean * mean;
        const sd = Math.sqrt(Math.max(0, variance));

        existing.middle[n - 1] = mean;
        existing.upper[n - 1] = mean + stdDevMult * sd;
        existing.lower[n - 1] = mean - stdDevMult * sd;

        return { middle: existing.middle, upper: existing.upper, lower: existing.lower };
    }

    /**
     * Incremental Stochastic: scans k-period window (O(k)) and smooths %D.
     * Much cheaper than full recompute, since k is typically 14.
     */
    computeStochasticIncremental(
        key: string,
        bars: { high: number; low: number; close: number }[],
        kPeriod: number = 14,
        dPeriod: number = 3,
    ): { k: number[]; d: number[] } {
        const n = bars.length;
        const hash = this._barsHash(bars);
        const existing = this._stochCache.get(key);

        // Full compute needed
        if (!existing || existing.barCount !== n || existing.dataHash !== hash) {
            const result = stochastic(bars as unknown[], kPeriod, dPeriod);

            // Build %D running sum for last dPeriod k values
            let dSum = 0;
            const firstK = result.k.findIndex(v => !isNaN(v));
            const dStart = firstK + dPeriod - 1;
            if (n > dStart) {
                for (let i = n - dPeriod; i < n; i++) {
                    dSum += isNaN(result.k[i]!) ? 0 : result.k[i]!;
                }
            }

            this._stochCache.set(key, {
                barCount: n,
                dataHash: hash,
                k: [...result.k],
                d: [...result.d],
                runningState: {
                    prevLastClose: bars[n - 1]?.close ?? 0,
                    dSum,
                    prevDLastVal: isNaN(result.k[n - 1]!) ? 0 : result.k[n - 1]!,
                },
            });
            return result;
        }

        // Incremental: recompute %K for last bar (O(kPeriod) scan)
        if (n < kPeriod) {
            return { k: existing.k, d: existing.d };
        }

        let high = -Infinity;
        let low = Infinity;
        for (let j = n - kPeriod; j < n; j++) {
            if (bars[j]!.high > high) high = bars[j]!.high;
            if (bars[j]!.low < low) low = bars[j]!.low;
        }
        const range = high - low;
        const newK = range === 0 ? 50 : ((bars[n - 1]!.close - low) / range) * 100;
        const oldK = existing.k[n - 1]!;

        existing.k[n - 1] = newK;

        // Update %D (SMA of %K) — adjust running sum
        const state = existing.runningState;
        const oldKVal = isNaN(oldK) ? 0 : oldK;
        state.dSum = state.dSum - oldKVal + newK;
        state.prevDLastVal = newK;
        state.prevLastClose = bars[n - 1]!.close;

        existing.d[n - 1] = state.dSum / dPeriod;

        return { k: existing.k, d: existing.d };
    }

    /**
     * Invalidate cache for a given key or all keys.
     */
    invalidate(key?: string): void {
        if (key) {
            this._cache.delete(key);
            this._macdCache.delete(key);
            this._bbCache.delete(key);
            this._stochCache.delete(key);
        } else {
            this._cache.clear();
            this._macdCache.clear();
            this._bbCache.clear();
            this._stochCache.clear();
        }
    }

    /**
     * Get cache size for diagnostics.
     */
    get size(): number {
        return this._cache.size + this._macdCache.size + this._bbCache.size + this._stochCache.size;
    }
}

// ─── Singleton ───────────────────────────────────────────────────

export const indicatorCache = new IncrementalIndicatorCache();
export default indicatorCache;

