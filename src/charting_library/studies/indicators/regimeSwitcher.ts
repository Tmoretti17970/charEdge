// ═══════════════════════════════════════════════════════════════════
// charEdge — Regime Switcher (Phase 2)
// ADX-based market regime classification
// ═══════════════════════════════════════════════════════════════════

import type { Bar } from './helpers.ts';
import { adx as computeAdx } from './adx.ts';

export type Regime = 'trending' | 'ranging' | 'transitioning';

/**
 * Regime Switcher — classifies market into trending/ranging/transitioning.
 *
 * @param bars            - OHLCV bars
 * @param adxPeriod       - ADX lookback (default 14)
 * @param trendThreshold  - ADX above this = trending (default 25)
 * @param rangeThreshold  - ADX below this = ranging (default 20)
 * @param confirmBars     - Bars needed to confirm regime change (default 3)
 */
export function regimeSwitcher(
    bars: Bar[],
    adxPeriod: number = 14,
    trendThreshold: number = 25,
    rangeThreshold: number = 20,
    confirmBars: number = 3,
): { regime: Regime[]; adx: number[]; strength: number[] } {
    const n = bars.length;
    const adxResult = computeAdx(bars, adxPeriod);
    const adxValues = adxResult.adx;
    const regime: Regime[] = new Array(n).fill('transitioning');
    const strength: number[] = new Array(n).fill(0);

    let currentRegime: Regime = 'transitioning';
    let confirmCount = 0;
    let pendingRegime: Regime | null = null;

    for (let i = 0; i < n; i++) {
        const adxVal = adxValues[i]!;

        if (isNaN(adxVal)) {
            regime[i] = 'transitioning';
            strength[i] = 0;
            continue;
        }

        // Classify raw regime
        let rawRegime: Regime;
        if (adxVal >= trendThreshold) rawRegime = 'trending';
        else if (adxVal <= rangeThreshold) rawRegime = 'ranging';
        else rawRegime = 'transitioning';

        // Regime confirmation with hysteresis
        if (rawRegime !== currentRegime) {
            if (rawRegime === pendingRegime) {
                confirmCount++;
                if (confirmCount >= confirmBars) {
                    currentRegime = rawRegime;
                    pendingRegime = null;
                    confirmCount = 0;
                }
            } else {
                pendingRegime = rawRegime;
                confirmCount = 1;
            }
        } else {
            pendingRegime = null;
            confirmCount = 0;
        }

        regime[i] = currentRegime;

        // Strength: 0-1 based on distance from thresholds
        if (currentRegime === 'trending') {
            strength[i] = Math.min(1, (adxVal - trendThreshold) / 25);
        } else if (currentRegime === 'ranging') {
            strength[i] = Math.min(1, (rangeThreshold - adxVal) / 20);
        } else {
            strength[i] = 0.5;
        }
    }

    return { regime, adx: adxValues, strength };
}
