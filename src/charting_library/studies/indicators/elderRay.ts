// ═══════════════════════════════════════════════════════════════
// charEdge — Elder-Ray Index
// Bull Power = High - EMA(close)
// Bear Power = Low - EMA(close)
// Developed by Dr. Alexander Elder — measures buying/selling pressure.
// ═══════════════════════════════════════════════════════════════

import type { Bar } from './helpers.ts';
import { ema } from './movingAverages.ts';

/**
 * Elder-Ray Bull Power and Bear Power.
 *
 * @param bars - OHLCV bar array
 * @param period - EMA period (default 13 — Elder's recommendation)
 */
export function elderRay(
    bars: Bar[],
    period: number = 13,
): { bullPower: number[]; bearPower: number[] } {
    const len = bars.length;
    const closes = bars.map(b => b.close);
    const emaVals = ema(closes, period);

    const bullPower = new Array(len).fill(NaN);
    const bearPower = new Array(len).fill(NaN);

    for (let i = 0; i < len; i++) {
        if (isNaN(emaVals[i])) continue;
        bullPower[i] = bars[i].high - emaVals[i];
        bearPower[i] = bars[i].low - emaVals[i];
    }

    return { bullPower, bearPower };
}
