// ═══════════════════════════════════════════════════════════════════
// charEdge — Insights Page (Redesign)
//
// Intelligence hub with narrative treatment:
//   1. Hero Summary — 4 key metrics at a glance
//   2. Tab Bar — Overview | Strategies | Psychology | Timing | Risk | Playbooks | Plans
//   3. Active Tab Content — delegates to sub-components
//
// Mobile: swaps to MobileAnalytics component.
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useState, Suspense, useMemo } from 'react';
import { C, F, M } from '../constants.js';
import { useJournalStore } from '../state/useJournalStore.js';
import { useAnalyticsStore } from '../state/useAnalyticsStore.js';
import { useUserStore } from '../state/useUserStore.js';
import { useUIStore } from '../state/useUIStore.js';
import { computeAndStore } from '../app/features/analytics/analyticsSingleton.js';
import { Card, SkeletonRow } from '../app/components/ui/UIKit.jsx';
import { InsightsEmptyState } from '../app/components/ui/EmptyState.jsx';
import { useBreakpoints } from '../utils/useMediaQuery.js';
import { fmtD } from '../utils.js';
import { MetricInfo } from '../app/components/ui/MetricInfo.jsx';

// Analytics tabs (eagerly loaded — they're small)
import OverviewTab from '../app/features/analytics/analytics_ui/OverviewTab.jsx';
import StrategiesTab from '../app/features/analytics/analytics_ui/StrategiesTab.jsx';
import PsychologyTab from '../app/features/analytics/analytics_ui/PsychologyTab.jsx';
import TimingTab from '../app/features/analytics/analytics_ui/TimingTab.jsx';
import RiskTab from '../app/features/analytics/analytics_ui/RiskTab.jsx';
import PlaybookDashboard from '../app/features/playbook/PlaybookDashboard.jsx';

// Mobile (dedicated mobile analytics experience)
import MobileAnalytics from '../app/components/mobile/MobileAnalytics.jsx';

// Plans (lazy — heavier component, less frequently used)
const TradePlanManager = React.lazy(() => import('../app/features/journal/TradePlanManager.jsx'));

const TABS = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'strategies', label: 'Strategies', icon: '🎯' },
  { id: 'psychology', label: 'Psychology', icon: '🧠' },
  { id: 'timing', label: 'Timing', icon: '⏱️' },
  { id: 'risk', label: 'Risk', icon: '🛡️' },
  { id: 'playbooks', label: 'Playbooks', icon: '📚' },
  { id: 'plans', label: 'Plans', icon: '📋' },
];

const TAB_COMPONENTS = {
  overview: OverviewTab,
  strategies: StrategiesTab,
  psychology: PsychologyTab,
  timing: TimingTab,
  risk: RiskTab,
  playbooks: PlaybookDashboard,
};

