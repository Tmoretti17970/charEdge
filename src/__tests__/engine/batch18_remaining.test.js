/**
 * Batch 18 Remaining Tasks — B1.6, B2.3, B2.4
 * Tests for:
 *   B1.6: rAF loop unification into engine render loop
 *   B2.3: Elastic touch pinch spring-back
 *   B2.4: Y-axis scale cross-fade transition
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

const SRC_DIR = resolve(__dirname, '../../charting_library/core');

function readSrc(file) {
    return readFileSync(resolve(SRC_DIR, file), 'utf8');
}

// ─── B1.6: rAF Loop Unification ──────────────────────────────────

describe('B1.6: rAF loop unification', () => {
    const inputSrc = readSrc('InputManager.ts');
    const engineSrc = readSrc('ChartEngine.ts');

    it('InputManager has tickAnimations() public method', () => {
        expect(inputSrc).toContain('tickAnimations(): boolean');
    });

    it('InputManager has hasActiveAnimations() public method', () => {
        expect(inputSrc).toContain('hasActiveAnimations(): boolean');
    });

    it('InputManager has tick functions for all 5 animation loops', () => {
        expect(inputSrc).toContain('_tickInertia(): boolean');
        expect(inputSrc).toContain('_tickZoom(): boolean');
        expect(inputSrc).toContain('_tickPriceInertia(): boolean');
        expect(inputSrc).toContain('_tickZoomMomentum(): boolean');
        expect(inputSrc).toContain('_tickScrollToNow(): boolean');
    });

    it('InputManager uses boolean active flags instead of rAF IDs', () => {
        expect(inputSrc).toContain('_inertiaActive: boolean');
        expect(inputSrc).toContain('_zoomActive: boolean');
        expect(inputSrc).toContain('_priceInertiaActive: boolean');
        expect(inputSrc).toContain('_zoomMomentumActive: boolean');
        expect(inputSrc).toContain('_scrollToNowActive: boolean');

        // Should NOT have rAF ID fields
        expect(inputSrc).not.toContain('_inertiaRaf');
        expect(inputSrc).not.toContain('_zoomRaf:');
        expect(inputSrc).not.toContain('_priceInertiaRaf');
        expect(inputSrc).not.toContain('_zoomMomentumRaf');
        expect(inputSrc).not.toContain('_scrollToNowRaf');
    });

    it('_startInertia sets flag instead of spawning rAF', () => {
        // Extract _startInertia method body
        const match = inputSrc.match(/_startInertia\(\)[\s\S]*?_inertiaActive = true/);
        expect(match).not.toBeNull();
        // It should not contain requestAnimationFrame
        const startBlock = inputSrc.match(/_startInertia\(\)[^}]*?this\.engine\._scheduleDraw\(\)/s);
        expect(startBlock).not.toBeNull();
    });

    it('ChartEngine.renderLoop calls tickAnimations()', () => {
        expect(engineSrc).toContain('this.inputManager.tickAnimations()');
    });

    it('ChartEngine._needsNextFrame checks hasActiveAnimations()', () => {
        expect(engineSrc).toContain('this.inputManager?.hasActiveAnimations()');
    });

    it('destroy() clears boolean flags instead of cancelling rAF', () => {
        expect(inputSrc).toContain('this._inertiaActive = false');
        expect(inputSrc).toContain('this._zoomActive = false');
        expect(inputSrc).toContain('this._scrollToNowActive = false');
        expect(inputSrc).toContain('this._priceInertiaActive = false');
        expect(inputSrc).toContain('this._zoomMomentumActive = false');
    });
});

// ─── B2.3: Elastic Touch Pinch Spring-Back ───────────────────────

describe('B2.3: Elastic touch pinch spring-back', () => {
    const inputSrc = readSrc('InputManager.ts');

    it('InputManager has _pinchOverstretched flag', () => {
        expect(inputSrc).toContain('_pinchOverstretched: boolean');
    });

    it('InputManager has _pinchSpringActive flag', () => {
        expect(inputSrc).toContain('_pinchSpringActive: boolean');
    });

    it('Pinch handler applies elastic resistance with 0.3 factor', () => {
        expect(inputSrc).toContain('overshoot * 0.3');
    });

    it('InputManager has _tickPinchSpring method with easeOutExpo', () => {
        expect(inputSrc).toContain('_tickPinchSpring(): boolean');
        expect(inputSrc).toContain('Math.pow(2, -10 * t)'); // easeOutExpo formula
    });

    it('tickAnimations includes pinch spring', () => {
        expect(inputSrc).toContain('this._pinchSpringActive');
        expect(inputSrc).toContain('this._tickPinchSpring()');
    });

    it('onTouchEnd triggers spring-back when overstretched', () => {
        expect(inputSrc).toContain("'pinch' && this._pinchOverstretched");
        expect(inputSrc).toContain('_pinchSpringActive = true');
    });

    it('Elastic pinch allows bars below minimum (10) with resistance', () => {
        // Should compute rawBars and apply resistance when < minBars
        expect(inputSrc).toContain('rawBars < minBars');
        expect(inputSrc).toContain('newBars = minBars - overshoot * 0.3');
    });

    it('Spring-back uses 200ms SPRING_DURATION', () => {
        expect(inputSrc).toContain('SPRING_DURATION = 200');
    });
});

// ─── B2.4: Y-Axis Scale Cross-Fade ──────────────────────────────

describe('B2.4: Y-axis scale cross-fade', () => {
    const engineSrc = readSrc('ChartEngine.ts');
    const dataStageSrc = readSrc('stages/DataStage.ts');
    const gridStageSrc = readSrc('stages/GridStage.ts');

    it('ChartEngine has _niceStepTransition typed field', () => {
        expect(engineSrc).toContain('_niceStepTransition');
        expect(engineSrc).toContain('startTime');
        expect(engineSrc).toContain('fromTicks');
        expect(engineSrc).toContain('toTicks');
    });

    it('ChartEngine has _prevNiceStepKey field', () => {
        expect(engineSrc).toContain('_prevNiceStepKey: string');
    });

    it('DataStage detects niceStep tick change and starts 120ms transition', () => {
        expect(dataStageSrc).toContain('_niceStepTransition');
        expect(dataStageSrc).toContain('duration: 120');
        expect(dataStageSrc).toContain('niceStepKey !== engine._prevNiceStepKey');
    });

    it('DataStage clears expired transition', () => {
        expect(dataStageSrc).toContain('engine._niceStepTransition = null');
        expect(dataStageSrc).toContain('elapsed >= engine._niceStepTransition.duration');
    });

    it('GridStage renders cross-fade with per-line alpha', () => {
        expect(gridStageSrc).toContain('hLine.alpha');
        expect(gridStageSrc).toContain('fadeOutAlpha');
        expect(gridStageSrc).toContain('transProgress');
    });

    it('GridStage invalidates cache during transition via transKey', () => {
        expect(gridStageSrc).toContain('transKey');
    });

    it('_needsNextFrame returns true during transition', () => {
        expect(engineSrc).toContain('if (this._niceStepTransition) return true');
    });
});
