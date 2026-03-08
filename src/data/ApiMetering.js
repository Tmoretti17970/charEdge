// ═══════════════════════════════════════════════════════════════════
// charEdge — API Metering Service (1B.10)
//
// Tracks API calls per provider per minute. Provides a simple
// counter visible in dev-mode or settings panel.
//
// Usage:
//   import { apiMeter } from './ApiMetering.js';
//   apiMeter.record('binance');
//   console.table(apiMeter.getSnapshot());
//
// Integration: Call apiMeter.record(provider) in adapter fetch
// methods or hook into a global fetch interceptor.
// ═══════════════════════════════════════════════════════════════════

const WINDOW_MS = 60_000; // 1-minute rolling window
const MAX_HISTORY = 300;  // 5 minutes of per-second granularity

// ─── Meter Class ────────────────────────────────────────────────

class ApiMeter {
    constructor() {
        /** @type {Map<string, number[]>} provider → array of timestamps */
        this._calls = new Map();
        this._totalCalls = new Map(); // provider → lifetime count
    }

    /**
     * Record an API call for a provider.
     * @param {string} provider - e.g. 'binance', 'polygon', 'coingecko'
     */
    record(provider) {
        const now = Date.now();
        const key = (provider || 'unknown').toLowerCase();

        if (!this._calls.has(key)) {
            this._calls.set(key, []);
            this._totalCalls.set(key, 0);
        }

        const timestamps = this._calls.get(key);
        timestamps.push(now);
        this._totalCalls.set(key, (this._totalCalls.get(key) || 0) + 1);

        // Evict old entries beyond MAX_HISTORY
        if (timestamps.length > MAX_HISTORY) {
            const cutoff = now - WINDOW_MS * 5; // keep 5 min
            const firstValid = timestamps.findIndex(t => t >= cutoff);
            if (firstValid > 0) timestamps.splice(0, firstValid);
        }
    }

    /**
     * Get calls/min for a provider in the last window.
     * @param {string} provider
     * @returns {number}
     */
    getRate(provider) {
        const key = (provider || '').toLowerCase();
        const timestamps = this._calls.get(key);
        if (!timestamps) return 0;

        const cutoff = Date.now() - WINDOW_MS;
        return timestamps.filter(t => t >= cutoff).length;
    }

    /**
     * Get a snapshot of all providers' call rates.
     * @returns {Array<{ provider: string, callsPerMin: number, totalCalls: number }>}
     */
    getSnapshot() {
        const now = Date.now();
        const cutoff = now - WINDOW_MS;
        const result = [];

        for (const [provider, timestamps] of this._calls) {
            const callsPerMin = timestamps.filter(t => t >= cutoff).length;
            result.push({
                provider,
                callsPerMin,
                totalCalls: this._totalCalls.get(provider) || 0,
            });
        }

        // Sort by calls/min descending
        result.sort((a, b) => b.callsPerMin - a.callsPerMin);
        return result;
    }

    /**
     * Get total calls across all providers.
     * @returns {{ totalCallsPerMin: number, totalLifetime: number }}
     */
    getTotals() {
        const snapshot = this.getSnapshot();
        return {
            totalCallsPerMin: snapshot.reduce((s, e) => s + e.callsPerMin, 0),
            totalLifetime: snapshot.reduce((s, e) => s + e.totalCalls, 0),
        };
    }

    /**
     * Check if any provider exceeds a calls/min threshold.
     * @param {number} [threshold=60] - Max calls/min before warning
     * @returns {Array<{ provider: string, callsPerMin: number }>}
     */
    getExceeded(threshold = 60) {
        return this.getSnapshot().filter(e => e.callsPerMin > threshold);
    }

    /**
     * Reset all counters.
     */
    reset() {
        this._calls.clear();
        this._totalCalls.clear();
    }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const apiMeter = new ApiMeter();
export { ApiMeter };
export default apiMeter;
