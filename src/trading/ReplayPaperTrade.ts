// ═══════════════════════════════════════════════════════════════════
// charEdge — Replay Paper Trading Bridge (Task 3.4.3)
//
// Connects ReplayEngine's simulated price feed to the PaperTradeStore,
// allowing users to place paper trades against historical replay data
// instead of live market prices.
// ═══════════════════════════════════════════════════════════════════

import type { ReplayEngine, ReplayBar } from '../charting_library/replay/ReplayEngine';

// ─── Types ──────────────────────────────────────────────────────

export interface ReplayTradeEntry {
    id: string;
    symbol: string;
    side: 'long' | 'short';
    entryPrice: number;
    entryBar: number;
    quantity: number;
    exitPrice?: number;
    exitBar?: number;
    pnl?: number;
    status: 'open' | 'closed';
}

export interface ReplaySessionStats {
    trades: ReplayTradeEntry[];
    totalPnl: number;
    winCount: number;
    lossCount: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    expectancy: number;
    maxDrawdown: number;
    peakEquity: number;
}

// ─── Bridge ─────────────────────────────────────────────────────

export class ReplayPaperTrade {
    private engine: ReplayEngine;
    private trades: ReplayTradeEntry[] = [];
    private startingBalance: number;
    private equity: number;
    private peakEquity: number;
    private maxDrawdown = 0;
    private unsubscribe: (() => void) | null = null;

    constructor(engine: ReplayEngine, startingBalance = 10000) {
        this.engine = engine;
        this.startingBalance = startingBalance;
        this.equity = startingBalance;
        this.peakEquity = startingBalance;
    }

    /** Wire up to the replay engine's bar-advance events */
    connect(): void {
        // Safety: engine may be a ChartEngine (no .on method) instead of ReplayEngine
        if (typeof this.engine?.on !== 'function') return;
        this.unsubscribe = this.engine.on('bar-advance', (data: { bar: ReplayBar; index: number }) => {
            this.onBarAdvance(data.bar, data.index);
        });
    }

    disconnect(): void {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }

    /** Place a paper trade at the current replay price */
    placeTrade(side: 'long' | 'short', quantity: number): ReplayTradeEntry | null {
        const bar = this.engine.getCurrentBar();
        if (!bar) return null;

        const config = this.engine.getConfig();
        if (!config) return null;

        const trade: ReplayTradeEntry = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            symbol: config.symbol,
            side,
            entryPrice: bar.close,
            entryBar: this.engine.getVisibleIndex(),
            quantity,
            status: 'open',
        };

        this.trades.push(trade);
        return trade;
    }

    /** Close an open trade at the current replay price */
    closeTrade(tradeId: string): ReplayTradeEntry | null {
        const bar = this.engine.getCurrentBar();
        if (!bar) return null;

        const trade = this.trades.find((t) => t.id === tradeId && t.status === 'open');
        if (!trade) return null;

        trade.exitPrice = bar.close;
        trade.exitBar = this.engine.getVisibleIndex();
        trade.pnl = trade.side === 'long'
            ? (bar.close - trade.entryPrice) * trade.quantity
            : (trade.entryPrice - bar.close) * trade.quantity;
        trade.status = 'closed';

        // Update equity tracking
        this.equity += trade.pnl;
        if (this.equity > this.peakEquity) this.peakEquity = this.equity;
        const dd = (this.peakEquity - this.equity) / this.peakEquity;
        if (dd > this.maxDrawdown) this.maxDrawdown = dd;

        return trade;
    }

    /** Close all open trades */
    closeAll(): ReplayTradeEntry[] {
        const openTrades = this.trades.filter((t) => t.status === 'open');
        return openTrades
            .map((t) => this.closeTrade(t.id))
            .filter((t): t is ReplayTradeEntry => t !== null);
    }

    /** Update open trade P&L on each bar advance */
    private onBarAdvance(bar: ReplayBar, _index: number): void {
        for (const trade of this.trades) {
            if (trade.status !== 'open') continue;
            // Update unrealized P&L
            trade.pnl = trade.side === 'long'
                ? (bar.close - trade.entryPrice) * trade.quantity
                : (trade.entryPrice - bar.close) * trade.quantity;
        }
    }

    /** Get session stats */
    getStats(): ReplaySessionStats {
        const closed = this.trades.filter((t) => t.status === 'closed');
        const wins = closed.filter((t) => (t.pnl ?? 0) > 0);
        const losses = closed.filter((t) => (t.pnl ?? 0) <= 0);

        const totalPnl = closed.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
        const avgWin = wins.length > 0
            ? wins.reduce((sum, t) => sum + (t.pnl ?? 0), 0) / wins.length
            : 0;
        const avgLoss = losses.length > 0
            ? Math.abs(losses.reduce((sum, t) => sum + (t.pnl ?? 0), 0) / losses.length)
            : 0;
        const winRate = closed.length > 0 ? wins.length / closed.length : 0;
        const expectancy = closed.length > 0
            ? (winRate * avgWin) - ((1 - winRate) * avgLoss)
            : 0;

        return {
            trades: [...this.trades],
            totalPnl,
            winCount: wins.length,
            lossCount: losses.length,
            winRate,
            avgWin,
            avgLoss,
            expectancy,
            maxDrawdown: this.maxDrawdown,
            peakEquity: this.peakEquity,
        };
    }

    /** Reset session */
    reset(): void {
        this.trades = [];
        this.equity = this.startingBalance;
        this.peakEquity = this.startingBalance;
        this.maxDrawdown = 0;
    }
}

export default ReplayPaperTrade;
