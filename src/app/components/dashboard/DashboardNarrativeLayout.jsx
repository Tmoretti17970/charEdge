// ═══════════════════════════════════════════════════════════════════
// charEdge — Dashboard Narrative Layout
//
// Extracted from DashboardPanel.jsx (Sprint 3 decomposition).
// The story-driven layout: Hero → Trend → Insights → Activity.
// ═══════════════════════════════════════════════════════════════════

import { useState, Suspense, lazy } from 'react';
import { C, F, M, GLASS } from '../../../constants.js';
import { useUserStore } from '../../../state/useUserStore';
import { text, radii } from '../../../theme/tokens.js';
import { fmtD, timeAgo, METRIC_TIPS } from '../../../utils.js';
import { MilestoneBar } from '../ui/EmptyState.jsx';
import { Card } from '../ui/UIKit.jsx';
import WidgetBoundary from '../ui/WidgetBoundary.jsx';
import DailyChallengeCard from '../widgets/DailyChallengeCard.jsx';
import EquityCurveChart from '../widgets/EquityCurveChart.jsx';
import TradeHeatmap from '../widgets/TradeHeatmap.jsx';
import WeeklyChallengeCard from '../widgets/WeeklyChallengeCard.jsx';
import WidgetCustomizer from '../widgets/WidgetCustomizer.jsx';
import WidgetSuggestionBanner from '../widgets/WidgetSuggestionBanner.jsx';
import XPActivityFeed from '../widgets/XPActivityFeed.jsx';
// #35: AccountabilityWidget is now lazy-loaded below
// #35: AIInsightCard is now lazy-loaded below
import BentoCustomizer from './BentoCustomizer.jsx';
// #35: ContextualInjector is now lazy-loaded below
import DashboardHero from './DashboardHero.jsx';
import s from './DashboardPanel.module.css';
import { DashHeader, NarrativeSectionHeader, NarrativeDivider, BentoMetricCard } from './DashboardPrimitives.jsx';
// #35: HeroTradeSpotlight is now lazy-loaded below
// HUDBar removed — Hero tile is the authoritative P&L display
import MorningBriefing from './MorningBriefing.jsx';
// #35: NLQueryBar is now lazy-loaded below
import { PersonaTierBanner } from './PersonaLayoutController.jsx';
import PreMarketChecklist from './PreMarketChecklist.jsx';
// #35: ProgressArc is now lazy-loaded below
import RiskDashboard from './RiskDashboard.jsx';
// #35: SessionTimeline, SimilarTrades, StreakCelebration are now lazy-loaded below
// #35: TradeReplayPanel is now lazy-loaded below
// #35: WeeklyDigest is now lazy-loaded below
import WeeklyReport from './WeeklyReport.jsx';
// #35: WhatIfPanel is now lazy-loaded below

// #35: Lazy-loaded advanced widgets with per-widget skeleton loading
const AIInsightCard = lazy(() => import('./AIInsightCard.jsx'));
const SessionTimeline = lazy(() => import('./SessionTimeline.jsx'));
const HeroTradeSpotlight = lazy(() => import('./HeroTradeSpotlight.jsx'));
const ProgressArc = lazy(() => import('./ProgressArc.jsx'));
const AchievementShowcase = lazy(() => import('./AchievementShowcase.jsx'));
const StreakCelebration = lazy(() => import('./StreakCelebration.jsx'));
const AccountabilityWidget = lazy(() => import('./AccountabilityWidget.jsx'));
const ContextualInjector = lazy(() => import('./ContextualInjector.jsx'));
const NLQueryBar = lazy(() => import('./NLQueryBar.jsx'));
const WeeklyDigest = lazy(() => import('./WeeklyDigest.jsx'));
const SimilarTrades = lazy(() => import('./SimilarTrades.jsx'));
const TradeReplayPanel = lazy(() => import('./TradeReplayPanel.jsx'));
const WhatIfPanel_Lazy = lazy(() => import('./WhatIfPanel.jsx'));
const SessionJournalPrompt = lazy(() => import('./SessionJournalPrompt.jsx'));

// #35: Widget skeleton fallback
function WidgetSkeleton({ height = 120 }) {
  return (
    <div
      className="tf-skeleton"
      style={{
        height,
        borderRadius: 12,
        border: `1px solid var(--tf-bd)`,
        marginBottom: 16,
      }}
    />
  );
}

