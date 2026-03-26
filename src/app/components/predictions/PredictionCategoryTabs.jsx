// Category tabs — Apple segmented control with sliding indicator
import { memo, useRef, useEffect, useState } from 'react';
import usePredictionStore from '../../../state/usePredictionStore.js';
import styles from './PredictionCategoryTabs.module.css';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'trending', label: 'Trending' },
  { id: 'finance', label: 'Finance' },
  { id: 'economy', label: 'Economy' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'politics', label: 'Politics' },
  { id: 'tech', label: 'Tech' },
  { id: 'sports', label: 'Sports' },
  { id: 'geopolitics', label: 'Geopolitics' },
  { id: 'climate', label: 'Climate' },
  { id: 'science', label: 'Science' },
  { id: 'culture', label: 'Culture' },
  { id: 'entertainment', label: 'Entertainment' },
  { id: 'health', label: 'Health' },
];

export default memo(function PredictionCategoryTabs() {
  const activeCategory = usePredictionStore((s) => s.activeCategory);
  const setCategory = usePredictionStore((s) => s.setCategory);
  const stats = usePredictionStore((s) => s.stats);
  const subcategories = usePredictionStore((s) => s.subcategories);
  const activeSubcategory = usePredictionStore((s) => s.activeSubcategory);
  const setSubcategory = usePredictionStore((s) => s.setSubcategory);

  const tabsRef = useRef(null);
  const [indicatorStyle, setIndicatorStyle] = useState({});

  // Slide indicator to active tab
  useEffect(() => {
    const container = tabsRef.current;
    if (!container) return;
    const activeEl = container.querySelector(`[data-tab="${activeCategory}"]`);
    if (!activeEl) return;

    setIndicatorStyle({
      width: activeEl.offsetWidth,
      transform: `translateX(${activeEl.offsetLeft}px)`,
    });
  }, [activeCategory]);

  const categoryCounts = stats?.categoryCounts || {};

  return (
    <div className={styles.wrapper}>
      {/* Main category tabs */}
      <div className={styles.tabsScroll}>
        <div className={styles.tabs} ref={tabsRef} role="tablist" aria-label="Market categories">
          <div className={styles.indicator} style={indicatorStyle} />
          {TABS.map((tab) => {
            const count = tab.id === 'all' ? stats?.totalActiveMarkets : categoryCounts[tab.id];
            return (
              <button
                key={tab.id}
                data-tab={tab.id}
                className={`${styles.tab} ${activeCategory === tab.id ? styles.active : ''}`}
                onClick={() => setCategory(tab.id)}
                role="tab"
                aria-selected={activeCategory === tab.id}
                aria-label={`${tab.label}${count > 0 ? `, ${count} markets` : ''}`}
              >
                {tab.label}
                {count > 0 && <sup className={styles.count}>{count}</sup>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Subcategory pills (Polymarket-style) */}
      {subcategories.length > 0 && activeCategory !== 'all' && (
        <div className={styles.subPills}>
          <button
            className={`${styles.subPill} ${!activeSubcategory ? styles.subActive : ''}`}
            onClick={() => setSubcategory(null)}
          >
            All
          </button>
          {subcategories.map((sub) => (
            <button
              key={sub.sub}
              className={`${styles.subPill} ${activeSubcategory === sub.sub ? styles.subActive : ''}`}
              onClick={() => setSubcategory(sub.sub)}
            >
              {sub.sub}
              <span className={styles.subCount}>{sub.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