export default function InsightsPage() {
  const trades = useJournalStore((s) => s.trades);
  const result = useAnalyticsStore((s) => s.result);
  const computing = useAnalyticsStore((s) => s.computing);
  const setPage = useUIStore((s) => s.setPage);
  const lastComputeMs = useAnalyticsStore((s) => s.lastComputeMs);
  const [tab, setTab] = useState('overview');
  const { isMobile } = useBreakpoints();
  const simpleMode = useUserStore((s) => s.simpleMode);

  // Simple Mode: show only core tabs
  const SIMPLE_TAB_IDS = new Set(['overview', 'strategies', 'plans']);
  const visibleTabs = useMemo(
    () => (simpleMode ? TABS.filter((t) => SIMPLE_TAB_IDS.has(t.id)) : TABS),
    [simpleMode],
  );

  // Compute analytics via Web Worker (off main thread).
  useEffect(() => {
    if (trades.length > 0) {
      computeAndStore(trades, { mcRuns: 1000 });
    }
  }, [trades]);

  // ═══════════════════════════════════════════════════════════════
  // MOBILE RENDER
  // ═══════════════════════════════════════════════════════════════
  if (isMobile) {
    if (trades.length === 0) {
      return (
        <div style={{ padding: 16 }}>
          <InsightsEmptyState onGoToJournal={() => setPage('journal')} />
        </div>
      );
    }
    return <MobileAnalytics analytics={result} trades={trades} />;
  }

  // ═══════════════════════════════════════════════════════════════
  // DESKTOP RENDER
  // ═══════════════════════════════════════════════════════════════
  const isPlansTab = tab === 'plans';
  const needsAnalytics = !isPlansTab;

  return (
    <div data-container="insights" className="tf-container" style={{ padding: 32, maxWidth: 1200 }}>
      {/* ─── Section 1: Header ──── */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, fontFamily: F, color: C.t1, margin: 0 }}>Insights</h1>
        <p style={{ fontSize: 12, color: C.t3, margin: '4px 0 0', fontFamily: M }}>
          {result
            ? `${result.tradeCount} trades analyzed${lastComputeMs ? ` · ${lastComputeMs}ms` : ''}`
            : computing
              ? 'Computing analytics...'
              : `${trades.length} trades`}
        </p>
      </div>

      {/* ─── Financial Disclaimer (SEC/FCA compliance) ──── */}
      <div
        role="note"
        aria-label="Financial disclaimer"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          padding: '10px 14px',
          marginBottom: 16,
          borderRadius: 10,
          background: `${C.y}08`,
          border: `1px solid ${C.y}20`,
        }}
      >
        <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>⚠️</span>
        <span style={{ fontSize: 11, fontFamily: F, color: C.t3, lineHeight: 1.5 }}>
          <strong style={{ color: C.t2 }}>For educational purposes only.</strong>{' '}
          charEdge does not provide financial advice or trading recommendations. Always do your own research.
        </span>
      </div>

      {/* ─── Section 2: Hero Summary (when result exists) ──── */}
      {result && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
            marginBottom: 24,
          }}
        >
          <HeroMetric label="Total P&L" value={fmtD(result.totalPnl)} color={result.totalPnl >= 0 ? C.g : C.r} large />
          <HeroMetric
            label="Win Rate"
            metric="winRate"
            value={`${result.winRate.toFixed(1)}%`}
            sub={`${result.winCount}W / ${result.lossCount}L`}
            color={result.winRate >= 50 ? C.g : C.r}
          />
          <HeroMetric
            label="Profit Factor"
            metric="profitFactor"
            value={result.pf === Infinity ? '∞' : result.pf.toFixed(2)}
            color={result.pf >= 1.5 ? C.g : result.pf >= 1 ? C.y : C.r}
          />
          <HeroMetric
            label="Max Drawdown"
            metric="maxDrawdown"
            value={`${result.maxDd.toFixed(1)}%`}
            color={result.maxDd < 10 ? C.g : result.maxDd < 25 ? C.y : C.r}
          />
        </div>
      )}

      {/* ─── Section 3: Tab Bar ──── */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          marginBottom: 20,
          borderBottom: `1px solid ${C.bd}`,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
        }}
        role="tablist"
        aria-label="Insights tabs"
      >
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="tf-btn"
            role="tab"
            aria-selected={tab === t.id}
            style={{
              padding: '10px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${tab === t.id ? C.b : 'transparent'}`,
              color: tab === t.id ? C.t1 : C.t3,
              fontSize: 13,
              fontWeight: tab === t.id ? 600 : 500,
              fontFamily: F,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ fontSize: 14 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── Section 4: Tab Content ──── */}

      {/* Plans tab — doesn't need analytics result */}
      {isPlansTab && (
        <Suspense
          fallback={
            <div style={{ padding: '24px 0' }}>
              <SkeletonRow count={4} />
            </div>
          }
        >
          <TradePlanManager />
        </Suspense>
      )}

      {/* Analytics tabs — need analytics result */}
      {needsAnalytics && !result && (
        <>
          {computing ? (
            <div style={{ padding: '24px 0' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <div
                  className="tf-spin"
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    border: `2px solid ${C.bd}`,
                    borderTopColor: C.b,
                  }}
                />
                <span style={{ fontSize: 13, color: C.t2 }}>Crunching {trades.length} trades...</span>
              </div>
              <SkeletonRow count={5} />
            </div>
          ) : trades.length === 0 ? (
            <InsightsEmptyState onGoToJournal={() => setPage('journal')} />
          ) : (
            <div style={{ padding: '24px 0' }}>
              <SkeletonRow count={5} />
            </div>
          )}
        </>
      )}

      {needsAnalytics &&
        result &&
        (() => {
          const ActiveTab = TAB_COMPONENTS[tab] || OverviewTab;
          return <ActiveTab result={result} trades={trades} />;
        })()}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// HERO METRIC CARD
// ═══════════════════════════════════════════════════════════════════

function HeroMetric({ label, value, sub, color, large, metric }) {
  return (
    <Card
      style={{
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: C.t3,
          textTransform: 'uppercase',
          letterSpacing: '0.3px',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {label}
        {metric && <MetricInfo metric={metric} position="bottom" />}
      </div>
      <div
        style={{
          fontSize: large ? 26 : 22,
          fontWeight: 800,
          fontFamily: M,
          color: color || C.t1,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: C.t3, fontFamily: M }}>{sub}</div>}
    </Card>
  );
}
