// ═══════════════════════════════════════════════════════════════════
// charEdge — Top Tab Content
//
// Brand-new market discovery experience. Shows ranked assets from
// public APIs (CoinGecko for crypto, SymbolRegistry for equities).
// Completely independent from the user's personal watchlist.
//
// Layout: Topic pills → Network filters → Search → Ranked table
// ═══════════════════════════════════════════════════════════════════

import { useEffect, memo } from 'react';
import useTopMarketsStore from '../../../state/useTopMarketsStore.js';
import TopNetworkFilters from './TopNetworkFilters.jsx';
import TopRankedTable from './TopRankedTable.jsx';
import styles from './TopTabContent.module.css';
import TopTopicPills from './TopTopicPills.jsx';

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

  // Start/stop data fetching with tab lifecycle
  useEffect(() => {
    startAutoRefresh();
    return () => stopAutoRefresh();
  }, [startAutoRefresh, stopAutoRefresh]);

  const hasActiveFilters = assetClassFilter !== 'all' || topicFilter !== null || searchQuery !== '';

  return (
    <div className={styles.container} role="tabpanel" aria-label="Top Markets">
      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <TopTopicPills />
        <TopNetworkFilters />
      </div>

      {/* Search + Status Row */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>🔍</span>
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
              ✕
            </button>
          )}
        </div>

        <div className={styles.statusRow}>
          {loading && <span className={styles.statusDot} style={{ background: '#f6b93b' }} />}
          {!loading && !error && <span className={styles.statusDot} style={{ background: '#16c784' }} />}
          {error && <span className={styles.statusDot} style={{ background: '#ea3943' }} />}
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

      {/* Error state */}
      {error && !loading && (
        <div className={styles.errorBar}>
          <span>Failed to load market data: {error}</span>
          <button onClick={() => useTopMarketsStore.getState().fetchAll(true)} className={styles.retryBtn}>
            Retry
          </button>
        </div>
      )}

      {/* Ranked Table */}
      <TopRankedTable />
    </div>
  );
});
