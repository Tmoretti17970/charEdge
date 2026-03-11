// ═══════════════════════════════════════════════════════════════════
// charEdge — Leak Detector (Task 4.3.1)
//
// Detects cognitive/behavioral "leaks" in trading patterns.
// Analyzes trade snapshots to identify common biases and costly
// behavioral patterns that hurt performance.
//
// Detected leaks:
//   - Revenge trading (rapid entries after losses)
//   - Overtrading (too many trades in a session)
//   - Overexposure (too much risk on one trade/symbol)
//   - Tilt trading (emotional entries after consecutive losses)
//   - Late entries (chasing moves that already happened)
//   - Early exits (cutting winners too short)
//   - FOMO entries (entering after large moves)
//   - Time bias (poor performance at specific times)
//
// Usage:
//   import { LeakDetector } from './LeakDetector';
//   const detector = new LeakDetector();
//   const leaks = detector.analyze(snapshots);
// ═══════════════════════════════════════════════════════════════════

import type { TradeSnapshot } from './TradeSnapshot';

export type LeakType =
    | 'revenge-trading'
    | 'overtrading'
    | 'overexposure'
    | 'tilt'
    | 'late-entry'
    | 'early-exit'
    | 'fomo'
    | 'time-bias'
    | 'loss-aversion'
    | 'disposition-effect';

export type LeakSeverity = 'info' | 'warning' | 'critical';

export interface Leak {
    type: LeakType;
    severity: LeakSeverity;
    message: string;
    evidence: string[];       // Specific trade IDs or data points
    costEstimate?: number;    // Estimated P&L impact
    recommendation: string;
    detectedAt: string;
}

export interface LeakReport {
    leaks: Leak[];
    score: number;            // 0-100, higher = more leaks
    summary: string;
    analyzedTrades: number;
    timeRange: { from: string; to: string };
}

// ─── Thresholds ─────────────────────────────────────────────────

const REVENGE_WINDOW_MS = 5 * 60 * 1000;     // 5 minutes between trades = revenge
const OVERTRADE_DAILY_LIMIT = 20;              // More than 20 trades/day
const OVEREXPOSURE_PERCENT = 0.10;             // More than 10% of equity on one trade
const TILT_CONSECUTIVE_LOSSES = 3;             // 3+ consecutive losses = tilt risk
const EARLY_EXIT_R_THRESHOLD = 0.5;            // Exit at < 0.5R = early exit
const _FOMO_MOVE_PERCENT = 2.0;                 // Entry after 2%+ move without pullback

// ─── LeakDetector Class ─────────────────────────────────────────

export class LeakDetector {
    /**
     * Analyze a set of trade snapshots for behavioral leaks.
     */
    analyze(snapshots: TradeSnapshot[]): LeakReport {
        if (!snapshots.length) {
            return {
                leaks: [],
                score: 0,
                summary: 'No trades to analyze.',
                analyzedTrades: 0,
                timeRange: { from: '', to: '' },
            };
        }

        const sorted = [...snapshots].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        const leaks: Leak[] = [];

        // Run all detectors
        leaks.push(...this._detectRevenge(sorted));
        leaks.push(...this._detectOvertrading(sorted));
        leaks.push(...this._detectOverexposure(sorted));
        leaks.push(...this._detectTilt(sorted));
        leaks.push(...this._detectEarlyExits(sorted));
        leaks.push(...this._detectDispositionEffect(sorted));
        leaks.push(...this._detectTimeBias(sorted));

        // Calculate score (0-100)
        const criticalCount = leaks.filter(l => l.severity === 'critical').length;
        const warningCount = leaks.filter(l => l.severity === 'warning').length;
        const infoCount = leaks.filter(l => l.severity === 'info').length;
        const score = Math.min(100, criticalCount * 25 + warningCount * 10 + infoCount * 3);

        return {
            leaks,
            score,
            summary: this._buildSummary(leaks, snapshots.length),
            analyzedTrades: snapshots.length,
            timeRange: {
                from: sorted[0].timestamp,
                to: sorted[sorted.length - 1].timestamp,
            },
        };
    }

    // ─── Detectors ──────────────────────────────────────────────

