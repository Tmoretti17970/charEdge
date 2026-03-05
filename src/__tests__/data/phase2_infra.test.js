// ═══════════════════════════════════════════════════════════════════
// Phase 2 Tests — DataValidator, CircuitBreaker, Error Hierarchy
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── DataValidator ───────────────────────────────────────────────

describe('DataValidator — OHLC validation', () => {
    let validateBars, isBarArrayValid;

    beforeEach(async () => {
        const mod = await import('../../data/engine/infra/DataValidator.ts');
        validateBars = mod.validateBars;
        isBarArrayValid = mod.isBarArrayValid;
    });

    it('passes valid bar array', () => {
        const bars = [
            { time: 1000, open: 10, high: 15, low: 8, close: 12, volume: 100 },
            { time: 2000, open: 12, high: 18, low: 10, close: 16, volume: 200 },
        ];
        const result = validateBars(bars);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('detects high < low', () => {
        const bars = [
            { time: 1000, open: 10, high: 5, low: 8, close: 6, volume: 100 }, // high < low
        ];
        const result = validateBars(bars);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.code === 'HIGH_LESS_THAN_LOW')).toBe(true);
    });

    it('detects non-monotonic timestamps', () => {
        const bars = [
            { time: 2000, open: 10, high: 15, low: 8, close: 12, volume: 100 },
            { time: 1000, open: 12, high: 18, low: 10, close: 16, volume: 200 }, // goes backward
        ];
        const result = validateBars(bars);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.code === 'NONMONOTONIC_TIMESTAMP')).toBe(true);
    });

    it('detects negative volume', () => {
        const bars = [
            { time: 1000, open: 10, high: 15, low: 8, close: 12, volume: -50 },
        ];
        const result = validateBars(bars);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.code === 'NEGATIVE_VOLUME')).toBe(true);
    });

    it('detects NaN values', () => {
        const bars = [
            { time: 1000, open: NaN, high: 15, low: 8, close: 12, volume: 100 },
        ];
        const result = validateBars(bars);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.code === 'INVALID_NUMBER')).toBe(true);
    });

    it('warns on duplicate timestamps', () => {
        const bars = [
            { time: 1000, open: 10, high: 15, low: 8, close: 12, volume: 100 },
            { time: 1000, open: 12, high: 18, low: 10, close: 16, volume: 200 },
        ];
        const result = validateBars(bars);
        expect(result.warnings.some(w => w.code === 'DUPLICATE_TIMESTAMP')).toBe(true);
    });

    it('isBarArrayValid returns true for valid data', () => {
        const bars = [
            { time: 1000, open: 10, high: 15, low: 8, close: 12, volume: 100 },
            { time: 2000, open: 12, high: 18, low: 10, close: 16, volume: 200 },
        ];
        expect(isBarArrayValid(bars)).toBe(true);
    });

    it('isBarArrayValid returns false for invalid data', () => {
        const bars = [
            { time: 1000, open: 10, high: 5, low: 8, close: 6, volume: 100 },
        ];
        expect(isBarArrayValid(bars)).toBe(false);
    });
});

// ─── CircuitBreaker ──────────────────────────────────────────────

