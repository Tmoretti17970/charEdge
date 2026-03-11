// ═══════════════════════════════════════════════════════════════════
// charEdge — Execution Ghost Boxes (Task 4.8.1)
//
// Overlays translucent "ghost" annotations on the chart showing
// where historical trades were executed. Visualizes:
//   - Entry and exit points with directional markers
//   - Hold duration as horizontal spans
//   - P&L color coding (green = win, red = loss)
//   - Execution grade (A-F) labels
//   - Cluster analysis for frequently-traded price zones
//
// The ghost data is derived from TradeSnapshot[] and rendered
// as canvas overlay instructions for the chart engine.
//
// Usage:
//   import { ExecutionGhosts } from './ExecutionGhosts';
//   const ghosts = new ExecutionGhosts();
//   const overlays = ghosts.generateOverlays(snapshots, visibleRange);
// ═══════════════════════════════════════════════════════════════════

import type { TradeSnapshot } from './TradeSnapshot';

// ─── Types ──────────────────────────────────────────────────────

export interface GhostMarker {
    type: 'entry' | 'exit';
    timestamp: string;
    price: number;
    side: 'long' | 'short';
    color: string;
    opacity: number;
    label?: string;
}

export interface GhostSpan {
    entryTime: string;
    exitTime: string;
    entryPrice: number;
    exitPrice: number;
    side: 'long' | 'short';
    pnl: number;
    color: string;
    opacity: number;
    grade?: string;
}

export interface GhostCluster {
    priceLevel: number;
    count: number;
    winRate: number;
    avgPnl: number;
    color: string;
    radius: number;  // Visual size proportional to trade count
}

export interface GhostOverlays {
    markers: GhostMarker[];
    spans: GhostSpan[];
    clusters: GhostCluster[];
    stats: {
        totalTrades: number;
        visibleTrades: number;
        winRate: number;
        avgPnl: number;
    };
}

// ─── Colors ─────────────────────────────────────────────────────

const COLORS = {
    win: 'rgba(76, 175, 80, 0.6)',       // Green
    loss: 'rgba(244, 67, 54, 0.6)',      // Red
    breakeven: 'rgba(158, 158, 158, 0.5)', // Grey
    longEntry: 'rgba(76, 175, 80, 0.8)',  // Green arrow up
    shortEntry: 'rgba(244, 67, 54, 0.8)', // Red arrow down
    longExit: 'rgba(76, 175, 80, 0.4)',
    shortExit: 'rgba(244, 67, 54, 0.4)',
    clusterHot: 'rgba(255, 152, 0, 0.4)', // Frequently traded zone
    clusterCold: 'rgba(33, 150, 243, 0.2)',
};

const _GRADE_COLORS: Record<string, string> = {
    A: '#4caf50', B: '#8bc34a', C: '#ffc107', D: '#ff9800', F: '#f44336',
};

// ─── ExecutionGhosts Class ──────────────────────────────────────

export class ExecutionGhosts {
    private _enabled: boolean = true;
    private _opacity: number = 0.6;      // Global opacity multiplier
    private _showGrades: boolean = true;
    private _showClusters: boolean = true;
    private _clusterThreshold: number = 3; // Min trades to form a cluster

    /**
     * Configure ghost display options.
     */
    configure(opts: {
        enabled?: boolean;
        opacity?: number;
        showGrades?: boolean;
        showClusters?: boolean;
        clusterThreshold?: number;
    }): void {
        if (opts.enabled !== undefined) this._enabled = opts.enabled;
        if (opts.opacity !== undefined) this._opacity = Math.max(0.1, Math.min(1, opts.opacity));
        if (opts.showGrades !== undefined) this._showGrades = opts.showGrades;
        if (opts.showClusters !== undefined) this._showClusters = opts.showClusters;
        if (opts.clusterThreshold !== undefined) this._clusterThreshold = opts.clusterThreshold;
    }

