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
        // Sprint 1 Task 1.3.2: Rate limit configuration per provider
        /** @type {Map<string, number>} provider → max calls per minute */
        this._rateLimits = new Map();
        // Pre-configure known provider limits
        this._rateLimits.set('coingecko', 30);
        this._rateLimits.set('binance', 1200);
        this._rateLimits.set('polygon', 200);
        this._rateLimits.set('alpaca', 200);
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

    // Sprint 1 Task 1.3.2: Rate limit tracking

    /**
     * Set the rate limit for a provider.
     * @param {string} provider
     * @param {number} maxPerMin - max calls per minute
     */
    setRateLimit(provider, maxPerMin) {
        this._rateLimits.set(provider.toLowerCase(), maxPerMin);
    }

    /**
     * Get rate limit usage percentage for a provider.
     * @param {string} provider
     * @returns {number} 0-100 (can exceed 100 if over limit)
     */
    getRateLimitPercent(provider) {
        const key = provider.toLowerCase();
        const limit = this._rateLimits.get(key);
        if (!limit) return 0;
        const counter = this._counters.get(key);
        if (!counter) return 0;
        return Math.round((counter.getCallsPerMin() / limit) * 100);
    }

    /**
     * Check if a provider can safely make another call.
     * @param {string} provider
     * @returns {boolean} true if under 80% of rate limit (or no limit set)
     */
    canCall(provider) {
        return this.getRateLimitPercent(provider) < 80;
    }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const apiMeter = new _ApiMeter();

// Expose on window for dev-mode console access
if (typeof window !== 'undefined') {
    window.__apiMeter = apiMeter;
}

export default apiMeter;
