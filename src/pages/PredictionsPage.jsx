// ═══════════════════════════════════════════════════════════════════
// charEdge — Predictions Page
//
// Dedicated prediction markets page with full CoinMarketCap-level
// features: stats bar, category tabs, sidebar filters, 3-column
// grid, search, sort, and market detail panel.
//
// Performance: Heavy below-the-fold components lazy-loaded.
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, Suspense } from 'react';
import PredictionCategoryTabs from '../app/components/predictions/PredictionCategoryTabs.jsx';
import PredictionErrorBoundary from '../app/components/predictions/PredictionErrorBoundary.jsx';
import PredictionGrid from '../app/components/predictions/PredictionGrid.jsx';
import PredictionSidebar from '../app/components/predictions/PredictionSidebar.jsx';
import PredictionStatsBar from '../app/components/predictions/PredictionStatsBar.jsx';
import PredictionToolbar from '../app/components/predictions/PredictionToolbar.jsx';
import usePredictionKeyboard from '../app/components/predictions/usePredictionKeyboard.js';
import usePredictionURLSync from '../app/components/predictions/usePredictionURLSync.js';
import { trackPageView, trackFeatureUse } from '../observability/telemetry';
import usePredictionStore from '../state/usePredictionStore.js';
import styles from './PredictionsPage.module.css';

// Lazy-load heavy below-the-fold components
const PredictionHeatmap = React.lazy(() => import('../app/components/predictions/PredictionHeatmap.jsx'));
const PredictionDetailPanel = React.lazy(() => import('../app/components/predictions/PredictionDetailPanel.jsx'));

const LazyFallback = () => (
  <div style={{ minHeight: 120, opacity: 0.4, borderRadius: 12, background: 'rgba(255,255,255,0.02)' }} />
);

export default function PredictionsPage() {
  const startAutoRefresh = usePredictionStore(s => s.startAutoRefresh);
  const stopAutoRefresh = usePredictionStore(s => s.stopAutoRefresh);

  usePredictionURLSync();
  usePredictionKeyboard();

  useEffect(() => {
    trackPageView('predictions');
    trackFeatureUse('predictions-page');
    startAutoRefresh();
    return () => stopAutoRefresh();
  }, [startAutoRefresh, stopAutoRefresh]);

  return (
    <div className={styles.page} role="main" aria-label="Prediction Markets">
      {/* Header: Stats Bar */}
      <PredictionErrorBoundary name="Stats Bar">
        <PredictionStatsBar />
      </PredictionErrorBoundary>

      {/* Category Tabs */}
      <PredictionErrorBoundary name="Category Tabs">
        <PredictionCategoryTabs />
      </PredictionErrorBoundary>

      {/* Main Content Area */}
      <div className={styles.content}>
        {/* Left Sidebar */}
        <PredictionErrorBoundary name="Sidebar">
          <PredictionSidebar />
        </PredictionErrorBoundary>

        {/* Main Grid Area */}
        <div className={styles.main}>
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
