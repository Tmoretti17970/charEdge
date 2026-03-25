// ═══════════════════════════════════════════════════════════════════
// charEdge — Morning Briefing Engine (Sprint 1)
//
// Context-aware hero card that changes based on session phase:
//   Pre-Market  (before 9:30am) → Prep mode: yesterday recap, plans, risk budget
//   Active      (9:30am–4pm)    → Live mode: session stats, deviation warnings
//   Post-Market (after 4pm)     → Review mode: debrief, what went right/wrong
//
// Decomposed: config in briefing/phaseConfig.js,
// primitives in briefing/BriefingPrimitives.jsx,
// section content in briefing/*Content.jsx
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useState, useEffect, useCallback } from 'react';
import { C, F, M, DEPTH } from '../../../constants.js';
import { useGamificationStore } from '../../../state/useGamificationStore';
import { useJournalStore } from '../../../state/useJournalStore';
import { useUserStore } from '../../../state/useUserStore';
// Decomposed sub-modules
import ActiveSessionContent from './briefing/ActiveSessionContent.jsx';
import { PhaseIndicator, btnStyle } from './briefing/BriefingPrimitives.jsx';
import { getSessionPhase, getGreeting, PHASE_CONFIG, startOfDay } from './briefing/phaseConfig.js';
import PostMarketContent from './briefing/PostMarketContent.jsx';
import PreMarketContent from './briefing/PreMarketContent.jsx';
import { useBreakpoints } from '@/hooks/useMediaQuery';
// ─── Component ───────────────────────────────────────────────────

