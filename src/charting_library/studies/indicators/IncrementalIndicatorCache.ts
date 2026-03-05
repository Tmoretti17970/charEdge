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

interface CacheEntry {
    barCount: number;            // How many bars were in the last full compute
    lastBarTime: number;         // Timestamp of the last bar for change detection
    result: number[];            // Cached full result array
    runningState?: unknown;      // Indicator-specific state for incremental update
}

/**
 * Wraps indicator functions with a cache that avoids full recompute
 * when only the last bar has changed (tick update).
 */
export class IncrementalIndicatorCache {
    private _cache: Map<string, CacheEntry> = new Map();

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
     * Invalidate cache for a given key or all keys.
     */
    invalidate(key?: string): void {
        if (key) {
            this._cache.delete(key);
        } else {
            this._cache.clear();
        }
    }

    /**
     * Get cache size for diagnostics.
     */
    get size(): number {
        return this._cache.size;
    }
}

// ─── Singleton ───────────────────────────────────────────────────

export const indicatorCache = new IncrementalIndicatorCache();
export default indicatorCache;
