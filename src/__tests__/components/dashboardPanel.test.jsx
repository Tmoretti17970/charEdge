// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// charEdge — DashboardPanel Render Tests (Updated for Home Tab Redesign)
//
// Source-verification + selective render tests for the main dashboard.
// Tests verify content across the decomposed dashboard files:
//   - DashboardPanel.jsx          (orchestrator — narrative only)
//   - DashboardNarrativeLayout.jsx (story layout + metrics row)
//   - DashboardPrimitives.jsx      (shared sub-components)
// ═══════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import { describe, it, expect } from 'vitest';

const dashSrc = fs.readFileSync('src/app/components/dashboard/DashboardPanel.jsx', 'utf8');
const narrativeSrc = fs.readFileSync('src/app/components/dashboard/DashboardNarrativeLayout.jsx', 'utf8');
const primSrc = fs.readFileSync('src/app/components/dashboard/DashboardPrimitives.jsx', 'utf8');
const cssSrc = fs.readFileSync('src/app/components/dashboard/DashboardPanel.module.css', 'utf8');

// ═══════════════════════════════════════════════════════════════════
// Structure
// ═══════════════════════════════════════════════════════════════════

describe('DashboardPanel — Structure', () => {
  it('exports default DashboardPanel', () => {
    expect(dashSrc).toContain('export default function DashboardPanel');
  });

  it('accepts trades, result, computing, onDashboardFilter props', () => {
    expect(dashSrc).toContain('trades');
    expect(dashSrc).toContain('result');
    expect(dashSrc).toContain('computing');
  });

  it('imports CSS module', () => {
    expect(dashSrc).toContain("from './DashboardPanel.module.css'");
  });

  it('uses useBreakpoints for responsive layout', () => {
    expect(dashSrc).toContain('useBreakpoints');
    expect(dashSrc).toContain('isMobile');
  });

  it('always renders NarrativeLayout (Sprint 24: custom mode removed)', () => {
    expect(dashSrc).toContain('DashboardNarrativeLayout');
    expect(dashSrc).not.toContain('DashboardCustomLayout');
  });
});

