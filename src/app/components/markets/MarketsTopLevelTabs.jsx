// ═══════════════════════════════════════════════════════════════════
// charEdge — Markets Top-Level Tabs
//
// Apple segmented control: Top | Predictions | Watchlist
// Sliding indicator animation, badge counts, hover effects.
// ═══════════════════════════════════════════════════════════════════

import { memo, useRef, useEffect, useState, useCallback } from 'react';
import { useMarketsPrefsStore } from '../../../state/useMarketsPrefsStore';
import usePredictionStore from '../../../state/usePredictionStore';
import { useWatchlistStore } from '../../../state/useWatchlistStore';
import styles from './MarketsTopLevelTabs.module.css';

const TABS = [
  { id: 'top', label: 'Top', icon: '🔥' },
  { id: 'predictions', label: 'Predictions', icon: '🎯' },
  { id: 'watchlist', label: 'Watchlist', icon: '👁' },
];

export default memo(function MarketsTopLevelTabs() {
  const activeTab = useMarketsPrefsStore((s) => s.activeTopTab);
  const setActiveTab = useMarketsPrefsStore((s) => s.setActiveTopTab);

  const watchlistCount = useWatchlistStore((s) => s.items.length);
  const predictionCount = usePredictionStore((s) => s.stats?.totalActiveMarkets || 0);

  const tabsRef = useRef(null);
  const [indicatorStyle, setIndicatorStyle] = useState({});

  // Slide indicator to active tab
  useEffect(() => {
    const container = tabsRef.current;
    if (!container) return;
    const activeEl = container.querySelector(`[data-tab="${activeTab}"]`);
    if (!activeEl) return;

    setIndicatorStyle({
      width: activeEl.offsetWidth,
      transform: `translateX(${activeEl.offsetLeft}px)`,
    });
  }, [activeTab]);

  // Preload predictions bundle on hover
  const handlePredictionHover = useCallback(() => {
    import('./PredictionsTabContent.jsx').catch(() => {});
  }, []);

  const getBadge = (tabId) => {
    if (tabId === 'watchlist' && watchlistCount > 0) return watchlistCount;
    if (tabId === 'predictions' && predictionCount > 0) return predictionCount;
    return null;
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.tabs} ref={tabsRef} role="tablist" aria-label="Markets sections">
        <div className={styles.indicator} style={indicatorStyle} />
        {TABS.map((tab) => {
          const badge = getBadge(tab.id);
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              data-tab={tab.id}
              className={`${styles.tab} ${isActive ? styles.active : ''}`}
              onClick={() => setActiveTab(tab.id)}
              onMouseEnter={tab.id === 'predictions' ? handlePredictionHover : undefined}
              role="tab"
              aria-selected={isActive}
              aria-label={`${tab.label}${badge ? `, ${badge} items` : ''}`}
            >
              <span className={styles.icon}>{tab.icon}</span>
              {tab.label}
              {badge != null && <span className={styles.badge}>{badge > 999 ? '999+' : badge}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
});