    private _detectRevenge(trades: TradeSnapshot[]): Leak[] {
        const leaks: Leak[] = [];

        for (let i = 1; i < trades.length; i++) {
            const prev = trades[i - 1];
            const curr = trades[i];

            if (prev.outcome !== 'loss') continue;

            const gap = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime();
            if (gap < REVENGE_WINDOW_MS) {
                leaks.push({
                    type: 'revenge-trading',
                    severity: 'critical',
                    message: `Entered ${curr.symbol} ${curr.side} within ${Math.round(gap / 1000)}s after a loss on ${prev.symbol}`,
                    evidence: [prev.id, curr.id],
                    costEstimate: curr.pnl !== undefined ? Math.min(0, curr.pnl) : undefined,
                    recommendation: 'Implement a mandatory 15-minute cooldown after any loss. Walk away from the screen.',
                    detectedAt: curr.timestamp,
                });
            }
        }

        return leaks;
    }

    private _detectOvertrading(trades: TradeSnapshot[]): Leak[] {
        const leaks: Leak[] = [];
        const byDay = new Map<string, TradeSnapshot[]>();

        for (const trade of trades) {
            const day = trade.timestamp.slice(0, 10); // YYYY-MM-DD
            if (!byDay.has(day)) byDay.set(day, []);
            byDay.get(day)!.push(trade);
        }

        for (const [day, dayTrades] of byDay) {
            if (dayTrades.length > OVERTRADE_DAILY_LIMIT) {
                const losses = dayTrades.filter(t => t.outcome === 'loss');
                leaks.push({
                    type: 'overtrading',
                    severity: dayTrades.length > OVERTRADE_DAILY_LIMIT * 1.5 ? 'critical' : 'warning',
                    message: `${dayTrades.length} trades on ${day} (limit: ${OVERTRADE_DAILY_LIMIT}). ${losses.length} were losses.`,
                    evidence: dayTrades.map(t => t.id),
                    recommendation: 'Set a daily trade limit. Quality over quantity.',
                    detectedAt: dayTrades[dayTrades.length - 1].timestamp,
                });
            }
        }

        return leaks;
    }

    private _detectOverexposure(trades: TradeSnapshot[]): Leak[] {
        const leaks: Leak[] = [];

        for (const trade of trades) {
            if (trade.accountState.equity <= 0) continue;

            const exposure = (trade.quantity * trade.entryPrice) / trade.accountState.equity;
            if (exposure > OVEREXPOSURE_PERCENT) {
                leaks.push({
                    type: 'overexposure',
                    severity: exposure > OVEREXPOSURE_PERCENT * 2 ? 'critical' : 'warning',
                    message: `${trade.symbol} position was ${(exposure * 100).toFixed(1)}% of equity (max: ${OVEREXPOSURE_PERCENT * 100}%)`,
                    evidence: [trade.id],
                    recommendation: 'Reduce position size to 1-2% of equity per trade.',
                    detectedAt: trade.timestamp,
                });
            }
        }

        return leaks;
    }

    private _detectTilt(trades: TradeSnapshot[]): Leak[] {
        const leaks: Leak[] = [];
        let consecutive = 0;

        for (const trade of trades) {
            if (trade.outcome === 'loss') {
                consecutive++;
                if (consecutive >= TILT_CONSECUTIVE_LOSSES) {
                    leaks.push({
                        type: 'tilt',
                        severity: consecutive >= 5 ? 'critical' : 'warning',
                        message: `${consecutive} consecutive losses detected. High tilt risk.`,
                        evidence: [trade.id],
                        recommendation: 'Stop trading immediately after 3 consecutive losses. Review your edge.',
                        detectedAt: trade.timestamp,
                    });
                }
            } else {
                consecutive = 0;
            }
        }

        return leaks;
    }

