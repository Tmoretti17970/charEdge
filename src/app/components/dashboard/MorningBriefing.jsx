// ═══════════════════════════════════════════════════════════════════
// charEdge — Morning Briefing Engine (Sprint 1)
//
// Context-aware hero card that changes based on session phase:
//   Pre-Market  (before 9:30am) → Prep mode: yesterday recap, plans, risk budget
//   Active      (9:30am–4pm)    → Live mode: session stats, deviation warnings
//   Post-Market (after 4pm)     → Review mode: debrief, what went right/wrong
//
// Replaces static DailyPulse with a living, phase-aware command center.
// ═══════════════════════════════════════════════════════════════════

import { useUserStore } from '../../../state/useUserStore.js';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { C, F, M, GLASS, DEPTH } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore.js';
import { useGamificationStore } from '../../../state/useGamificationStore.js';
import { useBreakpoints } from '../../../utils/useMediaQuery.js';
import { fmtD } from '../../../utils.js';
const useDisplayUnitStore = useUserStore; // consolidated into useUserStore
import { Card } from '../ui/UIKit.jsx';

// ─── Session Phase Detection ─────────────────────────────────────

function getSessionPhase() {
  const h = new Date().getHours();
  const m = new Date().getMinutes();
  const decimal = h + m / 60;

  if (decimal < 9.5) return 'pre-market';
  if (decimal < 16) return 'active';
  return 'post-market';
}

function getGreeting(phase) {
  const h = new Date().getHours();
  switch (phase) {
    case 'pre-market':
      if (h < 5) return { text: 'Burning the midnight oil', emoji: '🌙', sub: 'Review yesterday and prep for the session ahead.' };
      return { text: 'Good morning', emoji: '☀️', sub: 'Pre-market prep. Review your playbook before the bell.' };
    case 'active':
      return { text: 'Session Active', emoji: '🔴', sub: 'Markets are open. Execute your plan and manage risk.' };
    case 'post-market':
      if (h >= 21) return { text: 'Night session', emoji: '🌙', sub: 'Markets closed. Time to reflect on today\'s execution.' };
      return { text: 'Session closed', emoji: '🌆', sub: 'Review your execution. What worked? What didn\'t?' };
    default:
      return { text: 'Welcome', emoji: '👋', sub: '' };
  }
}

const PHASE_CONFIG = {
  'pre-market': {
    gradient: () => `linear-gradient(135deg, rgba(232,100,44,0.06), rgba(240,182,78,0.04))`,
    glass: GLASS.standard,
    blur: GLASS.blurMd,
    border: () => `1px solid rgba(232,100,44,0.12)`,
    accent: (c) => c.b,
    label: 'PRE-MARKET',
    labelBg: (c) => `${c.b}15`,
    dot: (c) => c.y,
    orbColor: 'rgba(232,100,44,0.15)',
  },
  active: {
    gradient: () => `linear-gradient(135deg, rgba(45,212,160,0.06), rgba(232,100,44,0.04))`,
    glass: GLASS.standard,
    blur: GLASS.blurMd,
    border: () => `1px solid rgba(45,212,160,0.12)`,
    accent: (c) => c.g,
    label: 'LIVE SESSION',
    labelBg: (c) => `${c.g}15`,
    dot: (c) => c.g,
    orbColor: 'rgba(45,212,160,0.12)',
  },
  'post-market': {
    gradient: () => `linear-gradient(135deg, rgba(192,132,252,0.06), rgba(232,100,44,0.04))`,
    glass: GLASS.standard,
    blur: GLASS.blurMd,
    border: () => `1px solid rgba(192,132,252,0.12)`,
    accent: (c) => c.p,
    label: 'POST-MARKET',
    labelBg: (c) => `${c.p}15`,
    dot: (c) => c.p,
    orbColor: 'rgba(192,132,252,0.12)',
  },
};

// ─── Helpers ─────────────────────────────────────────────────────

