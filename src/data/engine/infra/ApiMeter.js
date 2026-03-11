// ═══════════════════════════════════════════════════════════════════
// charEdge — API Call Meter (Task 1B.10 / N.1)
//
// Lightweight per-provider API call counter with rolling 60s window.
// Records every outbound API call and exposes stats for:
//   - Dev-mode console inspection
//   - Future settings panel display (Phase 2 scope)
//
// Usage:
//   import { apiMeter } from './ApiMeter.js';
//   apiMeter.record('binance', '/api/v3/klines');
//   apiMeter.getStats(); // → { binance: { callsPerMin: 4, total: 127 } }
// ═══════════════════════════════════════════════════════════════════

import { logger } from '@/observability/logger';

// ─── Ring Buffer for Rolling Window ─────────────────────────────

const WINDOW_MS = 60_000; // 60s rolling window
const BUCKET_COUNT = 60;  // 1 bucket per second
const BUCKET_MS = WINDOW_MS / BUCKET_COUNT;

class RollingCounter {
    constructor() {
        this._buckets = new Array(BUCKET_COUNT).fill(0);
        this._bucketTimestamps = new Array(BUCKET_COUNT).fill(0);
        this._total = 0;
        this._lastCall = 0;
    }

    record() {
        const now = Date.now();
        const idx = Math.floor(now / BUCKET_MS) % BUCKET_COUNT;
        const bucketTime = Math.floor(now / BUCKET_MS) * BUCKET_MS;

        // If this bucket is stale, reset it
        if (this._bucketTimestamps[idx] !== bucketTime) {
            this._bucketTimestamps[idx] = bucketTime;
            this._buckets[idx] = 0;
        }

        this._buckets[idx]++;
        this._total++;
        this._lastCall = now;
    }

    /** Count of calls within the last 60s */
    getCallsPerMin() {
        const now = Date.now();
        const cutoff = Math.floor((now - WINDOW_MS) / BUCKET_MS) * BUCKET_MS;
        let sum = 0;
        for (let i = 0; i < BUCKET_COUNT; i++) {
            if (this._bucketTimestamps[i] >= cutoff) {
                sum += this._buckets[i];
            }
        }
        return sum;
    }

    get total() { return this._total; }
    get lastCall() { return this._lastCall; }
}

// ─── API Meter ──────────────────────────────────────────────────

class _ApiMeter {
    constructor() {
        /** @type {Map<string, RollingCounter>} provider → counter */
        this._counters = new Map();
    }

    /**
     * Record an API call for a provider.
     * @param {string} provider - e.g. 'binance', 'polygon', 'coingecko'
     * @param {string} [endpoint] - optional endpoint path for debug logging
     */
    record(provider, endpoint) {
        if (!provider) return;

        const key = provider.toLowerCase();
        if (!this._counters.has(key)) {
            this._counters.set(key, new RollingCounter());
        }
        this._counters.get(key).record();

        // Debug log at threshold crossings
        const cpm = this._counters.get(key).getCallsPerMin();
        if (cpm === 50 || cpm === 100) {
            logger.data.warn(`[ApiMeter] ${key} hit ${cpm} calls/min`, endpoint || '');
        }
    }

    /**
     * Get stats for all providers.
     * @returns {Object<string, { callsPerMin: number, total: number, lastCall: number }>}
     */
    getStats() {
        const stats = {};
        for (const [provider, counter] of this._counters) {
            stats[provider] = {
                callsPerMin: counter.getCallsPerMin(),
                total: counter.total,
                lastCall: counter.lastCall,
            };
        }
        return stats;
    }

    /**
     * Get stats for a single provider.
     * @param {string} provider
     * @returns {{ callsPerMin: number, total: number, lastCall: number } | null}
     */
    getProviderStats(provider) {
        const counter = this._counters.get(provider?.toLowerCase());
        if (!counter) return null;
        return {
            callsPerMin: counter.getCallsPerMin(),
            total: counter.total,
            lastCall: counter.lastCall,
        };
    }

    /**
     * Get sorted list of providers by calls/min (highest first).
     * Useful for dev-mode display.
     * @returns {Array<{ provider: string, callsPerMin: number, total: number }>}
     */
    getTopProviders() {
        return Object.entries(this.getStats())
            .map(([provider, s]) => ({ provider, ...s }))
            .sort((a, b) => b.callsPerMin - a.callsPerMin);
    }

    /** Reset all counters. */
    reset() {
        this._counters.clear();
    }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const apiMeter = new _ApiMeter();

// Expose on window for dev-mode console access
if (typeof window !== 'undefined') {
    window.__apiMeter = apiMeter;
}

export default apiMeter;
