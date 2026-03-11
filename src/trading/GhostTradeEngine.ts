// ═══════════════════════════════════════════════════════════════════
// charEdge — Ghost Trade Engine (Task 4.1.9)
//
// Watches active drawings for price intersections and auto-creates
// hypothetical "ghost trades." When price crosses a trendline,
// horizontal line, or Fib level → creates a ghost trade entry.
//
// Ghost trades are hypothetical: "If you had entered here, you'd
// be at +2.3%." Auto-journaled with isGhost: true flag.
//
// Usage:
//   const engine = new GhostTradeEngine();
//   engine.addDrawing({ id: 'd1', type: 'hline', price: 42500 });
//   engine.onTick({ close: 42501, time: Date.now() });
//   // → triggers ghost trade if price crossed 42500
// ═══════════════════════════════════════════════════════════════════

import { MFEMAETracker } from './MFEMAETracker.ts';

// ─── Types ───────────────────────────────────────────────────────

export interface DrawingLevel {
    id: string;
    type: 'hline' | 'trendline' | 'fib';
    /** Price level for hlines and fib levels */
    price: number;
    /** For trendlines: slope per bar */
    slope?: number;
    /** For trendlines: price at bar 0 */
    intercept?: number;
    /** For Fib: which level (0.236, 0.382, 0.5, 0.618, 0.786, 1.0) */
    fibLevel?: number;
    /** Label for display */
    label?: string;
}

export interface GhostTrade {
    id: string;
    drawingId: string;
    drawingType: string;
    symbol: string;
    side: 'long' | 'short';
    entryPrice: number;
    entryTime: number;
    currentPrice: number;
    currentPnL: number;
    currentPnLPct: number;
    mfe: number;
    mae: number;
    efficiencyRatio: number;
    barCount: number;
    isGhost: true;
    label: string;
    closed: boolean;
    exitPrice?: number;
    exitTime?: number;
}

export interface GhostTradeEvent {
    type: 'entry' | 'update' | 'exit';
    trade: GhostTrade;
}

type GhostTradeListener = (event: GhostTradeEvent) => void;

// ─── Engine ─────────────────────────────────────────────────────

export class GhostTradeEngine {
    private _drawings: Map<string, DrawingLevel> = new Map();
    private _ghostTrades: Map<string, GhostTrade> = new Map();
    private _prevPrices: Map<string, number> = new Map(); // drawingId → last price relative to level
    private _tracker: MFEMAETracker = new MFEMAETracker();
    private _listeners: GhostTradeListener[] = [];
    private _symbol = 'UNKNOWN';
    private _barIndex = 0;
    private _maxGhosts = 20; // prevent unbounded growth

    // ─── Configuration ──────────────────────────────────────────────

    setSymbol(symbol: string): void {
        this._symbol = symbol;
    }

    setMaxGhosts(max: number): void {
        this._maxGhosts = max;
    }

    // ─── Drawing Management ─────────────────────────────────────────

    addDrawing(drawing: DrawingLevel): void {
        this._drawings.set(drawing.id, drawing);
    }

    removeDrawing(id: string): void {
        this._drawings.delete(id);
        this._prevPrices.delete(id);
    }

    updateDrawing(drawing: DrawingLevel): void {
        this._drawings.set(drawing.id, drawing);
    }

    clearDrawings(): void {
        this._drawings.clear();
        this._prevPrices.clear();
    }

    // ─── Event System ───────────────────────────────────────────────

    onGhostTrade(listener: GhostTradeListener): () => void {
        this._listeners.push(listener);
        return () => {
            this._listeners = this._listeners.filter((l) => l !== listener);
        };
    }

    private _emit(event: GhostTradeEvent): void {
        for (const listener of this._listeners) {
            try {
                listener(event);
            } catch {
                // Listeners shouldn't break the engine
            }
        }
    }

    // ─── Tick Processing ────────────────────────────────────────────

