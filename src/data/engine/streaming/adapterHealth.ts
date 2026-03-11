// ═══════════════════════════════════════════════════════════════════
// charEdge — Adapter Health Tracker
// Tracks per-source health metrics for the TickerPlant.
// ═══════════════════════════════════════════════════════════════════

import type {
    AdapterHealthData,
    SourceAdapter,
    SourceHealthStatus,
    SourceStatus,
} from './TickerPlantTypes.js';

/**
 * Tracks adapter health data (successes, errors, staleness, latency)
 * and computes health scores per source.
 */
export class AdapterHealthTracker {
    private _health: Map<string, AdapterHealthData> = new Map();

    /** Record a successful data ingestion. */
    recordSuccess(sourceId: string, price: number): void {
        let healthRecord = this._health.get(sourceId);
        if (!healthRecord) {
            healthRecord = { lastUpdate: 0, errors: 0, successes: 0, lastPrice: 0, consecutiveStale: 0, avgLatencyMs: 0 };
            this._health.set(sourceId, healthRecord);
        }
        healthRecord.successes++;
        healthRecord.lastUpdate = Date.now();

        if (price === healthRecord.lastPrice) {
            healthRecord.consecutiveStale++;
        } else {
            healthRecord.consecutiveStale = 0;
        }
        healthRecord.lastPrice = price;
    }

    /** Record a failed data fetch. */
    recordError(sourceId: string): void {
        let healthRecord = this._health.get(sourceId);
        if (!healthRecord) {
            healthRecord = { lastUpdate: 0, errors: 0, successes: 0, lastPrice: 0, consecutiveStale: 0, avgLatencyMs: 0 };
            this._health.set(sourceId, healthRecord);
        }
        healthRecord.errors++;
    }

    /** Get raw health data for a source (used by _connectSymbol for source ranking). */
    get(sourceId: string): AdapterHealthData | undefined {
        return this._health.get(sourceId);
    }

    /** Iterate over all health entries. */
    entries(): IterableIterator<[string, AdapterHealthData]> {
        return this._health.entries();
    }

    /** Compute status for all registered sources. */
    getSourceStatus(sources: Map<string, SourceAdapter>): Record<string, SourceStatus> {
        const status: Record<string, SourceStatus> = {};
        for (const [id, source] of sources) {
            const health = this._health.get(id);
            const now = Date.now();
            const freshness = health?.lastUpdate ? now - health.lastUpdate : null;
            const totalCalls = (health?.successes || 0) + (health?.errors || 0);
            const errorRate = totalCalls > 0 ? (health?.errors || 0) / totalCalls : 0;

            let score = 100;
            if (freshness !== null && freshness > 60000) score -= 20;
            if (freshness !== null && freshness > 300000) score -= 30;
            if (errorRate > 0.1) score -= 20;
            if (errorRate > 0.5) score -= 30;
            if ((health?.consecutiveStale || 0) > 5) score -= 20;
            if ((health?.avgLatencyMs || 0) > 5000) score -= 10;
            score = Math.max(0, score);

            status[id] = {
                name: source.name,
                available: source.available,
                assetClasses: source.assetClasses,
                hasStreaming: !!source.subscribe,
                hasRest: !!source.fetchQuote,
                health: {
                    score,
                    level: score >= 70 ? 'healthy' : score >= 40 ? 'degraded' : 'unhealthy',
                    lastUpdate: health?.lastUpdate || null,
                    freshness,
                    errors: health?.errors || 0,
                    successes: health?.successes || 0,
                    errorRate: Math.round(errorRate * 1000) / 10,
                    consecutiveStale: health?.consecutiveStale || 0,
                    avgLatencyMs: health?.avgLatencyMs || 0,
                },
            };
        }
        return status;
    }

    /** Get health scores for all sources. */
    getAdapterHealth(sources: Map<string, SourceAdapter>): Record<string, SourceHealthStatus> {
        const status = this.getSourceStatus(sources);
        const result: Record<string, SourceHealthStatus> = {};
        for (const [id, s] of Object.entries(status)) {
            result[id] = s.health;
        }
        return result;
    }
}
