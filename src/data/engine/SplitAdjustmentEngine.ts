// ═══════════════════════════════════════════════════════════════════
// charEdge — Split Adjustment Engine (Task 2.10.5.1)
//
// On-the-fly corporate action adjustment using cumulative split factors.
// C_adj = C_raw × Π(SplitFactor_i)
//
// Applied during OPFS → render pipeline. Never mutates stored data.
// ═══════════════════════════════════════════════════════════════════

import { logger } from '../../utils/logger';

// ─── Types ──────────────────────────────────────────────────────

export interface SplitEvent {
    /** Effective date of the split (ms since epoch) */
    dateMs: number;
    /** Split factor (e.g., 2 for a 2:1 split, 0.5 for a 1:2 reverse split) */
    factor: number;
}

export interface Bar {
    t: number;  // timestamp in ms
    o: number;  // open
    h: number;  // high
    l: number;  // low
    c: number;  // close
    v: number;  // volume
    [key: string]: unknown;
}

// ─── Split Adjustment Engine ────────────────────────────────────

export class SplitAdjustmentEngine {
    /** Map of symbol → sorted split events (oldest first) */
    private _splits = new Map<string, SplitEvent[]>();

    /**
     * Register split events for a symbol.
     * @param symbol - e.g., 'AAPL'
     * @param events - Array of split events (will be sorted by date)
     */
    setSplitEvents(symbol: string, events: SplitEvent[]): void {
        const sorted = [...events].sort((a, b) => a.dateMs - b.dateMs);
        this._splits.set(symbol.toUpperCase(), sorted);
        logger.data.info(
            `[SplitAdjustmentEngine] Registered ${sorted.length} splits for ${symbol}`
        );
    }

    /**
     * Get the cumulative split factor for a given timestamp.
     * Multiply raw prices by this factor to get adjusted prices.
     *
     * For bars BEFORE the split date, the factor includes the split.
     * For bars AFTER the split date, the factor is 1 (already adjusted).
     */
    getCumulativeFactor(symbol: string, timestampMs: number): number {
        const events = this._splits.get(symbol.toUpperCase());
        if (!events || events.length === 0) return 1;

        let factor = 1;
        // Apply all splits that happened AFTER this bar's timestamp
        // (we're adjusting historical bars to match current prices)
        for (const event of events) {
            if (event.dateMs > timestampMs) {
                factor *= event.factor;
            }
        }

        return factor;
    }

    /**
     * Adjust an array of bars for splits. Returns a new array (non-mutating).
     *
     * Adjusts OHLC by split factor, adjusts volume inversely.
     * Bars after all splits are unchanged (factor = 1).
     */
    adjustBars(symbol: string, bars: Bar[]): Bar[] {
        const events = this._splits.get(symbol.toUpperCase());
        if (!events || events.length === 0) return bars;

        return bars.map((bar) => {
            const factor = this.getCumulativeFactor(symbol, bar.t);
            if (factor === 1) return bar;

            return {
                ...bar,
                o: bar.o * factor,
                h: bar.h * factor,
                l: bar.l * factor,
                c: bar.c * factor,
                v: bar.v / factor, // Volume adjusts inversely
            };
        });
    }

    /**
     * Check if a symbol has any registered splits.
     */
    hasSplits(symbol: string): boolean {
        const events = this._splits.get(symbol.toUpperCase());
        return !!(events && events.length > 0);
    }

    /**
     * Clear split data for a symbol or all symbols.
     */
    clear(symbol?: string): void {
        if (symbol) {
            this._splits.delete(symbol.toUpperCase());
        } else {
            this._splits.clear();
        }
    }
}

// Singleton
export const splitAdjustmentEngine = new SplitAdjustmentEngine();
export default splitAdjustmentEngine;
