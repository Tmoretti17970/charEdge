// ═══════════════════════════════════════════════════════════════════
// charEdge — Predictions Tab Content
//
// Extracted from PredictionsPage. Embeds the full prediction markets
// experience inside the unified Markets page. All prediction
// sub-components, stores, adapters, and services remain untouched.
//
// Handles auto-refresh lifecycle: starts on mount, stops on unmount.
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, Suspense } from 'react';
import { trackFeatureUse } from '../../../observability/telemetry';
import usePredictionStore from '../../../state/usePredictionStore.js';
import PredictionCategoryTabs from '../predictions/PredictionCategoryTabs.jsx';
import PredictionErrorBoundary from '../predictions/PredictionErrorBoundary.jsx';
import PredictionGrid from '../predictions/PredictionGrid.jsx';
import PredictionSidebar from '../predictions/PredictionSidebar.jsx';
import PredictionStatsBar from '../predictions/PredictionStatsBar.jsx';
import PredictionToolbar from '../predictions/PredictionToolbar.jsx';
import usePredictionKeyboard from '../predictions/usePredictionKeyboard.js';

// Lazy-load heavy below-the-fold components
const PredictionHeatmap = React.lazy(() => import('../predictions/PredictionHeatmap.jsx'));
const PredictionDetailPanel = React.lazy(() => import('../predictions/PredictionDetailPanel.jsx'));

const LazyFallback = () => (
  <div style={{ minHeight: 120, opacity: 0.4, borderRadius: 12, background: 'rgba(255,255,255,0.02)' }} />
);

export default function PredictionsTabContent() {
  const startAutoRefresh = usePredictionStore((s) => s.startAutoRefresh);
  const stopAutoRefresh = usePredictionStore((s) => s.stopAutoRefresh);

  usePredictionKeyboard();

  useEffect(() => {
    trackFeatureUse('predictions-tab');
    startAutoRefresh();
    return () => stopAutoRefresh();
  }, [startAutoRefresh, stopAutoRefresh]);

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
      }}
      role="tabpanel"
      aria-label="Prediction Markets"
    >
      {/* Header: Stats Bar */}
      <PredictionErrorBoundary name="Stats Bar">
        <PredictionStatsBar />
      </PredictionErrorBoundary>

      {/* Category Tabs */}
      <PredictionErrorBoundary name="Category Tabs">
        <PredictionCategoryTabs />
      </PredictionErrorBoundary>

      {/* Main Content Area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          gap: 0,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* Left Sidebar */}
        <PredictionErrorBoundary name="Sidebar">
          <PredictionSidebar />
        </PredictionErrorBoundary>

        {/* Main Grid Area */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            minHeight: 0,
            overflow: 'auto',
          }}
        >
          <PredictionErrorBoundary name="Toolbar">
            <PredictionToolbar />
          </PredictionErrorBoundary>
          <PredictionErrorBoundary name="Market Grid">
            <PredictionGrid />
          </PredictionErrorBoundary>
          <PredictionErrorBoundary name="Heatmap">
            <Suspense fallback={<LazyFallback />}>
              <PredictionHeatmap />
            </Suspense>
          </PredictionErrorBoundary>
        </div>
      </div>

      {/* Detail Panel (lazy — only loads when user clicks a market) */}
      <PredictionErrorBoundary name="Detail Panel">
        <Suspense fallback={null}>
          <PredictionDetailPanel />
        </Suspense>
      </PredictionErrorBoundary>
    </div>
  );
}
