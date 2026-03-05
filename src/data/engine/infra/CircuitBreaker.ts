import { logger } from '../../../utils/logger';

// ═══════════════════════════════════════════════════════════════════
// charEdge — Circuit Breaker for Data Feeds
//
// Phase 2 Task 2.2.2: Auto-degrade on bad data.
//
// States:
//   CLOSED  → Normal operation, data flows through
//   OPEN    → Bad data detected, blocking data flow
//   HALF_OPEN → Testing recovery with limited data
//
// After N consecutive validation failures, the breaker OPENS and
// stops feeding bad data to the chart engine. After a cooldown
// period, it enters HALF_OPEN to test if the feed has recovered.
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

export type BreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface BreakerConfig {
    /** Number of consecutive failures before opening (default: 5) */
    failureThreshold: number;
    /** Milliseconds before transitioning OPEN → HALF_OPEN (default: 30000) */
    cooldownMs: number;
    /** Number of successes needed in HALF_OPEN to close (default: 3) */
    recoveryThreshold: number;
}

export interface BreakerStats {
    state: BreakerState;
    consecutiveFailures: number;
    consecutiveSuccesses: number;
    totalFailures: number;
    totalSuccesses: number;
    lastFailureTime: number | null;
    lastSuccessTime: number | null;
    openedAt: number | null;
}

export type BreakerEventType = 'stateChange' | 'failure' | 'success' | 'reset';
export type BreakerListener = (event: { type: BreakerEventType; state: BreakerState; stats: BreakerStats }) => void;

// ─── Default Config ──────────────────────────────────────────────

const DEFAULT_CONFIG: BreakerConfig = {
    failureThreshold: 5,
    cooldownMs: 30_000,
    recoveryThreshold: 3,
};

// ─── Circuit Breaker ─────────────────────────────────────────────

export class CircuitBreaker {
    private _state: BreakerState = 'CLOSED';
    private _config: BreakerConfig;
    private _consecutiveFailures = 0;
    private _consecutiveSuccesses = 0;
    private _totalFailures = 0;
    private _totalSuccesses = 0;
    private _lastFailureTime: number | null = null;
    private _lastSuccessTime: number | null = null;
    private _openedAt: number | null = null;
    private _cooldownTimer: ReturnType<typeof setTimeout> | null = null;
    private _listeners = new Set<BreakerListener>();

    constructor(config?: Partial<BreakerConfig>) {
        this._config = { ...DEFAULT_CONFIG, ...config };
    }

    // ─── Public API ────────────────────────────────────────────

    /** Current breaker state */
    get state(): BreakerState {
        return this._state;
    }

    /** Whether data should flow through */
    get isAllowed(): boolean {
        if (this._state === 'CLOSED') return true;
        if (this._state === 'HALF_OPEN') return true; // Let test data through
        // OPEN: check if cooldown has elapsed → transition to HALF_OPEN
        if (this._openedAt && Date.now() - this._openedAt >= this._config.cooldownMs) {
            this._transition('HALF_OPEN');
            return true;
        }
        return false;
    }

    /** Report a successful data validation */
    recordSuccess(): void {
        this._totalSuccesses++;
        this._consecutiveSuccesses++;
        this._consecutiveFailures = 0;
        this._lastSuccessTime = Date.now();

        if (this._state === 'HALF_OPEN') {
            if (this._consecutiveSuccesses >= this._config.recoveryThreshold) {
                this._transition('CLOSED');
            }
        }

        this._emit('success');
    }

    /** Report a data validation failure */
    recordFailure(): void {
        this._totalFailures++;
        this._consecutiveFailures++;
        this._consecutiveSuccesses = 0;
        this._lastFailureTime = Date.now();

        if (this._state === 'CLOSED' || this._state === 'HALF_OPEN') {
            if (this._consecutiveFailures >= this._config.failureThreshold) {
                this._transition('OPEN');
            }
        }

        this._emit('failure');
    }

    /** Get current stats */
    getStats(): BreakerStats {
        return {
            state: this._state,
            consecutiveFailures: this._consecutiveFailures,
            consecutiveSuccesses: this._consecutiveSuccesses,
            totalFailures: this._totalFailures,
            totalSuccesses: this._totalSuccesses,
            lastFailureTime: this._lastFailureTime,
            lastSuccessTime: this._lastSuccessTime,
            openedAt: this._openedAt,
        };
    }

    /** Reset to CLOSED state */
    reset(): void {
        this._clearCooldown();
        this._state = 'CLOSED';
        this._consecutiveFailures = 0;
        this._consecutiveSuccesses = 0;
        this._openedAt = null;
        this._emit('reset');
    }

    /** Subscribe to breaker events */
    on(listener: BreakerListener): () => void {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    /** Clean up timers */
    destroy(): void {
        this._clearCooldown();
        this._listeners.clear();
    }

    // ─── Internal ──────────────────────────────────────────────

    private _transition(newState: BreakerState): void {
        const oldState = this._state;
        if (oldState === newState) return;

        this._state = newState;

        switch (newState) {
            case 'OPEN':
                this._openedAt = Date.now();
                this._consecutiveSuccesses = 0;
                // Auto-transition to HALF_OPEN after cooldown
                this._clearCooldown();
                this._cooldownTimer = setTimeout(() => {
                    if (this._state === 'OPEN') {
                        this._transition('HALF_OPEN');
                    }
                }, this._config.cooldownMs);
                break;

            case 'HALF_OPEN':
                this._consecutiveSuccesses = 0;
                this._consecutiveFailures = 0;
                break;

            case 'CLOSED':
                this._clearCooldown();
                this._openedAt = null;
                this._consecutiveFailures = 0;
                break;
        }

        this._emit('stateChange');
    }

    private _emit(type: BreakerEventType): void {
        const event = { type, state: this._state, stats: this.getStats() };
        for (const listener of this._listeners) {
            try { listener(event); } catch (e) { logger.data.warn('Operation failed', e); }
        }
    }

    private _clearCooldown(): void {
        if (this._cooldownTimer) {
            clearTimeout(this._cooldownTimer);
            this._cooldownTimer = null;
        }
    }
}

export default CircuitBreaker;
