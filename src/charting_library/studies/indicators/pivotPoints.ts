// ═══════════════════════════════════════════════════════════════
// charEdge — Pivot Points
// Classic floor trader pivot levels (Standard formula).
// Calculates daily pivot, support (S1-S3), and resistance (R1-R3).
// ═══════════════════════════════════════════════════════════════

import type { Bar } from './helpers.ts';

/**
 * Standard Pivot Points from prior-period high/low/close.
 *
 * Uses a rolling window to determine the "prior period" from the
 * bar data itself (default 1-day equivalent = periodBars).
 *
 * @param bars - OHLCV bar array
 * @param periodBars - Number of bars constituting one period (default 1 for daily)
 */
export function pivotPoints(
    bars: Bar[],
    periodBars: number = 1,
): {
    pivot: number[];
    r1: number[];
    r2: number[];
    r3: number[];
    s1: number[];
    s2: number[];
    s3: number[];
} {
    const len = bars.length;
    const pivot = new Array(len).fill(NaN);
    const r1 = new Array(len).fill(NaN);
    const r2 = new Array(len).fill(NaN);
    const r3 = new Array(len).fill(NaN);
    const s1 = new Array(len).fill(NaN);
    const s2 = new Array(len).fill(NaN);
    const s3 = new Array(len).fill(NaN);

    for (let i = periodBars; i < len; i++) {
        // Look back `periodBars` to find the prior period's H/L/C
        let pH = -Infinity;
        let pL = Infinity;
        let pC = bars[i - 1].close;

        for (let j = i - periodBars; j < i; j++) {
            if (bars[j].high > pH) pH = bars[j].high;
            if (bars[j].low < pL) pL = bars[j].low;
        }

        const pp = (pH + pL + pC) / 3;
        pivot[i] = pp;

        // Standard formula
        r1[i] = 2 * pp - pL;
        s1[i] = 2 * pp - pH;
        r2[i] = pp + (pH - pL);
        s2[i] = pp - (pH - pL);
        r3[i] = pH + 2 * (pp - pL);
        s3[i] = pL - 2 * (pH - pp);
    }

    return { pivot, r1, r2, r3, s1, s2, s3 };
}
