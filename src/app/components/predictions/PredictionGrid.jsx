// Grid — 3-column Apple masonry grid with stagger animation + infinite scroll
import { memo, useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { filterByTimeframe } from '../../../data/services/TimeClassifier.js';
import { filterByTags } from '../../../data/services/TopicTagGenerator.js';
import { computeTrending } from '../../../data/services/TrendingAlgorithm.js';
import usePredictionStore from '../../../state/usePredictionStore.js';
import styles from './PredictionGrid.module.css';
import PredictionListRow from './PredictionListRow.jsx';
import PredictionMarketCard from './PredictionMarketCard.jsx';

const PAGE_SIZE = 30;

function sortMarkets(markets, sortBy, sortOrder) {
  if (sortBy === 'trending') return computeTrending(markets);

  const sorted = [...markets];
  const dir = sortOrder === 'asc' ? 1 : -1;
  sorted.sort((a, b) => {
    switch (sortBy) {
      case 'volume':
        return ((b.volume24h || 0) - (a.volume24h || 0)) * dir;
      case 'newest':
        return (new Date(b.createdDate || 0).getTime() - new Date(a.createdDate || 0).getTime()) * dir;
      case 'closingSoon': {
        const aC = a.closeDate ? new Date(a.closeDate).getTime() : Infinity;
        const bC = b.closeDate ? new Date(b.closeDate).getTime() : Infinity;
        return (aC - bC) * dir;
      }
      case 'probability':
        return ((b.outcomes?.[0]?.probability || 0) - (a.outcomes?.[0]?.probability || 0)) * dir;
      default:
        return ((b.volume24h || 0) - (a.volume24h || 0)) * dir;
    }
  });
  return sorted;
}

export default memo(function PredictionGrid() {
  const allMarkets = usePredictionStore((s) => s.markets);
  const loading = usePredictionStore((s) => s.loading);
  const activeCategory = usePredictionStore((s) => s.activeCategory);
  const activeSubcategory = usePredictionStore((s) => s.activeSubcategory);
  const activeTimeFilter = usePredictionStore((s) => s.activeTimeFilter);
  const activeTags = usePredictionStore((s) => s.activeTags);
  const searchQuery = usePredictionStore((s) => s.searchQuery);
  const sortBy = usePredictionStore((s) => s.sortBy);
  const sortOrder = usePredictionStore((s) => s.sortOrder);
  const platformFilters = usePredictionStore((s) => s.platformFilters);
  const viewMode = usePredictionStore((s) => s.viewMode);

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef(null);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeCategory, activeSubcategory, activeTimeFilter, activeTags, searchQuery, sortBy, platformFilters]);

  const allFiltered = useMemo(() => {
    let filtered = allMarkets;
    if (activeCategory !== 'all') filtered = filtered.filter((m) => m.category === activeCategory);
    if (activeSubcategory) filtered = filtered.filter((m) => m.subcategory === activeSubcategory);
    filtered = filterByTimeframe(filtered, activeTimeFilter);
    if (activeTags.length > 0) filtered = filterByTags(filtered, activeTags);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) => m.question?.toLowerCase().includes(q) || m.tags?.some((t) => t.toLowerCase().includes(q)),
      );
    }
    if (platformFilters.length > 0) filtered = filtered.filter((m) => platformFilters.includes(m.source));
    return sortMarkets(filtered, sortBy, sortOrder);
  }, [
    allMarkets,
    activeCategory,
    activeSubcategory,
    activeTimeFilter,
    activeTags,
    searchQuery,
    sortBy,
    sortOrder,
    platformFilters,
  ]);

  const markets = useMemo(() => allFiltered.slice(0, visibleCount), [allFiltered, visibleCount]);
  const hasMore = visibleCount < allFiltered.length;

  // Intersection observer for infinite scroll
  const observerCallback = useCallback(
    (entries) => {
      if (entries[0]?.isIntersecting && hasMore) {
        setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, allFiltered.length));
      }
    },
    [hasMore, allFiltered.length],
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(observerCallback, {
      rootMargin: '200px',
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [observerCallback]);

  if (loading && markets.length === 0) {
    return (
      <div className={styles.grid}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className={styles.skeleton} style={{ animationDelay: `${i * 50}ms` }}>
            <div className={styles.skelBadge} />
            <div className={styles.skelTitle} />
            <div className={styles.skelTitle2} />
            <div className={styles.skelOutcome} />
            <div className={styles.skelOutcome} />
            <div className={styles.skelFooter} />
          </div>
        ))}
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>🔍</span>
        <p className={styles.emptyText}>No markets match your filters</p>
        <button className={styles.emptyCta} onClick={() => usePredictionStore.getState().clearAllFilters()}>
          Clear filters
        </button>
      </div>
    );
  }

  return (
    <>
      {viewMode === 'grid' ? (
        <div className={styles.grid}>
          {markets.map((market, i) => (
            <div key={market.id} style={{ animationDelay: `${Math.min(i, 20) * 50}ms` }}>
              <PredictionMarketCard market={market} />
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.list}>
          {/* List header */}
          <div className={styles.listHeader}>
            <span className={styles.listHeaderCell} style={{ flex: 1 }}>
              Market
            </span>
            <span className={styles.listHeaderCell} style={{ minWidth: 50 }}>
              Prob
            </span>
            <span className={styles.listHeaderCell} style={{ minWidth: 40 }}>
              24h
            </span>
            <span className={styles.listHeaderCell} style={{ minWidth: 60 }}>
              Volume
            </span>
            <span className={styles.listHeaderCell} style={{ minWidth: 30 }}>
              Closes
            </span>
          </div>
          {markets.map((market) => (
            <PredictionListRow key={market.id} market={market} />
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      {hasMore && (
        <div ref={sentinelRef} className={styles.loadMore}>
          <div className={styles.loadingDots}>
            <span />
            <span />
            <span />
          </div>
        </div>
      )}

      {/* Result count */}
      <div className={styles.resultCount}>
        Showing {markets.length} of {allFiltered.length} markets
      </div>
    </>
  );
});
