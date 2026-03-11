// ═══════════════════════════════════════════════════════════════════
// SessionRecovery Unit Tests (Task 2.3.23)
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    captureRecoveryState,
    startAutoSave,
    stopAutoSave,
} from '../../charting_library/core/SessionRecovery.js';

// ─── Mock IndexedDB via fake-indexeddb ───────────────────────────
// vitest.config may already include a global fake-indexeddb setup.
// If not, we mock the IDB calls.

describe('SessionRecovery', () => {
    describe('captureRecoveryState', () => {
        it('should capture engine state into a serializable snapshot', () => {
            const engine = {
                symbol: 'BTCUSDT',
                timeframe: '4h',
                props: { chartType: 'candles' },
                state: { scrollOffset: 42, visibleBars: 120, scaleMode: 'log' },
                indicators: [
                    { type: 'ema', params: { period: 20 }, color: '#ff0' },
                    { type: 'rsi', params: { period: 14 } },
                ],
            };

            const stores = {
                uiStore: { getState: () => ({ page: 'charts' }) },
                workspaceStore: {
                    getState: () => ({
                        activeId: 'ws1',
                        workspaces: [{ id: 'ws1', name: 'Day Trading' }],
                    }),
                },
            };

            const state = captureRecoveryState(engine, stores);

            expect(state.symbol).toBe('BTCUSDT');
            expect(state.timeframe).toBe('4h');
            expect(state.chartType).toBe('candles');
            expect(state.scaleMode).toBe('log');
            expect(state.scrollOffset).toBe(42);
            expect(state.visibleBars).toBe(120);
            expect(state.page).toBe('charts');
            expect(state.workspaceName).toBe('Day Trading');
            expect(state.indicators).toHaveLength(2);
            expect(state.indicators[0].type).toBe('ema');
            expect(state.indicators[0].params).toEqual({ period: 20 });
            expect(state.indicators[0].color).toBe('#ff0');
            expect(state.indicators[1].type).toBe('rsi');
            expect(state.indicators[1].color).toBeUndefined();
            expect(state.cleanExit).toBe(false);
            expect(state.savedAt).toBeGreaterThan(0);
        });

        it('should handle minimal engine state with defaults', () => {
            const state = captureRecoveryState({});

            expect(state.symbol).toBe('');
            expect(state.timeframe).toBe('1h');
            expect(state.chartType).toBe('candles');
            expect(state.scaleMode).toBe('linear');
            expect(state.scrollOffset).toBe(0);
            expect(state.visibleBars).toBe(80);
            expect(state.indicators).toEqual([]);
            expect(state.page).toBe('charts');
            expect(state.workspaceName).toBeNull();
        });

        it('should not mutate original indicator params', () => {
            const originalParams = { period: 20 };
            const engine = {
                indicators: [{ type: 'sma', params: originalParams }],
            };

            const state = captureRecoveryState(engine);
            state.indicators[0].params.period = 999;

            // Original should be unchanged
            expect(originalParams.period).toBe(20);
        });
    });

    describe('startAutoSave / stopAutoSave', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            stopAutoSave(); // clean state
        });

        afterEach(() => {
            stopAutoSave();
            vi.useRealTimers();
        });

        it('should return a cleanup function', () => {
            const cleanup = startAutoSave(() => null);
            expect(typeof cleanup).toBe('function');
            cleanup();
        });

        it('should not crash when engine is null', () => {
            startAutoSave(() => null);
            // Advance past the save interval — should not throw
            expect(() => vi.advanceTimersByTime(35000)).not.toThrow();
        });
    });
});
