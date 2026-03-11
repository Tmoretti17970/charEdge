// ═══════════════════════════════════════════════════════════════
// charEdge — ADXR (Average Directional Index Rating)
// Smoothed ADX — averages current ADX with ADX from `period` bars ago.
// Completes the ADX family.
// ═══════════════════════════════════════════════════════════════

import type { Bar } from './helpers.ts';
import { adx } from './adx.ts';

/**
 * ADXR = (ADX[today] + ADX[today - period]) / 2
 *
 * @param bars - OHLCV bar array
 * @param period - ADX period and lookback period (default 14)
 */
export function adxr(
    bars: Bar[],
    period: number = 14,
): { adxr: number[]; adx: number[]; plusDI: number[]; minusDI: number[] } {
    const adxResult = adx(bars, period);
    const len = bars.length;
    const adxrOut = new Array(len).fill(NaN);

    for (let i = period; i < len; i++) {
        const current = adxResult.adx[i];
        const past = adxResult.adx[i - period];
        if (!isNaN(current) && !isNaN(past)) {
            adxrOut[i] = (current + past) / 2;
        }
    }

    return {
        adxr: adxrOut,
        adx: adxResult.adx,
        plusDI: adxResult.plusDI,
        minusDI: adxResult.minusDI,
    };
}
