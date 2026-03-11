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

    it('transitions to OPEN when failure rate exceeds threshold', () => {
        // _failureRate requires >= 3 results, so 3 failures → 100% failure rate → OPEN
        const cb = new CircuitBreaker({ windowSize: 5, failureThreshold: 0.5 });
        cb.recordFailure();
        cb.recordFailure();
        expect(cb.state).toBe('CLOSED'); // only 2 results — rate returns 0
        cb.recordFailure(); // 3rd result: 100% failure rate ≥ 50% → OPEN
        expect(cb.state).toBe('OPEN');
        expect(cb.isAllowed).toBe(false);
    });

    it('stays CLOSED when failure rate is below threshold', () => {
        const cb = new CircuitBreaker({ windowSize: 5, failureThreshold: 0.5 });
        cb.recordFailure();
        cb.recordSuccess();
        cb.recordSuccess();
        cb.recordSuccess(); // 4 results: 25% failure rate < 50% → stays CLOSED
        expect(cb.state).toBe('CLOSED');
    });

    it('transitions OPEN → HALF_OPEN after cooldown via isAllowed', () => {
        const now = Date.now();
        vi.spyOn(Date, 'now').mockReturnValue(now);
        const cb = new CircuitBreaker({ windowSize: 5, failureThreshold: 0.5, initialCooldownMs: 1000 });
        cb.recordFailure();
        cb.recordFailure();
        cb.recordFailure(); // 3 failures → OPEN
        expect(cb.state).toBe('OPEN');

        // Advance Date.now past cooldown
        vi.spyOn(Date, 'now').mockReturnValue(now + 1001);
        // isAllowed triggers HALF_OPEN transition
        expect(cb.isAllowed).toBe(true);
        expect(cb.state).toBe('HALF_OPEN');

        vi.restoreAllMocks();
        cb.destroy();
    });

    it('transitions HALF_OPEN → CLOSED on success', () => {
        const now = Date.now();
        vi.spyOn(Date, 'now').mockReturnValue(now);
        const cb = new CircuitBreaker({ windowSize: 5, failureThreshold: 0.5, initialCooldownMs: 100 });
        cb.recordFailure();
        cb.recordFailure();
        cb.recordFailure(); // OPEN
        expect(cb.state).toBe('OPEN');

        vi.spyOn(Date, 'now').mockReturnValue(now + 101);
        expect(cb.isAllowed).toBe(true); // triggers HALF_OPEN
        expect(cb.state).toBe('HALF_OPEN');

        cb.recordSuccess();
        expect(cb.state).toBe('CLOSED');

        vi.restoreAllMocks();
        cb.destroy();
    });

    it('goes back to OPEN if failure in HALF_OPEN', () => {
        const now = Date.now();
        vi.spyOn(Date, 'now').mockReturnValue(now);
        const cb = new CircuitBreaker({ windowSize: 5, failureThreshold: 0.5, initialCooldownMs: 100 });
        cb.recordFailure();
        cb.recordFailure();
        cb.recordFailure(); // OPEN
        expect(cb.state).toBe('OPEN');

        vi.spyOn(Date, 'now').mockReturnValue(now + 101);
        expect(cb.isAllowed).toBe(true); // HALF_OPEN
        expect(cb.state).toBe('HALF_OPEN');

        cb.recordFailure();
        expect(cb.state).toBe('OPEN');

        vi.restoreAllMocks();
        cb.destroy();
    });

    it('emits stateChange events', () => {
        const cb = new CircuitBreaker({ windowSize: 5, failureThreshold: 0.5 });
        const events = [];
        cb.on((e) => events.push(e.type + ':' + e.state));

        cb.recordFailure();
        cb.recordFailure();
        cb.recordFailure(); // 3 failures → OPEN
        expect(events).toContain('stateChange:OPEN');

        cb.destroy();
    });

    it('reset() returns to CLOSED', () => {
        const cb = new CircuitBreaker({ windowSize: 5, failureThreshold: 0.5 });
        cb.recordFailure();
        cb.recordFailure();
        cb.recordFailure(); // OPEN
        expect(cb.state).toBe('OPEN');
        cb.reset();
        expect(cb.state).toBe('CLOSED');
        cb.destroy();
    });

    it('getStats() returns correct shape', () => {
        const cb = new CircuitBreaker();
        cb.recordSuccess();
        cb.recordSuccess();
        cb.recordFailure();
        const stats = cb.getStats();
        expect(stats.state).toBe('CLOSED');
        expect(typeof stats.failureRate).toBe('number');
        expect(typeof stats.cooldownMs).toBe('number');
        expect(typeof stats.consecutiveTrips).toBe('number');
        expect(typeof stats.rateLimitUntil).toBe('number');
        cb.destroy();
    });
});

// ─── Error Hierarchy ─────────────────────────────────────────────

describe('Error hierarchy — classifyError', () => {
    let classifyError, DataError, NetworkError, StorageError, RenderError, AppError;

    beforeEach(async () => {
        const mod = await import('../../shared/errors.ts');
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
