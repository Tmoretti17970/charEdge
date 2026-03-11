// ═══════════════════════════════════════════════════════════════════
// charEdge — Relative Volume Filter (Phase 2)
// RVOL ratio with strength labels
// ═══════════════════════════════════════════════════════════════════

import type { Bar } from './helpers.ts';

export type RvolLabel = 'quiet' | 'normal' | 'elevated' | 'surge';

/**
 * Relative Volume Filter — current volume / average volume.
 *
 * @param bars   - OHLCV bars
 * @param period - Average volume lookback (default 20)
 */
export function rvolFilter(
    bars: Bar[],
    period: number = 20,
): { rvol: number[]; label: RvolLabel[] } {
    const n = bars.length;
    const rvol = new Array(n).fill(NaN);
    const label: RvolLabel[] = new Array(n).fill('normal');

    if (n < period) return { rvol, label };

    // Running volume sum
    let sumVol = 0;
    for (let i = 0; i < period; i++) {
        sumVol += bars[i]!.volume || 0;
    }

    for (let i = period - 1; i < n; i++) {
        if (i >= period) {
            sumVol += (bars[i]!.volume || 0) - (bars[i - period]!.volume || 0);
        }

        const avgVol = sumVol / period;
        const currentVol = bars[i]!.volume || 0;
        const ratio = avgVol === 0 ? 1 : currentVol / avgVol;

        rvol[i] = ratio;

        // Label classification
        if (ratio < 0.5) label[i] = 'quiet';
        else if (ratio < 1.5) label[i] = 'normal';
        else if (ratio < 3.0) label[i] = 'elevated';
        else label[i] = 'surge';
    }

    return { rvol, label };
}
