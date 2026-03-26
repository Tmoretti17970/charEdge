// Toolbar — Search + Sort + Platform filter + View mode
import { memo, useState, useCallback } from 'react';
import { SOURCE_CONFIG } from '../../../data/schemas/PredictionMarketSchema.js';
import usePredictionStore from '../../../state/usePredictionStore.js';
import styles from './PredictionToolbar.module.css';

const SORT_OPTIONS = [
  { id: 'volume', label: 'Volume (24h)' },
  { id: 'trending', label: 'Trending' },
  { id: 'newest', label: 'Newest' },
  { id: 'closingSoon', label: 'Closing Soon' },
  { id: 'probability', label: 'Probability' },
];

const PLATFORMS = Object.entries(SOURCE_CONFIG).map(([id, cfg]) => ({
  id,
  label: cfg.label,
  color: cfg.color,
}));

export default memo(function PredictionToolbar() {
  const searchQuery = usePredictionStore((s) => s.searchQuery);
  const setSearchQuery = usePredictionStore((s) => s.setSearchQuery);
  const sortBy = usePredictionStore((s) => s.sortBy);
  const setSortBy = usePredictionStore((s) => s.setSortBy);
  const totalCount = usePredictionStore((s) => s.totalCount);
  const platformFilters = usePredictionStore((s) => s.platformFilters);
  const setPlatformFilters = usePredictionStore((s) => s.setPlatformFilters);
  const sourceStatus = usePredictionStore((s) => s.sourceStatus);
  const viewMode = usePredictionStore((s) => s.viewMode);
  const setViewMode = usePredictionStore((s) => s.setViewMode);

  const [focused, setFocused] = useState(false);
  const [platformOpen, setPlatformOpen] = useState(false);

  const handleSearch = useCallback(
    (e) => {
      setSearchQuery(e.target.value);
    },
    [setSearchQuery],
  );

  const handleClear = useCallback(() => {
    setSearchQuery('');
  }, [setSearchQuery]);

  const togglePlatform = useCallback(
    (platformId) => {
      if (platformFilters.includes(platformId)) {
        setPlatformFilters(platformFilters.filter((p) => p !== platformId));
      } else {
        setPlatformFilters([...platformFilters, platformId]);
      }
    },
    [platformFilters, setPlatformFilters],
  );

  const clearPlatformFilters = useCallback(() => {
    setPlatformFilters([]);
    setPlatformOpen(false);
  }, [setPlatformFilters]);

  return (
    <div className={styles.toolbar}>
      {/* Search */}
      <div className={`${styles.searchWrap} ${focused ? styles.focused : ''}`}>
        <span className={styles.searchIcon}>🔍</span>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search events..."
          value={searchQuery}
          onChange={handleSearch}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {searchQuery && (
          <button className={styles.clearBtn} onClick={handleClear}>
            ✕
          </button>
        )}
      </div>

      {/* Sort */}
      <select className={styles.sortSelect} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Platform filter */}
      <div className={styles.platformWrap}>
        <button
          className={`${styles.platformBtn} ${platformFilters.length > 0 ? styles.platformActive : ''}`}
          onClick={() => setPlatformOpen(!platformOpen)}
        >
          Platform
          {platformFilters.length > 0 && <span className={styles.platformCount}>{platformFilters.length}</span>}
        </button>

        {platformOpen && (
          <div className={styles.platformDropdown}>
            <div className={styles.platformHeader}>
              <span>Filter by platform</span>
              {platformFilters.length > 0 && (
                <button className={styles.platformClear} onClick={clearPlatformFilters}>
                  Clear
                </button>
              )}
            </div>
            {PLATFORMS.map((p) => {
              const active = platformFilters.length === 0 || platformFilters.includes(p.id);
              const count = sourceStatus[p.id]?.count || 0;
              return (
                <button
                  key={p.id}
                  className={`${styles.platformItem} ${platformFilters.includes(p.id) ? styles.platformItemActive : ''}`}
                  onClick={() => togglePlatform(p.id)}
                >
                  <span className={styles.platformDot} style={{ background: p.color }} />
                  <span className={styles.platformName}>{p.label}</span>
                  <span className={styles.platformItemCount}>{count}</span>
                  <span className={styles.platformCheck}>{active ? '✓' : ''}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* View mode toggle */}
      <div className={styles.viewToggle}>
        <button
          className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.viewActive : ''}`}
          onClick={() => setViewMode('grid')}
          title="Grid view"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1" y="1" width="5" height="5" rx="1" />
            <rect x="8" y="1" width="5" height="5" rx="1" />
            <rect x="1" y="8" width="5" height="5" rx="1" />
            <rect x="8" y="8" width="5" height="5" rx="1" />
          </svg>
        </button>
        <button
          className={`${styles.viewBtn} ${viewMode === 'list' ? styles.viewActive : ''}`}
          onClick={() => setViewMode('list')}
          title="List view"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="1" y1="3" x2="13" y2="3" />
            <line x1="1" y1="7" x2="13" y2="7" />
            <line x1="1" y1="11" x2="13" y2="11" />
          </svg>
        </button>
      </div>

      {/* Market count */}
      <span className={styles.marketCount}>{totalCount.toLocaleString()} markets</span>
    </div>
  );
});
