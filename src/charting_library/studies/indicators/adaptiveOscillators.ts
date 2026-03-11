// ═══════════════════════════════════════════════════════════════════
// charEdge — Adaptive Oscillators (Phase 2)
// Adaptive RSI — period adjusts based on market volatility
// ═══════════════════════════════════════════════════════════════════

import type { Bar } from './helpers.ts';
import { atr } from './atr.ts';
import { rsi } from './rsi.ts';

/**
 * Adaptive RSI — RSI period adjusts based on ATR percentile.
 * High volatility → shorter period (more responsive)
 * Low volatility  → longer period (smoother)
 *
 * @param bars       - OHLCV bars
 * @param basePeriod - Base RSI period (default 14)
 * @param atrPeriod  - ATR smoothing period (default 14)
 * @param minPeriod  - Minimum adaptive period (default 5)
 * @param maxPeriod  - Maximum adaptive period (default 30)
 * @param lookback   - Lookback for ATR percentile ranking (default 100)
 */
export function adaptiveRsi(
    bars: Bar[],
    basePeriod: number = 14,
    atrPeriod: number = 14,
    minPeriod: number = 5,
    maxPeriod: number = 30,
    lookback: number = 100,
): { values: number[]; adaptivePeriod: number[] } {
    const n = bars.length;
    const values = new Array(n).fill(NaN);
    const adaptivePeriodOut = new Array(n).fill(basePeriod);

    if (n < maxPeriod + 1) {
        // Fall back to standard RSI
        const closes = bars.map(b => b.close);
        const fallback = rsi(closes, basePeriod);
        return { values: fallback, adaptivePeriod: adaptivePeriodOut };
    }

    // Compute ATR for percentile ranking
    const atrValues = atr(bars, atrPeriod);
    const closes = bars.map(b => b.close);

    // For each bar, compute adaptive period then RSI with that period
    for (let i = maxPeriod; i < n; i++) {
        // ATR percentile rank over lookback window
        const windowStart = Math.max(0, i - lookback + 1);
        const atrWindow: number[] = [];
        for (let j = windowStart; j <= i; j++) {
            if (!isNaN(atrValues[j]!)) atrWindow.push(atrValues[j]!);
        }

        let percentile = 0.5; // Default to median
        if (atrWindow.length > 0) {
            const currentATR = atrValues[i]!;
            if (!isNaN(currentATR)) {
                let below = 0;
                for (const v of atrWindow) {
                    if (v < currentATR) below++;
                }
                percentile = below / atrWindow.length;
            }
        }

        // Map percentile to period: high vol (high percentile) → short period
        const adaptPeriod = Math.round(maxPeriod - percentile * (maxPeriod - minPeriod));
        adaptivePeriodOut[i] = adaptPeriod;

        // Compute RSI with adaptive period using local window
        const windowData = closes.slice(Math.max(0, i - adaptPeriod * 2), i + 1);
        const localRsi = rsi(windowData, adaptPeriod);
        const lastRsi = localRsi[localRsi.length - 1];
        values[i] = isNaN(lastRsi!) ? NaN : lastRsi!;
    }

    return { values, adaptivePeriod: adaptivePeriodOut };
}
