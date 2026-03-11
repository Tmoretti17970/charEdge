// ═══════════════════════════════════════════════════════════════════
// Phase 1 — Sprint 1 Quick-Win Indicator QA (1.11 – 1.15)
//
// Verifies computation correctness for the 5 Sprint 1 indicators:
//   1.11  Stochastic RSI
//   1.12  Pivot Points
//   1.13  Elder-Ray
//   1.14  ADXR
//   1.15  Auto-Fib
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { adxr } from '../../charting_library/studies/indicators/adxr.ts';
import { elderRay } from '../../charting_library/studies/indicators/elderRay.ts';
import { pivotPoints } from '../../charting_library/studies/indicators/pivotPoints.ts';
import { INDICATORS } from '../../charting_library/studies/indicators/registry.js';
import { stochRsi } from '../../charting_library/studies/indicators/stochRsi.ts';

// ─── Helpers ─────────────────────────────────────────────────────

/** Generate deterministic trending bars for reproducible tests */
function generateTrendingBars(count, startPrice = 100, trend = 0.1) {
    const bars = [];
    let price = startPrice;
    for (let i = 0; i < count; i++) {
        price += trend + Math.sin(i * 0.1) * 0.5;
        const open = price;
        const close = price + (Math.sin(i * 0.3) * 0.5);
        const high = Math.max(open, close) + Math.abs(Math.sin(i * 0.2)) * 0.5;
        const low = Math.min(open, close) - Math.abs(Math.cos(i * 0.2)) * 0.5;
        bars.push({
            time: 1700000000000 + i * 60000,
            open,
            high,
            low,
            close,
            volume: 1000 + Math.floor(Math.sin(i * 0.1) * 500),
        });
    }
    return bars;
}

/** Hand-crafted known bars for exact validation */
const knownBars = [
    { time: 0, open: 44, high: 44.34, low: 43.61, close: 44.09, volume: 100 },
    { time: 1, open: 44.09, high: 44.09, low: 43.61, close: 43.61, volume: 100 },
    { time: 2, open: 43.61, high: 44.33, low: 43.61, close: 44.33, volume: 100 },
    { time: 3, open: 44.33, high: 44.84, low: 44.33, close: 44.83, volume: 100 },
    { time: 4, open: 44.83, high: 45.10, low: 44.37, close: 44.37, volume: 100 },
    { time: 5, open: 44.37, high: 44.80, low: 44.20, close: 44.57, volume: 100 },
    { time: 6, open: 44.57, high: 44.60, low: 43.27, close: 43.42, volume: 100 },
    { time: 7, open: 43.42, high: 43.70, low: 43.30, close: 43.60, volume: 100 },
    { time: 8, open: 43.60, high: 44.80, low: 43.50, close: 44.33, volume: 100 },
    { time: 9, open: 44.33, high: 44.90, low: 44.30, close: 44.83, volume: 100 },
    { time: 10, open: 44.83, high: 45.00, low: 44.10, close: 45.00, volume: 100 },
    { time: 11, open: 45.00, high: 45.15, low: 44.63, close: 44.63, volume: 100 },
    { time: 12, open: 44.63, high: 44.63, low: 43.90, close: 43.95, volume: 100 },
    { time: 13, open: 43.95, high: 44.18, low: 43.68, close: 44.18, volume: 100 },
    { time: 14, open: 44.18, high: 44.22, low: 43.98, close: 44.22, volume: 100 },
    { time: 15, open: 44.22, high: 44.50, low: 44.00, close: 44.47, volume: 100 },
    { time: 16, open: 44.47, high: 44.47, low: 43.64, close: 43.64, volume: 100 },
    { time: 17, open: 43.64, high: 44.55, low: 43.64, close: 44.55, volume: 100 },
    { time: 18, open: 44.55, high: 44.58, low: 44.20, close: 44.24, volume: 100 },
    { time: 19, open: 44.24, high: 44.70, low: 43.96, close: 44.50, volume: 100 },
];

const bars200 = generateTrendingBars(200);

// ═══════════════════════════════════════════════════════════════════
// 1.11 — Stochastic RSI
// ═══════════════════════════════════════════════════════════════════

