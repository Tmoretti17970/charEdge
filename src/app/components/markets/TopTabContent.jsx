// ═══════════════════════════════════════════════════════════════════
// charEdge — Top Tab Content (Enhanced)
//
// Market discovery experience with Apple-style UI. Shows:
//   1. Market Ticker Strip (indices/futures + macro indicators)
//   2. Fear & Greed gauge
//   3. Top Movers (Gainers/Losers/Most Active)
//   4. Topic pills + Network filters
//   5. View mode toggle (Table / Cards / Heatmap)
//   6. Ranked table, card grid, or heatmap view
//
// Layout: Ticker Strip → Movers → Filters → View Content
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState, memo } from 'react';
import useTopMarketsStore from '../../../state/useTopMarketsStore.js';
import MarketTickerStrip from './MarketTickerStrip.jsx';
import TopNetworkFilters from './TopNetworkFilters.jsx';
import TopRankedTable from './TopRankedTable.jsx';
import TopsCardView from './TopsCardView.jsx';
import TopsFearGreedGauge from './TopsFearGreedGauge.jsx';
import TopsHeatMap from './TopsHeatMap.jsx';
import TopsMovers from './TopsMovers.jsx';
import TopsViewToggle from './TopsViewToggle.jsx';
import styles from './TopTabContent.module.css';
import TopTopicPills from './TopTopicPills.jsx';

// ─── Search Icon SVG (replaces emoji) ────────────────────────────

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default memo(function TopTabContent() {
  const startAutoRefresh = useTopMarketsStore((s) => s.startAutoRefresh);
  const stopAutoRefresh = useTopMarketsStore((s) => s.stopAutoRefresh);
  const searchQuery = useTopMarketsStore((s) => s.searchQuery);
  const setSearchQuery = useTopMarketsStore((s) => s.setSearchQuery);
  const loading = useTopMarketsStore((s) => s.loading);
  const error = useTopMarketsStore((s) => s.error);
  const sources = useTopMarketsStore((s) => s.sources);
  const clearFilters = useTopMarketsStore((s) => s.clearFilters);
  const assetClassFilter = useTopMarketsStore((s) => s.assetClassFilter);
  const topicFilter = useTopMarketsStore((s) => s.topicFilter);

  const [viewMode, setViewMode] = useState('table');

  // Start/stop data fetching with tab lifecycle
  useEffect(() => {
    startAutoRefresh();
    return () => stopAutoRefresh();
  }, [startAutoRefresh, stopAutoRefresh]);

  const hasActiveFilters = assetClassFilter !== 'all' || topicFilter !== null || searchQuery !== '';

  return (
    <div className={styles.container} role="tabpanel" aria-label="Top Markets">
      {/* ─── Market Ticker Strip (glass header) ──────────────── */}
      <MarketTickerStrip />

      {/* ─── Movers + Fear & Greed Row ───────────────────────── */}
      <div className={styles.insightsRow}>
        <TopsFearGreedGauge />
      </div>

      {/* ─── Top Movers (Gainers/Losers/Active) ─────────────── */}
      <TopsMovers />

      {/* ─── Filter Bar ──────────────────────────────────────── */}
      <div className={styles.filterBar}>
        <TopTopicPills />
        <TopNetworkFilters />
      </div>

      {/* ─── Toolbar: Search + Status + View Toggle ──────────── */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
            aria-label="Search assets"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className={styles.clearSearch} aria-label="Clear search">
              <CloseIcon />
            </button>
          )}
        </div>

        <div className={styles.toolbarRight}>
          <TopsViewToggle viewMode={viewMode} setViewMode={setViewMode} />

          <div className={styles.statusRow}>
            {loading && <span className={styles.statusDot} style={{ background: 'var(--tf-yellow, #f0b64e)' }} />}
            {!loading && !error && <span className={styles.statusDot} style={{ background: 'var(--tf-green, #34C759)' }} />}
            {error && <span className={styles.statusDot} style={{ background: 'var(--tf-red, #FF3B30)' }} />}
            <span className={styles.statusText}>
              {sources.crypto.count + sources.equities.count} assets
              {loading ? ' · Updating...' : ''}
            </span>

            {hasActiveFilters && (
              <button onClick={clearFilters} className={styles.clearBtn}>
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Error state ─────────────────────────────────────── */}
      {error && !loading && (
        <div className={styles.errorBar}>
          <span>Failed to load market data: {error}</span>
          <button onClick={() => useTopMarketsStore.getState().fetchAll(true)} className={styles.retryBtn}>
            Retry
          </button>
        </div>
      )}

      {/* ─── View Content ────────────────────────────────────── */}
      {viewMode === 'table' && <TopRankedTable />}
      {viewMode === 'cards' && <TopsCardView />}
      {viewMode === 'heatmap' && <TopsHeatMap />}
    </div>
  );
});
