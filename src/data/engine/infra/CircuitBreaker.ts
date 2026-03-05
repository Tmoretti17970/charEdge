// ═══════════════════════════════════════════════════════════════════
// charEdge — Unified Circuit Breaker
//
// Consolidated from CircuitBreaker.ts + AdapterCircuitBreaker.js.
//
// Two APIs:
//   1. Functional: withCircuitBreaker(name, fn) — auto-manages per-adapter state
//   2. Class:      new CircuitBreaker(config) — for custom use cases
//
// Features:
//   • Sliding-window failure rate tracking
//   • Exponential backoff cooldown (30s → 5min max)
//   • Rate-limit awareness (Retry-After / 429 handling)
//   • Event listener pattern for state monitoring
//   • TypeScript types throughout
// ═══════════════════════════════════════════════════════════════════

import { logger } from '../../../utils/logger';

// ─── Types ───────────────────────────────────────────────────────

export type BreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface BreakerConfig {
    /** Sliding window size for tracking results (default: 10) */
    windowSize: number;
    /** Failure rate threshold (0..1) to trip the breaker (default: 0.5) */
    failureThreshold: number;
    /** Initial cooldown in ms before OPEN → HALF_OPEN probe (default: 30000) */
    initialCooldownMs: number;
    /** Maximum cooldown after exponential backoff (default: 300000) */
    maxCooldownMs: number;
}

export interface BreakerStats {
    state: BreakerState;
    failureRate: number;
    cooldownMs: number;
    consecutiveTrips: number;
    rateLimitUntil: number;
}

export type BreakerEventType = 'stateChange' | 'failure' | 'success' | 'reset';
export type BreakerListener = (event: { type: BreakerEventType; state: BreakerState; stats: BreakerStats }) => void;

// ─── Rate Budget (P3-10) ─────────────────────────────────────────

export interface RateBudget {
    /** Max requests per window */
    maxRequests: number;
    /** Window duration in ms (default: 60 000 = 1 minute) */
    windowMs: number;
    /** Current request count in this window */
    currentCount: number;
    /** When the current window started */
    windowStart: number;
}

// ─── Default Config ──────────────────────────────────────────────

const DEFAULT_CONFIG: BreakerConfig = {
    windowSize: 10,
    failureThreshold: 0.5,
    initialCooldownMs: 30_000,
    maxCooldownMs: 300_000,
};

// ─── Circuit Breaker Class ───────────────────────────────────────

export class CircuitBreaker {
    private _state: BreakerState = 'CLOSED';
    private _config: BreakerConfig;
    private _results: boolean[] = [];
    private _cooldownMs: number;
    private _openedAt = 0;
    private _consecutiveTrips = 0;
    private _rateLimitUntil = 0;
    private _listeners = new Set<BreakerListener>();

    constructor(config?: Partial<BreakerConfig>) {
        this._config = { ...DEFAULT_CONFIG, ...config };
        this._cooldownMs = this._config.initialCooldownMs;
    }

    // ─── Public API ────────────────────────────────────────────

    get state(): BreakerState {
        return this._state;
    }

    get isAllowed(): boolean {
        if (this._state === 'CLOSED') return true;
        if (this._state === 'HALF_OPEN') return true;
        // OPEN: check if cooldown has elapsed
        if (Date.now() - this._openedAt >= this._cooldownMs) {
            this._transition('HALF_OPEN');
            return true;
        }
        return false;
    }

    get isRateLimited(): boolean {
        return Date.now() < this._rateLimitUntil;
    }

    recordSuccess(): void {
        this._pushResult(true);

        if (this._state === 'HALF_OPEN') {
            // Probe succeeded → close
            this._transition('CLOSED');
            this._cooldownMs = this._config.initialCooldownMs;
            this._consecutiveTrips = 0;
        }

        this._emit('success');
    }

    recordFailure(): void {
        this._pushResult(false);

        if (this._state === 'HALF_OPEN') {
            // Probe failed → reopen with backoff
            this._openWithBackoff();
        } else if (this._state === 'CLOSED' && this._failureRate() >= this._config.failureThreshold) {
            this._openWithBackoff();
        }

        this._emit('failure');
    }

    recordRateLimit(retryAfterMs = 60_000): void {
        this._rateLimitUntil = Date.now() + retryAfterMs;
    }

    getStats(): BreakerStats {
        return {
            state: this._state,
            failureRate: this._failureRate(),
            cooldownMs: this._cooldownMs,
            consecutiveTrips: this._consecutiveTrips,
            rateLimitUntil: this._rateLimitUntil,
        };
    }

    reset(): void {
        this._state = 'CLOSED';
        this._results = [];
        this._cooldownMs = this._config.initialCooldownMs;
        this._openedAt = 0;
        this._consecutiveTrips = 0;
        this._rateLimitUntil = 0;
        this._emit('reset');
    }

