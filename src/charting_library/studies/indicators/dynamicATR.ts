// ═══════════════════════════════════════════════════════════════════
// charEdge — Dynamic ATR (Phase 2)
// ATR with adaptive period based on volatility percentile
// ═══════════════════════════════════════════════════════════════════

import type { Bar } from './helpers.ts';
import { atr, trueRange } from './atr.ts';

/**
 * Dynamic ATR — period adjusts based on ATR percentile rank.
 * High volatility → shorter period (respond faster)
 * Low volatility  → longer period (smoother)
 *
 * @param bars       - OHLCV bars
 * @param basePeriod - Base ATR period (default 14)
 * @param lookback   - ATR percentile ranking window (default 100)
 * @param minPeriod  - Minimum adaptive period (default 7)
 * @param maxPeriod  - Maximum adaptive period (default 28)
 */
export function dynamicATR(
    bars: Bar[],
    basePeriod: number = 14,
    lookback: number = 100,
    minPeriod: number = 7,
    maxPeriod: number = 28,
): { atr: number[]; adaptivePeriod: number[] } {
    const n = bars.length;
    const out = new Array(n).fill(NaN);
    const periods = new Array(n).fill(basePeriod);

    if (n < maxPeriod + 1) {
        return { atr: atr(bars, basePeriod), adaptivePeriod: periods };
    }

    // Compute base ATR for percentile reference
    const baseATR = atr(bars, basePeriod);
    const tr = trueRange(bars);

    for (let i = maxPeriod; i < n; i++) {
        // Percentile rank of current ATR
        const windowStart = Math.max(0, i - lookback + 1);
        let below = 0, total = 0;
        for (let j = windowStart; j <= i; j++) {
            if (!isNaN(baseATR[j]!)) {
                total++;
                if (baseATR[j]! < baseATR[i]!) below++;
            }
        }
        const percentile = total > 0 ? below / total : 0.5;

        // Map: high percentile (volatile) → shorter period
        const adaptPeriod = Math.round(maxPeriod - percentile * (maxPeriod - minPeriod));
        periods[i] = adaptPeriod;

        // Compute ATR with adaptive period using Wilder's smoothing
        let localATR = 0;
        for (let j = i - adaptPeriod + 1; j <= i; j++) {
            localATR += tr[j]!;
        }
        out[i] = localATR / adaptPeriod;
    }

    return { atr: out, adaptivePeriod: periods };
}
