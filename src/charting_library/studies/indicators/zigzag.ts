// ═══════════════════════════════════════════════════════════════════
// charEdge — ZigZag Indicator (Phase 2)
// Connects significant swing highs and lows
// ═══════════════════════════════════════════════════════════════════

import type { Bar } from './helpers.ts';

export interface ZigZagPoint {
    idx: number;
    price: number;
    type: 'high' | 'low';
}

/**
 * ZigZag — connects significant swing highs and lows.
 *
 * @param bars      - OHLCV bars
 * @param deviation - Minimum % price change to form a new swing (default 5%)
 * @param depth     - Minimum bars between swings (default 12)
 * @returns line array (overlay) + swing point list
 */
export function zigzag(
    bars: Bar[],
    deviation: number = 5,
    depth: number = 12,
): { line: number[]; points: ZigZagPoint[] } {
    const n = bars.length;
    const line = new Array(n).fill(NaN);
    const points: ZigZagPoint[] = [];

    if (n < depth * 2) return { line, points };

    const devFrac = deviation / 100;

    // Find initial direction: search for first significant swing
    let lastIdx = 0;
    let lastPrice = bars[0]!.close;
    let lastType: 'high' | 'low' = 'high';
    let _searching = true;

    // Initialize with the high and low of the first `depth` bars
    let initHigh = -Infinity, initHighIdx = 0;
    let initLow = Infinity, initLowIdx = 0;
    for (let i = 0; i < Math.min(depth, n); i++) {
        if (bars[i]!.high > initHigh) { initHigh = bars[i]!.high; initHighIdx = i; }
        if (bars[i]!.low < initLow) { initLow = bars[i]!.low; initLowIdx = i; }
    }

    if (initHighIdx < initLowIdx) {
        // Started with a high → looking for a low
        lastIdx = initHighIdx;
        lastPrice = initHigh;
        lastType = 'high';
        points.push({ idx: initHighIdx, price: initHigh, type: 'high' });
        line[initHighIdx] = initHigh;
    } else {
        lastIdx = initLowIdx;
        lastPrice = initLow;
        lastType = 'low';
        points.push({ idx: initLowIdx, price: initLow, type: 'low' });
        line[initLowIdx] = initLow;
    }
     
    _searching = false;

    for (let i = depth; i < n; i++) {
        const bar = bars[i]!;

        if (lastType === 'high') {
            // Looking for a low or higher high
            if (bar.high > lastPrice && i - lastIdx >= depth) {
                // Higher high — update the current high point
                lastPrice = bar.high;
                lastIdx = i;
                // Update the last point
                points[points.length - 1] = { idx: i, price: bar.high, type: 'high' };
                // Clear old line value, set new
                for (let k = 0; k < n; k++) {
                    if (line[k] === lastPrice) line[k] = NaN;
                }
                line[i] = bar.high;

            } else if (bar.low < lastPrice * (1 - devFrac) && i - lastIdx >= depth) {
                // Found a significant lower move — confirm new low
                lastPrice = bar.low;
                lastIdx = i;
                lastType = 'low';
                points.push({ idx: i, price: bar.low, type: 'low' });
                line[i] = bar.low;
            }

        } else {
            // lastType === 'low' — looking for a high or lower low
            if (bar.low < lastPrice && i - lastIdx >= depth) {
                // Lower low — update the current low point
                lastPrice = bar.low;
                lastIdx = i;
                points[points.length - 1] = { idx: i, price: bar.low, type: 'low' };
                for (let k = 0; k < n; k++) {
                    if (line[k] === lastPrice) line[k] = NaN;
                }
                line[i] = bar.low;

            } else if (bar.high > lastPrice * (1 + devFrac) && i - lastIdx >= depth) {
                // Found a significant higher move — confirm new high
                lastPrice = bar.high;
                lastIdx = i;
                lastType = 'high';
                points.push({ idx: i, price: bar.high, type: 'high' });
                line[i] = bar.high;
            }
        }
    }

    // Interpolate line between swing points for overlay rendering
    for (let p = 0; p < points.length - 1; p++) {
        const a = points[p]!;
        const b = points[p + 1]!;
        const barSpan = b.idx - a.idx;
        if (barSpan <= 0) continue;

        for (let j = a.idx; j <= b.idx; j++) {
            const t = (j - a.idx) / barSpan;
            line[j] = a.price + t * (b.price - a.price);
        }
    }

    return { line, points };
}