describe('CircuitBreaker — state machine', () => {
    let CircuitBreaker;

    beforeEach(async () => {
        const mod = await import('../../data/engine/infra/CircuitBreaker.ts');
        CircuitBreaker = mod.CircuitBreaker;
    });

    it('starts in CLOSED state', () => {
        const cb = new CircuitBreaker();
        expect(cb.state).toBe('CLOSED');
        expect(cb.isAllowed).toBe(true);
    });

    it('transitions to OPEN after N failures', () => {
        const cb = new CircuitBreaker({ failureThreshold: 3 });
        cb.recordFailure();
        cb.recordFailure();
        expect(cb.state).toBe('CLOSED');
        cb.recordFailure();
        expect(cb.state).toBe('OPEN');
        expect(cb.isAllowed).toBe(false);
    });

    it('resets failure count on success', () => {
        const cb = new CircuitBreaker({ failureThreshold: 3 });
        cb.recordFailure();
        cb.recordFailure();
        cb.recordSuccess(); // resets
        cb.recordFailure();
        expect(cb.state).toBe('CLOSED'); // not OPEN yet
    });

    it('transitions OPEN → HALF_OPEN after cooldown', () => {
        vi.useFakeTimers();
        const cb = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 1000 });
        cb.recordFailure();
        expect(cb.state).toBe('OPEN');

        vi.advanceTimersByTime(1000);
        expect(cb.state).toBe('HALF_OPEN');

        vi.useRealTimers();
        cb.destroy();
    });

    it('transitions HALF_OPEN → CLOSED after N successes', () => {
        vi.useFakeTimers();
        const cb = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 100, recoveryThreshold: 2 });
        cb.recordFailure();
        vi.advanceTimersByTime(100);
        expect(cb.state).toBe('HALF_OPEN');

        cb.recordSuccess();
        expect(cb.state).toBe('HALF_OPEN');
        cb.recordSuccess();
        expect(cb.state).toBe('CLOSED');

        vi.useRealTimers();
        cb.destroy();
    });

    it('goes back to OPEN if failure in HALF_OPEN', () => {
        vi.useFakeTimers();
        const cb = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 100 });
        cb.recordFailure();
        vi.advanceTimersByTime(100);
        expect(cb.state).toBe('HALF_OPEN');

        cb.recordFailure();
        expect(cb.state).toBe('OPEN');

        vi.useRealTimers();
        cb.destroy();
    });

    it('emits stateChange events', () => {
        const cb = new CircuitBreaker({ failureThreshold: 1 });
        const events = [];
        cb.on((e) => events.push(e.type + ':' + e.state));

        cb.recordFailure();
        expect(events).toContain('stateChange:OPEN');

        cb.destroy();
    });

    it('reset() returns to CLOSED', () => {
        const cb = new CircuitBreaker({ failureThreshold: 1 });
        cb.recordFailure();
        expect(cb.state).toBe('OPEN');
        cb.reset();
        expect(cb.state).toBe('CLOSED');
        cb.destroy();
    });

    it('getStats() returns correct metrics', () => {
        const cb = new CircuitBreaker();
        cb.recordSuccess();
        cb.recordSuccess();
        cb.recordFailure();
        const stats = cb.getStats();
        expect(stats.totalSuccesses).toBe(2);
        expect(stats.totalFailures).toBe(1);
        expect(stats.consecutiveFailures).toBe(1);
        expect(stats.consecutiveSuccesses).toBe(0);
        cb.destroy();
    });
});

// ─── Error Hierarchy ─────────────────────────────────────────────

describe('Error hierarchy — classifyError', () => {
    let classifyError, DataError, NetworkError, StorageError, RenderError, AppError;

    beforeEach(async () => {
        const mod = await import('../../utils/errors.ts');
        classifyError = mod.classifyError;
        DataError = mod.DataError;
        NetworkError = mod.NetworkError;
        StorageError = mod.StorageError;
        RenderError = mod.RenderError;
        AppError = mod.AppError;
    });

    it('returns AppError instances as-is', () => {
        const err = new DataError('TEST', 'test error');
        expect(classifyError(err)).toBe(err);
    });

    it('classifies WebSocket errors as NetworkError', () => {
        const err = new Error('WebSocket connection failed');
        const classified = classifyError(err);
        expect(classified).toBeInstanceOf(NetworkError);
        expect(classified.category).toBe('network');
    });

    it('classifies IndexedDB errors as StorageError', () => {
        const err = new Error('IndexedDB quota exceeded');
        const classified = classifyError(err);
        expect(classified).toBeInstanceOf(StorageError);
    });

    it('classifies canvas errors as RenderError', () => {
        const err = new Error('WebGL context lost');
        const classified = classifyError(err);
        expect(classified).toBeInstanceOf(RenderError);
    });

    it('classifies string errors as AppError', () => {
        const classified = classifyError('Something went wrong');
        expect(classified).toBeInstanceOf(AppError);
        expect(classified.message).toBe('Something went wrong');
    });

    it('AppError.toJSON() serializes correctly', () => {
        const err = new DataError('OHLC_INVALID', 'Bad bar', { barIndex: 5 });
        const json = err.toJSON();
        expect(json.code).toBe('OHLC_INVALID');
        expect(json.category).toBe('data');
        expect(json.context).toEqual({ barIndex: 5 });
    });
});
