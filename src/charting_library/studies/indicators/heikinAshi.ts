// ═══════════════════════════════════════════════════════════════════
// charEdge — Heikin-Ashi Overlay Indicator (Phase 5)
// Smoothed candle transformation that filters noise
// ═══════════════════════════════════════════════════════════════════

import type { Bar } from './helpers.ts';

/**
 * Heikin-Ashi candle transformation.
 *
 * HA Close = (O + H + L + C) / 4
 * HA Open  = (prev HA Open + prev HA Close) / 2
 * HA High  = max(H, HA Open, HA Close)
 * HA Low   = min(L, HA Open, HA Close)
 */
export function heikinAshi(bars: Bar[]): {
    haOpen: number[];
    haHigh: number[];
    haLow: number[];
    haClose: number[];
} {
    const n = bars.length;
    const haOpen = new Array<number>(n).fill(NaN);
    const haHigh = new Array<number>(n).fill(NaN);
    const haLow = new Array<number>(n).fill(NaN);
    const haClose = new Array<number>(n).fill(NaN);

    if (n === 0) return { haOpen, haHigh, haLow, haClose };

    // First bar seed
    haClose[0] = (bars[0]!.open + bars[0]!.high + bars[0]!.low + bars[0]!.close) / 4;
    haOpen[0] = (bars[0]!.open + bars[0]!.close) / 2;
    haHigh[0] = Math.max(bars[0]!.high, haOpen[0]!, haClose[0]!);
    haLow[0] = Math.min(bars[0]!.low, haOpen[0]!, haClose[0]!);

    for (let i = 1; i < n; i++) {
        const b = bars[i]!;
        haClose[i] = (b.open + b.high + b.low + b.close) / 4;
        haOpen[i] = (haOpen[i - 1]! + haClose[i - 1]!) / 2;
        haHigh[i] = Math.max(b.high, haOpen[i]!, haClose[i]!);
        haLow[i] = Math.min(b.low, haOpen[i]!, haClose[i]!);
    }

    return { haOpen, haHigh, haLow, haClose };
}
