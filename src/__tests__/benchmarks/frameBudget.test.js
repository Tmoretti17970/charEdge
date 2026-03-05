// ═══════════════════════════════════════════════════════════════════
// charEdge — FrameBudget CI Benchmark Test
//
// P1-3: Validates FrameBudget's LOD degradation, phase timing,
// and stats reporting in a deterministic (non-flaky) way.
//
// All timing is injected via manual calls — no real wall-clock deps.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FrameBudget, IndicatorCache, LOD_LEVELS } from '../../charting_library/core/FrameBudget.js';

// ─── Helpers ───────────────────────────────────────────────────

/** Simulate `n` frames each taking `ms` milliseconds. */
function runFrames(fb, n, ms) {
    let time = 0;
    vi.spyOn(performance, 'now')
        .mockImplementation(() => time);

    for (let i = 0; i < n; i++) {
        time = i * ms;
        fb.beginFrame();
        time = i * ms + ms;
        fb.endFrame();
    }

    vi.restoreAllMocks();
}

/** Simulate frames with per-phase timing. */
function runFramesWithPhases(fb, n, phases) {
    let time = 0;
    vi.spyOn(performance, 'now')
        .mockImplementation(() => time);

    for (let i = 0; i < n; i++) {
        const frameBase = i * 100;
        time = frameBase;
        fb.beginFrame();

        let offset = 0;
        for (const [name, ms] of Object.entries(phases)) {
            time = frameBase + offset;
            fb.beginPhase(name);
            time = frameBase + offset + ms;
            fb.endPhase(name);
            offset += ms;
        }

        time = frameBase + offset;
        fb.endFrame();
    }

    vi.restoreAllMocks();
}

// ═══════════════════════════════════════════════════════════════════

describe('FrameBudget — Core Mechanics', () => {
    let fb;

    beforeEach(() => {
        fb = new FrameBudget({ targetFps: 60, windowSize: 10 });
    });

    it('initializes at LOD 3 (full quality)', () => {
        expect(fb.level).toBe(3);
        expect(fb.getLOD().volume).toBe(true);
        expect(fb.getLOD().drawings).toBe(true);
        expect(fb.getLOD().antiAlias).toBe(true);
    });

    it('tracks rolling average frame time', () => {
        runFrames(fb, 10, 10); // 10 frames at 10ms each
        expect(fb.avgFrameMs).toBeCloseTo(10, 0);
    });

    it('counts dropped frames (over target)', () => {
        runFrames(fb, 10, 20); // 20ms per frame > 16.67ms target
        const stats = fb.getStats();
        expect(stats.droppedFrames).toBe(10);
        expect(stats.dropRate).toBeGreaterThan(0);
    });

    it('does not count dropped frames when under budget', () => {
        runFrames(fb, 10, 10); // 10ms per frame < 16.67ms
        expect(fb.getStats().droppedFrames).toBe(0);
    });
});

describe('FrameBudget — LOD Degradation', () => {
    let fb;

    beforeEach(() => {
        fb = new FrameBudget({ targetFps: 60, windowSize: 10 });
    });

    it('degrades LOD when frames are consistently over budget', () => {
        // Need: 5 frames to fill buffer + 8 frames of hysteresis at > 20ms
        runFrames(fb, 20, 25); // 20 frames at 25ms
        expect(fb.level).toBeLessThan(3);
    });

    it('upgrades LOD when frames are consistently fast', () => {
        // First degrade
        runFrames(fb, 20, 25);
        const degradedLevel = fb.level;

        // Then run fast frames to trigger upgrade
        runFrames(fb, 25, 5); // 5ms per frame < 12ms upgrade threshold
        expect(fb.level).toBeGreaterThan(degradedLevel);
    });

    it('maintains LOD in acceptable range (no flicker)', () => {
        // Frame times between 12–20ms should NOT trigger LOD changes
        runFrames(fb, 30, 15); // 15ms — right in the middle
        expect(fb.level).toBe(3); // Should stay at initial
    });

    it('setLevel() forces a specific LOD', () => {
        fb.setLevel(1);
        expect(fb.level).toBe(1);
        expect(fb.getLOD().volume).toBe(false);
        expect(fb.getLOD().maxIndicators).toBe(1);
    });

    it('reset() restores to full quality', () => {
        fb.setLevel(0);
        fb.reset();
        expect(fb.level).toBe(3);
        expect(fb.getStats().totalFrames).toBe(0);
    });
});

