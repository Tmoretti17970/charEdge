// ═══════════════════════════════════════════════════════════════════
// charEdge — useTodayStats (C3: Shared P&L source of truth)
//
// Single computation path for "today's stats" used by both
// SidebarPnL and DashboardPanel. Eliminates divergence between
// ISO-string matching and Date.setHours() timestamp approaches.
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { safeSum } from '../charting_library/model/Money.js';
import { useJournalStore } from '../state/useJournalStore';

/**
 * Shared hook for today's trading stats.
 * Uses local-time date string matching (ISO `YYYY-MM-DD` prefix).
 */
export function useTodayStats() {
  const trades = useJournalStore((s) => s.trades);

  return useMemo(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const todayTrades = trades.filter((t) => t.date && t.date.startsWith(today));
    const pnl = safeSum(todayTrades.map((t) => t.pnl || 0));
    const wins = todayTrades.filter((t) => (t.pnl || 0) > 0).length;
    const losses = todayTrades.filter((t) => (t.pnl || 0) < 0).length;
    const count = todayTrades.length;

    // Yesterday comparison
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    const yesterdayTrades = trades.filter((t) => t.date && t.date.startsWith(yesterdayStr));
    const yesterdayPnl = yesterdayTrades.length > 0 ? safeSum(yesterdayTrades.map((t) => t.pnl || 0)) : null;

    // 7-day sparkline
    const recentDailyPnl = [];
    for (let d = 6; d >= 0; d--) {
      const dt = new Date(now);
      dt.setDate(dt.getDate() - d);
      const dtStr = dt.toISOString().slice(0, 10);
      const dayTrades = trades.filter((t) => t.date && t.date.startsWith(dtStr));
      recentDailyPnl.push(dayTrades.length > 0 ? safeSum(dayTrades.map((t) => t.pnl || 0)) : 0);
    }

    return {
      pnl,
      count,
      wins,
      losses,
      winRate: count > 0 ? Math.round((wins / count) * 100) : 0,
      yesterdayPnl,
      recentDailyPnl,
    };
  }, [trades]);
}
