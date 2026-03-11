// ═══════════════════════════════════════════════════════════════════
// charEdge — useHomeSummary Hook
//
// Auto-generates a 2-3 sentence trade briefing for the AI Copilot
// popover. Rule-based (no LLM). Reads from useJournalStore +
// useUserStore and computes streak, today's stats, and equity trend.
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useJournalStore } from '../state/useJournalStore';
import { useUserStore } from '../state/useUserStore';

// ─── Helpers ────────────────────────────────────────────────────

function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function startOfWeek(date) {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
}

function computeStreak(trades) {
    if (!trades.length) return { count: 0, type: 'none' };

    // Sort by date descending
    const sorted = [...trades]
        .filter((t) => t.pnl != null)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (!sorted.length) return { count: 0, type: 'none' };

    const firstWin = sorted[0].pnl > 0;
    let count = 0;
    for (const t of sorted) {
        if ((t.pnl > 0) === firstWin) count++;
        else break;
    }
    return { count, type: firstWin ? 'winning' : 'losing' };
}

function pct(val) {
    return (val >= 0 ? '+' : '') + val.toFixed(1) + '%';
}

function fmtCurrency(val) {
    const abs = Math.abs(val);
    if (abs >= 1000) return (val >= 0 ? '+' : '-') + '$' + (abs / 1000).toFixed(1) + 'k';
    return (val >= 0 ? '+' : '-') + '$' + abs.toFixed(0);
}

// ─── Hook ───────────────────────────────────────────────────────

export default function useHomeSummary() {
    const trades = useJournalStore((s) => s.trades);
    const accountSize = useUserStore((s) => s.accountSize) || 0;

    return useMemo(() => {
        const now = new Date();
        const todayStart = startOfDay(now);
        const weekStart = startOfWeek(now);

        // Today's trades
        const todayTrades = trades.filter((t) => t.date && new Date(t.date) >= todayStart);
        const todayTradeCount = todayTrades.length;
        const todayWins = todayTrades.filter((t) => t.pnl > 0).length;
        const todayWinRate = todayTradeCount > 0 ? Math.round((todayWins / todayTradeCount) * 100) : 0;
        const todayPnl = todayTrades.reduce((s, t) => s + (t.pnl || 0), 0);

        // Week trades
        const weekTrades = trades.filter((t) => t.date && new Date(t.date) >= weekStart);
        const weekPnl = weekTrades.reduce((s, t) => s + (t.pnl || 0), 0);
        const weekTradeCount = weekTrades.length;
        const weekWins = weekTrades.filter((t) => t.pnl > 0).length;
        const weekWinRate = weekTradeCount > 0 ? Math.round((weekWins / weekTradeCount) * 100) : 0;
        const weekTrend = accountSize > 0
            ? parseFloat(((weekPnl / accountSize) * 100).toFixed(1))
            : 0;

        // Best / worst trade this week
        const weekWithPnl = weekTrades.filter((t) => t.pnl != null);
        const bestTradeThisWeek = weekWithPnl.length
            ? weekWithPnl.reduce((best, t) => (t.pnl > best.pnl ? t : best), weekWithPnl[0])
            : null;
        const worstTradeThisWeek = weekWithPnl.length
            ? weekWithPnl.reduce((worst, t) => (t.pnl < worst.pnl ? t : worst), weekWithPnl[0])
            : null;

        // Averages
        const allWins = trades.filter((t) => t.pnl > 0);
        const allLosses = trades.filter((t) => t.pnl < 0);
        const avgWin = allWins.length ? allWins.reduce((s, t) => s + t.pnl, 0) / allWins.length : 0;
        const avgLoss = allLosses.length ? allLosses.reduce((s, t) => s + t.pnl, 0) / allLosses.length : 0;

        // Streak
        const streak = computeStreak(trades);

        // Total equity
        const totalPnl = trades.reduce((s, t) => s + (t.pnl || 0), 0);
        const equity = accountSize > 0 ? accountSize + totalPnl : totalPnl;

        // Risk level
        const dailyLossLimit = 500; // sensible default
        const todayLoss = Math.abs(Math.min(0, todayPnl));
        const riskPct = dailyLossLimit > 0 ? Math.round((todayLoss / dailyLossLimit) * 100) : 0;
        const riskLevel = riskPct >= 75 ? 'HIGH' : riskPct >= 40 ? 'MEDIUM' : 'LOW';

        // ─── Generate briefing ──────────────────────────────────────
        let briefing;

        if (!trades.length) {
            briefing = "Welcome to charEdge! You haven't logged any trades yet. Hit \"+ Add Trade\" to start tracking your edge.";
        } else if (todayTradeCount === 0) {
            // No trades today — talk about overall
            const parts = [];
            if (streak.count >= 2) {
                parts.push(`You're on a ${streak.count}-trade ${streak.type} streak`);
            }
            if (weekPnl !== 0) {
                parts.push(`your equity is ${weekPnl >= 0 ? 'up' : 'down'} ${pct(Math.abs(weekTrend))} this week`);
            }
            if (parts.length) {
                briefing = parts.join(' and ') + '. No trades logged today — ready to find your edge?';
                briefing = briefing.charAt(0).toUpperCase() + briefing.slice(1);
            } else {
                briefing = `You have ${trades.length} total trades logged. No activity today yet.`;
            }
        } else {
            // Today has trades
            const parts = [];
            parts.push(`You've taken ${todayTradeCount} trade${todayTradeCount !== 1 ? 's' : ''} today with a ${todayWinRate}% win rate`);
            if (todayPnl !== 0) {
                parts.push(`today's P&L is ${fmtCurrency(todayPnl)}`);
            }
            if (weekTrend !== 0) {
                parts.push(`equity is ${weekTrend >= 0 ? 'trending up' : 'down'} ${pct(Math.abs(weekTrend))} this week`);
            }
            briefing = parts.join('. ') + '.';
            briefing = briefing.charAt(0).toUpperCase() + briefing.slice(1);

            if (streak.count >= 3) {
                briefing += ` 🔥 ${streak.count}-trade ${streak.type} streak!`;
            }
        }

        return {
            briefing,
            todayTradeCount,
            todayWinRate,
            todayPnl,
            weekTrend,
            weekPnl,
            weekTradeCount,
            weekWinRate,
            bestTradeThisWeek,
            worstTradeThisWeek,
            avgWin,
            avgLoss,
            streak,
            riskLevel,
            riskPct,
            equity,
            totalTrades: trades.length,
        };
    }, [trades, accountSize]);
}

export { useHomeSummary };