describe('FrameBudget — Phase Timing', () => {
    it('tracks per-phase durations', () => {
        const fb = new FrameBudget({ targetFps: 60, windowSize: 10 });

        runFramesWithPhases(fb, 10, {
            grid: 2,
            candles: 5,
            indicators: 3,
        });

        const phaseStats = fb.getPhaseStats();
        expect(phaseStats).toHaveProperty('grid');
        expect(phaseStats).toHaveProperty('candles');
        expect(phaseStats).toHaveProperty('indicators');
        expect(phaseStats.candles).toBeGreaterThan(phaseStats.grid);
    });

    it('lastPhases returns single-frame breakdown', () => {
        const fb = new FrameBudget({ targetFps: 60, windowSize: 10 });
        runFramesWithPhases(fb, 1, { grid: 2, candles: 5 });

        const last = fb.lastPhases;
        expect(last).toHaveProperty('grid');
        expect(last).toHaveProperty('candles');
    });
});

describe('FrameBudget — Stats Reporting', () => {
    it('getStats() returns complete shape', () => {
        const fb = new FrameBudget({ targetFps: 60, windowSize: 10 });
        runFrames(fb, 5, 10);

        const stats = fb.getStats();
        expect(stats).toHaveProperty('avgMs');
        expect(stats).toHaveProperty('lastMs');
        expect(stats).toHaveProperty('lod');
        expect(stats).toHaveProperty('totalFrames', 5);
        expect(stats).toHaveProperty('droppedFrames');
        expect(stats).toHaveProperty('dropRate');
        expect(stats).toHaveProperty('phases');
    });

    it('LOD_LEVELS has 4 levels (0–3)', () => {
        expect(LOD_LEVELS).toHaveLength(4);
        expect(LOD_LEVELS[0].level).toBe(0);
        expect(LOD_LEVELS[3].level).toBe(3);
    });
});

// ═══════════════════════════════════════════════════════════════════
// IndicatorCache
// ═══════════════════════════════════════════════════════════════════

describe('IndicatorCache — incremental computation', () => {
    let cache;

    beforeEach(() => {
        cache = new IndicatorCache();
    });

    it('computes all indicators on first call', () => {
        const indicators = [
            { type: 'sma', params: { period: 20 }, color: '#ff0' },
            { type: 'ema', params: { period: 50 }, color: '#0f0' },
        ];
        const data = [
            { close: 100 }, { close: 101 }, { close: 102 },
        ];

        let computeCount = 0;
        const results = cache.compute(indicators, data, (ind) => {
            computeCount++;
            return { values: [1, 2, 3] };
        });

        expect(computeCount).toBe(2); // Both computed
        expect(results).toHaveLength(2);
        expect(results[0]).toHaveProperty('result');
    });

    it('skips recomputation when data length unchanged', () => {
        const indicators = [{ type: 'sma', params: { period: 20 } }];
        const data = [{ close: 100 }, { close: 101 }];

        let computeCount = 0;
        const computeFn = () => { computeCount++; return { values: [1] }; };

        cache.compute(indicators, data, computeFn);
        expect(computeCount).toBe(1);

        // Second call with same data length — should use cache
        cache.compute(indicators, data, computeFn);
        expect(computeCount).toBe(1); // Not recomputed
    });

    it('recomputes when data length changes', () => {
        const indicators = [{ type: 'sma', params: { period: 20 } }];
        const computeFn = () => ({ values: [1] });

        cache.compute(indicators, [{ close: 100 }], computeFn);
        let computeCount = 0;
        const countFn = () => { computeCount++; return { values: [1] }; };

        // Add a candle → data length changed
        cache.compute(indicators, [{ close: 100 }, { close: 101 }], countFn);
        expect(computeCount).toBe(1); // Recomputed
    });

    it('evicts stale entries when indicator is removed', () => {
        const all = [
            { type: 'sma', params: { period: 20 } },
            { type: 'ema', params: { period: 50 } },
        ];
        const data = [{ close: 100 }];
        const computeFn = () => ({ values: [1] });

        cache.compute(all, data, computeFn);
        expect(cache.size).toBe(2);

        // Remove EMA
        cache.compute([all[0]], data, computeFn);
        expect(cache.size).toBe(1);
    });

    it('invalidate() forces full recompute', () => {
        const indicators = [{ type: 'sma', params: { period: 20 } }];
        const data = [{ close: 100 }];

        let computeCount = 0;
        const computeFn = () => { computeCount++; return { values: [1] }; };

        cache.compute(indicators, data, computeFn);
        cache.invalidate();
        cache.compute(indicators, data, computeFn);
        expect(computeCount).toBe(2); // Recomputed after invalidate
    });

    it('clear() empties all cache', () => {
        const indicators = [{ type: 'sma', params: { period: 20 } }];
        cache.compute(indicators, [{ close: 100 }], () => ({ values: [1] }));
        expect(cache.size).toBe(1);
        cache.clear();
        expect(cache.size).toBe(0);
    });

    it('returns empty array for empty input', () => {
        expect(cache.compute([], [], () => null)).toEqual([]);
        expect(cache.compute(null, null, () => null)).toEqual([]);
    });
});