    on(listener: BreakerListener): () => void {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    destroy(): void {
        this._listeners.clear();
    }

    // ─── Internal ──────────────────────────────────────────────

    private _pushResult(success: boolean): void {
        this._results.push(success);
        if (this._results.length > this._config.windowSize) {
            this._results.shift();
        }
    }

    private _failureRate(): number {
        if (this._results.length < 3) return 0; // Not enough data
        const failures = this._results.filter(r => !r).length;
        return failures / this._results.length;
    }

    private _openWithBackoff(): void {
        this._state = 'OPEN';
        this._openedAt = Date.now();
        this._consecutiveTrips++;
        if (this._consecutiveTrips > 1) {
            this._cooldownMs = Math.min(
                this._cooldownMs * 2,
                this._config.maxCooldownMs,
            );
        }
        this._emit('stateChange');
    }

    private _transition(newState: BreakerState): void {
        const oldState = this._state;
        if (oldState === newState) return;
        this._state = newState;
        if (newState === 'HALF_OPEN') {
            // Reset results for probe phase
            this._results = [];
        }
        this._emit('stateChange');
    }

    private _emit(type: BreakerEventType): void {
        const event = { type, state: this._state, stats: this.getStats() };
        for (const listener of this._listeners) {
            try { listener(event); } catch (e) { logger.data.warn('Circuit breaker listener error', e); }
        }
    }
}

// ═══════════════════════════════════════════════════════════════════
// Functional API — Per-adapter circuit breaker registry
// ═══════════════════════════════════════════════════════════════════

const _circuits = new Map<string, CircuitBreaker>();
const _rateBudgets = new Map<string, RateBudget>();

function _getOrCreate(name: string): CircuitBreaker {
    let cb = _circuits.get(name);
    if (!cb) {
        cb = new CircuitBreaker();
        _circuits.set(name, cb);
    }
    return cb;
}

/**
 * Set a rate budget for an adapter.
 * @param adapterName - e.g. 'binance', 'coingecko'
 * @param maxRequests - Max requests per window
 * @param windowMs - Window duration in ms (default: 60000)
 */
export function setRateBudget(adapterName: string, maxRequests: number, windowMs = 60_000): void {
    _rateBudgets.set(adapterName, {
        maxRequests,
        windowMs,
        currentCount: 0,
        windowStart: Date.now(),
    });
}

/**
 * Check if a request is allowed under the rate budget.
 * Returns true if allowed (and increments count), false if over budget.
 */
export function checkRateBudget(adapterName: string): boolean {
    const budget = _rateBudgets.get(adapterName);
    if (!budget) return true; // No budget set → always allowed

    const now = Date.now();
    // Reset window if elapsed
    if (now - budget.windowStart >= budget.windowMs) {
        budget.currentCount = 0;
        budget.windowStart = now;
    }

    if (budget.currentCount >= budget.maxRequests) {
        return false;
    }

    budget.currentCount++;
    return true;
}

/**
 * Get rate budget stats for all adapters.
 */
export function getAllRateBudgetStats(): Record<string, { used: number; max: number; remaining: number; windowMs: number }> {
    const result: Record<string, { used: number; max: number; remaining: number; windowMs: number }> = {};
    const now = Date.now();
    for (const [name, budget] of _rateBudgets) {
        // Auto-reset window for accurate stats
        if (now - budget.windowStart >= budget.windowMs) {
            budget.currentCount = 0;
            budget.windowStart = now;
        }
        result[name] = {
            used: budget.currentCount,
            max: budget.maxRequests,
            remaining: Math.max(0, budget.maxRequests - budget.currentCount),
            windowMs: budget.windowMs,
        };
    }
    return result;
}

/**
 * Wrap an async function with a circuit breaker for the named adapter.
 *
 * @param adapterName - e.g. 'binance', 'coingecko'
 * @param fetchFn - async () => data | null
 * @returns The fetch result, or null if circuit is open / rate-limited
 */
export async function withCircuitBreaker<T>(
    adapterName: string,
    fetchFn: () => Promise<T | null>,
): Promise<T | null> {
    const cb = _getOrCreate(adapterName);

    // Rate limit check
    if (cb.isRateLimited) return null;

    // P3-10: Rate budget check
    if (!checkRateBudget(adapterName)) return null;

    // OPEN check + auto-transition
    if (!cb.isAllowed) return null;

    try {
        const result = await fetchFn();
        const success = result !== null && result !== undefined;
        if (success) {
            cb.recordSuccess();
        } else {
            cb.recordFailure();
        }
        return result;
    } catch (err: unknown) {
        // Rate limit — respect Retry-After, don't trip the breaker
        if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 429) {
            const retryAfter = (err as { retryAfterMs?: number }).retryAfterMs || 60_000;
            cb.recordRateLimit(retryAfter);
            return null;
        }

        cb.recordFailure();
        return null;
    }
}

/**
 * Get the current state of a circuit breaker.
 */
export function getCircuitState(adapterName: string): BreakerStats {
    return _getOrCreate(adapterName).getStats();
}

/**
 * Get all circuit breaker states (for debugging / settings panel).
 */
export function getAllCircuitStates(): Record<string, BreakerStats> {
    const result: Record<string, BreakerStats> = {};
    for (const [name, cb] of _circuits) {
        result[name] = cb.getStats();
    }
    return result;
}

/**
 * Reset a specific circuit breaker to CLOSED state.
 */
export function resetCircuit(adapterName: string): void {
    const cb = _circuits.get(adapterName);
    if (cb) cb.reset();
}

/**
 * Reset all circuit breakers.
 */
export function resetAllCircuits(): void {
    for (const cb of _circuits.values()) {
        cb.reset();
    }
}

export const STATE = Object.freeze({
    CLOSED: 'CLOSED' as BreakerState,
    OPEN: 'OPEN' as BreakerState,
    HALF_OPEN: 'HALF_OPEN' as BreakerState,
});

export default {
    withCircuitBreaker,
    getCircuitState,
    getAllCircuitStates,
    resetCircuit,
    resetAllCircuits,
    setRateBudget,
    checkRateBudget,
    getAllRateBudgetStats,
    STATE,
    CircuitBreaker,
};
