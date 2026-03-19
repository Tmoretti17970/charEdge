// ═══════════════════════════════════════════════════════════════════
// charEdge — Dashboard Page (Orchestrator)
//
// Slim orchestrator: state hooks, computed memos, layout routing.
// Layout rendering delegated to:
//   - DashboardNarrativeLayout  (story-driven UI)
//   - (CustomLayout removed — Sprint 24)
//
// Sub-components live in DashboardPrimitives.jsx.
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { safeSum } from '../../../charting_library/model/Money.js';
import { useTodayStats } from '../../../hooks/useTodayStats';
import { useGamificationStore } from '../../../state/useGamificationStore';
import { useLayoutStore } from '../../../state/useLayoutStore';
import { useUIStore } from '../../../state/useUIStore';
import { DashboardEmptyState } from '../ui/EmptyState.jsx';
import { DashboardSkeleton } from '../ui/WidgetSkeleton.jsx';
import DashboardNarrativeLayout from './DashboardNarrativeLayout.jsx';
import s from './DashboardPanel.module.css';
import { DashHeader } from './DashboardPrimitives.jsx';
import { useBreakpoints } from '@/hooks/useMediaQuery';

export default function DashboardPanel({ trades, result, computing, onDashboardFilter: _onDashboardFilter }) {
  const setPage = useUIStore((s) => s.setPage);
  const goals = useGamificationStore((s) => s.goals);
  const { isMobile, isTablet } = useBreakpoints();

  // Dashboard layout store
  const activeWidgets = useLayoutStore((s) => s.activeWidgets);
  const activePreset = useLayoutStore((s) => s.activePreset);
  const editMode = useLayoutStore((s) => s.editMode);
  const setActiveWidgets = useLayoutStore((s) => s.setActiveWidgets);
  const applyPreset = useLayoutStore((s) => s.applyPreset);
  const toggleEditMode = useLayoutStore((s) => s.toggleEditMode);


  // ─── Computed Stats ──────────────────────────────────────────

  const todayStats = useTodayStats();

  const ribbonStats = useMemo(() => {
    if (!trades.length) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekPnl = safeSum(trades.filter((t) => t.date && new Date(t.date) >= weekStart).map((t) => t.pnl || 0));
    const monthPnl = safeSum(
      trades
        .filter((t) => t.date && new Date(t.date) >= new Date(today.getFullYear(), today.getMonth(), 1))
        .map((t) => t.pnl || 0),
    );
    const totalPnl = safeSum(trades.map((t) => t.pnl || 0));
    const wins = trades.filter((t) => (t.pnl || 0) > 0).length;
    const winRate = trades.length > 0 ? Math.round((wins / trades.length) * 100) : 0;

    const sorted = [...trades].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    const dayMap = new Map();
    for (const t of sorted) {
      if (!t.date) continue;
      const dayKey = new Date(t.date).toISOString().slice(0, 10);
      if (!dayMap.has(dayKey)) dayMap.set(dayKey, []);
      dayMap.get(dayKey).push(t);
    }
    let streak = 0,
      streakType = null;
    for (const dk of [...dayMap.keys()].sort((a, b) => b.localeCompare(a))) {
      const dayPnl = safeSum(dayMap.get(dk).map((t) => t.pnl || 0));
      const isWin = dayPnl > 0;
      if (streakType === null) {
        streakType = isWin ? 'win' : 'loss';
        streak = 1;
      } else if ((isWin && streakType === 'win') || (!isWin && streakType === 'loss')) streak++;
      else break;
    }

    return { weekPnl, monthPnl, totalPnl, winRate, streak, streakType };
  }, [trades]);

  const recentTrades = useMemo(
    () => [...trades].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 5),
    [trades],
  );

  // ─── Loading / Empty ────────────────────────────────────────

  if (!result) {
    return (
      <div data-container="dashboard" className={`${s.page} ${isMobile ? s.pageMobile : s.pageDesktop}`}>
        <DashHeader
          trades={trades}
        />
        {computing ? (
          <DashboardSkeleton isMobile={isMobile} />
        ) : trades.length === 0 ? (
          <DashboardEmptyState
            onGoToJournal={() => window.dispatchEvent(new CustomEvent('tf:openTradeForm'))}
            onImportTrades={() => {
              useUIStore.getState().openSettings();
              // Small delay so panel is open before navigating to Data tab
              setTimeout(() => window.dispatchEvent(new CustomEvent('tf:openSettingsImport')), 100);
            }}
          />
        ) : (
          <DashboardSkeleton isMobile={isMobile} />
        )}
      </div>
    );
  }

  // ─── Layout Routing ─────────────────────────────────────────

  return (
    <DashboardNarrativeLayout
      trades={trades}
      result={result}
      computing={computing}
      todayStats={todayStats}
      ribbonStats={ribbonStats}
      recentTrades={recentTrades}
      isMobile={isMobile}
      setPage={setPage}
      activeWidgets={activeWidgets}
      activePreset={activePreset}
    />
  );
}