export default function MorningBriefing() {
  const trades = useJournalStore((s) => s.trades);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tradePlans = useJournalStore((s) => s.tradePlans) || [];
  const _xp = useGamificationStore((s) => s.xp);
  const _streakDays = useGamificationStore((s) => s.streakDays) || 0;
  const { isMobile } = useBreakpoints();

  // Refresh phase every minute
  const [phase, setPhase] = useState(getSessionPhase);
  const [dismissed, setDismissed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => setPhase(getSessionPhase()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const refresh = useCallback(() => {
    setPhase(getSessionPhase());
    setCollapsed(false);
  }, []);

  // Settings
  const dailyLossLimit = useUserStore((s) => s.dailyLossLimit) || 0;

  // ── Compute stats ──
  const stats = useMemo(() => {
    if (!trades.length) return null;

    const now = new Date();
    const today = startOfDay(now);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const sorted = [...trades].sort((a, b) => new Date(b.date) - new Date(a.date));

    const dayMap = new Map();
    for (const t of sorted) {
      if (!t.date) continue;
      const dayKey = startOfDay(t.date).getTime();
      if (!dayMap.has(dayKey)) dayMap.set(dayKey, []);
      dayMap.get(dayKey).push(t);
    }

    const todayTrades = dayMap.get(today.getTime()) || [];
    const todayPnl = todayTrades.reduce((s, t) => s + (t.pnl || 0), 0);
    const todayWins = todayTrades.filter((t) => (t.pnl || 0) > 0).length;
    const todayWinRate = todayTrades.length > 0 ? Math.round((todayWins / todayTrades.length) * 100) : 0;

    let todayBest = null,
      todayWorst = null;
    if (todayTrades.length > 0) {
      todayBest = todayTrades.reduce((best, t) => ((t.pnl || 0) > (best.pnl || 0) ? t : best), todayTrades[0]);
      todayWorst = todayTrades.reduce((worst, t) => ((t.pnl || 0) < (worst.pnl || 0) ? t : worst), todayTrades[0]);
    }

    const yestTrades = dayMap.get(yesterday.getTime()) || [];
    const yestPnl = yestTrades.reduce((s, t) => s + (t.pnl || 0), 0);
    const yestWins = yestTrades.filter((t) => (t.pnl || 0) > 0).length;
    const yestWinRate = yestTrades.length > 0 ? Math.round((yestWins / yestTrades.length) * 100) : 0;
    const yestBest =
      yestTrades.length > 0
        ? yestTrades.reduce((best, t) => ((t.pnl || 0) > (best.pnl || 0) ? t : best), yestTrades[0])
        : null;

    const dayKeys = [...dayMap.keys()].sort((a, b) => b - a);
    let streak = 0,
      streakType = null;
    for (const dayKey of dayKeys) {
      const dayTrades = dayMap.get(dayKey);
      const dayPnl = dayTrades.reduce((s, t) => s + (t.pnl || 0), 0);
      const isWin = dayPnl > 0;
      if (streakType === null) {
        streakType = isWin ? 'win' : 'loss';
        streak = 1;
      } else if ((isWin && streakType === 'win') || (!isWin && streakType === 'loss')) {
        streak++;
      } else break;
    }

    let consecLosses = 0;
    for (let i = 0; i < todayTrades.length; i++) {
      const t = todayTrades[todayTrades.length - 1 - i];
      if ((t.pnl || 0) < 0) consecLosses++;
      else break;
    }

    const ruleBreaks = todayTrades.filter((t) => t.ruleBreak).length;

    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekTrades = trades.filter((t) => t.date && new Date(t.date) >= weekStart);
    const weekPnl = weekTrades.reduce((s, t) => s + (t.pnl || 0), 0);

    return {
      todayTrades,
      todayPnl,
      todayWins,
      todayWinRate,
      todayBest,
      todayWorst,
      todayCount: todayTrades.length,
      yestTrades,
      yestPnl,
      yestWins,
      yestWinRate,
      yestBest,
      yestCount: yestTrades.length,
      streak,
      streakType,
      consecLosses,
      ruleBreaks,
      weekPnl,
      weekCount: weekTrades.length,
      totalTrades: trades.length,
    };
  }, [trades]);

  const activePlans = useMemo(() => tradePlans.filter((p) => p.status !== 'completed').slice(0, 3), [tradePlans]);

  const greeting = getGreeting(phase);
  const config = PHASE_CONFIG[phase];

  // ── Risk/streak derived values ──
  const riskUsed =
    dailyLossLimit > 0 && stats
      ? Math.min(100, Math.round((Math.abs(Math.min(0, stats.todayPnl)) / dailyLossLimit) * 100))
      : 0;
  const riskRemaining = dailyLossLimit > 0 && stats ? Math.max(0, dailyLossLimit + Math.min(0, stats.todayPnl)) : null;
  const streakEmoji =
    stats?.streakType === 'win'
      ? stats.streak >= 5
        ? '🔥🔥'
        : stats.streak >= 3
          ? '🔥'
          : '✅'
      : stats?.streak >= 3
        ? '⚠️'
        : '📉';
  const streakText = stats
    ? stats.streakType === 'win'
      ? `${stats.streak}-day win streak ${streakEmoji}`
      : `${stats.streak}-day losing streak ${streakEmoji}`
    : '';

  // ── No-data state ──
  if (!stats) {
    return (
      <div
        className="tf-container"
        style={{
          padding: '24px 28px',
          borderRadius: 14,
          background: config.glass,
          backdropFilter: config.blur,
          WebkitBackdropFilter: config.blur,
          border: config.border(C),
          boxShadow: `${DEPTH[2]}, ${DEPTH.innerGlow}`,
          marginBottom: 20,
        }}
      >
        <PhaseIndicator config={config} />
        <div style={{ fontSize: 20, fontWeight: 700, color: C.t1, fontFamily: F, marginTop: 8 }}>
          {greeting.emoji} {greeting.text}
        </div>
        <div style={{ fontSize: 13, color: C.t3, marginTop: 6, fontFamily: F }}>
          Log your first trade to unlock your Morning Briefing.
        </div>
      </div>
    );
  }

  // ── Dismissed state ──
  if (dismissed) {
    return (
      <button
        onClick={() => setDismissed(false)}
        style={{
          background: 'none',
          border: 'none',
          color: C.t3,
          fontSize: 11,
          fontFamily: M,
          cursor: 'pointer',
          padding: '4px 0',
          marginBottom: 12,
          opacity: 0.6,
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={(e) => (e.target.style.opacity = 1)}
        onMouseLeave={(e) => (e.target.style.opacity = 0.6)}
      >
        📋 View Morning Briefing
      </button>
    );
  }

  return (
    <div
      className="tf-morning-briefing"
      style={{
        borderRadius: 14,
        background: config.glass,
        backdropFilter: config.blur,
        WebkitBackdropFilter: config.blur,
        border: config.border(C),
        boxShadow: `${DEPTH[2]}, ${DEPTH.innerGlow}`,
        overflow: 'hidden',
        marginBottom: 20,
        position: 'relative',
      }}
    >
      {/* Ambient gradient orbs */}
      <div
        className="tf-hero-orb"
        style={{
          position: 'absolute',
          top: -40,
          right: -20,
          width: 180,
          height: 180,
          borderRadius: '50%',
          background: config.orbColor,
          filter: 'blur(60px)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -30,
          left: -10,
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: config.orbColor,
          filter: 'blur(40px)',
          opacity: 0.5,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Phase indicator + greeting */}
      <div style={{ padding: isMobile ? '16px 20px 12px' : '20px 24px 14px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PhaseIndicator config={config} />
              <button onClick={refresh} title="Refresh briefing" style={btnStyle}>
                ↻
              </button>
              <button
                onClick={() => setCollapsed((c) => !c)}
                title={collapsed ? 'Expand' : 'Collapse'}
                style={btnStyle}
              >
                {collapsed ? '▸' : '▾'}
              </button>
              <button onClick={() => setDismissed(true)} title="Dismiss briefing" style={btnStyle}>
                ×
              </button>
            </div>
            <div
              style={{
                fontSize: isMobile ? 18 : 22,
                fontWeight: 800,
                color: C.t1,
                fontFamily: F,
                marginTop: 8,
                letterSpacing: '-0.3px',
              }}
            >
              {greeting.emoji} {greeting.text}
            </div>
            <div style={{ fontSize: 12, color: C.t3, fontFamily: M, marginTop: 4, lineHeight: 1.5 }}>
              {greeting.sub}
            </div>
          </div>
          {/* Sprint 18: P&L badge + sparkline removed — now in SessionSummaryBar */}
        </div>
      </div>

      {/* Phase-specific content (collapsible) */}
      {!collapsed && (
        <div
          style={{
            display: 'flex',
            gap: 0,
            padding: isMobile ? '0 16px 16px' : '0 24px 20px',
            flexWrap: 'wrap',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {phase === 'pre-market' && (
            <PreMarketContent
              stats={stats}
              plans={activePlans}
              dailyLossLimit={dailyLossLimit}
              isMobile={isMobile}
              streakText={streakText}
            />
          )}
          {phase === 'active' && (
            <ActiveSessionContent
              stats={stats}
              riskUsed={riskUsed}
              riskRemaining={riskRemaining}
              dailyLossLimit={dailyLossLimit}
              isMobile={isMobile}
              streakText={streakText}
            />
          )}
          {phase === 'post-market' && <PostMarketContent stats={stats} isMobile={isMobile} streakText={streakText} />}
        </div>
      )}
    </div>
  );
}
