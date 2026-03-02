// ═══════════════════════════════════════════════════════════════════
// charEdge — Dashboard Page (Sprint 3: Narrative Redesign)
//
// Default: Narrative layout that tells a story:
//   1. Hero stat (today's session)
//   2. Your trend (equity curve + key metrics)
//   3. Patterns & habits (calendar + insights)
//   4. Risk check (streaks, drawdown, alerts)
//   5. Recent activity (last 5 trades)
//
// "Custom Layout" toggle restores the widget grid for power users.
// ═══════════════════════════════════════════════════════════════════

import { useLayoutStore } from '../../../state/useLayoutStore.js';
import { useGamificationStore } from '../../../state/useGamificationStore.js';
import { useUserStore } from '../../../state/useUserStore.js';
import { useEffect, useMemo, useState } from 'react';
import { C, F, M, GLASS, DEPTH } from '../../../constants.js';
import { text, layout, space, preset } from '../../../theme/tokens.js';
import { useUIStore } from '../../../state/useUIStore.js';
import { Card, StatCard, AutoGrid, SkeletonRow } from '../ui/UIKit.jsx';
import { DashboardEmptyState, MilestoneBar } from '../ui/EmptyState.jsx';
import { fmtD, timeAgo, METRIC_TIPS } from '../../../utils.js';
import DashboardHero from './DashboardHero.jsx';
import { DashboardSkeleton } from '../ui/WidgetSkeleton.jsx';
import { safeSum } from '../../../charting_library/model/Money.js';
import { useBreakpoints } from '../../../utils/useMediaQuery.js';
import WidgetBoundary from '../ui/WidgetBoundary.jsx';
import WidgetGrid from '../widgets/WidgetGrid.jsx';
import WidgetCustomizer from '../widgets/WidgetCustomizer.jsx';
import {
  StreakWidget,
  RollingMetricsWidget,
  GoalProgressWidget,
  SmartAlertFeedWidget,
  ContextPerformanceWidget,
  DailyDebriefWidget,
  QuickStatsBar,
  WIDGET_REGISTRY,
  DashboardPollWidget,
} from '../widgets/DashboardWidgets.jsx';
import EquityCurveChart from '../widgets/EquityCurveChart.jsx';
import DailyPnlChart from '../widgets/DailyPnlChart.jsx';
import TradeHeatmap from '../widgets/TradeHeatmap.jsx';
import WinRateDonut from '../widgets/WinRateDonut.jsx';
import PropFirmWidget from '../widgets/PropFirmWidget.jsx';
import DailyChallengeCard from '../widgets/DailyChallengeCard.jsx';
import XPActivityFeed from '../widgets/XPActivityFeed.jsx';
import WeeklyChallengeCard from '../widgets/WeeklyChallengeCard.jsx';
import WeeklyReport from './WeeklyReport.jsx';
import PropFirmDashboard from './PropFirmDashboard.jsx';
import SimilarTrades from './SimilarTrades.jsx';
import TradeReplayPanel from './TradeReplayPanel.jsx';
import MorningBriefing from './MorningBriefing.jsx';
import AIInsightCard from './AIInsightCard.jsx';
import SmartActionBar from './SmartActionBar.jsx';
import SessionTimeline from './SessionTimeline.jsx';
import RiskDashboard from './RiskDashboard.jsx';
import HeroTradeSpotlight from './HeroTradeSpotlight.jsx';
import ProgressArc from './ProgressArc.jsx';
import AchievementShowcase from './AchievementShowcase.jsx';
import ContextualInjector from './ContextualInjector.jsx';
import NLQueryBar from './NLQueryBar.jsx';
import PreMarketChecklist from './PreMarketChecklist.jsx';
import StreakCelebration from './StreakCelebration.jsx';
import CommunityPulse from './CommunityPulse.jsx';
import AccountabilityWidget from './AccountabilityWidget.jsx';
import WeeklyDigest from './WeeklyDigest.jsx';
import DashboardCommands from './DashboardCommands.jsx';
import { PersonaTierBanner } from './PersonaLayoutController.jsx';
import BentoCustomizer from './BentoCustomizer.jsx';
import WhatIfPanel from './WhatIfPanel.jsx';
import WidgetSuggestionBanner from '../widgets/WidgetSuggestionBanner.jsx';

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

  const [showCustomizer, setShowCustomizer] = useState(false);
  const [layoutMode, setLayoutMode] = useState('narrative'); // 'narrative' | 'custom'
  const [showAllWidgets, setShowAllWidgets] = useState(false); // Sprint 10: progressive disclosure

  // Today's stats + yesterday for trend indicator + last 7 days for sparkline
  const todayStats = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const todayTrades = trades.filter((t) => t.date && t.date.startsWith(today));
    const pnl = safeSum(todayTrades.map((t) => t.pnl || 0));
    const wins = todayTrades.filter((t) => (t.pnl || 0) > 0).length;

    // Yesterday's P&L for trend arrow
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    const yesterdayTrades = trades.filter((t) => t.date && t.date.startsWith(yesterdayStr));
    const yesterdayPnl = yesterdayTrades.length > 0 ? safeSum(yesterdayTrades.map((t) => t.pnl || 0)) : null;

    // Last 7 days of daily P&L for sparkline
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
      count: todayTrades.length,
      wins,
      winRate: todayTrades.length > 0 ? Math.round((wins / todayTrades.length) * 100) : 0,
      yesterdayPnl,
      recentDailyPnl,
    };
  }, [trades]);

  // Performance Ribbon stats
  const ribbonStats = useMemo(() => {
    if (!trades.length) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Week P&L
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekTrades = trades.filter((t) => t.date && new Date(t.date) >= weekStart);
    const weekPnl = safeSum(weekTrades.map((t) => t.pnl || 0));

    // Month P&L
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthTrades = trades.filter((t) => t.date && new Date(t.date) >= monthStart);
    const monthPnl = safeSum(monthTrades.map((t) => t.pnl || 0));

    // Total P&L
    const totalPnl = safeSum(trades.map((t) => t.pnl || 0));

    // Overall win rate
    const wins = trades.filter((t) => (t.pnl || 0) > 0).length;
    const winRate = trades.length > 0 ? Math.round((wins / trades.length) * 100) : 0;

    // Win streak
    const sorted = [...trades].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    const dayMap = new Map();
    for (const t of sorted) {
      if (!t.date) continue;
      const dayKey = new Date(t.date).toISOString().slice(0, 10);
      if (!dayMap.has(dayKey)) dayMap.set(dayKey, []);
      dayMap.get(dayKey).push(t);
    }
    const dayKeys = [...dayMap.keys()].sort((a, b) => b.localeCompare(a));
    let streak = 0, streakType = null;
    for (const dk of dayKeys) {
      const dayPnl = safeSum(dayMap.get(dk).map((t) => t.pnl || 0));
      const isWin = dayPnl > 0;
      if (streakType === null) { streakType = isWin ? 'win' : 'loss'; streak = 1; }
      else if ((isWin && streakType === 'win') || (!isWin && streakType === 'loss')) streak++;
      else break;
    }

    return { weekPnl, monthPnl, totalPnl, winRate, streak, streakType };
  }, [trades]);

  // Recent trades
  const recentTrades = useMemo(
    () => [...trades].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 5),
    [trades],
  );

  // Loading / empty states — shaped skeletons instead of uniform rectangles
  if (!result) {
    return (
      <div style={{ padding: isMobile ? 16 : 32, maxWidth: 1200, margin: '0 auto' }}>
        <DashHeader
          trades={trades}
          computing={computing}
          layoutMode={layoutMode}
          onLayoutToggle={() => setLayoutMode((m) => (m === 'narrative' ? 'custom' : 'narrative'))}
          editMode={editMode}
          onToggleEdit={toggleEditMode}
          onCustomize={() => setShowCustomizer(true)}
          activePreset={activePreset}
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

  const pagePad = isMobile ? 16 : 32;
  const sectionGap = isMobile ? 20 : 28;

  // ═══════════════════════════════════════════════════════════════
  // NARRATIVE LAYOUT
  // ═══════════════════════════════════════════════════════════════
  if (layoutMode === 'narrative') {
    return (
      <div style={{ padding: pagePad, maxWidth: 1200, margin: '0 auto' }}>
        <DashHeader
          trades={trades}
          computing={computing}
          layoutMode={layoutMode}
          onLayoutToggle={() => setLayoutMode('custom')}
          editMode={false}
          onToggleEdit={toggleEditMode}
          onCustomize={() => setShowCustomizer(true)}
          activePreset={activePreset}
        />

        {/* ═══ PERFORMANCE RIBBON — instant snapshot strip ═══ */}
        {ribbonStats && (
          <div
            style={{
              display: 'flex',
              gap: 6,
              marginBottom: 14,
              overflowX: 'auto',
              scrollbarWidth: 'none',
              WebkitOverflowScrolling: 'touch',
              paddingBottom: 2,
            }}
          >
            {[
              { label: 'Week', value: fmtD(ribbonStats.weekPnl), color: ribbonStats.weekPnl >= 0 ? C.g : C.r },
              { label: 'Month', value: fmtD(ribbonStats.monthPnl), color: ribbonStats.monthPnl >= 0 ? C.g : C.r },
              { label: 'Total', value: fmtD(ribbonStats.totalPnl), color: ribbonStats.totalPnl >= 0 ? C.g : C.r },
              { label: 'Win Rate', value: `${ribbonStats.winRate}%`, color: ribbonStats.winRate >= 50 ? C.g : C.r },
              { label: 'Streak', value: `${ribbonStats.streak}d ${ribbonStats.streakType === 'win' ? '🔥' : '📉'}`, color: ribbonStats.streakType === 'win' ? C.g : C.r },
            ].map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 10px',
                  borderRadius: 8,
                  background: GLASS.subtle,
                  backdropFilter: GLASS.blurSm,
                  WebkitBackdropFilter: GLASS.blurSm,
                  border: GLASS.border,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                <span style={{ ...text.captionSm, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {item.label}
                </span>
                <span style={{ ...text.dataSm, fontWeight: 800, color: item.color }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Milestone progress for early-stage users */}
        {trades.length > 0 && trades.length < 100 && (
          <div style={{ marginBottom: sectionGap }}>
            <MilestoneBar tradeCount={trades.length} />
          </div>
        )}

        {/* Sprint 13: Getting Started onboarding card */}
        {trades.length < 5 && !localStorage.getItem('tf_onboard_dismissed') && (
          <Card
            style={{
              marginBottom: sectionGap,
              padding: '24px 28px',
              background: `linear-gradient(135deg, ${C.sf}, ${C.b}08)`,
              border: `1px solid ${C.b}30`,
              position: 'relative',
            }}
          >
            <button
              className="tf-btn"
              onClick={() => { localStorage.setItem('tf_onboard_dismissed', '1'); window.dispatchEvent(new Event('storage')); }}
              style={{
                position: 'absolute', top: 12, right: 12,
                background: 'none', border: 'none', color: C.t3,
                fontSize: 14, cursor: 'pointer', padding: '2px 6px',
              }}
            >✕</button>
            <div style={{ ...text.h3, fontSize: 15, fontWeight: 800, marginBottom: 4 }}>
              🚀 Getting Started
            </div>
            <div style={{ ...text.bodyXs, marginBottom: 16 }}>
              Build your trading edge in 3 steps
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { icon: '✏️', label: 'Add your first trade', desc: 'Log a trade to start tracking', action: () => window.dispatchEvent(new CustomEvent('tf:openTradeForm')) },
                { icon: '📥', label: 'Import from CSV', desc: 'Bulk import your history', action: () => window.dispatchEvent(new CustomEvent('tf:openCSVImport')) },
                { icon: '📊', label: 'Explore the chart', desc: 'Technical analysis tools', action: () => setPage('charts') },
              ].map((step, i) => (
                <button
                  key={i}
                  className="tf-btn"
                  onClick={step.action}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 16px', background: C.bg2,
                    border: `1px solid ${C.bd}`, borderRadius: 10,
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.b; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.bd; }}
                >
                  <span style={{ fontSize: 22 }}>{step.icon}</span>
                  <div>
                    <div style={{ ...text.bodyXs, fontWeight: 700, color: C.t1 }}>{step.label}</div>
                    <div style={{ ...text.captionSm, marginTop: 1 }}>{step.desc}</div>
                  </div>
                  <span style={{ marginLeft: 'auto', color: C.t3, fontSize: 14 }}>›</span>
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* ═══════════════════════════════════════════════════════════
            Narrative Redesign: Hero → Trend → Patterns → Risk → Activity
           ═══════════════════════════════════════════════════════════ */}

        {/* ═══ SECTION 01: TODAY'S SESSION ═══ */}
        <NarrativeSectionHeader
          step="01"
          label="Today's Session"
          description="Your current trading day at a glance"
        />
        <DashboardHero
          todayPnl={todayStats.pnl}
          todayCount={todayStats.count}
          winRate={todayStats.winRate}
          yesterdayPnl={todayStats.yesterdayPnl}
          recentDailyPnl={todayStats.recentDailyPnl}
          isMobile={isMobile}
        />

        <NarrativeDivider />

        {/* ═══ SECTION 02: YOUR TREND ═══ */}
        <NarrativeSectionHeader
          step="02"
          label="Your Trend"
          description="How your equity has grown over time"
        />

        {/* ═══ BENTO BOX DASHBOARD (Apple-Style) ═══ */}
        <div
          className="tf-bento tf-section-enter"
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)',
            gap: 16,
            gridAutoRows: isMobile ? 'auto' : '140px',
            marginBottom: sectionGap,
          }}
        >
          {/* Equity Curve - full width span */}
          <Card
            className="tf-card-hover"
            style={{
              gridColumn: isMobile ? '1' : 'span 4',
              gridRow: isMobile ? 'auto' : 'span 2',
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              backdropFilter: 'blur(16px)',
            }}
          >
            <div style={{ padding: '20px 24px 0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="tf-section-accent" style={{ marginBottom: 0 }}>Equity Curve</div>
              <div style={{ ...text.dataLg, fontSize: 24, fontWeight: 800, color: result.totalPnl >= 0 ? C.g : C.r }}>
                {fmtD(result.totalPnl)}
              </div>
            </div>
            <div style={{ flex: 1, minHeight: isMobile ? 200 : 0 }}>
              <WidgetBoundary name="Equity Curve" height="100%">
                <EquityCurveChart eq={result.eq} height="100%" />
              </WidgetBoundary>
            </div>
          </Card>

          {/* Row 3 - Small Tiles (Sparklines) with MetricTooltips */}
          <BentoMetricCard label="Profit Factor" value={result.pf === Infinity ? '∞' : result.pf.toFixed(2)} color={result.pf >= 1.5 ? C.g : result.pf >= 1 ? C.y : C.r} data={result.eq.map(d => d.val || d.pnl)} tip={METRIC_TIPS['Profit Factor']} />
          <BentoMetricCard label="Win/Loss Ratio" value={result.rr === Infinity ? '∞' : result.rr.toFixed(2)} color={C.t1} data={trades.map(t => t.pnl || 0)} tip={METRIC_TIPS['Win/Loss Ratio']} />
          <BentoMetricCard label="Max Drawdown" value={`${result.maxDd.toFixed(1)}%`} color={result.maxDd < 10 ? C.g : C.r} data={result.eq.map(d => Math.abs(d.dd || 0))} inverse tip={METRIC_TIPS['Max DD']} />
          <BentoMetricCard label="Expectancy" value={fmtD(result.expectancy)} color={result.expectancy >= 0 ? C.g : C.r} tip={METRIC_TIPS['Expectancy']} />

          {/* Row 4 - Calendar & Activity */}
          <Card className="tf-card-hover tf-section-enter" style={{ gridColumn: isMobile ? '1' : 'span 2', gridRow: isMobile ? 'auto' : 'span 3', padding: 20, overflow: 'hidden' }}>
             <div className="tf-section-accent" style={{ marginBottom: 12 }}>Activity Heatmap</div>
             <WidgetBoundary name="Calendar" height={340}>
                <TradeHeatmap trades={trades} onDayClick={(date, data) => {
                  if (onDashboardFilter) {
                    const dStr = date.toISOString().slice(0, 10);
                    onDashboardFilter({
                      dateRange: 'custom',
                      customDateFrom: dStr,
                      customDateTo: dStr
                    });
                  } else {
                    setPage('journal');
                  }
                }} />
             </WidgetBoundary>
          </Card>

          <Card className="tf-card-hover tf-section-enter" style={{ gridColumn: isMobile ? '1' : 'span 2', gridRow: isMobile ? 'auto' : 'span 3', padding: 0, display: 'flex', flexDirection: 'column' }}>
             <div style={{ padding: '20px 20px 0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <span className="tf-section-accent" style={{ marginBottom: 0 }}>Recent Trades</span>
               <button
                 onClick={() => setPage('journal')}
                 className="tf-link"
                 style={{ background: 'none', border: 'none', fontSize: 11, fontWeight: 600, fontFamily: F, cursor: 'pointer', color: C.b }}
               >
                 View All →
               </button>
             </div>
             <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
               {recentTrades.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '60px 1fr auto' : '70px 1fr auto',
                      gap: 8,
                      padding: '10px 20px',
                      borderBottom: `1px solid ${C.bd}40`,
                      fontSize: 12,
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ fontFamily: M, fontSize: 11, color: C.t3 }} title={t.date}>
                      {timeAgo(t.date)}
                    </div>
                    <div style={{ fontWeight: 700, color: C.t1, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {t.symbol}
                      <span style={{
                        color: t.side === 'long' ? C.g : C.r,
                        background: (t.side === 'long' ? C.g : C.r) + '15',
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: 'uppercase'
                      }}>
                        {t.side}
                      </span>
                    </div>
                    <div
                      style={{
                        fontFamily: M,
                        fontWeight: 700,
                        fontSize: 13,
                        color: (t.pnl || 0) >= 0 ? C.g : C.r,
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums'
                      }}
                    >
                      {fmtD(t.pnl)}
                    </div>
                  </div>
                ))}
                {recentTrades.length === 0 && (
                  <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: C.t3 }}>No trades yet</div>
                )}
             </div>
          </Card>

          {/* Gamification Widgets */}
          <DailyChallengeCard />
          <WeeklyChallengeCard />
          <XPActivityFeed />
        </div>

        <NarrativeDivider />

        {/* ═══ SECTION 03: INSIGHTS & ACTIONS ═══ */}
        <NarrativeSectionHeader
          step="03"
          label="Insights & Actions"
          description="Briefings, suggestions, and your daily checklist"
        />

        {/* ═══ MORNING BRIEFING (Context-aware hero) ═══ */}
        <MorningBriefing />

        {/* Sprint 18: Smart Widget Suggestion */}
        <WidgetSuggestionBanner />

        {/* ═══ PERSONA TIER BANNER (Sprint 16) ═══ */}
        <PersonaTierBanner />

        {/* ═══ DASHBOARD COMMANDS (Sprint 10) ═══ */}
        <DashboardCommands />

        {/* ═══ PRE-MARKET CHECKLIST (Sprint 6) ═══ */}
        <PreMarketChecklist />

        {/* ═══ BENTO CUSTOMIZER OVERLAY (Sprint 17) ═══ */}
        <BentoCustomizer />

        {/* Sprint 10: Advanced widgets behind toggle */}
        {!showAllWidgets ? (
          <button
            onClick={() => setShowAllWidgets(true)}
            className="tf-glass-btn"
            style={{
              width: '100%',
              padding: '14px 0',
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: F,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginBottom: sectionGap,
            }}
          >
            ↓ Show All Widgets
            <span style={{ fontSize: 10, padding: '2px 8px', background: `${C.b}15`, borderRadius: 10, color: C.b }}>+5 more</span>
          </button>
        ) : (
          <>
            {/* ═══ Sprint 4: Secondary widgets in disclosure ═══ */}
            <AIInsightCard />
            <SessionTimeline />
            <RiskDashboard />
            <HeroTradeSpotlight />
            <ProgressArc />
            <AchievementShowcase />
            <StreakCelebration />
            <AccountabilityWidget />
            <ContextualInjector />
            <NLQueryBar />
            <CommunityPulse />
            <WeeklyDigest />

            {/* ═══ P2 DIFFERENTIATORS ═══ */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: sectionGap }}>
              <WeeklyReport />
              <PropFirmDashboard />
            </div>

            {/* Similar Trades — shows matches for the most recent trade */}
            {recentTrades.length > 0 && (
              <div style={{ marginBottom: sectionGap }}>
                <SimilarTrades criteria={recentTrades[0]} />
              </div>
            )}

            {/* Trade Replay — pick a trade to replay on chart */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: sectionGap }}>
              <TradeReplayPanel />
              <WhatIfPanel />
            </div>

            {/* Collapse toggle */}
            <button
              onClick={() => setShowAllWidgets(false)}
              className="tf-btn"
              style={{
                width: '100%',
                padding: '10px 0',
                background: 'transparent',
                border: `1px dashed ${C.bd}`,
                borderRadius: 10,
                color: C.t3,
                fontSize: 12,
                fontFamily: F,
                cursor: 'pointer',
                marginBottom: sectionGap,
                transition: 'all 0.15s',
              }}
            >
              ↑ Show Less
            </button>
          </>
        )}

        {/* Widget Customizer Modal (still available) */}
        <WidgetCustomizer
          isOpen={showCustomizer}
          onClose={() => setShowCustomizer(false)}
          activeWidgets={activeWidgets}
          onUpdateWidgets={setActiveWidgets}
          onApplyPreset={applyPreset}
        />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // CUSTOM LAYOUT (widget grid — original behavior)
  // ═══════════════════════════════════════════════════════════════
  const cols = isMobile ? 1 : isTablet ? 1 : 2;

  const widgetComponents = {
    'stat-cards': (
      <Card style={{ padding: 12 }}>
        <AutoGrid minWidth={isMobile ? 100 : 120} gap={8}>
          <StatCard label="Total P&L" value={fmtD(result.totalPnl)} color={result.totalPnl >= 0 ? C.g : C.r} />
          <StatCard
            label="Today"
            value={fmtD(todayStats.pnl)}
            color={todayStats.pnl >= 0 ? C.g : todayStats.pnl < 0 ? C.r : C.t3}
          />
          <StatCard
            label="Profit Factor"
            value={result.pf === Infinity ? '∞' : result.pf.toFixed(2)}
            color={result.pf >= 1.5 ? C.g : result.pf >= 1 ? C.y : C.r}
          />
          <StatCard label="Expectancy" value={fmtD(result.expectancy)} color={result.expectancy >= 0 ? C.g : C.r} />
          <StatCard
            label="Sharpe"
            value={result.sharpe.toFixed(2)}
            color={result.sharpe >= 1 ? C.g : result.sharpe >= 0 ? C.y : C.r}
          />
          <StatCard
            label="Max DD"
            value={`${result.maxDd.toFixed(1)}%`}
            color={result.maxDd < 10 ? C.g : result.maxDd < 25 ? C.y : C.r}
          />
        </AutoGrid>
      </Card>
    ),
    'win-donut': (
      <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <WidgetBoundary name="Win Rate" height={130}>
          <WinRateDonut wins={result.winCount} losses={result.lossCount} size={130} />
        </WidgetBoundary>
      </Card>
    ),
    'equity-curve': (
      <Card style={{ padding: 16 }}>
        <OldSectionLabel text="Equity Curve" right={`${result.tradeCount} trades`} />
        <WidgetBoundary name="Equity Curve" height={260}>
          <EquityCurveChart eq={result.eq} height={260} />
        </WidgetBoundary>
      </Card>
    ),
    'daily-pnl': (
      <Card style={{ padding: 16 }}>
        <OldSectionLabel text="Daily P&L" />
        <WidgetBoundary name="Daily P&L" height={200}>
          <DailyPnlChart eq={result.eq} height={200} />
        </WidgetBoundary>
      </Card>
    ),
    calendar: (
      <Card style={{ padding: 16 }}>
        <OldSectionLabel text="Calendar" />
        <WidgetBoundary name="Calendar Heatmap" height={180}>
          <TradeHeatmap trades={trades} onDayClick={() => setPage('journal')} />
        </WidgetBoundary>
      </Card>
    ),
    streaks: <StreakWidget trades={trades} />,
    rolling: <RollingMetricsWidget trades={trades} />,
    goals: <GoalProgressWidget trades={trades} goals={goals} />,
    debrief: <DailyDebriefWidget trades={trades} result={result} />,
    alerts: <SmartAlertFeedWidget alerts={[]} />,
    'context-perf': <ContextPerformanceWidget trades={trades} />,
    'prop-firm': (
      <WidgetBoundary name="Prop Firm Tracker">
        <PropFirmWidget />
      </WidgetBoundary>
    ),
    'community-poll': <DashboardPollWidget />,
    'daily-challenge': <DailyChallengeCard />,
    'xp-activity': <XPActivityFeed />,
    'weekly-challenge': <WeeklyChallengeCard />,
    'weekly-report': <WeeklyReport />,
    'prop-firm-dash': <PropFirmDashboard />,
    'similar-trades': recentTrades.length > 0 ? <SimilarTrades criteria={recentTrades[0]} /> : null,
    'trade-replay': <TradeReplayPanel />,
    'recent-trades': (
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '12px 16px',
            borderBottom: `1px solid ${C.bd}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <OldSectionLabel text="Recent Trades" style={{ marginBottom: 0 }} />
          <button
            onClick={() => setPage('journal')}
            className="tf-link"
            style={{
              background: 'none',
              border: 'none',
              fontSize: 11,
              fontWeight: 600,
              fontFamily: F,
              cursor: 'pointer',
            }}
          >
            View all →
          </button>
        </div>
        {recentTrades.map((t) => (
          <div
            key={t.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '70px 60px 1fr auto',
              gap: 8,
              padding: '8px 16px',
              borderBottom: `1px solid ${C.bd}`,
              fontSize: 12,
              alignItems: 'center',
            }}
          >
            <div style={{ fontFamily: M, fontSize: 11, color: C.t3 }} title={t.date}>
              {timeAgo(t.date)}
            </div>
            <div style={{ fontWeight: 700, color: C.t1 }}>{t.symbol}</div>
            <div
              style={{
                color: t.side === 'long' ? C.g : C.r,
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              {t.side}
            </div>
            <div style={{ fontFamily: M, fontWeight: 700, color: (t.pnl || 0) >= 0 ? C.g : C.r, textAlign: 'right' }}>
              {fmtD(t.pnl)}
            </div>
          </div>
        ))}
        {recentTrades.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: C.t3 }}>No trades yet</div>
        )}
      </Card>
    ),
    insights: (
      <Card style={{ padding: 16 }}>
        <OldSectionLabel text="Insights" />
        {result.insights?.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {result.insights.map((ins, i) => (
              <div
                key={i}
                style={{
                  padding: '8px 12px',
                  background: ins.t === 'positive' ? C.g + '0c' : ins.t === 'warning' ? C.y + '0c' : C.b + '0c',
                  borderLeft: `3px solid ${ins.t === 'positive' ? C.g : ins.t === 'warning' ? C.y : C.b}`,
                  borderRadius: '0 6px 6px 0',
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: C.t2,
                }}
              >
                {ins.x}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: C.t3, padding: '20px 0', textAlign: 'center' }}>
            Add more trades to unlock insights
          </div>
        )}
      </Card>
    ),
    'risk-metrics': (
      <Card style={{ padding: 16 }}>
        <OldSectionLabel text="Streaks & Risk" />
        <MetricRow label="Best Streak" value={`${result.best} wins`} color={C.g} />
        <MetricRow label="Worst Streak" value={`${result.worst} losses`} color={C.r} />
        <MetricRow label="Avg Win" value={fmtD(result.avgWin)} color={C.g} />
        <MetricRow label="Avg Loss" value={fmtD(result.avgLoss)} color={C.r} />
        <MetricRow label="Win/Loss Ratio" value={result.rr === Infinity ? '∞' : result.rr.toFixed(2)} color={C.t1} />
        <MetricRow label="Consec. 3+ Losses" value={`${result.consLoss3}x`} color={result.consLoss3 > 3 ? C.r : C.t2} />
      </Card>
    ),
    'advanced-metrics': (
      <Card style={{ padding: 16 }}>
        <OldSectionLabel text="Advanced" />
        <MetricRow
          label="Kelly Criterion"
          value={`${(result.kelly * 100).toFixed(1)}%`}
          color={C.b}
          tip={METRIC_TIPS['Kelly Criterion']}
        />
        <MetricRow
          label="Risk of Ruin"
          value={`${result.ror.toFixed(1)}%`}
          color={result.ror < 5 ? C.g : result.ror < 30 ? C.y : C.r}
          tip={METRIC_TIPS['Risk of Ruin']}
        />
        <MetricRow
          label="Sortino Ratio"
          value={result.sortino.toFixed(2)}
          color={result.sortino >= 1 ? C.g : C.t2}
          tip={METRIC_TIPS['Sortino']}
        />
        <MetricRow label="Total Fees" value={fmtD(result.totalFees)} color={C.y} />
        <MetricRow label="Rule Breaks" value={`${result.ruleBreaks}`} color={result.ruleBreaks > 0 ? C.r : C.g} />
        <MetricRow label="Largest Win" value={fmtD(result.lw)} color={C.g} />
        <MetricRow label="Largest Loss" value={fmtD(result.ll)} color={C.r} />
      </Card>
    ),
  };

  const widgets = activeWidgets
    .filter((id) => widgetComponents[id])
    .map((id) => ({
      id,
      span: WIDGET_REGISTRY[id]?.span || 1,
      component: widgetComponents[id],
    }));

  return (
    <div style={{ padding: pagePad, maxWidth: 1200 }}>
      <DashHeader
        trades={trades}
        computing={computing}
        layoutMode={layoutMode}
        onLayoutToggle={() => setLayoutMode('narrative')}
        editMode={editMode}
        onToggleEdit={toggleEditMode}
        onCustomize={() => setShowCustomizer(true)}
        activePreset={activePreset}
      />

      <QuickStatsBar result={result} todayPnl={todayStats.pnl} todayCount={todayStats.count} />

      <WidgetGrid
        widgets={widgets}
        cols={cols}
        gap={isMobile ? 12 : 16}
        editable={editMode}
        onLayoutChange={(order) => {
          const newOrder = order.map((i) => widgets[i]?.id).filter(Boolean);
          if (newOrder.length === widgets.length) {
            useLayoutStore.getState().setActiveWidgets(newOrder);
          }
        }}
      />

      {editMode && (
        <div
          style={{
            marginTop: 16,
            padding: '12px 16px',
            background: C.b + '10',
            borderRadius: 8,
            border: `1px dashed ${C.b}40`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: 12, color: C.b, fontWeight: 600 }}>Drag widgets to rearrange</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowCustomizer(true)}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: `1px solid ${C.b}40`,
                background: C.b + '15',
                color: C.b,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Add/Remove
            </button>
            <button
              onClick={toggleEditMode}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: 'none',
                background: C.b,
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      <WidgetCustomizer
        isOpen={showCustomizer}
        onClose={() => setShowCustomizer(false)}
        activeWidgets={activeWidgets}
        onUpdateWidgets={setActiveWidgets}
        onApplyPreset={applyPreset}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════

function DashHeader({
  trades,
  computing,
  layoutMode,
  onLayoutToggle,
  editMode,
  onToggleEdit,
  onCustomize,
  _activePreset,
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {trades.length > 0 && (
          <span style={{ ...text.monoXs, fontWeight: 600 }}>
            {trades.length} trades
          </span>
        )}
        <UnitToggle />
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <HeaderBtn label={layoutMode === 'narrative' ? '⊞ Custom' : '☰ Story'} onClick={onLayoutToggle} />
        {layoutMode === 'custom' && (
          <>
            <HeaderBtn label={editMode ? '✓ Done' : 'Edit'} active={editMode} onClick={onToggleEdit} />
            <HeaderBtn label="⚙ Widgets" onClick={onCustomize} />
          </>
        )}
      </div>
    </div>
  );
}

function UnitToggle() {
  const unit = useUserStore((s) => s.unit);
  const cycle = useUserStore((s) => s.cycle);
  const label = unit === 'dollar' ? '$' : unit === 'percent' ? '%' : 'R';

  return (
    <button
      onClick={cycle}
      className="tf-btn"
      title={`Display unit: ${unit} (click to cycle)`}
      style={{
        ...text.monoXs,
        padding: '3px 8px',
        borderRadius: 4,
        border: `1px solid ${C.b}30`,
        background: C.b + '10',
        color: C.b,
        fontWeight: 800,
        cursor: 'pointer',
        transition: 'all 0.15s',
        lineHeight: 1,
      }}
    >
      {label}
    </button>
  );
}

function HeaderBtn({ label, onClick, active }) {
  return (
    <button
      onClick={onClick}
      className="tf-btn"
      style={{
        ...text.label,
        padding: '5px 10px',
        borderRadius: 6,
        border: `1px solid ${active ? C.b : C.bd}`,
        background: active ? C.b + '15' : C.sf,
        color: active ? C.b : C.t2,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

/** Narrative section header with accent left border */
function SectionHeader({ label }) {
  return (
    <div
      className="tf-section-accent"
      style={{
        ...text.label,
        marginBottom: 12,
      }}
    >
      {label}
    </div>
  );
}

/** Narrative section header with step number, label, and description */
function NarrativeSectionHeader({ step, label, description }) {
  return (
    <div
      className="tf-section-enter"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 16,
        paddingLeft: 2,
      }}
    >
      <span
        style={{
          ...text.captionSm,
          fontWeight: 800,
          color: C.b,
          background: C.b + '12',
          padding: '3px 7px',
          borderRadius: 6,
          flexShrink: 0,
        }}
      >
        {step}
      </span>
      <div>
        <div
          style={{
            ...text.h3,
            lineHeight: 1.3,
          }}
        >
          {label}
        </div>
        {description && (
          <div
            style={{
              ...text.caption,
              marginTop: 2,
            }}
          >
            {description}
          </div>
        )}
      </div>
    </div>
  );
}

/** Gradient divider between narrative sections */
function NarrativeDivider() {
  return (
    <div
      className="tf-narrative-divider"
      style={{
        height: 1,
        background: `linear-gradient(90deg, transparent, ${C.bd}60, transparent)`,
        margin: '20px 0 24px',
      }}
    />
  );
}

/** Secondary stat card with tooltip support */
function MetricCard({ label, value, color }) {
  const tip = METRIC_TIPS[label];
  return <StatCard tier="secondary" label={label} value={value} color={color} style={tip ? { cursor: 'help' } : {}} />;
}

/** Legacy section label for custom widget layout */
function OldSectionLabel({ text: label, right, style = {} }) {
  return (
    <div style={{ ...layout.rowBetween, marginBottom: space[2] + 2, ...style }}>
      <div style={preset.sectionLabel}>{label}</div>
      {right && <div style={text.monoXs}>{right}</div>}
    </div>
  );
}

function MetricRow({ label, value, color = C.t1, tip }) {
  return (
    <div style={{ ...preset.metricRow }} title={tip || undefined}>
      <span style={{ ...text.bodySm, display: 'flex', alignItems: 'center', gap: 4 }}>
        {label}
        {tip && (
          <span style={{ fontSize: 10, color: C.t3, cursor: 'help' }} title={tip}>
            ⓘ
          </span>
        )}
      </span>
      <span style={{ ...text.mono, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

/** Apple-style Bento tile with inline sparkline and optional tooltip */
function BentoMetricCard({ label, value, color, data = [], inverse = false, tip }) {
  const [showTip, setShowTip] = useState(false);
  const width = 100;
  const height = 30;
  let sparkline = null;

  const validData = data.filter(d => typeof d === 'number' && !isNaN(d));

  if (validData.length > 2) {
    const min = Math.min(...validData);
    const max = Math.max(...validData);
    const range = max - min || 1;
    const points = validData.map((d, i) => {
      const x = (i / (validData.length - 1)) * width;
      let y = height - ((d - min) / range) * height;
      if (isNaN(y)) y = height;
      return `${x},${y}`;
    }).join(' ');

    sparkline = (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ marginTop: 'auto', opacity: 0.6 }}>
        <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
      </svg>
    );
  } else {
    sparkline = <div style={{ height, marginTop: 'auto' }} />;
  }

  return (
    <Card
      className="tf-glass-card"
      style={{
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        background: GLASS.subtle,
        backdropFilter: GLASS.blurSm,
        WebkitBackdropFilter: GLASS.blurSm,
        position: 'relative',
        cursor: tip ? 'help' : 'default',
      }}
      onMouseEnter={tip ? () => setShowTip(true) : undefined}
      onMouseLeave={tip ? () => setShowTip(false) : undefined}
    >
      <div style={{ ...text.label, fontSize: 10, letterSpacing: '0.08em', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
        {label}
        {tip && <span style={{ fontSize: 9, color: C.t3, opacity: 0.6 }}>ⓘ</span>}
      </div>
      <div style={{ ...text.dataLg, fontSize: 24, fontWeight: 800, color, letterSpacing: '-0.5px' }}>{value}</div>
      {sparkline}

      {/* Metric Tooltip */}
      {tip && showTip && (
        <div
          className="tf-metric-tooltip"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 8,
            padding: '10px 14px',
            background: GLASS.standard,
            backdropFilter: GLASS.blurMd,
            WebkitBackdropFilter: GLASS.blurMd,
            border: GLASS.border,
            borderRadius: 10,
            boxShadow: DEPTH[2],
            zIndex: 50,
            maxWidth: 220,
            minWidth: 160,
            pointerEvents: 'none',
          }}
        >
          <div style={{ ...text.caption, fontWeight: 700, color: C.t1, marginBottom: 4 }}>{label}</div>
          <div style={{ ...text.captionSm, color: C.t2, lineHeight: 1.5 }}>{tip}</div>
          {/* Arrow */}
          <div
            style={{
              position: 'absolute',
              bottom: -4,
              left: '50%',
              transform: 'translateX(-50%) rotate(45deg)',
              width: 8,
              height: 8,
              background: GLASS.standard,
              border: GLASS.border,
              borderTop: 'none',
              borderLeft: 'none',
            }}
          />
        </div>
      )}
    </Card>
  );
}
