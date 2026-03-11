// ═══════════════════════════════════════════════════════════════════
// charEdge — Divergence Engine (Phase 2)
// Detects regular and hidden divergences between price and indicators
// ═══════════════════════════════════════════════════════════════════

import type { Bar } from './helpers.ts';
import { zigzag, type ZigZagPoint } from './zigzag.ts';

// ─── Types ───────────────────────────────────────────────────────

export type DivergenceType =
    | 'regular_bullish'
    | 'regular_bearish'
    | 'hidden_bullish'
    | 'hidden_bearish';

export interface Divergence {
    type: DivergenceType;
    priceStart: { idx: number; value: number };
    priceEnd: { idx: number; value: number };
    indicatorStart: { idx: number; value: number };
    indicatorEnd: { idx: number; value: number };
    strength: number; // 0-1 confidence
}

export interface DivergenceOptions {
    /** Sensitivity level for swing detection */
    sensitivity?: 'loose' | 'medium' | 'strict';
    /** Maximum bars between compared swings */
    maxDistance?: number;
    /** Minimum bars between compared swings */
    minDistance?: number;
}

// ─── Sensitivity Presets ─────────────────────────────────────────

const PRESETS = {
    loose: { deviation: 3, depth: 5 },
    medium: { deviation: 5, depth: 10 },
    strict: { deviation: 8, depth: 15 },
};

// ─── Main API ────────────────────────────────────────────────────

/**
 * Detect divergences between price swings and indicator swings.
 *
 * @param bars            - OHLCV bars
 * @param indicatorValues - Indicator output array (e.g. RSI, MACD)
 * @param options         - Sensitivity and distance params
 */
