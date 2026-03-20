// ═══════════════════════════════════════════════════════════════════
// charEdge — Dashboard Narrative Layout
//
// Redesigned: Session Summary Bar → Equity Curve → Metrics Row →
// Watchlist + Recent Trades → Insights → Show More
// ═══════════════════════════════════════════════════════════════════

import { useState, Suspense, lazy } from 'react';
import { C, F } from '../../../constants.js';
import { text, radii, space } from '../../../theme/tokens.js';
import { fmtD, METRIC_TIPS } from '../../../utils.js';
import { Card } from '../ui/UIKit.jsx';
import WidgetBoundary from '../ui/WidgetBoundary.jsx';
import EquityCurveChart from '../widgets/EquityCurveChart.jsx';
import TradeHeatmap from '../widgets/TradeHeatmap.jsx';
import s from './DashboardPanel.module.css';
import { DashHeader } from './DashboardPrimitives.jsx';
import HomeWatchlist from './HomeWatchlist.jsx';
import MorningBriefing from './MorningBriefing.jsx';
import RiskDashboard from './RiskDashboard.jsx';
import SessionSummaryBar from './SessionSummaryBar.jsx';


// Lazy-loaded widgets (Sprint 22: trimmed to 4 useful ones)
const AIInsightCard = lazy(() => import('./AIInsightCard.jsx'));
const SessionTimeline = lazy(() => import('./SessionTimeline.jsx'));

const TradeReplayPanel = lazy(() => import('./TradeReplayPanel.jsx'));
const WhatIfPanel_Lazy = lazy(() => import('./WhatIfPanel.jsx'));

// Phase 6 new features
const IntradayChart = lazy(() => import('./IntradayChart.jsx'));
const StrategyBreakdown = lazy(() => import('./StrategyBreakdown.jsx'));
const AssetBreakdown = lazy(() => import('./AssetBreakdown.jsx'));
const QuickActions = lazy(() => import('./QuickActions.jsx'));
const SessionJournalPrompt = lazy(() => import('./SessionJournalPrompt.jsx'));
const MonteCarloWidget = lazy(() => import('./MonteCarloWidget.jsx'));
const QuestWidget = lazy(() => import('../ui/QuestWidget.jsx'));
const JournalHealthStreak = lazy(() => import('./JournalHealthStreak.jsx'));

// Widget skeleton fallback
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

// Sprint 15: Dashboard narrative section header
function SectionHeader({ emoji, title }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        marginTop: 8,
        paddingLeft: 2,
      }}
    >
      <span style={{ fontSize: 14 }}>{emoji}</span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: C.t3,
          fontFamily: F,
        }}
      >
        {title}
      </span>
      <div style={{ flex: 1, height: 1, background: `${C.bd}30`, marginLeft: 8 }} />
    </div>
  );
}

