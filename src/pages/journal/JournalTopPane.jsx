// ═══════════════════════════════════════════════════════════════════
// charEdge — JournalTopPane Component
// Extracted from JournalPage.jsx — renders the active top-pane tab
// (Dashboard, Analytics, Notes, Plans).
// ═══════════════════════════════════════════════════════════════════

import React, { Suspense } from 'react';
import { C } from '../../constants.js';
import { DashboardSkeleton } from '../../app/components/ui/SkeletonPulse.jsx';

// Eager top-pane tabs
import DashboardPanel from '../../app/components/dashboard/DashboardPanel.jsx';
import StrategiesTab from '../../app/features/analytics/analytics_ui/StrategiesTab.jsx';
import PsychologyTab from '../../app/features/analytics/analytics_ui/PsychologyTab.jsx';
import TimingTab from '../../app/features/analytics/analytics_ui/TimingTab.jsx';
import RiskTab from '../../app/features/analytics/analytics_ui/RiskTab.jsx';
import CalendarHeatmap from '../../app/features/analytics/analytics_ui/CalendarHeatmap.jsx';
import PlaybookDashboard from '../../app/features/playbook/PlaybookDashboard.jsx';

// Lazy top-pane tabs
const NotesPage = React.lazy(() => import('../NotesPage.jsx'));
const TradePlanManager = React.lazy(() => import('../../app/features/journal/TradePlanManager.jsx'));

// ─── Tab → Component map ────────────────────────────────────
const TAB_COMPONENTS = {
  dashboard: DashboardPanel,
  strategies: StrategiesTab,
  psychology: PsychologyTab,
  timing: TimingTab,
  risk: RiskTab,
  calendar: CalendarHeatmap,
  playbooks: PlaybookDashboard,
};

export default function JournalTopPane({ journalTab, result, computing, trades, filters }) {
  if (journalTab === 'notes') {
    return (
      <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: C.t3 }}>Loading notes...</div>}>
        <NotesPage />
      </Suspense>
    );
  }
  if (journalTab === 'plans') {
    return (
      <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: C.t3 }}>Loading plans...</div>}>
        <TradePlanManager />
      </Suspense>
    );
  }

  const ActiveTab = TAB_COMPONENTS[journalTab];
  if (ActiveTab) {
    if (!result && computing) {
      return <DashboardSkeleton />;
    }

    // CalendarHeatmap needs eq + trades instead of standard tab props
    if (journalTab === 'calendar') {
      return (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <CalendarHeatmap eq={result?.eq} trades={trades} />
        </div>
      );
    }

    return (
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <ActiveTab
          result={result}
          trades={trades}
          computing={computing}
          onDashboardFilter={(f) => {
            if (f.dateRange !== undefined) filters.setDateRange(f.dateRange);
            if (f.sideFilter !== undefined) filters.setSideFilter(f.sideFilter);
            if (f.customDateFrom !== undefined) filters.setCustomDateFrom(f.customDateFrom);
            if (f.customDateTo !== undefined) filters.setCustomDateTo(f.customDateTo);
          }}
        />
      </div>
    );
  }
  return null;
}
