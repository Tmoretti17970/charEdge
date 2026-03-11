// ═══════════════════════════════════════════════════════════════════
// charEdge — Wick Rejection Detector (Phase 3)
// Detects institutional wick-rejection patterns
// ═══════════════════════════════════════════════════════════════════

import type { Bar } from './helpers.ts';

export interface WickRejection {
    idx: number;
    type: 'upper' | 'lower';
    ratio: number;       // wick-to-body ratio (higher = stronger rejection)
    atLevel: boolean;     // true if near a support/resistance level
    price: number;        // wick tip price
}

/**
 * Detect wick rejection candles — long wicks relative to body size
 * indicating institutional rejection of a price level.
 *
 * @param bars       - OHLCV bars
 * @param minRatio   - Min wick-to-body ratio to qualify (default 2.0)
 * @param srLevels   - Optional S/R prices to check proximity
 * @param tolerance  - % proximity to S/R level (default 0.5%)
 */
export function detectWickRejections(
    bars: Bar[],
    minRatio: number = 2.0,
    srLevels: number[] = [],
    tolerance: number = 0.005,
): WickRejection[] {
    const rejections: WickRejection[] = [];

    for (let i = 0; i < bars.length; i++) {
        const bar = bars[i]!;
        const body = Math.abs(bar.close - bar.open);
        const upperWick = bar.high - Math.max(bar.open, bar.close);
        const lowerWick = Math.min(bar.open, bar.close) - bar.low;

        // Avoid division by zero: use range if body is tiny
        const bodyRef = Math.max(body, (bar.high - bar.low) * 0.05);

        // Upper wick rejection
        if (upperWick / bodyRef >= minRatio && upperWick > lowerWick * 1.5) {
            const atLevel = srLevels.some(lvl => Math.abs(bar.high - lvl) / lvl < tolerance);
            rejections.push({
                idx: i, type: 'upper', ratio: upperWick / bodyRef,
                atLevel, price: bar.high,
            });
        }

        // Lower wick rejection
        if (lowerWick / bodyRef >= minRatio && lowerWick > upperWick * 1.5) {
            const atLevel = srLevels.some(lvl => Math.abs(bar.low - lvl) / lvl < tolerance);
            rejections.push({
                idx: i, type: 'lower', ratio: lowerWick / bodyRef,
                atLevel, price: bar.low,
            });
        }
    }

    return rejections;
}
