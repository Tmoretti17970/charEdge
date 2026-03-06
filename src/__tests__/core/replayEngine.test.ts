// ═══════════════════════════════════════════════════════════════════
// charEdge — ReplayEngine Unit Tests
//
// Tests: state machine transitions, bar advancement, future hiding,
//        speed control, completion detection.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReplayEngine } from '../../charting_library/replay/ReplayEngine.ts';

// ─── Mock Data Provider ─────────────────────────────────────────

function createMockProvider(barCount = 10) {
    const bars = Array.from({ length: barCount }, (_, i) => ({
        time: 1700000000 + i * 60,
        open: 100 + i,
        high: 102 + i,
        low: 99 + i,
        close: 101 + i,
        volume: 1000 + i * 10,
    }));

    return {
        getHistoricalBars: vi.fn().mockResolvedValue(bars),
        bars,
    };
}

const CONFIG = {
    symbol: 'BTCUSD',
    timeframe: '5',
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-01-02'),
};

// ─── Tests ──────────────────────────────────────────────────────

describe('ReplayEngine', () => {
    let engine;
    let provider;

    beforeEach(() => {
        provider = createMockProvider(10);
        engine = new ReplayEngine(provider);
    });

    it('starts in idle state', () => {
        expect(engine.getState()).toBe('idle');
        expect(engine.isActive()).toBe(false);
    });

    it('transitions to paused after loading', async () => {
        const states = [];
        engine.on('state-change', ({ to }) => states.push(to));

        await engine.startReplay(CONFIG);

        expect(states).toContain('loading');
        expect(states).toContain('paused');
        expect(engine.getState()).toBe('paused');
        expect(engine.getTotalBars()).toBe(10);
        expect(engine.getVisibleIndex()).toBe(0);
    });

    it('fetches data from provider with correct params', async () => {
        await engine.startReplay(CONFIG);

        expect(provider.getHistoricalBars).toHaveBeenCalledWith(
            CONFIG.symbol, CONFIG.timeframe, CONFIG.startDate, CONFIG.endDate
        );
    });

    it('hides future bars via getVisibleBars()', async () => {
        await engine.startReplay(CONFIG);

        // At index 0, only 1 bar visible
        expect(engine.getVisibleBars()).toHaveLength(1);

        engine.step();
        expect(engine.getVisibleBars()).toHaveLength(2);

        engine.step();
        expect(engine.getVisibleBars()).toHaveLength(3);
    });

    it('step() advances one bar at a time', async () => {
        await engine.startReplay(CONFIG);

        expect(engine.getVisibleIndex()).toBe(0);
        engine.step();
        expect(engine.getVisibleIndex()).toBe(1);
        engine.step();
        expect(engine.getVisibleIndex()).toBe(2);
    });

    it('emits bar-advance with correct progress', async () => {
        await engine.startReplay(CONFIG);

        const advances = [];
        engine.on('bar-advance', (data) => advances.push(data));

        engine.step();
        engine.step();
        engine.step();

        expect(advances).toHaveLength(3);
        expect(advances[0].index).toBe(1);
        expect(advances[2].index).toBe(3);
        expect(advances[2].progress).toBeCloseTo(3 / 9, 2);
    });

    it('visibleBarIndex never exceeds loaded bar count', async () => {
        const smallProvider = createMockProvider(3);
        const smallEngine = new ReplayEngine(smallProvider);
        await smallEngine.startReplay(CONFIG);

        // Step through all bars
        smallEngine.step(); // index 1
        smallEngine.step(); // index 2 (last)
        smallEngine.step(); // should NOT go to 3

        expect(smallEngine.getVisibleIndex()).toBe(2);
        expect(smallEngine.getVisibleBars()).toHaveLength(3);
    });

    it('emits replay-complete when reaching the end', async () => {
        const smallProvider = createMockProvider(3);
        const smallEngine = new ReplayEngine(smallProvider);
        await smallEngine.startReplay(CONFIG);

        const completeSpy = vi.fn();
        smallEngine.on('replay-complete', completeSpy);

        smallEngine.step(); // index 0 → 1
        smallEngine.step(); // index 1 → 2
        smallEngine.step(); // index 2 (last bar, emits replay-complete)

        expect(completeSpy).toHaveBeenCalledTimes(1);
        expect(completeSpy).toHaveBeenCalledWith(
            expect.objectContaining({ totalBars: 3 })
        );
    });

    it('play/pause toggles state correctly', async () => {
        await engine.startReplay(CONFIG);

        engine.play();
        expect(engine.getState()).toBe('playing');

        engine.pause();
        expect(engine.getState()).toBe('paused');
    });

    it('stop() resets to idle', async () => {
        await engine.startReplay(CONFIG);
        engine.play();
        engine.stop();

        // Synchronously goes to 'stopped', then async to 'idle'
        expect(engine.getState()).toBe('stopped');
        expect(engine.isActive()).toBe(false);
    });

    it('setSpeed changes interval', async () => {
        await engine.startReplay(CONFIG);

        engine.setSpeed(5);
        expect(engine.getSpeed()).toBe(5);

        engine.setSpeed(10);
        expect(engine.getSpeed()).toBe(10);
    });

    it('getProgress returns 0 when no bars loaded', () => {
        expect(engine.getProgress()).toBe(0);
    });

    it('getCurrentBar returns current bar', async () => {
        await engine.startReplay(CONFIG);

        const bar = engine.getCurrentBar();
        expect(bar).not.toBeNull();
        expect(bar.open).toBe(100);
    });

    it('handles empty data gracefully', async () => {
        const emptyProvider = { getHistoricalBars: vi.fn().mockResolvedValue([]) };
        const emptyEngine = new ReplayEngine(emptyProvider);

        const errorSpy = vi.fn();
        emptyEngine.on('error', errorSpy);

        await emptyEngine.startReplay(CONFIG);

        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(emptyEngine.getState()).toBe('idle');
    });

    it('handles provider error gracefully', async () => {
        const failProvider = { getHistoricalBars: vi.fn().mockRejectedValue(new Error('Network error')) };
        const failEngine = new ReplayEngine(failProvider);

        const errorSpy = vi.fn();
        failEngine.on('error', errorSpy);

        await failEngine.startReplay(CONFIG);

        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(failEngine.getState()).toBe('idle');
    });
});
