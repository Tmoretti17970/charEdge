// ═══════════════════════════════════════════════════════════════════
// charEdge — Top Tab Content (Phase 5: Intelligence)
//
// Market discovery experience with Apple-style UI. Shows:
//   1. Market Ticker Strip (indices/futures + macro indicators)
//   2. Fear & Greed gauge + Market Breadth
//   3. Economic Events + Upcoming Earnings
//   4. Sector Performance Cards
//   5. Top Movers (Gainers/Losers/Most Active)
//   6. Quick Screener Presets
//   7. Topic pills + Network filters
//   8. Search + View Toggle + Export
//   9. Ranked table, card grid, or heatmap view
//
// Layout: Ticker Strip → Insights → Events → Sectors → Movers
//         → Screener → Filters → Toolbar → View Content
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState, useRef, useMemo, memo } from 'react';
import useTopMarketsStore from '../../../state/useTopMarketsStore.js';
import useTopMarketsStreaming from '../../../hooks/useTopMarketsStreaming.js';
import MarketTickerStrip from './MarketTickerStrip.jsx';
import TopNetworkFilters from './TopNetworkFilters.jsx';
import TopRankedTable from './TopRankedTable.jsx';
import TopsCardView from './TopsCardView.jsx';
import TopsFearGreedGauge from './TopsFearGreedGauge.jsx';
import TopsHeatMap from './TopsHeatMap.jsx';
import TopsMovers from './TopsMovers.jsx';
import TopsSectorCards from './TopsSectorCards.jsx';
import TopsViewToggle from './TopsViewToggle.jsx';
import TopsBreadthWidget from './TopsBreadthWidget.jsx';
import TopsEconStrip from './TopsEconStrip.jsx';
import TopsEarningsStrip from './TopsEarningsStrip.jsx';
import TopsScreenerPresets from './TopsScreenerPresets.jsx';
import TopsExportButton from './TopsExportButton.jsx';
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
  const searchRef = useRef(null);

  // Start/stop data fetching with tab lifecycle
  useEffect(() => {
    startAutoRefresh();
    return () => stopAutoRefresh();
  }, [startAutoRefresh, stopAutoRefresh]);

  // Derive visible markets for streaming (first 20 from current filtered view)
  const markets = useTopMarketsStore((s) => s.markets);
  const visibleMarkets = useMemo(() => {
    const filtered = useTopMarketsStore.getState().getFilteredMarkets();
    return filtered.slice(0, 20);
  }, [markets, assetClassFilter, topicFilter, searchQuery]);

  // Real-time streaming: WS for crypto, polling for equities
  const { priceUpdates, wsStatus } = useTopMarketsStreaming(visibleMarkets, true);

  const hasActiveFilters = assetClassFilter !== 'all' || topicFilter !== null || searchQuery !== '';

  return (
    <div className={styles.container} role="tabpanel" aria-label="Top Markets">
      {/* ─── Market Ticker Strip (glass header) ──────────────── */}
      <MarketTickerStrip />

      {/* ─── Insights Row: Fear & Greed + Market Breadth ─────── */}
      <div className={styles.insightsRow}>
        <TopsFearGreedGauge />
        <TopsBreadthWidget />
      </div>

      {/* ─── Economic Events + Upcoming Earnings ─────────────── */}
      <TopsEconStrip />
      <TopsEarningsStrip />

      {/* ─── Sector Performance Cards ────────────────────────── */}
      <TopsSectorCards />

      {/* ─── Top Movers (Gainers/Losers/Active) ─────────────── */}
      <TopsMovers />

      {/* ─── Quick Screener Presets ──────────────────────────── */}
      <TopsScreenerPresets />

      {/* ─── Filter Bar ──────────────────────────────────────── */}
      <div className={styles.filterBar}>
        <TopTopicPills />
        <TopNetworkFilters />
      </div>

      {/* ─── Toolbar: Search + Status + View Toggle + Export ─── */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>
            <SearchIcon />
          </span>
          <input
            ref={searchRef}
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
          <TopsExportButton />

          <div className={styles.statusRow}>
            {loading && <span className={styles.statusDot} style={{ background: 'var(--tf-yellow, #f0b64e)' }} />}
            {!loading && !error && <span className={styles.statusDot} style={{ background: 'var(--tf-green, #34C759)' }} />}
            {error && <span className={styles.statusDot} style={{ background: 'var(--tf-red, #FF3B30)' }} />}
            <span className={styles.statusText}>
              {sources.crypto.count + sources.equities.count} assets
              {loading ? ' · Updating...' : ''}
              {wsStatus === 'connected' ? ' · Live' : ''}
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

      {/* ─── View Content (animated transitions) ───────────── */}
      <div className={styles.viewContainer} key={viewMode}>
        {viewMode === 'table' && <TopRankedTable priceUpdates={priceUpdates} searchRef={searchRef} />}
        {viewMode === 'cards' && <TopsCardView />}
        {viewMode === 'heatmap' && <TopsHeatMap />}
      </div>
    </div>
  );
});
