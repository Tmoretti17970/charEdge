// List Row — Apple dense-but-readable single-row market display
import { memo, useCallback } from 'react';
import {
  formatVolume,
  timeToClose,
  CATEGORY_CONFIG,
  SOURCE_CONFIG,
} from '../../../data/schemas/PredictionMarketSchema.js';
import usePredictionDetailStore from '../../../state/usePredictionDetailStore.js';
import usePredictionStore from '../../../state/usePredictionStore.js';
import usePredictionWatchlistStore from '../../../state/usePredictionWatchlistStore.js';
import styles from './PredictionListRow.module.css';

export default memo(function PredictionListRow({ market }) {
  const openMarket = usePredictionDetailStore((s) => s.openMarket);
  const toggleBookmark = usePredictionWatchlistStore((s) => s.toggleBookmark);
  const isBookmarked = usePredictionWatchlistStore((s) => s.isBookmarked);
  const bookmarked = isBookmarked(market?.id);

  const handleClick = useCallback(() => {
    const allMarkets = usePredictionStore.getState().markets;
    openMarket(market, allMarkets);
  }, [market, openMarket]);

  if (!market) return null;

  const lead = market.outcomes?.[0];
  const probability = lead?.probability || 0;
  const delta = market.change24h || 0;
  const catConfig = CATEGORY_CONFIG[market.category] || CATEGORY_CONFIG.other;
  const sourceConfig = SOURCE_CONFIG[market.source] || {};
  const remaining = timeToClose(market.closeDate);

  return (
    <div className={styles.row} onClick={handleClick} role="button" tabIndex={0}>
      {/* Category dot */}
      <span className={styles.catDot} style={{ background: catConfig.color }} />

      {/* Title */}
      <span className={styles.title}>{market.question}</span>

      {/* Lead outcome label */}
      {lead && market.outcomes.length > 2 && <span className={styles.leadLabel}>{lead.label}</span>}

      {/* Probability pill */}
      <span className={styles.probPill}>{probability}%</span>

      {/* Delta */}
      <span
        className={styles.delta}
        style={{ color: delta > 0 ? '#22c55e' : delta < 0 ? '#ef4444' : 'var(--tf-tx-2)' }}
      >
        {delta > 0 ? '+' : ''}
        {delta}%
      </span>

      {/* Volume */}
      <span className={styles.volume}>{formatVolume(market.volume24h)}</span>

      {/* Time remaining */}
      <span className={styles.remaining}>{remaining || '—'}</span>

      {/* Source */}
      <span className={styles.sourceDot} style={{ background: sourceConfig.color }} title={sourceConfig.label} />

      {/* Bookmark */}
      <button
        className={`${styles.bookmarkBtn} ${bookmarked ? styles.bookmarked : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          toggleBookmark(market.id);
        }}
      >
        {bookmarked ? '♥' : '♡'}
      </button>
    </div>
  );
});