function startOfDay(d) {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function daysBetween(a, b) {
  return Math.floor((startOfDay(b) - startOfDay(a)) / 86400000);
}
// Sprint 6.5: Button style for briefing controls
const btnStyle = {
  background: 'none',
  border: 'none',
  color: C.t3,
  fontSize: 14,
  cursor: 'pointer',
  padding: '0 2px',
  opacity: 0.5,
  transition: 'opacity 0.15s',
};

// Sprint 6.3: Tiny inline sparkline (SVG polyline)
function MiniSparkline({ points, width = 60, height = 20 }) {
  if (!points || points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((p - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');
  const lastVal = points[points.length - 1];
  const color = lastVal >= 0 ? C.g : C.r;
  return (
    <svg width={width} height={height} style={{ display: 'block', marginTop: 4, marginLeft: 'auto' }}>
      <polyline
        points={path}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
    </svg>
  );
}

// ─── Component ───────────────────────────────────────────────────

export default function MorningBriefing() {
  const trades = useJournalStore((s) => s.trades);
  const tradePlans = useJournalStore((s) => s.tradePlans) || [];
  const xp = useGamificationStore((s) => s.xp);
  const streakDays = useGamificationStore((s) => s.streakDays) || 0;
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

  // Trader name
  let traderName = '';
  try { traderName = useUserStore.getState()?.profile?.name || ''; } catch { /* noop */ }
  const nameLabel = traderName || 'Trader';

  // Settings
  const dailyLossLimit = useUserStore((s) => s.dailyLossLimit) || 0;
  const accountSize = useUserStore((s) => s.accountSize) || 0;
  const riskPerTrade = useUserStore((s) => s.riskPerTrade) || 0;
  const displayUnit = useDisplayUnitStore((s) => s.unit);

  // Local reactive format function
  const fmtPnl = (val) => {
    if (displayUnit === 'percent') {
      if (accountSize > 0) {
        const pct = (val / accountSize) * 100;
        return (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
      }
      // No account size — show dollar with % label hint
      return fmtD(val);
    }
    if (displayUnit === 'rmultiple') {
      const risk = riskPerTrade > 0 ? riskPerTrade : (accountSize > 0 ? accountSize * 0.01 : 0);
      if (risk > 0) {
        const r = val / risk;
        return (r >= 0 ? '+' : '') + r.toFixed(2) + 'R';
      }
      // No risk data — show dollar with R label hint
      return fmtD(val);
    }
    return fmtD(val);
  };

  // ── Compute stats ──
  const stats = useMemo(() => {
    if (!trades.length) return null;

    const now = new Date();
    const today = startOfDay(now);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const sorted = [...trades].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Group by day
    const dayMap = new Map();
    for (const t of sorted) {
      if (!t.date) continue;
      const dayKey = startOfDay(t.date).getTime();
      if (!dayMap.has(dayKey)) dayMap.set(dayKey, []);
      dayMap.get(dayKey).push(t);
    }

    // Today
    const todayTrades = dayMap.get(today.getTime()) || [];
    const todayPnl = todayTrades.reduce((s, t) => s + (t.pnl || 0), 0);
    const todayWins = todayTrades.filter((t) => (t.pnl || 0) > 0).length;
    const todayWinRate = todayTrades.length > 0 ? Math.round((todayWins / todayTrades.length) * 100) : 0;

    // Today's best and worst
    let todayBest = null, todayWorst = null;
    if (todayTrades.length > 0) {
      todayBest = todayTrades.reduce((best, t) => ((t.pnl || 0) > (best.pnl || 0) ? t : best), todayTrades[0]);
      todayWorst = todayTrades.reduce((worst, t) => ((t.pnl || 0) < (worst.pnl || 0) ? t : worst), todayTrades[0]);
    }

    // Yesterday
    const yestTrades = dayMap.get(yesterday.getTime()) || [];
    const yestPnl = yestTrades.reduce((s, t) => s + (t.pnl || 0), 0);
    const yestWins = yestTrades.filter((t) => (t.pnl || 0) > 0).length;
    const yestWinRate = yestTrades.length > 0 ? Math.round((yestWins / yestTrades.length) * 100) : 0;
    const yestBest = yestTrades.length > 0
      ? yestTrades.reduce((best, t) => ((t.pnl || 0) > (best.pnl || 0) ? t : best), yestTrades[0])
      : null;

    // P&L streak
    const dayKeys = [...dayMap.keys()].sort((a, b) => b - a);
    let streak = 0;
    let streakType = null;
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

    // Consecutive losses today
    let consecLosses = 0;
    for (let i = 0; i < todayTrades.length; i++) {
      const t = todayTrades[todayTrades.length - 1 - i]; // Most recent first
      if ((t.pnl || 0) < 0) consecLosses++;
      else break;
    }

    // Rule breaks today
    const ruleBreaks = todayTrades.filter((t) => t.ruleBreak).length;

    // This week P&L
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

  // Active plans for today
  const activePlans = useMemo(() => {
    return tradePlans.filter((p) => p.status !== 'completed').slice(0, 3);
  }, [tradePlans]);

  const greeting = getGreeting(phase);
  const config = PHASE_CONFIG[phase];

  // ── No-data state ──
  if (!stats) {
    return (
      <div style={{
        padding: '24px 28px',
        borderRadius: 14,
        background: config.glass,
        backdropFilter: config.blur,
        WebkitBackdropFilter: config.blur,
        border: config.border(C),
        boxShadow: `${DEPTH[2]}, ${DEPTH.innerGlow}`,
        marginBottom: 20,
      }}>
        <PhaseIndicator config={config} />
        <div style={{ fontSize: 20, fontWeight: 700, color: C.t1, fontFamily: F, marginTop: 8 }}>
          {greeting.emoji} {greeting.text}, {nameLabel}
        </div>
        <div style={{ fontSize: 13, color: C.t3, marginTop: 6, fontFamily: F }}>
          Log your first trade to unlock your Morning Briefing.
        </div>
      </div>
    );
  }

  // ── Risk budget calculation ──
  const riskUsed = dailyLossLimit > 0 ? Math.min(100, Math.round(Math.abs(Math.min(0, stats.todayPnl)) / dailyLossLimit * 100)) : 0;
  const riskRemaining = dailyLossLimit > 0 ? Math.max(0, dailyLossLimit + Math.min(0, stats.todayPnl)) : null;

  // ── Streak display ──
  const streakEmoji = stats.streakType === 'win'
    ? stats.streak >= 5 ? '🔥🔥' : stats.streak >= 3 ? '🔥' : '✅'
    : stats.streak >= 3 ? '⚠️' : '📉';
  const streakText = stats.streakType === 'win'
    ? `${stats.streak}-day win streak ${streakEmoji}`
    : `${stats.streak}-day losing streak ${streakEmoji}`;

  // Sprint 6.3: Mini sparkline data (last 10 days cumulative P&L)
  const sparklinePoints = useMemo(() => {
    if (!trades.length) return [];
    const now = new Date();
    const days = [];
    for (let i = 9; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayKey = startOfDay(d).getTime();
      const dayTrades = trades.filter(t => t.date && startOfDay(t.date).getTime() === dayKey);
      const dayPnl = dayTrades.reduce((s, t) => s + (t.pnl || 0), 0);
      days.push(dayPnl);
    }
    // Cumulative
    let cum = 0;
    return days.map(d => { cum += d; return cum; });
  }, [trades]);

  // Sprint 6.5: Dismissed state — show a minimal restore link
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
      {/* Ambient gradient orb */}
      <div className="tf-hero-orb" style={{
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
      }} />
      <div style={{
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
      }} />
      {/* Phase indicator + greeting */}
      <div style={{ padding: isMobile ? '16px 20px 12px' : '20px 24px 14px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PhaseIndicator config={config} />
              {/* Sprint 6.5: Refresh + Collapse + Dismiss buttons */}
              <button onClick={refresh} title="Refresh briefing" style={btnStyle}>↻</button>
              <button onClick={() => setCollapsed(c => !c)} title={collapsed ? 'Expand' : 'Collapse'} style={btnStyle}>
                {collapsed ? '▸' : '▾'}
              </button>
              <button onClick={() => setDismissed(true)} title="Dismiss briefing" style={btnStyle}>×</button>
            </div>
            <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.t1, fontFamily: F, marginTop: 8, letterSpacing: '-0.3px' }}>
              {greeting.emoji} {greeting.text}, {nameLabel}
            </div>
            <div style={{ fontSize: 12, color: C.t3, fontFamily: M, marginTop: 4, lineHeight: 1.5 }}>
              {greeting.sub}
            </div>
          </div>

          {/* Session P&L Badge + sparkline */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: C.t3, fontFamily: M, marginBottom: 2, fontWeight: 600, textTransform: 'uppercase' }}>
              {stats.todayCount > 0 ? 'Today' : 'This Week'}
            </div>
            <div style={{
              fontSize: stats.todayCount > 0 ? 28 : 20,
              fontWeight: 800,
              fontFamily: M,
              color: (stats.todayCount > 0 ? stats.todayPnl : stats.weekPnl) >= 0 ? C.g : C.r,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-1px',
              lineHeight: 1,
            }}>
              {fmtPnl(stats.todayCount > 0 ? stats.todayPnl : stats.weekPnl)}
            </div>
            {stats.todayCount > 0 && (
              <div style={{ fontSize: 10, color: C.t3, fontFamily: M, marginTop: 2 }}>
                {stats.todayCount} trade{stats.todayCount !== 1 ? 's' : ''} · {stats.todayWinRate}% WR
              </div>
            )}
            {/* Sprint 6.3: Mini sparkline */}
            {sparklinePoints.length > 1 && <MiniSparkline points={sparklinePoints} />}
          </div>
        </div>
      </div>

      {/* Phase-specific content (collapsible) */}
      {!collapsed && (
      <div style={{
        display: 'flex',
        gap: 0,
        padding: isMobile ? '0 16px 16px' : '0 24px 20px',
        flexWrap: 'wrap',
        position: 'relative',
        zIndex: 1,
      }}>
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

        {phase === 'post-market' && (
          <PostMarketContent
            stats={stats}
            isMobile={isMobile}
            streakText={streakText}
          />
        )}
      </div>
      )}
    </div>
  );
}

// ─── Phase Indicator Pill ────────────────────────────────────────

function PhaseIndicator({ config }) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '3px 10px',
      borderRadius: 100,
      background: config.labelBg(C),
      border: `1px solid ${config.accent(C)}25`,
    }}>
      <div
        className="tf-pulse-dot"
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: config.dot(C),
          boxShadow: `0 0 8px ${config.dot(C)}`,
          animation: 'tf-pulse 2s ease-in-out infinite',
        }}
      />
      <span style={{
        fontSize: 9,
        fontWeight: 800,
        fontFamily: M,
        color: config.accent(C),
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
      }}>
        {config.label}
      </span>
    </div>
  );
}