// ─── Sprint 17: Compact Metrics Row ─────────────────────────────
function MetricsRow({ result, trades }) {
  const pf = result.pf ?? 0;
  const rr = result.rr ?? 0;
  const maxDd = result.maxDd ?? 0;
  const expectancy = result.expectancy ?? 0;
  const metrics = [
    {
      label: 'Profit Factor',
      value: pf === Infinity ? '∞' : pf.toFixed(2),
      color: pf >= 1.5 ? C.g : pf >= 1 ? C.y : C.r,
      tip: METRIC_TIPS['Profit Factor'],
    },
    {
      label: 'Win/Loss',
      value: rr === Infinity ? '∞' : rr.toFixed(2),
      color: rr >= 1.5 ? C.g : rr >= 1 ? C.info : C.r,
      tip: METRIC_TIPS['Win/Loss Ratio'],
    },
    {
      label: 'Max DD',
      value: `${maxDd.toFixed(1)}%`,
      color: maxDd < 10 ? C.g : C.r,
      tip: METRIC_TIPS['Max DD'],
    },
    {
      label: 'Expectancy',
      value: fmtD(expectancy),
      color: expectancy >= 0 ? C.g : C.r,
      tip: METRIC_TIPS['Expectancy'],
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        padding: '12px 20px',
        background: C.sf,
        border: `1px solid ${C.bd}40`,
        borderRadius: radii.lg,
        marginBottom: 20,
        overflow: 'hidden',
      }}
    >
      {metrics.map((m, i) => (
        <div
          key={m.label}
          title={m.tip}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 12px',
            borderRight: i < metrics.length - 1 ? `1px solid ${C.bd}30` : 'none',
            cursor: m.tip ? 'help' : 'default',
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: C.t3,
              whiteSpace: 'nowrap',
            }}
          >
            {m.label}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 13,
              fontWeight: 700,
              color: m.color,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {m.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Sprint 48: Smart Session Tip ──────────────────────────────
function SessionTip({ todayStats, result, sectionGap }) {
  let message = null;
  let emoji = null;

  const riskUsed = result?.riskUsedPct ?? 0;
  const todayWR = todayStats.count > 0 ? (todayStats.wins / todayStats.count) * 100 : 0;
  const consLosses = todayStats.consecutiveLosses ?? 0;

  if (riskUsed > 60) {
    emoji = '⚠️';
    message = `${Math.round(riskUsed)}% of daily risk used — consider taking a break.`;
  } else if (consLosses >= 3) {
    emoji = '🧊';
    message = `${consLosses} consecutive losses — step away and reset.`;
  } else if (todayWR >= 70 && todayStats.count >= 3) {
    emoji = '🔥';
    message = `Strong session (${Math.round(todayWR)}% WR) — lock in profits?`;
  }

  if (!message) return null;

  return (
    <div style={{
      padding: '10px 16px',
      background: `${C.y}08`,
      border: `1px solid ${C.y}20`,
      borderRadius: radii.md,
      fontSize: 12,
      color: C.t2,
      fontWeight: 500,
      marginBottom: sectionGap,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}>
      <span style={{ fontSize: 16 }}>{emoji}</span>
      {message}
    </div>
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
}) {
  const [showAllWidgets, setShowAllWidgets] = useState(false);
  const sectionGap = isMobile ? space[5] : space[9]; // Sprint 28: 20 mobile, 36 desktop

  // AmbientBorder — compute aura color from overall P&L (dark mode only)
  const isDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
  const ambientColor = isDark
    ? (result?.totalPnl ?? 0) >= 0
      ? 'rgba(52,199,89,0.04)'   // Sprint 33: reduced from 0.08
      : 'rgba(255,59,48,0.04)'
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
      <DashHeader trades={trades} />

      {/* ═══ SESSION SUMMARY BAR ═══ */}
      <SessionSummaryBar
        todayPnl={todayStats.pnl}
        todayCount={todayStats.count}
        winRate={todayStats.winRate}
        yesterdayPnl={todayStats.yesterdayPnl}
        recentDailyPnl={todayStats.recentDailyPnl}
        ribbonStats={ribbonStats}
        isMobile={isMobile}
      />

      {/* Sprint 23: Simplified Getting Started — single-line banner */}
      {trades.length < 5 && !localStorage.getItem('tf_onboard_dismissed') && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 20px',
            background: `linear-gradient(135deg, ${C.sf}, ${C.b}08)`,
            border: `1px solid ${C.b}20`,
            borderRadius: radii.lg,
            marginBottom: sectionGap,
          }}
        >
          <span style={{ fontSize: 14 }}>🚀</span>
          <span style={{ fontSize: 12, color: C.t2, flex: 1 }}>
            Welcome to charEdge — Add a trade or Import from CSV to get started
          </span>
          <button
            className="tf-btn"
            onClick={() => window.dispatchEvent(new CustomEvent('tf:openTradeForm'))}
            style={{
              padding: '5px 12px',
              borderRadius: radii.sm,
              fontSize: 11,
              fontWeight: 700,
              background: C.b,
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            + Add Trade
          </button>
          <button
            className="tf-btn"
            onClick={() => window.dispatchEvent(new CustomEvent('tf:openCSVImport'))}
            style={{
              padding: '5px 12px',
              borderRadius: radii.sm,
              fontSize: 11,
              fontWeight: 700,
              background: 'transparent',
              color: C.b,
              border: `1px solid ${C.b}40`,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Import CSV
          </button>
          <button
            className="tf-btn"
            onClick={() => {
              localStorage.setItem('tf_onboard_dismissed', '1');
              window.dispatchEvent(new Event('storage'));
            }}
            style={{
              background: 'none',
              border: 'none',
              color: C.t3,
              fontSize: 12,
              cursor: 'pointer',
              padding: '2px 4px',
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* AI Insight Card — appears after 20+ trades */}
      {trades.length >= 20 && (
        <Suspense fallback={<WidgetSkeleton height={160} />}>
          <AIInsightCard />
        </Suspense>
      )}

      {/* ═══ HERO SECTION: EQUITY CURVE + TRADE HEATMAP ═══ */}
      <SectionHeader emoji="📊" title="Performance Overview" />

      <div className={s.heroRow} style={{ marginBottom: sectionGap }}>
        {/* ═══ EQUITY CURVE ═══ */}
        <Card
          className="tf-card-hover"
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
              padding: '12px 20px 0 20px',
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
          <div className={s.equityChartWrapResponsive} style={{ flex: 1 }}>
            <div style={{ position: 'absolute', inset: 0 }}>
              <WidgetBoundary name="Equity Curve" height="100%">
                <EquityCurveChart eq={result.eq} height="100%" />
              </WidgetBoundary>
            </div>
          </div>
        </Card>

        {/* ═══ TRADE HEATMAP ═══ */}
        <Card
          className="tf-card-hover"
          style={{
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderImage: `linear-gradient(135deg, ${C.b}30, ${C.y}30) 1`,
          }}
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
              Trade Heatmap
            </span>
          </div>
          <div style={{ flex: 1, padding: '10px 16px 16px 16px', minHeight: 220 }}>
            <WidgetBoundary name="Trade Heatmap" height="100%">
              <TradeHeatmap
                trades={trades}
                onDayClick={(date) => {
                  const dStr = date.toISOString().slice(0, 10);
                  window.dispatchEvent(new CustomEvent('charEdge:open-logbook', { detail: { date: dStr } }));
                }}
              />
            </WidgetBoundary>
          </div>
        </Card>
      </div>


      {/* ═══ Sprint 17: COMPACT METRICS ROW ═══ */}
      <MetricsRow result={result} trades={trades} />

      {/* ═══ P&L TIMELINE + BREAKDOWN side by side ═══ */}
      <div className={s.heroRow} style={{ marginBottom: sectionGap, alignItems: 'stretch' }}>
        {trades.length >= 2 && (
          <Suspense fallback={null}>
            <IntradayChart trades={trades} isMobile={isMobile} />
          </Suspense>
        )}
        {trades.length >= 5 && (
          <Suspense fallback={null}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <StrategyBreakdown trades={trades} />
              <AssetBreakdown trades={trades} />
            </div>
          </Suspense>
        )}
      </div>

      {/* ═══ Sprint 48: SMART SESSION RECOMMENDATIONS ═══ */}
      {todayStats && todayStats.count >= 3 && (
        <SessionTip todayStats={todayStats} result={result} sectionGap={sectionGap} />
      )}

      {/* ═══ Sprint 21: QUEST WIDGET ═══ */}
      <Suspense fallback={null}>
        <div style={{ marginBottom: sectionGap }}>
          <QuestWidget />
        </div>
      </Suspense>

      {/* Trade Heatmap moved to heroRow above */}

      {/* ═══ YOUR EDGE section ═══ */}
      <SectionHeader emoji="🎯" title="Your Edge" />

      {/* ═══ Sprint 13: WATCHLIST ═══ */}
      <div style={{ marginBottom: sectionGap }}>
        <HomeWatchlist isMobile={isMobile} />
      </div>



      {/* ═══ GROWTH section ═══ */}
      <SectionHeader emoji="📈" title="Growth" />

      {/* ═══ INSIGHTS + MONTE CARLO side by side ═══ */}
      <div className={s.heroRow} style={{ marginBottom: sectionGap }}>
        <MorningBriefing />

        {trades.length >= 5 ? (
          <Suspense fallback={<WidgetSkeleton height={180} />}>
            <MonteCarloWidget />
          </Suspense>
        ) : <div />}
      </div>

      {/* RiskDashboard always-visible */}
      <RiskDashboard />

      {/* ═══ Sprint 22: Show More — trimmed to 4 useful widgets ═══ */}
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
          ↓ Show More
          <span
            style={{ fontSize: 10, padding: '2px 8px', background: `${C.b}15`, borderRadius: radii.md, color: C.b }}
          >
            +2
          </span>
        </button>
      ) : (
        <>


          <Suspense fallback={<WidgetSkeleton height={200} />}>
            <SessionTimeline />
          </Suspense>



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

      {/* ═══ Sprint 46: QUICK ACTIONS ═══ */}
      {!isMobile && (
        <div style={{ marginTop: sectionGap }}>
          <Suspense fallback={null}>
            <QuickActions isActive />
          </Suspense>
        </div>
      )}
    </div>
  );
}