    /**
     * Generate overlay data from trade snapshots for the visible chart range.
     *
     * @param snapshots - All trade snapshots
     * @param visibleRange - Visible time range on chart { from: ms, to: ms }
     * @param symbol - Filter to current chart symbol
     */
    generateOverlays(
        snapshots: TradeSnapshot[],
        visibleRange: { from: number; to: number },
        symbol?: string
    ): GhostOverlays {
        if (!this._enabled || !snapshots.length) {
            return {
                markers: [], spans: [], clusters: [],
                stats: { totalTrades: 0, visibleTrades: 0, winRate: 0, avgPnl: 0 },
            };
        }

        // Filter to symbol and visible range
        const relevant = snapshots.filter(s => {
            if (symbol && s.symbol !== symbol) return false;
            const entryMs = new Date(s.timestamp).getTime();
            return entryMs >= visibleRange.from && entryMs <= visibleRange.to;
        });

        const markers = this._buildMarkers(relevant);
        const spans = this._buildSpans(relevant);
        const clusters = this._showClusters ? this._buildClusters(relevant) : [];

        // Stats
        const closedTrades = relevant.filter(s => s.outcome);
        const wins = closedTrades.filter(s => s.outcome === 'win').length;
        const totalPnl = closedTrades.reduce((sum, s) => sum + (s.pnl || 0), 0);

        return {
            markers,
            spans,
            clusters,
            stats: {
                totalTrades: snapshots.filter(s => !symbol || s.symbol === symbol).length,
                visibleTrades: relevant.length,
                winRate: closedTrades.length > 0 ? wins / closedTrades.length : 0,
                avgPnl: closedTrades.length > 0 ? totalPnl / closedTrades.length : 0,
            },
        };
    }

    // ─── Builders ───────────────────────────────────────────────

    private _buildMarkers(trades: TradeSnapshot[]): GhostMarker[] {
        const markers: GhostMarker[] = [];

        for (const trade of trades) {
            // Entry marker
            markers.push({
                type: 'entry',
                timestamp: trade.timestamp,
                price: trade.entryPrice,
                side: trade.side,
                color: trade.side === 'long' ? COLORS.longEntry : COLORS.shortEntry,
                opacity: this._opacity,
                label: this._showGrades && trade.executionGrade
                    ? trade.executionGrade
                    : undefined,
            });

            // Exit marker (if closed)
            if (trade.exitPrice) {
                const exitTime = trade.holdDuration
                    ? new Date(new Date(trade.timestamp).getTime() + trade.holdDuration).toISOString()
                    : trade.timestamp;

                markers.push({
                    type: 'exit',
                    timestamp: exitTime,
                    price: trade.exitPrice,
                    side: trade.side,
                    color: trade.outcome === 'win' ? COLORS.win
                        : trade.outcome === 'loss' ? COLORS.loss
                            : COLORS.breakeven,
                    opacity: this._opacity * 0.7,
                });
            }
        }

        return markers;
    }

    private _buildSpans(trades: TradeSnapshot[]): GhostSpan[] {
        return trades
            .filter(t => t.exitPrice && t.holdDuration)
            .map(t => {
                const exitTime = new Date(
                    new Date(t.timestamp).getTime() + (t.holdDuration || 0)
                ).toISOString();

                return {
                    entryTime: t.timestamp,
                    exitTime,
                    entryPrice: t.entryPrice,
                    exitPrice: t.exitPrice!,
                    side: t.side,
                    pnl: t.pnl || 0,
                    color: t.outcome === 'win' ? COLORS.win
                        : t.outcome === 'loss' ? COLORS.loss
                            : COLORS.breakeven,
                    opacity: this._opacity * 0.3,
                    grade: this._showGrades ? t.executionGrade : undefined,
                };
            });
    }

    private _buildClusters(trades: TradeSnapshot[]): GhostCluster[] {
        if (trades.length < this._clusterThreshold) return [];

        // Group entries by rounded price level (0.5% buckets)
        const buckets = new Map<number, TradeSnapshot[]>();

        for (const trade of trades) {
            const bucket = Math.round(trade.entryPrice / (trade.entryPrice * 0.005)) * (trade.entryPrice * 0.005);
            if (!buckets.has(bucket)) buckets.set(bucket, []);
            buckets.get(bucket)!.push(trade);
        }

        const clusters: GhostCluster[] = [];

        for (const [priceLevel, bucketTrades] of buckets) {
            if (bucketTrades.length < this._clusterThreshold) continue;

            const closed = bucketTrades.filter(t => t.outcome);
            const wins = closed.filter(t => t.outcome === 'win').length;
            const winRate = closed.length > 0 ? wins / closed.length : 0;
            const avgPnl = closed.length > 0
                ? closed.reduce((s, t) => s + (t.pnl || 0), 0) / closed.length
                : 0;

            clusters.push({
                priceLevel,
                count: bucketTrades.length,
                winRate,
                avgPnl,
                color: winRate > 0.5 ? COLORS.clusterHot : COLORS.clusterCold,
                radius: Math.min(30, 8 + bucketTrades.length * 3),
            });
        }

        return clusters.sort((a, b) => b.count - a.count);
    }
}

export default ExecutionGhosts;