describe('DashboardPanel — Empty State & Loading', () => {
  it('renders DashboardEmptyState when no trades', () => {
    expect(dashSrc).toContain('DashboardEmptyState');
    expect(dashSrc).toContain('trades.length === 0');
  });

  it('renders DashboardSkeleton when computing', () => {
    expect(dashSrc).toContain('DashboardSkeleton');
    expect(dashSrc).toContain('computing');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Narrative Layout — Redesigned
// ═══════════════════════════════════════════════════════════════════

describe('DashboardNarrativeLayout — Session Summary Bar', () => {
  it('renders SessionSummaryBar (Sprint 2)', () => {
    expect(narrativeSrc).toContain('SessionSummaryBar');
    expect(narrativeSrc).toContain('todayPnl');
    expect(narrativeSrc).toContain('ribbonStats');
  });

  it('does NOT render legacy ribbon (Sprint 2)', () => {
    expect(narrativeSrc).not.toContain('ribbonItem');
    expect(narrativeSrc).not.toContain('ribbonLabel');
  });

  it('does NOT render DashboardHero (Sprint 2)', () => {
    expect(narrativeSrc).not.toContain('<DashboardHero');
  });

  it('does NOT render NarrativeSectionHeader (Sprint 3)', () => {
    expect(narrativeSrc).not.toContain('NarrativeSectionHeader');
  });

  it('does NOT render NarrativeDivider (Sprint 3)', () => {
    expect(narrativeSrc).not.toContain('NarrativeDivider');
  });
});

describe('DashboardNarrativeLayout — Compact Metrics Row', () => {
  it('renders MetricsRow component (Sprint 17)', () => {
    expect(narrativeSrc).toContain('MetricsRow');
    expect(narrativeSrc).toContain('Profit Factor');
    expect(narrativeSrc).toContain('Win/Loss');
    expect(narrativeSrc).toContain('Max DD');
    expect(narrativeSrc).toContain('Expectancy');
  });

  it('does NOT render BentoMetricCard (Sprint 17)', () => {
    expect(narrativeSrc).not.toContain('<BentoMetricCard');
  });
});

describe('DashboardNarrativeLayout — Content Cleanup', () => {
  it('does NOT render gamification widgets (Sprint 20)', () => {
    expect(narrativeSrc).not.toContain('DailyChallengeCard');
    expect(narrativeSrc).not.toContain('WeeklyChallengeCard');
    expect(narrativeSrc).not.toContain('XPActivityFeed');
  });

  it('does NOT render meta-UI banners (Sprint 21)', () => {
    expect(narrativeSrc).not.toContain('WidgetSuggestionBanner');
    expect(narrativeSrc).not.toContain('PersonaTierBanner');
    expect(narrativeSrc).not.toContain('BentoCustomizer');
  });

  it('does NOT render WidgetCustomizer (Sprint 25)', () => {
    expect(narrativeSrc).not.toContain('WidgetCustomizer');
  });

  it('has simplified Getting Started banner (Sprint 23)', () => {
    expect(narrativeSrc).toContain('tf_onboard_dismissed');
    expect(narrativeSrc).toContain('+ Add Trade');
    expect(narrativeSrc).toContain('Import CSV');
  });
});

describe('DashboardNarrativeLayout — Core Widgets', () => {
  it('renders Equity Curve chart', () => {
    expect(narrativeSrc).toContain('EquityCurveChart');
    expect(narrativeSrc).toContain('Equity Curve');
  });

  it('renders Trade Heatmap', () => {
    expect(narrativeSrc).toContain('TradeHeatmap');
    expect(narrativeSrc).toContain('Trade Heatmap');
  });

  it('renders Trade Heatmap (replaced Recent Trades)', () => {
    expect(narrativeSrc).toContain('Trade Heatmap');
    expect(narrativeSrc).toContain('TradeHeatmap');
  });

  it('does NOT render MilestoneBar (removed)', () => {
    expect(narrativeSrc).not.toContain('MilestoneBar');
  });

  it('has Show More button with trimmed widget count (Sprint 22)', () => {
    expect(narrativeSrc).toContain('Show More');
    expect(narrativeSrc).toContain('Show Less');
    expect(narrativeSrc).toContain('showAllWidgets');
    expect(narrativeSrc).toContain('+2');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Primitives
// ═══════════════════════════════════════════════════════════════════

describe('DashboardPanel — Primitives', () => {
  it('exports simplified DashHeader (Sprint 4)', () => {
    expect(primSrc).toContain('export function DashHeader');
    expect(primSrc).toContain('UnitToggle');
  });

  it('DashHeader does not have layout toggle (Sprint 4)', () => {
    expect(primSrc).not.toContain('layoutMode');
    expect(primSrc).not.toContain('onLayoutToggle');
    expect(primSrc).not.toContain('editMode');
  });

  it('exports BentoMetricCard', () => {
    expect(primSrc).toContain('export function BentoMetricCard');
  });

  it('exports MetricRow', () => {
    expect(primSrc).toContain('export function MetricRow');
  });
});

describe('DashboardPanel — CSS Module', () => {
  it('has page layout classes', () => {
    expect(cssSrc).toContain('.page');
  });

  it('ribbon CSS is removed (Sprint 5)', () => {
    expect(cssSrc).not.toContain('.ribbonItem');
    expect(cssSrc).not.toContain('.ribbonLabel');
  });

  it('narrative header CSS is removed (Sprint 5)', () => {
    expect(cssSrc).not.toContain('.narrativeHeader');
    expect(cssSrc).not.toContain('.narrativeStep');
    expect(cssSrc).not.toContain('.divider');
  });

  // ═══ Phase 4: Apple Visual Polish CSS ═══
  it('has Sprint 28 widened section gap (36px)', () => {
    expect(cssSrc).toContain('36px');
  });

  it('has Sprint 31 staggered entry animation', () => {
    expect(cssSrc).toContain('sectionFadeIn');
    expect(cssSrc).toContain('.sectionEntry');
  });

  it('has Sprint 32 price flash animation', () => {
    expect(cssSrc).toContain('priceFlash');
  });

  it('has Sprint 34 sticky summary bar', () => {
    expect(cssSrc).toContain('.stickySummary');
    expect(cssSrc).toContain('blur(20px)');
  });

  it('has Sprint 35 focus-visible accessibility', () => {
    expect(cssSrc).toContain('focus-visible');
    expect(cssSrc).toContain('min-height: 44px');
  });

  it('has Sprint 36 skeleton loading styles', () => {
    expect(cssSrc).toContain('.skeletonRow');
    expect(cssSrc).toContain('.skeletonBar');
    expect(cssSrc).toContain('skeletonPulse');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Phase 4: Apple Colors
// ═══════════════════════════════════════════════════════════════════

describe('Phase 4 — Apple System Colors', () => {
  const themeSrc = fs.readFileSync('src/constants/_colors.js', 'utf8');

  it('dark theme uses Apple system green #34C759', () => {
    expect(themeSrc).toContain("g: '#34C759'");
  });

  it('dark theme uses Apple system red #FF3B30', () => {
    expect(themeSrc).toContain("r: '#FF3B30'");
  });
});

// ═══════════════════════════════════════════════════════════════════
// Phase 5: Mobile Optimization
// ═══════════════════════════════════════════════════════════════════

describe('Phase 5 — Mobile Optimization', () => {
  const summarySrc = fs.readFileSync('src/app/components/dashboard/SessionSummaryBar.jsx', 'utf8');
  const watchlistSrc = fs.readFileSync('src/app/components/dashboard/HomeWatchlist.jsx', 'utf8');

  it('Sprint 37: summary bar stacks on mobile with 32px P&L', () => {
    expect(summarySrc).toContain("flexDirection: isMobile ? 'column' : 'row'");
    expect(summarySrc).toContain('fontSize: isMobile ? 32 : 28');
  });

  it('Sprint 38: mobile watchlist rows have 56px min height', () => {
    const watchlistCssSrc = fs.readFileSync('src/app/components/dashboard/HomeWatchlist.module.css', 'utf8');
    expect(watchlistCssSrc).toContain('min-height: 56px');
  });

  it('Sprint 38: swipe-to-remove gesture handlers', () => {
    expect(watchlistSrc).toContain('handleTouchStart');
    expect(watchlistSrc).toContain('handleTouchMove');
    expect(watchlistSrc).toContain('handleTouchEnd');
    expect(watchlistSrc).toContain('swipeX');
  });

  it('Sprint 40: long-press context menu', () => {
    expect(watchlistSrc).toContain('showContextMenu');
    expect(watchlistSrc).toContain('View Chart');
    expect(watchlistSrc).toContain('Set Alert');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Phase 6: New Features
// ═══════════════════════════════════════════════════════════════════

describe('Phase 6 — New Features Integration', () => {
  it('Sprint 43: IntradayChart integrated in layout', () => {
    expect(narrativeSrc).toContain('IntradayChart');
  });

  it('Sprint 44-45: StrategyBreakdown + AssetBreakdown integrated', () => {
    expect(narrativeSrc).toContain('StrategyBreakdown');
    expect(narrativeSrc).toContain('AssetBreakdown');
  });

  it('Sprint 48: SessionTip for smart recommendations', () => {
    expect(narrativeSrc).toContain('SessionTip');
    expect(narrativeSrc).toContain('daily risk used');
    expect(narrativeSrc).toContain('consecutive losses');
  });
});