    /**
     * Process a new price tick. Checks all drawings for crossovers
     * and creates/updates ghost trades.
     */
    onTick(bar: { close: number; high: number; low: number; time: number }): void {
        this._barIndex++;

        // Update existing ghost trades
        for (const [id, ghost] of this._ghostTrades) {
            if (ghost.closed) continue;

            this._tracker.updateTick(id, bar.close);
            const result = this._tracker.peek(id, bar.close);

            ghost.currentPrice = bar.close;
            ghost.barCount++;

            if (ghost.side === 'long') {
                ghost.currentPnL = round2(bar.close - ghost.entryPrice);
                ghost.currentPnLPct = round4(((bar.close - ghost.entryPrice) / ghost.entryPrice) * 100);
            } else {
                ghost.currentPnL = round2(ghost.entryPrice - bar.close);
                ghost.currentPnLPct = round4(((ghost.entryPrice - bar.close) / ghost.entryPrice) * 100);
            }

            if (result) {
                ghost.mfe = result.mfe;
                ghost.mae = result.mae;
                ghost.efficiencyRatio = result.efficiencyRatio;
            }

            this._emit({ type: 'update', trade: { ...ghost } });
        }

        // Check drawings for new crossovers
        for (const [drawingId, drawing] of this._drawings) {
            const level = this._getLevelPrice(drawing);
            if (level <= 0) continue;

            const prevPrice = this._prevPrices.get(drawingId);
            this._prevPrices.set(drawingId, bar.close);

            if (prevPrice == null) continue; // First tick, just record

            // Check for crossover
            const crossedUp = prevPrice < level && bar.close >= level;
            const crossedDown = prevPrice > level && bar.close <= level;

            if (!crossedUp && !crossedDown) continue;

            // Don't create duplicate ghost trades for same drawing
            const existingGhost = Array.from(this._ghostTrades.values()).find(
                (g) => g.drawingId === drawingId && !g.closed,
            );
            if (existingGhost) continue;

            // Enforce max ghost trades
            if (this._ghostTrades.size >= this._maxGhosts) {
                this._evictOldest();
            }

            // Create ghost trade
            const side = crossedUp ? 'long' : 'short';
            const ghostId = `ghost-${drawingId}-${bar.time}`;
            const label = drawing.label || `${drawing.type} @ ${level.toFixed(2)}`;

            const ghost: GhostTrade = {
                id: ghostId,
                drawingId,
                drawingType: drawing.type,
                symbol: this._symbol,
                side,
                entryPrice: bar.close,
                entryTime: bar.time,
                currentPrice: bar.close,
                currentPnL: 0,
                currentPnLPct: 0,
                mfe: 0,
                mae: 0,
                efficiencyRatio: 0,
                barCount: 0,
                isGhost: true,
                label: `Ghost ${side.toUpperCase()} — ${label}`,
                closed: false,
            };

            this._ghostTrades.set(ghostId, ghost);
            this._tracker.startTracking(ghostId, bar.close, side);
            this._emit({ type: 'entry', trade: { ...ghost } });
        }
    }

    // ─── Ghost Trade Lifecycle ──────────────────────────────────────

    /**
     * Close a ghost trade (e.g. when user clicks "close" on the ghost).
     */
    closeGhost(ghostId: string, exitPrice: number): GhostTrade | null {
        const ghost = this._ghostTrades.get(ghostId);
        if (!ghost || ghost.closed) return null;

        const result = this._tracker.closeTracking(ghostId, exitPrice);

        ghost.closed = true;
        ghost.exitPrice = exitPrice;
        ghost.exitTime = Date.now();
        ghost.currentPrice = exitPrice;

        if (ghost.side === 'long') {
            ghost.currentPnL = round2(exitPrice - ghost.entryPrice);
            ghost.currentPnLPct = round4(((exitPrice - ghost.entryPrice) / ghost.entryPrice) * 100);
        } else {
            ghost.currentPnL = round2(ghost.entryPrice - exitPrice);
            ghost.currentPnLPct = round4(((ghost.entryPrice - exitPrice) / ghost.entryPrice) * 100);
        }

        if (result) {
            ghost.mfe = result.mfe;
            ghost.mae = result.mae;
            ghost.efficiencyRatio = result.efficiencyRatio;
        }

        this._emit({ type: 'exit', trade: { ...ghost } });
        return { ...ghost };
    }

    /**
     * Close all active ghost trades.
     */
    closeAll(currentPrice: number): GhostTrade[] {
        const closed: GhostTrade[] = [];
        for (const [id, ghost] of this._ghostTrades) {
            if (!ghost.closed) {
                const result = this.closeGhost(id, currentPrice);
                if (result) closed.push(result);
            }
        }
        return closed;
    }

    // ─── Queries ────────────────────────────────────────────────────

    getActiveGhosts(): GhostTrade[] {
        return Array.from(this._ghostTrades.values()).filter((g) => !g.closed);
    }

    getAllGhosts(): GhostTrade[] {
        return Array.from(this._ghostTrades.values());
    }

    getGhost(id: string): GhostTrade | null {
        const ghost = this._ghostTrades.get(id);
        return ghost ? { ...ghost } : null;
    }

    // ─── Internals ──────────────────────────────────────────────────

    private _getLevelPrice(drawing: DrawingLevel): number {
        if (drawing.type === 'hline' || drawing.type === 'fib') {
            return drawing.price;
        }
        if (drawing.type === 'trendline' && drawing.slope != null && drawing.intercept != null) {
            return drawing.intercept + drawing.slope * this._barIndex;
        }
        return drawing.price || 0;
    }

    private _evictOldest(): void {
        // Remove the oldest closed ghost, or if none, the oldest open one
        let oldest: string | null = null;
        let oldestTime = Infinity;

        for (const [id, ghost] of this._ghostTrades) {
            if (ghost.closed && ghost.entryTime < oldestTime) {
                oldest = id;
                oldestTime = ghost.entryTime;
            }
        }

        if (!oldest) {
            // All open — evict oldest open
            for (const [id, ghost] of this._ghostTrades) {
                if (ghost.entryTime < oldestTime) {
                    oldest = id;
                    oldestTime = ghost.entryTime;
                }
            }
        }

        if (oldest) {
            this._tracker.cancelTracking(oldest);
            this._ghostTrades.delete(oldest);
        }
    }

    /**
     * Reset all state.
     */
    destroy(): void {
        this._tracker.clear();
        this._ghostTrades.clear();
        this._drawings.clear();
        this._prevPrices.clear();
        this._listeners = [];
        this._barIndex = 0;
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

export const ghostTradeEngine = new GhostTradeEngine();
export default ghostTradeEngine;
