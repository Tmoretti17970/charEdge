// ═══════════════════════════════════════════════════════════════════
// charEdge — FormingCandleInterpolator Tests
//
// Tests for the exponential smoothing candle interpolation system.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
// eslint-disable-next-line import/order
import { FormingCandleInterpolator } from '../../charting_library/core/FormingCandleInterpolator.ts';

describe('FormingCandleInterpolator', () => {
    // ─── Construction ────────────────────────────────────────────

    it('creates with default alpha', () => {
        const interp = new FormingCandleInterpolator();
        expect(interp.alpha).toBe(0.3);
        expect(interp.initialized).toBe(false);
        expect(interp.isDone).toBe(true);
    });

    it('creates with custom alpha', () => {
        const interp = new FormingCandleInterpolator(0.5);
        expect(interp.alpha).toBe(0.5);
    });

    it('throws on invalid alpha', () => {
        expect(() => new FormingCandleInterpolator(0)).toThrow(RangeError);
        expect(() => new FormingCandleInterpolator(-0.1)).toThrow(RangeError);
        expect(() => new FormingCandleInterpolator(1.1)).toThrow(RangeError);
    });

    // ─── First Target — Snap ───────────────────────────────────

    it('snaps to first target immediately', () => {
        const interp = new FormingCandleInterpolator();
        interp.setTarget({ open: 100, high: 110, low: 90, close: 105 });

        expect(interp.initialized).toBe(true);
        expect(interp.isDone).toBe(true);

        const result = interp.tick();
        expect(result.open).toBe(100);
        expect(result.high).toBe(110);
        expect(result.low).toBe(90);
        expect(result.close).toBe(105);
        expect(result.done).toBe(true);
    });

    // ─── Interpolation ────────────────────────────────────────

    it('interpolates toward second target', () => {
        const interp = new FormingCandleInterpolator(0.3);
        interp.setTarget({ open: 100, high: 110, low: 90, close: 100 });
        interp.setTarget({ open: 100, high: 110, low: 90, close: 120 });

        expect(interp.isDone).toBe(false);

        const r1 = interp.tick();
        // close should move from 100 toward 120 by alpha * delta = 0.3 * 20 = 6
        expect(r1.close).toBeCloseTo(106, 1);
        expect(r1.done).toBe(false);
    });

    it('converges after enough ticks', () => {
        const interp = new FormingCandleInterpolator(0.5);
        interp.setTarget({ open: 100, high: 110, low: 90, close: 100 });
        interp.setTarget({ open: 100, high: 110, low: 90, close: 120 });

        for (let i = 0; i < 50; i++) interp.tick();

        const result = interp.tick();
        expect(result.close).toBe(120);
        expect(result.done).toBe(true);
    });

    it('alpha=1 snaps immediately', () => {
        const interp = new FormingCandleInterpolator(1.0);
        interp.setTarget({ open: 100, high: 110, low: 90, close: 100 });
        interp.setTarget({ open: 100, high: 110, low: 90, close: 120 });

        const result = interp.tick();
        expect(result.close).toBe(120);
        expect(result.done).toBe(true);
    });

    // ─── High/Low Monotonicity ─────────────────────────────────

    it('high can only expand upward', () => {
        const interp = new FormingCandleInterpolator(0.5);
        interp.setTarget({ open: 100, high: 120, low: 90, close: 100 });

        // Try to set a lower high — should snap immediately
        interp.setTarget({ open: 100, high: 115, low: 90, close: 100 });
        const result = interp.tick();
        expect(result.high).toBe(115); // Snaps down (corrected target)
    });

    it('low can only expand downward', () => {
        const interp = new FormingCandleInterpolator(0.5);
        interp.setTarget({ open: 100, high: 120, low: 90, close: 100 });

        // Try to set a higher low — should snap immediately
        interp.setTarget({ open: 100, high: 120, low: 95, close: 100 });
        const result = interp.tick();
        expect(result.low).toBe(95); // Snaps up (corrected target)
    });

    // ─── Snap Method ───────────────────────────────────────────

    it('snap() immediately sets current to target', () => {
        const interp = new FormingCandleInterpolator();
        interp.setTarget({ open: 100, high: 110, low: 90, close: 100 });
        interp.snap({ open: 200, high: 220, low: 180, close: 210 });

        expect(interp.isDone).toBe(true);
        const result = interp.tick();
        expect(result.open).toBe(200);
        expect(result.close).toBe(210);
    });

    // ─── Reset ─────────────────────────────────────────────────

    it('reset() clears state', () => {
        const interp = new FormingCandleInterpolator();
        interp.setTarget({ open: 100, high: 110, low: 90, close: 100 });
        interp.reset();
        expect(interp.initialized).toBe(false);
        expect(interp.isDone).toBe(true);
    });

    // ─── Uninitialized Tick ────────────────────────────────────

    it('tick() returns zeros when uninitialized', () => {
        const interp = new FormingCandleInterpolator();
        const result = interp.tick();
        expect(result.open).toBe(0);
        expect(result.close).toBe(0);
        expect(result.done).toBe(true);
    });

    // ─── Same OHLC Edge Case ──────────────────────────────────

    it('handles same OHLC as initial and target', () => {
        const interp = new FormingCandleInterpolator();
        const ohlc = { open: 100, high: 100, low: 100, close: 100 };
        interp.setTarget(ohlc);
        interp.setTarget(ohlc);

        const result = interp.tick();
        expect(result.done).toBe(true);
    });
});

// ─── ChartEngine Integration (Source Verification) ──────────────

// eslint-disable-next-line import/order
import fs from 'fs';
// eslint-disable-next-line import/order
import { fileURLToPath } from 'url';
// eslint-disable-next-line import/order
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('FormingCandleInterpolator — ChartEngine integration', () => {
    let source;

    beforeEach(() => {
        source = fs.readFileSync(
            path.resolve(__dirname, '..', '..', 'charting_library/core/ChartEngine.ts'),
            'utf-8'
        );
    });

    it('imports FormingCandleInterpolator', () => {
        expect(source).toContain("import { FormingCandleInterpolator }");
    });

    it('creates _formingInterpolator in constructor', () => {
        expect(source).toContain('new FormingCandleInterpolator(');
    });

    it('calls setTarget in setData for tick updates', () => {
        expect(source).toContain('this._formingInterpolator.setTarget(');
    });

    it('calls snap in setData for new bar/reset', () => {
        expect(source).toContain('this._formingInterpolator.snap(');
    });

    it('calls tick in renderLoop', () => {
        expect(source).toContain('this._formingInterpolator.tick(');
    });

    it('uses isDone in _needsNextFrame', () => {
        expect(source).toContain('this._formingInterpolator.isDone');
    });
});

// ─── Numeric Timestamp Optimization (8.1.3) ─────────────────────

describe('Task 8.1.3 — Numeric timestamp optimization', () => {
    it('barCountdown.js uses shared Date objects', () => {
        const source = fs.readFileSync(
            path.resolve(__dirname, '..', '..', 'charting_library/core/barCountdown.js'),
            'utf-8'
        );
        expect(source).toContain('new Date(');
        expect(source).toContain('Date');
        expect(source).toContain('timestamp');
    });

    it('CoordinateSystem.js uses shared Date objects', () => {
        const source = fs.readFileSync(
            path.resolve(__dirname, '..', '..', 'charting_library/core/CoordinateSystem.js'),
            'utf-8'
        );
        expect(source).toContain('_csSharedDate');
        expect(source).toContain('setTime(');
        expect(source).toContain("typeof timestamp === 'number'");
    });
});
