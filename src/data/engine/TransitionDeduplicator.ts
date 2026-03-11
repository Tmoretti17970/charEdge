// ═══════════════════════════════════════════════════════════════════
// charEdge — Transition Deduplicator (Task 2.10.5.2)
//
// Merge-reconciles the overlap between the final REST page bar
// and the initial WebSocket live bar at LastCommonTimestamp.
// Prevents volume double-counting during REST→WS transitions.
// ═══════════════════════════════════════════════════════════════════

import { logger } from '@/observability/logger';

// ─── Types ──────────────────────────────────────────────────────

export interface TransitionBar {
    t: number;  // timestamp (ms)
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
    [key: string]: unknown;
}

// ─── TransitionDeduplicator ─────────────────────────────────────

export class TransitionDeduplicator {
    /** Last timestamp received from REST data */
    private _lastRestTimestamp = 0;

    /**
     * Record the last REST page's final timestamp.
     * Call this after each REST fetch completes.
     */
    setLastRestTimestamp(timestampMs: number): void {
        this._lastRestTimestamp = timestampMs;
    }

    /**
     * Merge REST bars with incoming WebSocket bars, deduplicating
     * any overlap at the transition boundary.
     *
     * Strategy:
     * - For bars with matching timestamps, prefer the WS version
     *   (more recent data: final close vs mid-candle snapshot)
     * - Ensure no duplicate timestamps in the output
     * - Verify volume continuity at the seam
     *
     * @param restBars - Bars from REST (sorted oldest-first)
     * @param wsBars - Bars from WebSocket (sorted oldest-first)
     * @returns Merged bars without duplicates
     */
    merge(restBars: TransitionBar[], wsBars: TransitionBar[]): TransitionBar[] {
        if (!restBars.length) return wsBars;
        if (!wsBars.length) return restBars;

        // Find the transition point
        const lastRestTime = restBars[restBars.length - 1].t;
        const firstWsTime = wsBars[0].t;

        // No overlap — simple concatenation
        if (firstWsTime > lastRestTime) {
            return [...restBars, ...wsBars];
        }

        // Overlap detected — merge with WS priority at boundary
        const merged: TransitionBar[] = [];
        const wsMap = new Map<number, TransitionBar>();

        // Index WS bars by timestamp for O(1) lookup
        for (const bar of wsBars) {
            wsMap.set(bar.t, bar);
        }

        // Add REST bars, but prefer WS version at overlap
        for (const bar of restBars) {
            const wsVersion = wsMap.get(bar.t);
            if (wsVersion) {
                // Use WS version (more recent), remove from map
                merged.push(wsVersion);
                wsMap.delete(bar.t);
            } else {
                merged.push(bar);
            }
        }

        // Add remaining WS bars (those after the REST range)
        for (const bar of wsBars) {
            if (wsMap.has(bar.t)) {
                merged.push(bar);
            }
        }

        // Sort by timestamp (safety — should already be ordered)
        merged.sort((a, b) => a.t - b.t);

        // Final dedup pass — remove any remaining timestamp duplicates
        const seen = new Set<number>();
        const deduped = merged.filter((bar) => {
            if (seen.has(bar.t)) return false;
            seen.add(bar.t);
            return true;
        });

        if (deduped.length < restBars.length + wsBars.length) {
            const removed = restBars.length + wsBars.length - deduped.length;
            logger.data.info(
                `[TransitionDeduplicator] Removed ${removed} duplicate bars at REST→WS seam ` +
                `(lastRest=${new Date(lastRestTime).toISOString()}, firstWS=${new Date(firstWsTime).toISOString()})`
            );
        }

        return deduped;
    }

    /**
     * Deduplicate a single bar array (e.g., merged multi-page REST results).
     * Keeps the LAST occurrence of each timestamp (most recent data).
     */
    dedup(bars: TransitionBar[]): TransitionBar[] {
        const map = new Map<number, TransitionBar>();
        for (const bar of bars) {
            map.set(bar.t, bar); // Last write wins
        }
        return Array.from(map.values()).sort((a, b) => a.t - b.t);
    }

    /**
     * Check for volume discontinuity at a seam point.
     * Returns true if there's a suspicious volume spike/drop.
     */
    hasVolumeAnomaly(bars: TransitionBar[], seamTimestamp: number): boolean {
        const idx = bars.findIndex((b) => b.t === seamTimestamp);
        if (idx <= 0 || idx >= bars.length - 1) return false;

        const prev = bars[idx - 1].v;
        const curr = bars[idx].v;
        const next = bars[idx + 1].v;

        // Flag if volume at seam is >5× neighbors (likely double-counted)
        const avgNeighbor = (prev + next) / 2;
        return avgNeighbor > 0 && curr > avgNeighbor * 5;
    }
}

// Singleton
export const transitionDeduplicator = new TransitionDeduplicator();
export default transitionDeduplicator;
