// ═══════════════════════════════════════════════════════════════════
// charEdge — MFE/MAE Intra-Trade Tracker (Task 4.1.3)
//
// Tracks Maximum Favorable Excursion (MFE) and Maximum Adverse
// Excursion (MAE) during a trade's lifetime.
//
// MFE = furthest the trade moved in your favor
// MAE = furthest the trade moved against you
// Efficiency = actualPnL / MFE  (how much of the move you captured)
//
// Usage:
//   const tracker = new MFEMAETracker();
//   tracker.startTracking('trade-1', 42500, 'long');
//   tracker.updateTick(42800);  // price moves up
//   tracker.updateTick(42200);  // price pulls back
//   const result = tracker.closeTracking('trade-1', 42600);
//   // → { mfe: 300, mae: 300, efficiencyRatio: 0.33, ... }
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

export interface MFEMAEResult {
    /** Maximum price excursion in favorable direction (absolute $) */
    mfe: number;
    /** Maximum price excursion in adverse direction (absolute $) */
    mae: number;
    /** MFE as percentage of entry price */
    mfePct: number;
    /** MAE as percentage of entry price */
    maePct: number;
    /** Timestamp when MFE was reached */
    mfeTime: number;
    /** Timestamp when MAE was reached */
    maeTime: number;
    /** Actual PnL / MFE — how much of the favorable move was captured (0–1+) */
    efficiencyRatio: number;
    /** Number of ticks tracked */
    tickCount: number;
    /** Duration in milliseconds */
    durationMs: number;
}

export interface ActiveTrade {
    tradeId: string;
    entryPrice: number;
    side: 'long' | 'short';
    startTime: number;
    highPrice: number;
    lowPrice: number;
    highTime: number;
    lowTime: number;
    tickCount: number;
}

// ─── Tracker ─────────────────────────────────────────────────────

export class MFEMAETracker {
    private _activeTrades: Map<string, ActiveTrade> = new Map();

    /**
     * Begin tracking MFE/MAE for a trade.
     * Call updateTick() on each price update while the trade is open.
     */
    startTracking(tradeId: string, entryPrice: number, side: 'long' | 'short'): void {
        if (entryPrice <= 0) return;

        const now = Date.now();
        this._activeTrades.set(tradeId, {
            tradeId,
            entryPrice,
            side,
            startTime: now,
            highPrice: entryPrice,
            lowPrice: entryPrice,
            highTime: now,
            lowTime: now,
            tickCount: 0,
        });
    }

    /**
     * Update with the latest market price.
     * Call this on every tick/bar close while the trade is active.
     */
    updateTick(tradeId: string, price: number): void {
        const trade = this._activeTrades.get(tradeId);
        if (!trade || price <= 0) return;

        trade.tickCount++;
        const now = Date.now();

        if (price > trade.highPrice) {
            trade.highPrice = price;
            trade.highTime = now;
        }
        if (price < trade.lowPrice) {
            trade.lowPrice = price;
            trade.lowTime = now;
        }
    }

    /**
     * Close tracking and compute MFE/MAE/efficiency.
     * Returns null if tradeId is not being tracked.
     */
    closeTracking(tradeId: string, exitPrice: number): MFEMAEResult | null {
        const trade = this._activeTrades.get(tradeId);
        if (!trade) return null;

        this._activeTrades.delete(tradeId);
        return this._computeResult(trade, exitPrice);
    }

    /**
     * Peek at current MFE/MAE without closing the trade.
     */
    peek(tradeId: string, currentPrice: number): MFEMAEResult | null {
        const trade = this._activeTrades.get(tradeId);
        if (!trade) return null;
        return this._computeResult(trade, currentPrice);
    }

    /**
     * Check if a trade is actively being tracked.
     */
    isTracking(tradeId: string): boolean {
        return this._activeTrades.has(tradeId);
    }

    /**
     * Get all actively tracked trade IDs.
     */
    getActiveTradeIds(): string[] {
        return Array.from(this._activeTrades.keys());
    }

    /**
     * Stop tracking a trade without computing results (e.g. cancelled trade).
     */
    cancelTracking(tradeId: string): void {
        this._activeTrades.delete(tradeId);
    }

    /**
     * Stop tracking all trades.
     */
    clear(): void {
        this._activeTrades.clear();
    }

    // ─── Internals ──────────────────────────────────────────────────

    private _computeResult(trade: ActiveTrade, exitPrice: number): MFEMAEResult {
        const { entryPrice, side, highPrice, lowPrice, highTime, lowTime, startTime, tickCount } = trade;
        const now = Date.now();

        let mfe: number;
        let mae: number;
        let mfeTime: number;
        let maeTime: number;
        let actualPnL: number;

        if (side === 'long') {
            // For longs: MFE = highest price - entry, MAE = entry - lowest price
            mfe = Math.max(0, highPrice - entryPrice);
            mae = Math.max(0, entryPrice - lowPrice);
            mfeTime = highTime;
            maeTime = lowTime;
            actualPnL = exitPrice - entryPrice;
        } else {
            // For shorts: MFE = entry - lowest price, MAE = highest price - entry
            mfe = Math.max(0, entryPrice - lowPrice);
            mae = Math.max(0, highPrice - entryPrice);
            mfeTime = lowTime;
            maeTime = highTime;
            actualPnL = entryPrice - exitPrice;
        }

        // Efficiency ratio: how much of the favorable move was captured
        // > 1.0 is possible if exit happened after MFE dipped and recovered
        const efficiencyRatio = mfe > 0 ? round4(actualPnL / mfe) : (actualPnL > 0 ? 1 : 0);

        return {
            mfe: round2(mfe),
            mae: round2(mae),
            mfePct: entryPrice > 0 ? round4((mfe / entryPrice) * 100) : 0,
            maePct: entryPrice > 0 ? round4((mae / entryPrice) * 100) : 0,
            mfeTime,
            maeTime,
            efficiencyRatio,
            tickCount,
            durationMs: now - startTime,
        };
    }
}

// ─── Helpers ─────────────────────────────────────────────────────

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

function round4(n: number): number {
    return Math.round(n * 10000) / 10000;
}

// ─── Singleton ───────────────────────────────────────────────────

export const mfeMAETracker = new MFEMAETracker();
export default mfeMAETracker;
