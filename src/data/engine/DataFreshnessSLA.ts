// ═══════════════════════════════════════════════════════════════════
// charEdge — Data Freshness SLA Monitor (Task 2.4.7)
//
// Tracks data freshness per symbol/timeframe. When data hasn't
// been updated within the expected interval, surface warnings.
//
// Thresholds:
//   fresh:   ≤ 1.5× expected interval
//   warning: 1.5× – 3× expected interval
//   stale:   > 3× expected interval
// ═══════════════════════════════════════════════════════════════════

// @ts-expect-error — .ts imports resolved by Vite
import { logger } from '../../utils/logger.ts';

// ─── Types ──────────────────────────────────────────────────────

type FreshnessLevel = 'fresh' | 'warning' | 'stale' | 'unknown';

interface FreshnessState {
    symbol: string;
    interval: string;
    lastUpdate: number;
    expectedIntervalMs: number;
    level: FreshnessLevel;
}

type FreshnessListener = (state: FreshnessState) => void;

// ─── Interval Durations (ms) ────────────────────────────────────

const INTERVAL_DURATIONS: Record<string, number> = {
    '1m': 60_000,
    '3m': 180_000,
    '5m': 300_000,
    '15m': 900_000,
    '30m': 1_800_000,
    '1h': 3_600_000,
    '2h': 7_200_000,
    '4h': 14_400_000,
    '6h': 21_600_000,
    '8h': 28_800_000,
    '12h': 43_200_000,
    '1d': 86_400_000,
    '3d': 259_200_000,
    '1w': 604_800_000,
    '1M': 2_592_000_000,
};

// ─── DataFreshnessSLA ───────────────────────────────────────────

class DataFreshnessSLA {
    private _states = new Map<string, FreshnessState>();
    private _listeners = new Set<FreshnessListener>();
    private _checkInterval: ReturnType<typeof setInterval> | null = null;

    constructor() {
        // Check freshness every 10 seconds
        this._checkInterval = setInterval(() => this._checkAll(), 10_000);
    }

    // ─── Public API ─────────────────────────────────────────────────

    /** Record a data update for a symbol/interval */
    recordUpdate(symbol: string, interval: string): void {
        const key = `${symbol}_${interval}`;
        const expectedMs = INTERVAL_DURATIONS[interval] || 60_000;

        const state: FreshnessState = {
            symbol,
            interval,
            lastUpdate: performance.now(),
            expectedIntervalMs: expectedMs,
            level: 'fresh',
        };

        const prev = this._states.get(key);
        this._states.set(key, state);

        // Notify only on transition
        if (!prev || prev.level !== 'fresh') {
            this._notify(state);
        }
    }

    /** Check freshness for a specific symbol/interval */
    checkFreshness(symbol: string, interval: string): FreshnessLevel {
        const key = `${symbol}_${interval}`;
        const state = this._states.get(key);
        if (!state) return 'unknown';

        return this._computeLevel(state);
    }

    /** Get the full freshness state for a symbol/interval */
    getState(symbol: string, interval: string): FreshnessState | null {
        const key = `${symbol}_${interval}`;
        return this._states.get(key) || null;
    }

    /** Get human-readable time since last update */
    getTimeSinceUpdate(symbol: string, interval: string): string {
        const state = this.getState(symbol, interval);
        if (!state) return 'No data';

        const elapsed = performance.now() - state.lastUpdate;
        if (elapsed < 1000) return 'Just now';
        if (elapsed < 60_000) return `${Math.round(elapsed / 1000)}s ago`;
        if (elapsed < 3_600_000) return `${Math.round(elapsed / 60_000)}m ago`;
        return `${Math.round(elapsed / 3_600_000)}h ago`;
    }

    /** Subscribe to freshness state changes */
    subscribe(listener: FreshnessListener): () => void {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    /** Remove tracking for a symbol/interval */
    untrack(symbol: string, interval: string): void {
        this._states.delete(`${symbol}_${interval}`);
    }

    /** Cleanup */
    dispose(): void {
        if (this._checkInterval) {
            clearInterval(this._checkInterval);
            this._checkInterval = null;
        }
        this._states.clear();
        this._listeners.clear();
    }

    // ─── Private ────────────────────────────────────────────────────

    private _computeLevel(state: FreshnessState): FreshnessLevel {
        const elapsed = performance.now() - state.lastUpdate;
        const expected = state.expectedIntervalMs;

        if (elapsed <= expected * 1.5) return 'fresh';
        if (elapsed <= expected * 3) return 'warning';
        return 'stale';
    }

    private _checkAll(): void {
        for (const [, state] of this._states) {
            const newLevel = this._computeLevel(state);
            if (newLevel !== state.level) {
                const prev = state.level;
                state.level = newLevel;
                logger.data.info(
                    `[FreshnessSLA] ${state.symbol}/${state.interval}: ${prev} → ${newLevel}`
                );
                this._notify(state);
            }
        }
    }

    private _notify(state: FreshnessState): void {
        for (const listener of this._listeners) {
            try {
                listener(state);
            } catch (e) {
                logger.data.warn('[FreshnessSLA] Listener error', e);
            }
        }
    }
}

// Singleton
const dataFreshnessSLA = new DataFreshnessSLA();

export { DataFreshnessSLA, dataFreshnessSLA, INTERVAL_DURATIONS };
export type { FreshnessLevel, FreshnessState };
export default dataFreshnessSLA;
