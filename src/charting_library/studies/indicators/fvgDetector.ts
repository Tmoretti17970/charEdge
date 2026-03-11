// ═══════════════════════════════════════════════════════════════════
// charEdge — Fair Value Gap Detector (Phase 3)
// Detects bullish/bearish FVGs and tracks fill status
// ═══════════════════════════════════════════════════════════════════

import type { Bar } from './helpers.ts';

export interface FVG {
    startIdx: number;    // Center bar index (the gap bar)
    type: 'bullish' | 'bearish';
    top: number;         // Upper boundary of gap
    bottom: number;      // Lower boundary of gap
    filled: boolean;     // Has price revisited the zone?
    fillIdx?: number;    // Bar index where fill occurred
}

/**
 * Detect Fair Value Gaps — imbalance zones where price moved too fast.
 *
 * Bullish FVG: bar[i-1].high < bar[i+1].low  (gap between bar -1 high and bar +1 low)
 * Bearish FVG: bar[i-1].low > bar[i+1].high   (gap between bar +1 high and bar -1 low)
 *
 * @param bars      - OHLCV bars
 * @param minGapPct - Minimum gap size as % of price (default 0.1%)
 */
export function detectFVGs(
    bars: Bar[],
    minGapPct: number = 0.1,
): FVG[] {
    const n = bars.length;
    const fvgs: FVG[] = [];
    if (n < 3) return fvgs;

    const minFrac = minGapPct / 100;

    for (let i = 1; i < n - 1; i++) {
        const prev = bars[i - 1]!;
        const curr = bars[i]!;
        const next = bars[i + 1]!;

        // Bullish FVG: previous candle's high < next candle's low
        if (prev.high < next.low) {
            const gapSize = next.low - prev.high;
            if (gapSize / curr.close >= minFrac) {
                fvgs.push({
                    startIdx: i,
                    type: 'bullish',
                    top: next.low,
                    bottom: prev.high,
                    filled: false,
                });
            }
        }

        // Bearish FVG: previous candle's low > next candle's high
        if (prev.low > next.high) {
            const gapSize = prev.low - next.high;
            if (gapSize / curr.close >= minFrac) {
                fvgs.push({
                    startIdx: i,
                    type: 'bearish',
                    top: prev.low,
                    bottom: next.high,
                    filled: false,
                });
            }
        }
    }

    // Track fill status: check if subsequent price action enters the gap zone
    for (const fvg of fvgs) {
        for (let j = fvg.startIdx + 2; j < n; j++) {
            const bar = bars[j]!;
            if (fvg.type === 'bullish') {
                // Filled when price drops into the gap zone
                if (bar.low <= fvg.top) {
                    fvg.filled = true;
                    fvg.fillIdx = j;
                    break;
                }
            } else {
                // Filled when price rises into the gap zone
                if (bar.high >= fvg.bottom) {
                    fvg.filled = true;
                    fvg.fillIdx = j;
                    break;
                }
            }
        }
    }

    return fvgs;
}