// ─── Pre-Market Content ──────────────────────────────────────────

function PreMarketContent({ stats, plans, dailyLossLimit, isMobile, streakText }) {
  return (
    <>
      {/* Yesterday Recap */}
      {stats.yestCount > 0 && (
        <BriefingTile
          title="YESTERDAY"
          isMobile={isMobile}
          style={{ marginRight: 10, flex: '1 1 180px' }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 800, fontFamily: M, color: stats.yestPnl >= 0 ? C.g : C.r }}>
              {fmtD(stats.yestPnl)}
            </span>
            <span style={{ fontSize: 10, color: C.t3, fontFamily: M }}>
              {stats.yestCount} trades · {stats.yestWinRate}% WR
            </span>
          </div>
          {stats.yestBest && (
            <div style={{ fontSize: 10, color: C.t2, fontFamily: M, marginTop: 4 }}>
              Best: {stats.yestBest.symbol} {fmtD(stats.yestBest.pnl || 0)}
            </div>
          )}
        </BriefingTile>
      )}

      {/* Active Trade Plans */}
      {plans.length > 0 && (
        <BriefingTile
          title="TODAY'S PLANS"
          isMobile={isMobile}
          style={{ marginRight: 10, flex: '1 1 180px' }}
        >
          {plans.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{
                fontSize: 9,
                fontWeight: 700,
                padding: '1px 5px',
                borderRadius: 3,
                background: (p.bias === 'long' ? C.g : p.bias === 'short' ? C.r : C.b) + '20',
                color: p.bias === 'long' ? C.g : p.bias === 'short' ? C.r : C.b,
              }}>
                {(p.bias || 'N').charAt(0).toUpperCase()}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: M, color: C.t1 }}>
                {p.symbol}
              </span>
              <span style={{ fontSize: 10, color: C.t3, fontFamily: M, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                {p.entryReason || 'No criteria set'}
              </span>
            </div>
          ))}
        </BriefingTile>
      )}

      {/* Risk Budget */}
      {dailyLossLimit > 0 && (
        <BriefingTile
          title="RISK BUDGET"
          isMobile={isMobile}
          style={{ flex: '0 0 auto', minWidth: 120 }}
        >
          <div style={{ fontSize: 16, fontWeight: 800, fontFamily: M, color: C.g }}>
            {fmtD(dailyLossLimit)}
          </div>
          <div style={{ fontSize: 9, color: C.t3, fontFamily: M, marginTop: 2 }}>
            Daily loss limit available
          </div>
        </BriefingTile>
      )}

      {/* Streak */}
      <BriefingTile
        title="STREAK"
        isMobile={isMobile}
        style={{ flex: '0 0 auto', minWidth: 110 }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: M, color: stats.streakType === 'win' ? C.g : C.r }}>
          {streakText}
        </div>
      </BriefingTile>
    </>
  );
}

