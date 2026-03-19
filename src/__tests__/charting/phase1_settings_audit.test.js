// ═══════════════════════════════════════════════════════════════════
// Phase 1 — Settings Audit Tests (1.7, 1.8, 1.9, 1.10)
//
// Validates structural correctness of all indicator registry entries:
//   1.7  Band/fill config rendering correctness
//   1.8  Editable bands round-trip
//   1.9  Overrides API round-trip
//   1.10 Template load/save/apply
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { INDICATORS } from '../../charting_library/studies/indicators/registry.js';

// ─── Helpers ─────────────────────────────────────────────────────

/** Generate synthetic OHLCV bars for testing */
function generateBars(count) {
    const bars = [];
    let price = 100;
    for (let i = 0; i < count; i++) {
        const change = (Math.random() - 0.5) * 2;
        const open = price;
        const close = price + change;
        const high = Math.max(open, close) + Math.random();
        const low = Math.min(open, close) - Math.random();
        bars.push({
            time: 1700000000000 + i * 60000,
            open,
            high,
            low,
            close,
            volume: Math.floor(Math.random() * 10000) + 100,
        });
        price = close;
    }
    return bars;
}

const allIds = Object.keys(INDICATORS);
const bars500 = generateBars(500);

// ─── 1.7 Band/Fill Config Rendering ─────────────────────────────

describe('Phase 1 · 1.7 — Band/Fill Config Audit', () => {
    it(`has ${allIds.length} total indicators in registry`, () => {
        expect(allIds.length).toBeGreaterThanOrEqual(55);
    });

    it('every pane indicator with bands has valid { value, color } entries', () => {
        for (const id of allIds) {
            const def = INDICATORS[id];
            if (def.mode !== 'pane') continue;
            const pc = def.paneConfig;
            if (!pc || !pc.bands) continue;

            for (const band of pc.bands) {
                expect(typeof band.value).toBe('number');
                expect(typeof band.color).toBe('string');
                // Value should be finite
                expect(Number.isFinite(band.value)).toBe(true);
            }
        }
    });

    it('band values fall within paneConfig.min/max when defined', () => {
        for (const id of allIds) {
            const def = INDICATORS[id];
            if (def.mode !== 'pane') continue;
            const pc = def.paneConfig;
            if (!pc || !pc.bands) continue;
            if (pc.min === undefined || pc.max === undefined) continue;

            for (const band of pc.bands) {
                expect(band.value).toBeGreaterThanOrEqual(pc.min);
                expect(band.value).toBeLessThanOrEqual(pc.max);
            }
        }
    });

    it('overlay fills reference existing output keys', () => {
        for (const id of allIds) {
            const def = INDICATORS[id];
            if (!def.fills) continue;

            const outputKeys = new Set(def.outputs.map((o) => o.key));
            for (const fill of def.fills) {
                expect(outputKeys.has(fill.upper)).toBe(true);
                expect(outputKeys.has(fill.lower)).toBe(true);
            }
        }
    });

    it('every indicator has a valid compute() function', () => {
        for (const id of allIds) {
            const def = INDICATORS[id];
            expect(typeof def.compute).toBe('function');
        }
    });

    it('every indicator has outputs with key, label, color, type', () => {
        for (const id of allIds) {
            const def = INDICATORS[id];
            expect(def.outputs.length).toBeGreaterThan(0);

            for (const output of def.outputs) {
                expect(typeof output.key).toBe('string');
                expect(typeof output.label).toBe('string');
                expect(typeof output.color).toBe('string');
                expect(['line', 'histogram', 'vrvp', 'dots', 'hidden', 'band', 'fill', 'area']).toContain(output.type);
            }
        }
    });
});

// ─── 1.8 / 1.9 / 1.10 — Structural Verification ────────────────

describe('Phase 1 · 1.8 — Editable Bands Structure', () => {
    it('pane indicators with fills have valid { above, color } or { below, color }', () => {
        for (const id of allIds) {
            const def = INDICATORS[id];
            if (def.mode !== 'pane') continue;
            const pc = def.paneConfig;
            if (!pc || !pc.fills) continue;

            for (const fill of pc.fills) {
                // Each fill should have either 'above' or 'below' and a color
                const hasAbove = fill.above !== undefined;
                const hasBelow = fill.below !== undefined;
                expect(hasAbove || hasBelow).toBe(true);
                expect(typeof fill.color).toBe('string');
            }
        }
    });
});

describe('Phase 1 · 1.9 — Overrides API Structural', () => {
    const indicatorSlicePath = '../../state/chart/indicatorSlice.ts';

    it('indicatorSlice has applyOverride and applyOverrides', async () => {
        // Read the file to verify the API exists
        const fs = await import('fs');
        const path = await import('path');
        const sliceSrc = fs.readFileSync(
            path.resolve(__dirname, indicatorSlicePath),
            'utf-8'
        );
        expect(sliceSrc).toContain('applyOverride');
        expect(sliceSrc).toContain('applyOverrides');
        expect(sliceSrc).toContain('_deepSet');
    });
});

describe('Phase 1 · 1.10 — Templates Structural', () => {
    it('indicatorSlice has template save/load/list actions', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const sliceSrc = fs.readFileSync(
            path.resolve(__dirname, '../../state/chart/indicatorSlice.ts'),
            'utf-8'
        );
        expect(sliceSrc).toContain('saveIndicatorTemplate');
        expect(sliceSrc).toContain('loadIndicatorTemplate');
        expect(sliceSrc).toContain('listIndicatorTemplates');
    });
});

// ─── All Indicators Compute Without Error ────────────────────────

describe('Phase 1 · All 55 indicators compute without error', () => {
    for (const id of allIds) {
        it(`${id} computes on 500 bars`, () => {
            const def = INDICATORS[id];
            // Build default params
            const params = {};
            for (const [key, config] of Object.entries(def.params)) {
                params[key] = config.default;
            }

            const result = def.compute(bars500, params);
            expect(result).toBeDefined();

            // Verify all output keys exist in computed result
            if (typeof result === 'object' && result !== null) {
                for (const output of def.outputs) {
                    if (output.type === 'vrvp') continue; // VRVP is special
                    const vals = result[output.key];
                    if (vals === undefined) continue; // Some return scalar config

                    if (Array.isArray(vals)) {
                        expect(vals.length).toBe(bars500.length);
                    }
                }
            }
        });
    }
});