export function detectDivergences(
    bars: Bar[],
    indicatorValues: number[],
    options: DivergenceOptions = {},
): Divergence[] {
    const {
        sensitivity = 'medium',
        maxDistance = 100,
        minDistance = 5,
    } = options;

    const preset = PRESETS[sensitivity];
    const divergences: Divergence[] = [];

    // Find price swings
    const priceSwings = zigzag(bars, preset.deviation, preset.depth);

    // Find indicator swings (treat indicator values as price for ZigZag)
    const indBars: Bar[] = indicatorValues.map((v, i) => ({
        time: i,
        open: isNaN(v) ? 0 : v,
        high: isNaN(v) ? 0 : v,
        low: isNaN(v) ? 0 : v,
        close: isNaN(v) ? 0 : v,
    }));
    const indSwings = zigzag(indBars, preset.deviation * 2, Math.max(3, Math.floor(preset.depth / 2)));

    const priceHighs = priceSwings.points.filter(p => p.type === 'high');
    const priceLows = priceSwings.points.filter(p => p.type === 'low');
    const indHighs = indSwings.points.filter(p => p.type === 'high');
    const indLows = indSwings.points.filter(p => p.type === 'low');

    // ─── Regular Bullish: price lower low + indicator higher low ───
    for (let i = 1; i < priceLows.length; i++) {
        const prev = priceLows[i - 1]!;
        const curr = priceLows[i]!;

        if (curr.price >= prev.price) continue; // Not a lower low
        const dist = curr.idx - prev.idx;
        if (dist < minDistance || dist > maxDistance) continue;

        // Find indicator low near each price low
        const indPrev = _findNearest(indLows, prev.idx);
        const indCurr = _findNearest(indLows, curr.idx);
        if (!indPrev || !indCurr) continue;

        if (indCurr.price > indPrev.price) {
            // Price lower low + indicator higher low = regular bullish
            const strength = _calcStrength(prev.price, curr.price, indPrev.price, indCurr.price);
            divergences.push({
                type: 'regular_bullish',
                priceStart: { idx: prev.idx, value: prev.price },
                priceEnd: { idx: curr.idx, value: curr.price },
                indicatorStart: { idx: indPrev.idx, value: indPrev.price },
                indicatorEnd: { idx: indCurr.idx, value: indCurr.price },
                strength,
            });
        }
    }

    // ─── Regular Bearish: price higher high + indicator lower high ─
    for (let i = 1; i < priceHighs.length; i++) {
        const prev = priceHighs[i - 1]!;
        const curr = priceHighs[i]!;

        if (curr.price <= prev.price) continue; // Not a higher high
        const dist = curr.idx - prev.idx;
        if (dist < minDistance || dist > maxDistance) continue;

        const indPrev = _findNearest(indHighs, prev.idx);
        const indCurr = _findNearest(indHighs, curr.idx);
        if (!indPrev || !indCurr) continue;

        if (indCurr.price < indPrev.price) {
            const strength = _calcStrength(prev.price, curr.price, indPrev.price, indCurr.price);
            divergences.push({
                type: 'regular_bearish',
                priceStart: { idx: prev.idx, value: prev.price },
                priceEnd: { idx: curr.idx, value: curr.price },
                indicatorStart: { idx: indPrev.idx, value: indPrev.price },
                indicatorEnd: { idx: indCurr.idx, value: indCurr.price },
                strength,
            });
        }
    }

    // ─── Hidden Bullish: price higher low + indicator lower low ────
    for (let i = 1; i < priceLows.length; i++) {
        const prev = priceLows[i - 1]!;
        const curr = priceLows[i]!;

        if (curr.price <= prev.price) continue; // Not a higher low
        const dist = curr.idx - prev.idx;
        if (dist < minDistance || dist > maxDistance) continue;

        const indPrev = _findNearest(indLows, prev.idx);
        const indCurr = _findNearest(indLows, curr.idx);
        if (!indPrev || !indCurr) continue;

        if (indCurr.price < indPrev.price) {
            const strength = _calcStrength(prev.price, curr.price, indPrev.price, indCurr.price);
            divergences.push({
                type: 'hidden_bullish',
                priceStart: { idx: prev.idx, value: prev.price },
                priceEnd: { idx: curr.idx, value: curr.price },
                indicatorStart: { idx: indPrev.idx, value: indPrev.price },
                indicatorEnd: { idx: indCurr.idx, value: indCurr.price },
                strength,
            });
        }
    }

    // ─── Hidden Bearish: price lower high + indicator higher high ──
    for (let i = 1; i < priceHighs.length; i++) {
        const prev = priceHighs[i - 1]!;
        const curr = priceHighs[i]!;

        if (curr.price >= prev.price) continue; // Not a lower high
        const dist = curr.idx - prev.idx;
        if (dist < minDistance || dist > maxDistance) continue;

        const indPrev = _findNearest(indHighs, prev.idx);
        const indCurr = _findNearest(indHighs, curr.idx);
        if (!indPrev || !indCurr) continue;

        if (indCurr.price > indPrev.price) {
            const strength = _calcStrength(prev.price, curr.price, indPrev.price, indCurr.price);
            divergences.push({
                type: 'hidden_bearish',
                priceStart: { idx: prev.idx, value: prev.price },
                priceEnd: { idx: curr.idx, value: curr.price },
                indicatorStart: { idx: indPrev.idx, value: indPrev.price },
                indicatorEnd: { idx: indCurr.idx, value: indCurr.price },
                strength,
            });
        }
    }

    return divergences;
}

// ─── Helpers ─────────────────────────────────────────────────────

/** Find nearest swing point to a given bar index */
// eslint-disable-next-line @typescript-eslint/naming-convention
function _findNearest(
    points: ZigZagPoint[],
    targetIdx: number,
    maxDist: number = 15,
): ZigZagPoint | null {
    let best: ZigZagPoint | null = null;
    let bestDist = Infinity;

    for (const p of points) {
        const dist = Math.abs(p.idx - targetIdx);
        if (dist < bestDist && dist <= maxDist) {
            best = p;
            bestDist = dist;
        }
    }
    return best;
}

/** Divergence strength: magnitude of angle divergence between price and indicator */
// eslint-disable-next-line @typescript-eslint/naming-convention
function _calcStrength(
    pricePrev: number,
    priceCurr: number,
    indPrev: number,
    indCurr: number,
): number {
    const priceChange = (priceCurr - pricePrev) / (Math.abs(pricePrev) || 1);
    const indChange = (indCurr - indPrev) / (Math.abs(indPrev) || 1);

    // Strength is the difference in direction magnitude, clamped to [0, 1]
    const raw = Math.abs(priceChange - indChange);
    return Math.min(1, Math.max(0, raw));
}
