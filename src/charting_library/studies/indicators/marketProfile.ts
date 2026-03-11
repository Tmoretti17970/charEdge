// ═══════════════════════════════════════════════════════════════════
// charEdge — Market Profile / TPO (Phase 5)
// Time-Price Opportunity distribution with POC, VA High/Low
// ═══════════════════════════════════════════════════════════════════

import type { Bar } from './helpers.ts';

export interface MarketProfileConfig {
    tickSize: number;      // Price bucket granularity (e.g., 0.25 for ES)
    sessionBars: number;   // Bars per session (e.g., 390 for US equities 1m)
    valueAreaPct: number;  // Value area percentage (default 70%)
}

export interface ProfileSession {
    pocPrice: number;       // Point of Control price
    valueAreaHigh: number;  // VA High
    valueAreaLow: number;   // VA Low
    tpoCounts: Map<number, number>;  // price bucket → TPO count
    startIdx: number;
    endIdx: number;
}

/**
 * Compute Market Profile / TPO distribution.
 * Groups bars into sessions and builds price-level histograms.
 */
export function marketProfile(
    bars: Bar[],
    config: Partial<MarketProfileConfig> = {},
): {
    sessions: ProfileSession[];
    poc: number[];           // Per-bar POC (held constant within session)
    valueAreaHigh: number[]; // Per-bar VA High
    valueAreaLow: number[];  // Per-bar VA Low
} {
    const n = bars.length;
    const tickSize = config.tickSize || 1;
    const sessionBars = config.sessionBars || 390;
    const valueAreaPct = config.valueAreaPct || 0.70;

    const poc = new Array<number>(n).fill(NaN);
    const vaHigh = new Array<number>(n).fill(NaN);
    const vaLow = new Array<number>(n).fill(NaN);
    const sessions: ProfileSession[] = [];

    if (n === 0) return { sessions, poc, valueAreaHigh: vaHigh, valueAreaLow: vaLow };

    // Process bars in session-sized chunks
    for (let start = 0; start < n; start += sessionBars) {
        const end = Math.min(start + sessionBars, n);
        const tpoCounts = new Map<number, number>();

        // Build TPO distribution for this session
        for (let i = start; i < end; i++) {
            const b = bars[i]!;
            const lo = Math.floor(b.low / tickSize) * tickSize;
            const hi = Math.ceil(b.high / tickSize) * tickSize;

            for (let price = lo; price <= hi; price += tickSize) {
                const bucket = Math.round(price / tickSize) * tickSize;
                tpoCounts.set(bucket, (tpoCounts.get(bucket) || 0) + 1);
            }
        }

        // Find POC (price with max TPO count)
        let maxCount = 0;
        let pocPrice = 0;
        for (const [price, count] of tpoCounts) {
            if (count > maxCount) {
                maxCount = count;
                pocPrice = price;
            }
        }

        // Calculate Value Area (70% of TPOs centered on POC)
        const sortedPrices = Array.from(tpoCounts.entries())
            .sort((a, b) => a[0] - b[0]);
        const totalTpos = sortedPrices.reduce((sum, [, c]) => sum + c, 0);
        const targetTpos = Math.ceil(totalTpos * valueAreaPct);

        // Expand outward from POC
        const pocIdx = sortedPrices.findIndex(([p]) => p === pocPrice);
        let lo = pocIdx, hi = pocIdx;
        let accumulated = sortedPrices[pocIdx]?.[1] || 0;

        while (accumulated < targetTpos && (lo > 0 || hi < sortedPrices.length - 1)) {
            const loCount = lo > 0 ? (sortedPrices[lo - 1]?.[1] || 0) : 0;
            const hiCount = hi < sortedPrices.length - 1 ? (sortedPrices[hi + 1]?.[1] || 0) : 0;

            if (loCount >= hiCount && lo > 0) {
                lo--;
                accumulated += loCount;
            } else if (hi < sortedPrices.length - 1) {
                hi++;
                accumulated += hiCount;
            } else {
                break;
            }
        }

        const vaLowPrice = sortedPrices[lo]?.[0] || pocPrice;
        const vaHighPrice = sortedPrices[hi]?.[0] || pocPrice;

        const session: ProfileSession = {
            pocPrice,
            valueAreaHigh: vaHighPrice,
            valueAreaLow: vaLowPrice,
            tpoCounts,
            startIdx: start,
            endIdx: end - 1,
        };
        sessions.push(session);

        // Fill per-bar arrays
        for (let i = start; i < end; i++) {
            poc[i] = pocPrice;
            vaHigh[i] = vaHighPrice;
            vaLow[i] = vaLowPrice;
        }
    }

    return { sessions, poc, valueAreaHigh: vaHigh, valueAreaLow: vaLow };
}
