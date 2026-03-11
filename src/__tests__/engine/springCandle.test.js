// ═══════════════════════════════════════════════════════════════════
// charEdge — Forming Candle Animation Tests (Task 8.2.1)
//
// Verifies the FormingCandleInterpolator-based candle animation:
//   1. Source presence of interpolator integration
//   2. Smooth animation system using exponential smoothing
//   3. Settling behavior via isDone
//   4. Reset on new bars
//
// Note: Replaces the old spring-physics source verification tests.
//       The ad-hoc _springVelocity/_springStiffness/_springDamping
//       fields have been replaced by FormingCandleInterpolator.
// ═══════════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, beforeEach } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Forming Candle Animation — source verification', () => {
    let source;

    beforeEach(() => {
        source = fs.readFileSync(
            path.resolve(__dirname, '..', '..', 'charting_library/core/ChartEngine.ts'),
            'utf-8'
        );
    });

    // ─── FormingCandleInterpolator Integration ──────────────────

    it('imports FormingCandleInterpolator', () => {
        expect(source).toContain("import { FormingCandleInterpolator }");
    });

    it('has _formingInterpolator field', () => {
        expect(source).toContain('_formingInterpolator');
    });

    it('creates interpolator in constructor', () => {
        expect(source).toContain('new FormingCandleInterpolator(');
    });

    it('has _lastFrameTime for dt calculation', () => {
        expect(source).toContain('_lastFrameTime');
        expect(source).toContain('performance.now()');
    });

    // ─── Interpolation in Render Loop ───────────────────────────

    it('uses FormingCandleInterpolator.tick() in render loop', () => {
        expect(source).toContain('this._formingInterpolator.tick(');
    });

    it('caps dt to prevent physics explosion', () => {
        expect(source).toContain('Math.min');
        // Caps at 32ms
        expect(source).toContain('32');
    });

    // ─── Settling Behavior ──────────────────────────────────────

    it('settles based on interpolator isDone', () => {
        expect(source).toContain('this._formingInterpolator.isDone');
    });

    // ─── Data Updates ───────────────────────────────────────────

    it('calls setTarget on tick updates', () => {
        expect(source).toContain('this._formingInterpolator.setTarget(');
    });

    it('calls snap on new bar / data reset', () => {
        expect(source).toContain('this._formingInterpolator.snap(');
    });

    it('calls reset when bars array is empty', () => {
        expect(source).toContain('this._formingInterpolator.reset()');
    });

    // ─── Integration ────────────────────────────────────────────

    it('still assigns _anim* properties to last bar for rendering', () => {
        expect(source).toContain('lastBar._animOpen = result.open');
        expect(source).toContain('lastBar._animHigh = result.high');
        expect(source).toContain('lastBar._animLow = result.low');
        expect(source).toContain('lastBar._animClose = result.close');
    });

    it('marks layers dirty when animation is not done', () => {
        expect(source).toContain("if (!result.done)");
        expect(source).toContain("this.layers.markDirty(LAYERS.DATA)");
    });
});
