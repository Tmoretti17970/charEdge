// Sidebar — Apple clean list with time filters + topic tags
import { memo, useState } from 'react';
import { TIME_BUCKETS } from '../../../data/schemas/PredictionMarketSchema.js';
import usePredictionStore from '../../../state/usePredictionStore.js';
import styles from './PredictionSidebar.module.css';

const VISIBLE_TAGS = 15;

export default memo(function PredictionSidebar() {
  const activeTimeFilter = usePredictionStore((s) => s.activeTimeFilter);
  const setTimeFilter = usePredictionStore((s) => s.setTimeFilter);
  const timeframeCounts = usePredictionStore((s) => s.timeframeCounts);
  const topicTags = usePredictionStore((s) => s.topicTags);
  const activeTags = usePredictionStore((s) => s.activeTags);
  const toggleTag = usePredictionStore((s) => s.toggleTag);

  const [showAllTags, setShowAllTags] = useState(false);
  const [tagSearch, setTagSearch] = useState('');

  const filteredTags = topicTags.filter((t) => !tagSearch || t.tag.toLowerCase().includes(tagSearch.toLowerCase()));
  const visibleTags = showAllTags ? filteredTags : filteredTags.slice(0, VISIBLE_TAGS);

  return (
    <aside className={styles.sidebar} aria-label="Market filters">
      {/* Time Filters */}
      <div className={styles.section}>
        {TIME_BUCKETS.map((bucket) => {
          const count = timeframeCounts[bucket.id] || 0;
          const isActive = activeTimeFilter === bucket.id;
          return (
            <button
              key={bucket.id}
              className={`${styles.filterItem} ${isActive ? styles.active : ''}`}
              onClick={() => setTimeFilter(bucket.id)}
            >
              <span className={styles.filterIcon}>{bucket.icon}</span>
              <span className={styles.filterLabel}>{bucket.label}</span>
              <span className={styles.filterCount}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className={styles.divider} />

      {/* Topic Tags */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>TOPICS</div>

        {/* Tag search */}
        <div className={styles.tagSearchWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            className={styles.tagSearch}
            type="text"
            placeholder="Search topics..."
            value={tagSearch}
            onChange={(e) => setTagSearch(e.target.value)}
          />
        </div>

        {visibleTags.map((tag) => {
          const isActive = activeTags.includes(tag.tag);
          return (
            <button
              key={tag.tag}
              className={`${styles.filterItem} ${isActive ? styles.active : ''}`}
              onClick={() => toggleTag(tag.tag)}
            >
              <span className={styles.tagDot} style={{ background: getCategoryColor(tag.category) }} />
              <span className={styles.filterLabel}>{tag.tag}</span>
              <span className={styles.filterCount}>{tag.count}</span>
            </button>
          );
        })}

        {filteredTags.length > VISIBLE_TAGS && (
          <button className={styles.showMore} onClick={() => setShowAllTags(!showAllTags)}>
            <span className={`${styles.chevron} ${showAllTags ? styles.open : ''}`}>›</span>
            {showAllTags ? 'Show less' : `Show ${filteredTags.length - VISIBLE_TAGS} more`}
          </button>
        )}
      </div>
    </aside>
  );
});

function getCategoryColor(category) {
  const colors = {
    crypto: '#f59e0b',
    finance: '#3b82f6',
    economy: '#5c9cf5',
    politics: '#a855f7',
    tech: '#8b5cf6',
    sports: '#06b6d4',
    geopolitics: '#ef4444',
    climate: '#10b981',
    health: '#22d3ee',
  };
  return colors[category] || '#94a3b8';
}