// ─── Active Session Content ──────────────────────────────────────

function ActiveSessionContent({ stats, riskUsed, riskRemaining, dailyLossLimit, isMobile, streakText }) {
  // Warning state
  const isWarning = stats.consecLosses >= 3 || riskUsed >= 75;
  const isDanger = riskUsed >= 100;

  return (
    <>
      {/* Live Session Stats */}
      <BriefingTile
        title="SESSION STATS"
        isMobile={isMobile}
        style={{ marginRight: 10, flex: '1 1 180px' }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <MiniStat label="Trades" value={stats.todayCount} color={C.t1} />
          <MiniStat label="Win Rate" value={`${stats.todayWinRate}%`} color={stats.todayWinRate >= 50 ? C.g : C.r} />
          <MiniStat label="Streak" value={stats.streakType === 'win' ? `+${stats.streak}` : `-${stats.streak}`} color={stats.streakType === 'win' ? C.g : C.r} />
        </div>
      </BriefingTile>

      {/* Risk Gauge */}
      {dailyLossLimit > 0 && (
        <BriefingTile
          title={isDanger ? '⛔ LIMIT HIT' : isWarning ? '⚠️ RISK ALERT' : 'RISK BUDGET'}
          isMobile={isMobile}
          style={{
            marginRight: 10,
            flex: '0 0 auto',
            minWidth: 140,
            borderColor: isDanger ? C.r + '40' : isWarning ? C.y + '40' : undefined,
          }}
        >
          {/* Progress bar */}
          <div style={{
            width: '100%',
            height: 6,
            background: C.bg2,
            borderRadius: 3,
            overflow: 'hidden',
            marginBottom: 6,
          }}>
            <div style={{
              width: `${Math.min(100, riskUsed)}%`,
              height: '100%',
              background: isDanger ? C.r : riskUsed >= 50 ? C.y : C.g,
              borderRadius: 3,
              transition: 'width 0.3s ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 14, fontWeight: 800, fontFamily: M, color: isDanger ? C.r : riskUsed >= 50 ? C.y : C.g }}>
              {riskRemaining !== null ? fmtD(riskRemaining) : '—'}
            </span>
            <span style={{ fontSize: 9, color: C.t3, fontFamily: M }}>
              {riskUsed}% used
            </span>
          </div>
        </BriefingTile>
      )}

      {/* Consecutive Loss Warning */}
      {stats.consecLosses >= 2 && (
        <BriefingTile
          title="⚡ COOL DOWN"
          isMobile={isMobile}
          style={{
            flex: '0 0 auto',
            minWidth: 130,
            borderColor: C.y + '40',
            background: C.y + '08',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: M, color: C.y }}>
            {stats.consecLosses} consecutive losses
          </div>
          <div style={{ fontSize: 10, color: C.t3, fontFamily: M, marginTop: 2 }}>
            Consider taking a break
          </div>
        </BriefingTile>
      )}

      {/* Today's Best */}
      {stats.todayBest && (stats.todayBest.pnl || 0) > 0 && (
        <BriefingTile
          title="🏆 TODAY'S BEST"
          isMobile={isMobile}
          style={{ flex: '0 0 auto', minWidth: 120 }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: M, color: C.g }}>
            {stats.todayBest.symbol} {fmtD(stats.todayBest.pnl)}
          </div>
        </BriefingTile>
      )}
    </>
  );
}

// ─── Post-Market Content ─────────────────────────────────────────

function PostMarketContent({ stats, isMobile, streakText }) {
  // Calculate session grade
  const grade = stats.todayCount === 0 ? 'No Session'
    : stats.todayWinRate >= 70 ? 'A+'
    : stats.todayWinRate >= 60 ? 'A'
    : stats.todayWinRate >= 50 ? 'B'
    : stats.todayWinRate >= 40 ? 'C'
    : 'D';

  const gradeColor = grade.startsWith('A') ? C.g
    : grade === 'B' ? C.b
    : grade === 'C' ? C.y
    : grade === 'D' ? C.r
    : C.t3;

  return (
    <>
      {/* Session Grade */}
      {stats.todayCount > 0 && (
        <BriefingTile
          title="SESSION GRADE"
          isMobile={isMobile}
          style={{ marginRight: 10, flex: '0 0 auto', minWidth: 100 }}
        >
          <div style={{
            fontSize: 32,
            fontWeight: 900,
            fontFamily: M,
            color: gradeColor,
            lineHeight: 1,
          }}>
            {grade}
          </div>
          <div style={{ fontSize: 9, color: C.t3, fontFamily: M, marginTop: 4 }}>
            {stats.todayWinRate}% win rate
          </div>
        </BriefingTile>
      )}

      {/* Session Summary */}
      <BriefingTile
        title={stats.todayCount > 0 ? 'SESSION SUMMARY' : 'WEEKLY RECAP'}
        isMobile={isMobile}
        style={{ marginRight: 10, flex: '1 1 200px' }}
      >
        {stats.todayCount > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <MiniStat label="P&L" value={fmtD(stats.todayPnl)} color={stats.todayPnl >= 0 ? C.g : C.r} />
            <MiniStat label="Trades" value={stats.todayCount} color={C.t1} />
            <MiniStat label="W/L" value={`${stats.todayWins}/${stats.todayCount - stats.todayWins}`} color={C.t1} />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <MiniStat label="Week P&L" value={fmtD(stats.weekPnl)} color={stats.weekPnl >= 0 ? C.g : C.r} />
            <MiniStat label="Trades" value={stats.weekCount} color={C.t1} />
          </div>
        )}
      </BriefingTile>

      {/* Best / Worst */}
      {stats.todayBest && stats.todayWorst && stats.todayCount > 1 && (
        <BriefingTile
          title="BEST / WORST"
          isMobile={isMobile}
          style={{ marginRight: 10, flex: '0 0 auto', minWidth: 150 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span style={{ color: C.g, fontWeight: 700, fontFamily: M }}>▲</span>
              <span style={{ fontWeight: 700, color: C.t1, fontFamily: M }}>{stats.todayBest.symbol}</span>
              <span style={{ color: C.g, fontFamily: M }}>{fmtD(stats.todayBest.pnl)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span style={{ color: C.r, fontWeight: 700, fontFamily: M }}>▼</span>
              <span style={{ fontWeight: 700, color: C.t1, fontFamily: M }}>{stats.todayWorst.symbol}</span>
              <span style={{ color: C.r, fontFamily: M }}>{fmtD(stats.todayWorst.pnl)}</span>
            </div>
          </div>
        </BriefingTile>
      )}

      {/* Streak */}
      <BriefingTile
        title="STREAK"
        isMobile={isMobile}
        style={{ flex: '0 0 auto', minWidth: 110 }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: M, color: stats.streakType === 'win' ? C.g : C.r }}>
          {streakText}
        </div>
      </BriefingTile>
    </>
  );
}

// ─── Shared Sub-Components ───────────────────────────────────────

function BriefingTile({ title, children, isMobile, style = {} }) {
  return (
    <div style={{
      padding: isMobile ? '8px 12px' : '10px 14px',
      borderRadius: 10,
      background: GLASS.subtle,
      backdropFilter: GLASS.blurSm,
      WebkitBackdropFilter: GLASS.blurSm,
      border: GLASS.border,
      marginBottom: isMobile ? 8 : 0,
      transition: 'border-color 0.15s ease',
      ...style,
    }}>
      <div style={{
        fontSize: 9,
        color: C.t3,
        fontFamily: M,
        fontWeight: 700,
        marginBottom: 4,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: C.t3, fontFamily: M, fontWeight: 600, marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, fontFamily: M, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}
