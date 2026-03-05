// ═══════════════════════════════════════════════════════════════════
// charEdge — Dashboard Page (Orchestrator)
//
// Slim orchestrator: state hooks, computed memos, layout routing.
// Layout rendering delegated to:
//   - DashboardNarrativeLayout  (story-driven UI)
//   - DashboardCustomLayout     (drag-and-drop widget grid)
//
// Sub-components live in DashboardPrimitives.jsx.
// ═══════════════════════════════════════════════════════════════════

import s from './DashboardPanel.module.css';
import { useLayoutStore } from '../../../state/useLayoutStore.js';
import { useGamificationStore } from '../../../state/useGamificationStore.js';
import { useMemo, useState } from 'react';
import { useUIStore } from '../../../state/useUIStore.js';
import { DashboardEmptyState } from '../ui/EmptyState.jsx';
import { DashboardSkeleton } from '../ui/WidgetSkeleton.jsx';
import { safeSum } from '../../../charting_library/model/Money.js';
import { useBreakpoints } from '../../../utils/useMediaQuery.js';
import { DashHeader } from './DashboardPrimitives.jsx';
import DashboardNarrativeLayout from './DashboardNarrativeLayout.jsx';
import DashboardCustomLayout from './DashboardCustomLayout.jsx';

export default function DashboardPanel({ trades, result, computing, onDashboardFilter }) {
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

  const [layoutMode, setLayoutMode] = useState('narrative');

  // ─── Computed Stats ──────────────────────────────────────────

  const todayStats = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const todayTrades = trades.filter((t) => t.date && t.date.startsWith(today));
    const pnl = safeSum(todayTrades.map((t) => t.pnl || 0));
    const wins = todayTrades.filter((t) => (t.pnl || 0) > 0).length;

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    const yesterdayTrades = trades.filter((t) => t.date && t.date.startsWith(yesterdayStr));
    const yesterdayPnl = yesterdayTrades.length > 0 ? safeSum(yesterdayTrades.map((t) => t.pnl || 0)) : null;

    const recentDailyPnl = [];
    for (let d = 6; d >= 0; d--) {
      const dt = new Date(now);
      dt.setDate(dt.getDate() - d);
      const dtStr = dt.toISOString().slice(0, 10);
      const dayTrades = trades.filter((t) => t.date && t.date.startsWith(dtStr));
      recentDailyPnl.push(dayTrades.length > 0 ? safeSum(dayTrades.map((t) => t.pnl || 0)) : 0);
    }

    return {
      pnl, count: todayTrades.length, wins,
      winRate: todayTrades.length > 0 ? Math.round((wins / todayTrades.length) * 100) : 0,
      yesterdayPnl, recentDailyPnl,
    };
  }, [trades]);

  const ribbonStats = useMemo(() => {
    if (!trades.length) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekPnl = safeSum(trades.filter((t) => t.date && new Date(t.date) >= weekStart).map((t) => t.pnl || 0));
    const monthPnl = safeSum(trades.filter((t) => t.date && new Date(t.date) >= new Date(today.getFullYear(), today.getMonth(), 1)).map((t) => t.pnl || 0));
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
    let streak = 0, streakType = null;
    for (const dk of [...dayMap.keys()].sort((a, b) => b.localeCompare(a))) {
      const dayPnl = safeSum(dayMap.get(dk).map((t) => t.pnl || 0));
      const isWin = dayPnl > 0;
      if (streakType === null) { streakType = isWin ? 'win' : 'loss'; streak = 1; }
      else if ((isWin && streakType === 'win') || (!isWin && streakType === 'loss')) streak++;
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
      <div className={`${s.page} ${isMobile ? s.pageMobile : s.pageDesktop}`}>
        <DashHeader
          trades={trades} computing={computing}
          layoutMode={layoutMode}
          onLayoutToggle={() => setLayoutMode((m) => (m === 'narrative' ? 'custom' : 'narrative'))}
          editMode={editMode} onToggleEdit={toggleEditMode}
          onCustomize={() => { }} activePreset={activePreset}
        />
        {computing ? (
          <DashboardSkeleton isMobile={isMobile} />
        ) : trades.length === 0 ? (
          <DashboardEmptyState onGoToJournal={() => setPage('journal')} />
        ) : (
          <DashboardSkeleton isMobile={isMobile} />
        )}
      </div>
    );
  }

  // ─── Layout Routing ─────────────────────────────────────────

  if (layoutMode === 'narrative') {
    return (
      <DashboardNarrativeLayout
        trades={trades} result={result} computing={computing}
        todayStats={todayStats} ribbonStats={ribbonStats} recentTrades={recentTrades}
        isMobile={isMobile} setPage={setPage}
        activeWidgets={activeWidgets} activePreset={activePreset}
        onDashboardFilter={onDashboardFilter}
        onLayoutToggle={() => setLayoutMode((m) => (m === 'narrative' ? 'custom' : 'narrative'))}
        editMode={editMode}
        onToggleEdit={toggleEditMode}
      />
    );
  }

  return (
    <DashboardCustomLayout
      trades={trades} result={result} computing={computing}
      todayStats={todayStats} recentTrades={recentTrades}
      goals={goals} isMobile={isMobile} isTablet={isTablet}
      setPage={setPage} activeWidgets={activeWidgets}
      setActiveWidgets={setActiveWidgets} activePreset={activePreset}
      editMode={editMode} toggleEditMode={toggleEditMode} applyPreset={applyPreset}
    />
  );
}