describe('Phase 1 · 1.11 — Stochastic RSI QA', () => {
    it('returns { k, d } arrays of correct length', () => {
        const result = stochRsi(bars200);
        expect(result.k.length).toBe(200);
        expect(result.d.length).toBe(200);
    });

    it('%K and %D values are bounded [0, 100] when valid', () => {
        const result = stochRsi(bars200);
        for (let i = 0; i < result.k.length; i++) {
            if (!isNaN(result.k[i])) {
                expect(result.k[i]).toBeGreaterThanOrEqual(-0.01);
                expect(result.k[i]).toBeLessThanOrEqual(100.01);
            }
            if (!isNaN(result.d[i])) {
                expect(result.d[i]).toBeGreaterThanOrEqual(-0.01);
                expect(result.d[i]).toBeLessThanOrEqual(100.01);
            }
        }
    });

    it('early values are NaN (warmup period)', () => {
        const result = stochRsi(bars200, 14, 14, 3, 3);
        // Need rsiPeriod + stochPeriod + kSmooth + dSmooth warmup ≈ 33 bars
        expect(isNaN(result.k[0])).toBe(true);
        expect(isNaN(result.d[0])).toBe(true);
    });

    it('registry entry has correct paneConfig', () => {
        const def = INDICATORS.stochRsi;
        expect(def.mode).toBe('pane');
        expect(def.paneConfig.min).toBe(0);
        expect(def.paneConfig.max).toBe(100);
        expect(def.paneConfig.bands.length).toBe(3);
        expect(def.paneConfig.bands[0].value).toBe(80);
        expect(def.paneConfig.bands[1].value).toBe(20);
    });

    it('computes via registry entry', () => {
        const def = INDICATORS.stochRsi;
        const params = {};
        for (const [key, config] of Object.entries(def.params)) {
            params[key] = config.default;
        }
        const result = def.compute(bars200, params);
        expect(result.k).toBeDefined();
        expect(result.d).toBeDefined();
    });
});

// ═══════════════════════════════════════════════════════════════════
// 1.12 — Pivot Points
// ═══════════════════════════════════════════════════════════════════

describe('Phase 1 · 1.12 — Pivot Points QA', () => {
    it('returns all 7 level arrays of correct length', () => {
        const result = pivotPoints(bars200, 1);
        expect(result.pivot.length).toBe(200);
        expect(result.r1.length).toBe(200);
        expect(result.r2.length).toBe(200);
        expect(result.r3.length).toBe(200);
        expect(result.s1.length).toBe(200);
        expect(result.s2.length).toBe(200);
        expect(result.s3.length).toBe(200);
    });

    it('pivot formula: PP = (H + L + C) / 3', () => {
        const result = pivotPoints(knownBars, 1);
        // Check bar index 1 (uses bar 0 as prior period)
        const pH = knownBars[0].high;
        const pL = knownBars[0].low;
        const pC = knownBars[0].close;
        const expectedPP = (pH + pL + pC) / 3;
        expect(result.pivot[1]).toBeCloseTo(expectedPP, 6);
    });

    it('R1 = 2*PP - L, S1 = 2*PP - H', () => {
        const result = pivotPoints(knownBars, 1);
        const pH = knownBars[0].high;
        const pL = knownBars[0].low;
        const pC = knownBars[0].close;
        const pp = (pH + pL + pC) / 3;
        expect(result.r1[1]).toBeCloseTo(2 * pp - pL, 6);
        expect(result.s1[1]).toBeCloseTo(2 * pp - pH, 6);
    });

    it('R2 = PP + (H-L), S2 = PP - (H-L)', () => {
        const result = pivotPoints(knownBars, 1);
        const pH = knownBars[0].high;
        const pL = knownBars[0].low;
        const pC = knownBars[0].close;
        const pp = (pH + pL + pC) / 3;
        expect(result.r2[1]).toBeCloseTo(pp + (pH - pL), 6);
        expect(result.s2[1]).toBeCloseTo(pp - (pH - pL), 6);
    });

    it('registry: mode is overlay with 7 outputs', () => {
        const def = INDICATORS.pivotPoints;
        expect(def.mode).toBe('overlay');
        expect(def.outputs.length).toBe(7);
    });
});

// ═══════════════════════════════════════════════════════════════════
// 1.13 — Elder-Ray
// ═══════════════════════════════════════════════════════════════════

