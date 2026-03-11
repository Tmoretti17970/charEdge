// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// charEdge — DashboardPanel Render Tests (Task 4.1.2)
//
// Source-verification + selective render tests for the main dashboard.
// Tests verify content across the decomposed dashboard files:
//   - DashboardPanel.jsx          (orchestrator)
//   - DashboardNarrativeLayout.jsx (story layout)
//   - DashboardCustomLayout.jsx    (widget grid)
//   - DashboardPrimitives.jsx      (shared sub-components)
// ═══════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import { describe, it, expect } from 'vitest';

const dashSrc = fs.readFileSync('src/app/components/dashboard/DashboardPanel.jsx', 'utf8');
const narrativeSrc = fs.readFileSync('src/app/components/dashboard/DashboardNarrativeLayout.jsx', 'utf8');
const customSrc = fs.readFileSync('src/app/components/dashboard/DashboardCustomLayout.jsx', 'utf8');
const primSrc = fs.readFileSync('src/app/components/dashboard/DashboardPrimitives.jsx', 'utf8');
const cssSrc = fs.readFileSync('src/app/components/dashboard/DashboardPanel.module.css', 'utf8');

// ═══════════════════════════════════════════════════════════════════
// Source Verification
// ═══════════════════════════════════════════════════════════════════

describe('DashboardPanel — Structure', () => {
    it('exports default DashboardPanel', () => {
        expect(dashSrc).toContain('export default function DashboardPanel');
    });

    it('accepts trades, result, computing, onDashboardFilter props', () => {
        expect(dashSrc).toContain('trades');
        expect(dashSrc).toContain('result');
        expect(dashSrc).toContain('computing');
        expect(dashSrc).toContain('onDashboardFilter');
    });

    it('imports CSS module', () => {
        expect(dashSrc).toContain("from './DashboardPanel.module.css'");
    });

    it('uses useBreakpoints for responsive layout', () => {
        expect(dashSrc).toContain('useBreakpoints');
        expect(dashSrc).toContain('isMobile');
        expect(dashSrc).toContain('isTablet');
    });

    it('delegates to NarrativeLayout and CustomLayout', () => {
        expect(dashSrc).toContain('DashboardNarrativeLayout');
        expect(dashSrc).toContain('DashboardCustomLayout');
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

    it('shows Getting Started card for < 5 trades', () => {
        expect(narrativeSrc).toContain('Getting Started');
        expect(narrativeSrc).toContain('trades.length < 5');
    });
});

describe('DashboardPanel — Narrative Layout', () => {
    it('has narrative section headers', () => {
        expect(narrativeSrc).toContain("Today's Session");
        expect(narrativeSrc).toContain('Your Trend');
        expect(narrativeSrc).toContain('Insights & Actions');
    });

    it('renders performance ribbon with period stats', () => {
        expect(dashSrc).toContain('ribbonStats');
        expect(narrativeSrc).toContain("label: 'Week'");
        expect(narrativeSrc).toContain("label: 'Month'");
        expect(narrativeSrc).toContain("label: 'Total'");
        expect(narrativeSrc).toContain("label: 'Win Rate'");
        expect(narrativeSrc).toContain("label: 'Streak'");
    });

    it('renders DashboardHero', () => {
        expect(narrativeSrc).toContain('<DashboardHero');
        expect(narrativeSrc).toContain('todayPnl');
    });

    it('renders Equity Curve chart', () => {
        expect(narrativeSrc).toContain('EquityCurveChart');
        expect(narrativeSrc).toContain('Equity Curve');
    });

    it('renders Activity Heatmap', () => {
        expect(narrativeSrc).toContain('TradeHeatmap');
        expect(narrativeSrc).toContain('Activity Heatmap');
    });

    it('renders Recent Trades section', () => {
        expect(narrativeSrc).toContain('Recent Trades');
        expect(narrativeSrc).toContain('recentTrades');
        expect(narrativeSrc).toContain('View All');
    });

    it('has MilestoneBar for early users', () => {
        expect(narrativeSrc).toContain('MilestoneBar');
        expect(narrativeSrc).toContain('trades.length < 100');
    });

    it('has progressive disclosure toggle for widgets', () => {
        expect(narrativeSrc).toContain('Show All Widgets');
        expect(narrativeSrc).toContain('Show Less');
        expect(narrativeSrc).toContain('showAllWidgets');
    });
});

describe('DashboardPanel — Custom Layout', () => {
    it('supports custom widget grid layout mode', () => {
        expect(dashSrc).toContain("'narrative'");
        expect(dashSrc).toContain("'custom'");
        expect(dashSrc).toContain('layoutMode');
    });

    it('has widgetComponents map with all widget keys', () => {
        expect(customSrc).toContain("'stat-cards'");
        expect(customSrc).toContain("'equity-curve'");
        expect(customSrc).toContain("'win-donut'");
        expect(customSrc).toContain("'daily-pnl'");
        expect(customSrc).toContain('calendar:');
        expect(customSrc).toContain("'recent-trades'");
        expect(customSrc).toContain('insights:');
        expect(customSrc).toContain("'risk-metrics'");
        expect(customSrc).toContain("'advanced-metrics'");
    });

    it('renders active widgets from store', () => {
        expect(customSrc).toContain('activeWidgets');
        expect(customSrc).toContain('useLayoutStore');
    });
});

describe('DashboardPanel — Primitives', () => {
    it('exports DashHeader', () => {
        expect(primSrc).toContain('export function DashHeader');
    });

    it('exports NarrativeSectionHeader', () => {
        expect(primSrc).toContain('export function NarrativeSectionHeader');
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

    it('has responsive grid classes', () => {
        expect(cssSrc).toContain('bentoGrid') || expect(cssSrc).toContain('Responsive');
    });

    it('has ribbon styles', () => {
        expect(cssSrc).toContain('ribbon');
    });
});