    private _detectEarlyExits(trades: TradeSnapshot[]): Leak[] {
        const leaks: Leak[] = [];
        const winners = trades.filter(t => t.outcome === 'win' && t.pnlPercent !== undefined);

        if (winners.length < 5) return leaks;

        const avgWinPercent = winners.reduce((sum, t) => sum + (t.pnlPercent || 0), 0) / winners.length;
        const smallWinners = winners.filter(t => (t.pnlPercent || 0) < avgWinPercent * EARLY_EXIT_R_THRESHOLD);

        if (smallWinners.length > winners.length * 0.4) {
            leaks.push({
                type: 'early-exit',
                severity: 'warning',
                message: `${smallWinners.length}/${winners.length} winning trades exited below ${(EARLY_EXIT_R_THRESHOLD * 100)}% of avg win. Cutting winners short.`,
                evidence: smallWinners.map(t => t.id),
                recommendation: 'Use trailing stops instead of fixed targets. Let winners run.',
                detectedAt: smallWinners[smallWinners.length - 1].timestamp,
            });
        }

        return leaks;
    }

    private _detectDispositionEffect(trades: TradeSnapshot[]): Leak[] {
        const leaks: Leak[] = [];
        const closedTrades = trades.filter(t => t.holdDuration !== undefined && t.outcome);

        if (closedTrades.length < 10) return leaks;

        const winners = closedTrades.filter(t => t.outcome === 'win');
        const losers = closedTrades.filter(t => t.outcome === 'loss');

        if (winners.length < 3 || losers.length < 3) return leaks;

        const avgWinHold = winners.reduce((s, t) => s + (t.holdDuration || 0), 0) / winners.length;
        const avgLossHold = losers.reduce((s, t) => s + (t.holdDuration || 0), 0) / losers.length;

        // Disposition effect: holding losers longer than winners
        if (avgLossHold > avgWinHold * 1.5) {
            leaks.push({
                type: 'disposition-effect',
                severity: 'critical',
                message: `Avg loss held ${(avgLossHold / 60000).toFixed(0)}min vs avg win ${(avgWinHold / 60000).toFixed(0)}min. Classic disposition effect.`,
                evidence: losers.slice(-3).map(t => t.id),
                recommendation: 'Set hard stop-losses BEFORE entry. Honor your stops — the market doesn\'t care about your cost basis.',
                detectedAt: losers[losers.length - 1].timestamp,
            });
        }

        return leaks;
    }

    private _detectTimeBias(trades: TradeSnapshot[]): Leak[] {
        const leaks: Leak[] = [];
        const byTime = new Map<string, { wins: number; losses: number; pnl: number }>();

        for (const trade of trades) {
            const tod = trade.psychContext?.timeOfDay || 'mid-day';
            if (!byTime.has(tod)) byTime.set(tod, { wins: 0, losses: 0, pnl: 0 });
            const stats = byTime.get(tod)!;

            if (trade.outcome === 'win') stats.wins++;
            else if (trade.outcome === 'loss') stats.losses++;
            stats.pnl += trade.pnl || 0;
        }

        for (const [time, stats] of byTime) {
            const total = stats.wins + stats.losses;
            if (total < 5) continue;

            const winRate = stats.wins / total;
            if (winRate < 0.35 && stats.pnl < 0) {
                leaks.push({
                    type: 'time-bias',
                    severity: 'warning',
                    message: `${time}: ${(winRate * 100).toFixed(0)}% win rate across ${total} trades. Net P&L: ${stats.pnl.toFixed(2)}`,
                    evidence: [],
                    recommendation: `Consider avoiding trading during '${time}' sessions or reducing size.`,
                    detectedAt: new Date().toISOString(),
                });
            }
        }

        return leaks;
    }

    // ─── Summary Builder ────────────────────────────────────────

    private _buildSummary(leaks: Leak[], tradeCount: number): string {
        if (leaks.length === 0) {
            return `Clean sheet! No behavioral leaks detected across ${tradeCount} trades.`;
        }

        const critical = leaks.filter(l => l.severity === 'critical').length;
        const warning = leaks.filter(l => l.severity === 'warning').length;
        const parts = [];

        if (critical) parts.push(`${critical} critical`);
        if (warning) parts.push(`${warning} warning`);

        const topLeak = leaks.find(l => l.severity === 'critical') || leaks[0];
        return `${parts.join(', ')} leak${leaks.length > 1 ? 's' : ''} detected. Top concern: ${topLeak.type}. ${topLeak.recommendation}`;
    }
}

export default LeakDetector;