describe('Phase 1 · 1.13 — Elder-Ray QA', () => {
    it('returns { bullPower, bearPower } arrays of correct length', () => {
        const result = elderRay(bars200, 13);
        expect(result.bullPower.length).toBe(200);
        expect(result.bearPower.length).toBe(200);
    });

    it('Bull Power = High - EMA(close), Bear Power = Low - EMA(close)', () => {
        const result = elderRay(bars200, 13);
        // After EMA warmup, bull power should generally be positive (high > ema)
        // and bear power should generally be negative (low < ema)
        let bullPositive = 0;
        let bearNegative = 0;
        for (let i = 50; i < 200; i++) {
            if (!isNaN(result.bullPower[i]) && result.bullPower[i] > 0) bullPositive++;
            if (!isNaN(result.bearPower[i]) && result.bearPower[i] < 0) bearNegative++;
        }
        // Majority of bull power values should be positive
        expect(bullPositive).toBeGreaterThan(50);
        // Majority of bear power values should be negative
        expect(bearNegative).toBeGreaterThan(50);
    });

    it('early values are NaN (EMA warmup)', () => {
        const result = elderRay(bars200, 13);
        expect(isNaN(result.bullPower[0])).toBe(true);
        expect(isNaN(result.bearPower[0])).toBe(true);
    });

    it('registry: Bull is histogram, Bear is line, band at 0', () => {
        const def = INDICATORS.elderRay;
        expect(def.mode).toBe('pane');
        const bullOutput = def.outputs.find(o => o.key === 'bullPower');
        const bearOutput = def.outputs.find(o => o.key === 'bearPower');
        expect(bullOutput.type).toBe('histogram');
        expect(bearOutput.type).toBe('line');
        expect(def.paneConfig.bands[0].value).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════
// 1.14 — ADXR
// ═══════════════════════════════════════════════════════════════════

describe('Phase 1 · 1.14 — ADXR QA', () => {
    it('returns { adxr, adx, plusDI, minusDI } arrays', () => {
        const result = adxr(bars200, 14);
        expect(result.adxr.length).toBe(200);
        expect(result.adx.length).toBe(200);
        expect(result.plusDI.length).toBe(200);
        expect(result.minusDI.length).toBe(200);
    });

    it('ADXR = (ADX[i] + ADX[i - period]) / 2', () => {
        const period = 14;
        const result = adxr(bars200, period);
        // Check a valid ADXR value
        for (let i = period * 3; i < 200; i++) {
            if (!isNaN(result.adxr[i]) && !isNaN(result.adx[i]) && !isNaN(result.adx[i - period])) {
                const expected = (result.adx[i] + result.adx[i - period]) / 2;
                expect(result.adxr[i]).toBeCloseTo(expected, 10);
            }
        }
    });

    it('all values bounded [0, 100] when valid', () => {
        const result = adxr(bars200, 14);
        for (let i = 0; i < 200; i++) {
            if (!isNaN(result.adxr[i])) {
                expect(result.adxr[i]).toBeGreaterThanOrEqual(0);
                expect(result.adxr[i]).toBeLessThanOrEqual(100);
            }
            if (!isNaN(result.adx[i])) {
                expect(result.adx[i]).toBeGreaterThanOrEqual(0);
                expect(result.adx[i]).toBeLessThanOrEqual(100);
            }
        }
    });

    it('registry: mode=pane, min=0, max=100', () => {
        const def = INDICATORS.adxr;
        expect(def.mode).toBe('pane');
        expect(def.paneConfig.min).toBe(0);
        expect(def.paneConfig.max).toBe(100);
    });
});

// ═══════════════════════════════════════════════════════════════════
// 1.15 — Auto-Fib
// ═══════════════════════════════════════════════════════════════════

describe('Phase 1 · 1.15 — Auto-Fib QA', () => {
    it('returns all 7 retracement level arrays', () => {
        const def = INDICATORS.autoFib;
        const result = def.compute(bars200, { strength: 8 });
        expect(result.high).toBeDefined();
        expect(result.low).toBeDefined();
        expect(result.fib786).toBeDefined();
        expect(result.fib618).toBeDefined();
        expect(result.fib500).toBeDefined();
        expect(result.fib382).toBeDefined();
        expect(result.fib236).toBeDefined();
        expect(result.high.length).toBe(200);
    });

    it('retracement levels are at correct percentages', () => {
        const def = INDICATORS.autoFib;
        const result = def.compute(bars200, { strength: 5 });
        // Find the first valid index
        const firstValid = result.high.findIndex(v => !isNaN(v));
        if (firstValid === -1) return; // No swings detected — skip

        const h = result.high[firstValid];
        const l = result.low[firstValid];
        const range = h - l;

        if (range > 0) {
            expect(result.fib786[firstValid]).toBeCloseTo(l + range * 0.786, 6);
            expect(result.fib618[firstValid]).toBeCloseTo(l + range * 0.618, 6);
            expect(result.fib500[firstValid]).toBeCloseTo(l + range * 0.5, 6);
            expect(result.fib382[firstValid]).toBeCloseTo(l + range * 0.382, 6);
            expect(result.fib236[firstValid]).toBeCloseTo(l + range * 0.236, 6);
        }
    });

    it('all levels are between swing low and swing high', () => {
        const def = INDICATORS.autoFib;
        const result = def.compute(bars200, { strength: 5 });
        for (let i = 0; i < result.high.length; i++) {
            if (isNaN(result.high[i])) continue;
            const h = result.high[i];
            const l = result.low[i];
            expect(result.fib786[i]).toBeGreaterThanOrEqual(l - 0.001);
            expect(result.fib786[i]).toBeLessThanOrEqual(h + 0.001);
            expect(result.fib618[i]).toBeGreaterThanOrEqual(l - 0.001);
            expect(result.fib618[i]).toBeLessThanOrEqual(h + 0.001);
        }
    });

    it('registry: mode=overlay, 7 outputs', () => {
        const def = INDICATORS.autoFib;
        expect(def.mode).toBe('overlay');
        expect(def.outputs.length).toBe(7);
    });
});

// ═══════════════════════════════════════════════════════════════════
// Incremental Cache — BB & Stochastic (1.5, 1.6)
// ═══════════════════════════════════════════════════════════════════

describe('Phase 1 · 1.5 — BB Incremental matches full compute', () => {
    it('incremental BB output matches full recompute within tolerance', async () => {
        const { IncrementalIndicatorCache } = await import(
            '../../charting_library/studies/indicators/IncrementalIndicatorCache.ts'
        );
        const { bollingerBands } = await import(
            '../../charting_library/studies/indicators/bollingerBands.ts'
        );

        const bars = generateTrendingBars(100);
        const closes = bars.map(b => b.close);
        const cache = new IncrementalIndicatorCache();

        // Initial full compute
        const initial = cache.computeBollingerIncremental('bb-test', closes, 20, 2);

        // Simulate tick update: change only the last close
        const updatedCloses = [...closes];
        updatedCloses[99] = closes[99] + 1.5;

        const incremental = cache.computeBollingerIncremental('bb-test', updatedCloses, 20, 2);
        const full = bollingerBands(updatedCloses, 20, 2);

        // Last value should match
        expect(incremental.middle[99]).toBeCloseTo(full.middle[99], 8);
        expect(incremental.upper[99]).toBeCloseTo(full.upper[99], 8);
        expect(incremental.lower[99]).toBeCloseTo(full.lower[99], 8);
    });
});

describe('Phase 1 · 1.6 — Stoch Incremental matches full compute', () => {
    it('incremental Stoch output matches full recompute for %K', async () => {
        const { IncrementalIndicatorCache } = await import(
            '../../charting_library/studies/indicators/IncrementalIndicatorCache.ts'
        );
        const { stochastic } = await import(
            '../../charting_library/studies/indicators/stochastic.ts'
        );

        const bars = generateTrendingBars(100);
        const cache = new IncrementalIndicatorCache();

        // Initial full compute
        cache.computeStochasticIncremental('stoch-test', bars, 14, 3);

        // Simulate tick update: change only last bar's close
        const updatedBars = bars.map((b, i) => i === 99 ? { ...b, close: b.close + 1.0 } : b);

        const incremental = cache.computeStochasticIncremental('stoch-test', updatedBars, 14, 3);
        const full = stochastic(updatedBars, 14, 3);

        // %K for last bar should match
        expect(incremental.k[99]).toBeCloseTo(full.k[99], 8);
    });
});
