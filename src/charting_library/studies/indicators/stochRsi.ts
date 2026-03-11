// ═══════════════════════════════════════════════════════════════
// charEdge — Stochastic RSI
// Applies the Stochastic formula to RSI values instead of price.
// The #1 crypto oscillator — more sensitive than raw RSI.
// ═══════════════════════════════════════════════════════════════

import type { Bar } from './helpers.ts';
import { rsi } from './rsi.ts';
import { nanSafeSma } from './movingAverages.ts';

/**
 * Stochastic RSI — applies Stochastic %K/%D to RSI values.
 *
 * @param bars - OHLCV bar array
 * @param rsiPeriod - RSI lookback (default 14)
 * @param stochPeriod - Stochastic lookback applied to RSI (default 14)
 * @param kSmooth - %K smoothing (default 3)
 * @param dSmooth - %D smoothing (default 3)
 */
export function stochRsi(
    bars: Bar[],
    rsiPeriod: number = 14,
    stochPeriod: number = 14,
    kSmooth: number = 3,
    dSmooth: number = 3,
): { k: number[]; d: number[] } {
    const len = bars.length;
    const closes = bars.map(b => b.close);
    const rsiVals = rsi(closes, rsiPeriod);

    // Apply Stochastic formula to RSI values
    const rawK = new Array(len).fill(NaN);

    for (let i = rsiPeriod + stochPeriod - 2; i < len; i++) {
        let maxRsi = -Infinity;
        let minRsi = Infinity;
        for (let j = i - stochPeriod + 1; j <= i; j++) {
            const r = rsiVals[j];
            if (isNaN(r)) continue;
            if (r > maxRsi) maxRsi = r;
            if (r < minRsi) minRsi = r;
        }
        const range = maxRsi - minRsi;
        rawK[i] = range === 0 ? 50 : ((rsiVals[i] - minRsi) / range) * 100;
    }

    // Smooth %K with SMA
    const kSmoothed = nanSafeSma(rawK, kSmooth);
    const firstValid = rawK.findIndex(v => !isNaN(v));
    for (let i = 0; i < firstValid + kSmooth - 1; i++) kSmoothed[i] = NaN;

    // %D = SMA of smoothed %K
    const d = nanSafeSma(kSmoothed, dSmooth);
    const firstK = kSmoothed.findIndex(v => !isNaN(v));
    for (let i = 0; i < firstK + dSmooth - 1; i++) d[i] = NaN;

    return { k: kSmoothed, d };
}