export default function DashboardNarrativeLayout({
  trades,
  result,
  computing,
  todayStats,
  ribbonStats,
  recentTrades,
  isMobile,
  setPage,
  activeWidgets,
  activePreset,
  onLayoutToggle,
  editMode,
  onToggleEdit,
}) {
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [showAllWidgets, setShowAllWidgets] = useState(false);
  const simpleMode = useUserStore((s) => s.simpleMode);
  const sectionGap = isMobile ? 20 : 28;

  // Task 4.9.1.1: AmbientBorder — compute aura color from overall risk (dark mode only)
  const isDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
  const ambientColor = isDark
    ? (result?.totalPnl ?? 0) >= 0
      ? 'rgba(45,212,160,0.08)'
      : 'rgba(242,92,92,0.08)'
    : 'transparent';

  return (
    <div
      className={s.page}
      style={{
        position: 'relative',
        boxShadow: `inset 0 0 80px ${ambientColor}`,
        transition: 'box-shadow 1s ease',
      }}
    >
      <DashHeader
        trades={trades}
        computing={computing}
        layoutMode="narrative"
        onLayoutToggle={onLayoutToggle}
        editMode={editMode || false}
        onToggleEdit={onToggleEdit || (() => {})}
        onCustomize={() => setShowCustomizer(true)}
        activePreset={activePreset}
      />

      {/* ═══ PERFORMANCE RIBBON ═══ */}
      {ribbonStats && (
        <div className={s.ribbon}>
          {[
            { label: 'Week', value: fmtD(ribbonStats.weekPnl), color: ribbonStats.weekPnl >= 0 ? C.g : C.r },
            { label: 'Month', value: fmtD(ribbonStats.monthPnl), color: ribbonStats.monthPnl >= 0 ? C.g : C.r },
            { label: 'Total', value: fmtD(ribbonStats.totalPnl), color: ribbonStats.totalPnl >= 0 ? C.g : C.r },
            { label: 'Win Rate', value: `${ribbonStats.winRate}%`, color: ribbonStats.winRate >= 50 ? C.g : C.r },
            {
              label: 'Streak',
              value: `${ribbonStats.streak}d ${ribbonStats.streakType === 'win' ? '🔥' : '📉'}`,
              color: ribbonStats.streakType === 'win' ? C.g : C.r,
            },
          ].map((item, i) => (
            <div
              key={i}
              className={s.ribbonItem}
              style={{
                background: GLASS.subtle,
                backdropFilter: GLASS.blurSm,
                WebkitBackdropFilter: GLASS.blurSm,
                border: GLASS.border,
              }}
            >
              <span className={s.ribbonLabel} style={text.captionSm}>
                {item.label}
              </span>
              <span className={s.ribbonValue} style={{ ...text.dataSm, color: item.color }}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Getting Started onboarding */}
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
            onClick={() => {
              localStorage.setItem('tf_onboard_dismissed', '1');
              window.dispatchEvent(new Event('storage'));
            }}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              background: 'none',
              border: 'none',
              color: C.t3,
              fontSize: 14,
              cursor: 'pointer',
              padding: '2px 6px',
            }}
          >
            ✕
          </button>
          <div style={{ ...text.h3, fontSize: 15, fontWeight: 800, marginBottom: 4 }}>🚀 Getting Started</div>
          <div style={{ ...text.bodyXs, marginBottom: 16 }}>Build your trading edge in 3 steps</div>
          <div className={s.onboardGridResponsive}>
            {[
              {
                icon: '✏️',
                label: 'Add your first trade',
                desc: 'Log a trade to start tracking',
                action: () => window.dispatchEvent(new CustomEvent('tf:openTradeForm')),
              },
              {
                icon: '📥',
                label: 'Import from CSV',
                desc: 'Bulk import your history',
                action: () => window.dispatchEvent(new CustomEvent('tf:openCSVImport')),
              },
              {
                icon: '📊',
                label: 'Explore the chart',
                desc: 'Technical analysis tools',
                action: () => setPage('charts'),
              },
            ].map((step, i) => (
              <button
                key={i}
                className="tf-btn"
                onClick={step.action}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 16px',
                  background: C.bg2,
                  border: `1px solid ${C.bd}`,
                  borderRadius: radii.md,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = C.b;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = C.bd;
                }}
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

      {/* ═══ SECTION 01: TODAY'S SESSION ═══ */}
      <NarrativeSectionHeader label="Today's Session" description="Your current trading day at a glance" />
      <DashboardHero
        todayPnl={todayStats.pnl}
        todayCount={todayStats.count}
        winRate={todayStats.winRate}
        yesterdayPnl={todayStats.yesterdayPnl}
        recentDailyPnl={todayStats.recentDailyPnl}
        isMobile={isMobile}
      />

      {/* B2: Promoted AI Insight Card — appears after 20+ trades */}
      {trades.length >= 20 && (
        <Suspense fallback={<WidgetSkeleton height={160} />}>
          <AIInsightCard />
        </Suspense>
      )}

      <NarrativeDivider />

      {/* ═══ SECTION 02: YOUR TREND ═══ */}
      <NarrativeSectionHeader label="Your Trend" description="How your equity has grown over time" />

      <div className={`tf-bento tf-section-enter ${s.bentoGridResponsive} ${s.sectionGap}`}>
        {/* Equity Curve */}
        <Card
          className={`tf-card-hover ${s.equitySpan}`}
          style={{
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div
            style={{
              padding: '20px 24px 0 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div className="tf-section-accent" style={{ marginBottom: 0 }}>
              Equity Curve
            </div>
            <div style={{ ...text.dataLg, fontSize: 24, fontWeight: 800, color: result.totalPnl >= 0 ? C.g : C.r }}>
              {fmtD(result.totalPnl)}
            </div>
          </div>
          <div className={s.equityChartWrapResponsive}>
            <WidgetBoundary name="Equity Curve" height="100%">
              <EquityCurveChart eq={result.eq} height="100%" />
            </WidgetBoundary>
          </div>
        </Card>

        {/* Milestone for early-stage users — below the equity curve, not above the fold */}
        {trades.length > 0 && trades.length < 100 && (
          <div style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
            <MilestoneBar tradeCount={trades.length} />
          </div>
        )}

        {/* Bento metric tiles */}
        <BentoMetricCard
          label="Profit Factor"
          value={result.pf === Infinity ? '∞' : result.pf.toFixed(2)}
          color={result.pf >= 1.5 ? C.g : result.pf >= 1 ? C.y : C.r}
          data={result.eq.map((d) => d.val || d.pnl)}
          tip={METRIC_TIPS['Profit Factor']}
        />
        <BentoMetricCard
          label="Win/Loss Ratio"
          value={result.rr === Infinity ? '∞' : result.rr.toFixed(2)}
          color={result.rr >= 1.5 ? C.g : result.rr >= 1 ? C.info : C.r}
          data={trades.map((t) => t.pnl || 0)}
          tip={METRIC_TIPS['Win/Loss Ratio']}
        />
        <BentoMetricCard
          label="Max Drawdown"
          value={`${result.maxDd.toFixed(1)}%`}
          color={result.maxDd < 10 ? C.g : C.r}
          data={result.eq.map((d) => Math.abs(d.dd || 0))}
          inverse
          tip={METRIC_TIPS['Max DD']}
        />
        <BentoMetricCard
          label="Expectancy"
          value={fmtD(result.expectancy)}
          color={result.expectancy >= 0 ? C.g : C.r}
          tip={METRIC_TIPS['Expectancy']}
        />

        {/* Calendar & Activity */}
        <Card className={`tf-card-hover tf-section-enter ${s.wideSpan}`} style={{ padding: 20, overflow: 'hidden' }}>
          <div className="tf-section-accent" style={{ marginBottom: 12 }}>
            Activity Heatmap
          </div>
          <WidgetBoundary name="Calendar" height={340}>
            <TradeHeatmap
              trades={trades}
              onDayClick={(date) => {
                const dStr = date.toISOString().slice(0, 10);
                window.dispatchEvent(new CustomEvent('charEdge:open-logbook', { detail: { date: dStr } }));
              }}
            />
          </WidgetBoundary>
        </Card>

        <Card
          className={`tf-card-hover tf-section-enter ${s.wideSpan}`}
          style={{ padding: 0, display: 'flex', flexDirection: 'column' }}
        >
          <div
            style={{
              padding: '20px 20px 0 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span className="tf-section-accent" style={{ marginBottom: 0 }}>
              Recent Trades
            </span>
            <button
              onClick={() => {
                setPage('journal');
                window.dispatchEvent(new CustomEvent('tf:openLogbook'));
              }}
              className="tf-link"
              style={{
                background: 'none',
                border: 'none',
                fontSize: 11,
                fontWeight: 600,
                fontFamily: F,
                cursor: 'pointer',
                color: C.b,
              }}
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
                <div
                  style={{ fontWeight: 700, color: C.t1, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {t.symbol}
                  <span
                    style={{
                      color: t.side === 'long' ? C.g : C.r,
                      background: (t.side === 'long' ? C.g : C.r) + '15',
                      padding: '2px 6px',
                      borderRadius: radii.xs,
                      fontSize: 9,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  >
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
                    fontVariantNumeric: 'tabular-nums',
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

        {/* B4: Quick Journal prompt — appears after 3+ trades */}
        <Suspense fallback={null}>
          <SessionJournalPrompt tradeCount={todayStats.count} />
        </Suspense>

        {/* Gamification Widgets — gated by simpleMode (B3) */}
        {!simpleMode && (
          <>
            <DailyChallengeCard />
            <WeeklyChallengeCard />
            <XPActivityFeed />
          </>
        )}
      </div>

      <NarrativeDivider />

      {/* ═══ SECTION 03: INSIGHTS & ACTIONS ═══ */}
      <NarrativeSectionHeader
        label="Insights & Actions"
        description="Briefings, suggestions, and your daily checklist"
      />

      <MorningBriefing />
      <WidgetSuggestionBanner />
      <PersonaTierBanner />

      <PreMarketChecklist />
      <BentoCustomizer />

      {/* Task 4.9.1.3: RiskDashboard always-visible — promoted from showAllWidgets gate */}
      <RiskDashboard />

      {/* Advanced widgets progressive disclosure */}
      {!showAllWidgets ? (
        <button
          onClick={() => setShowAllWidgets(true)}
          className="tf-glass-btn"
          style={{
            width: '100%',
            padding: '14px 0',
            borderRadius: radii.md,
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
          <span
            style={{ fontSize: 10, padding: '2px 8px', background: `${C.b}15`, borderRadius: radii.md, color: C.b }}
          >
            +5 more
          </span>
        </button>
      ) : (
        <>
          {/* AIInsightCard removed from here — promoted to Section 01 (B2) */}
          <Suspense fallback={<WidgetSkeleton height={200} />}>
            <SessionTimeline />
          </Suspense>
          <Suspense fallback={<WidgetSkeleton height={140} />}>
            <HeroTradeSpotlight />
          </Suspense>
          <Suspense fallback={<WidgetSkeleton height={140} />}>
            <ProgressArc />
          </Suspense>
          {/* AchievementShowcase + StreakCelebration gated by simpleMode (B3) */}
          {!simpleMode && (
            <>
              <Suspense fallback={<WidgetSkeleton height={140} />}>
                <AchievementShowcase />
              </Suspense>
              <Suspense fallback={<WidgetSkeleton height={100} />}>
                <StreakCelebration />
              </Suspense>
            </>
          )}
          <Suspense fallback={<WidgetSkeleton height={140} />}>
            <AccountabilityWidget />
          </Suspense>
          <Suspense fallback={<WidgetSkeleton height={100} />}>
            <ContextualInjector />
          </Suspense>
          <Suspense fallback={<WidgetSkeleton height={100} />}>
            <NLQueryBar />
          </Suspense>
          <Suspense fallback={<WidgetSkeleton height={140} />}>
            <WeeklyDigest />
          </Suspense>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: 16,
              marginBottom: sectionGap,
            }}
          >
            <WeeklyReport />
          </div>

          {recentTrades.length > 0 && (
            <div style={{ marginBottom: sectionGap }}>
              <Suspense fallback={<WidgetSkeleton height={160} />}>
                <SimilarTrades criteria={recentTrades[0]} />
              </Suspense>
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: 16,
              marginBottom: sectionGap,
            }}
          >
            <Suspense fallback={<WidgetSkeleton height={200} />}>
              <TradeReplayPanel />
            </Suspense>
            <Suspense fallback={<WidgetSkeleton height={200} />}>
              <WhatIfPanel_Lazy />
            </Suspense>
          </div>

          <button
            onClick={() => setShowAllWidgets(false)}
            className="tf-btn"
            style={{
              width: '100%',
              padding: '10px 0',
              background: 'transparent',
              border: `1px dashed ${C.bd}`,
              borderRadius: radii.md,
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

      <WidgetCustomizer
        isOpen={showCustomizer}
        onClose={() => setShowCustomizer(false)}
        activeWidgets={activeWidgets}
        onUpdateWidgets={undefined}
        onApplyPreset={undefined}
      />
    </div>
  );
}
