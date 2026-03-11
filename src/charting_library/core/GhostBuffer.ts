// ═══════════════════════════════════════════════════════════════════
// charEdge — Ghost Buffer (Phase 4)
// Predictive timeframe prefetch — monitors TF switch patterns
// and background-fetches the most likely next TFs
// ═══════════════════════════════════════════════════════════════════

import type { Bar } from '../../types/chart.js';

interface GhostEntry {
    bars: Bar[];
    timestamp: number;
    tf: string;
}

const MAX_HISTORY = 50;
const GHOST_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Ghost Buffer — predictive TF prefetcher.
 * Tracks user TF switch patterns and pre-loads predicted next TFs.
 */
export class GhostBuffer {
    private _history: string[] = [];          // Recent TF switches
    private _cache = new Map<string, GhostEntry>();
    private _fetching = new Set<string>();

    /**
     * Record a timeframe switch and trigger prefetch.
     */
    recordSwitch(newTF: string, fetchFn?: (tf: string) => Promise<Bar[]>): void {
        this._history.push(newTF);
        if (this._history.length > MAX_HISTORY) {
            this._history.shift();
        }

        // Auto-prefetch predicted TFs
        if (fetchFn) {
            this.prefetch(fetchFn);
        }
    }

    /**
     * Predict the top-2 most likely next TFs based on frequency and recency.
     * Uses weighted frequency: recent switches count more.
     */
    predictNext(): [string | null, string | null] {
        if (this._history.length < 2) return [null, null];

        const current = this._history[this._history.length - 1]!;
        const scores = new Map<string, number>();

        // Score by frequency with recency weighting
        for (let i = 0; i < this._history.length; i++) {
            const tf = this._history[i]!;
            if (tf === current) continue;
            const recencyWeight = 1 + (i / this._history.length); // More recent = higher weight
            scores.set(tf, (scores.get(tf) || 0) + recencyWeight);
        }

        // Also look for transition patterns: "after X, users often go to Y"
        for (let i = 0; i < this._history.length - 1; i++) {
            if (this._history[i] === current) {
                const next = this._history[i + 1]!;
                if (next !== current) {
                    scores.set(next, (scores.get(next) || 0) + 3); // Pattern bonus
                }
            }
        }

        // Sort by score
        const sorted = Array.from(scores.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([tf]) => tf);

        return [sorted[0] || null, sorted[1] || null];
    }

    /**
     * Background-fetch top-2 predicted TFs.
     */
    async prefetch(fetchFn: (tf: string) => Promise<Bar[]>): Promise<void> {
        const [tf1, tf2] = this.predictNext();

        const toFetch = [tf1, tf2].filter((tf): tf is string => {
            if (!tf) return false;
            if (this._fetching.has(tf)) return false;
            // Skip if fresh cache exists
            const cached = this._cache.get(tf);
            if (cached && Date.now() - cached.timestamp < GHOST_TTL) return false;
            return true;
        });

        for (const tf of toFetch) {
            this._fetching.add(tf);
            try {
                const bars = await fetchFn(tf);
                this._cache.set(tf, { bars, timestamp: Date.now(), tf });
            } catch {
                // Silent failure — prefetch is best-effort
            } finally {
                this._fetching.delete(tf);
            }
        }
    }

    /**
     * Check ghost cache for a TF before hitting the network.
     * Returns bars if cached and fresh, null otherwise.
     */
    get(tf: string): Bar[] | null {
        const entry = this._cache.get(tf);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > GHOST_TTL) {
            this._cache.delete(tf);
            return null;
        }
        return entry.bars;
    }

    /** Clear all ghost cache entries. */
    clear(): void {
        this._cache.clear();
        this._fetching.clear();
    }

    /** Get stats for debugging. */
    get stats() {
        return {
            historyLen: this._history.length,
            cacheSize: this._cache.size,
            fetching: this._fetching.size,
            predictions: this.predictNext(),
        };
    }
}
