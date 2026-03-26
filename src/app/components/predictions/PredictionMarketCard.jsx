// Market Card — Apple clean card with multi-outcome support
import { memo, useState, useCallback } from 'react';
import { formatVolume, formatMultiplier, timeToClose } from '../../../data/schemas/PredictionMarketSchema.js';
import { SOURCE_CONFIG, CATEGORY_CONFIG } from '../../../data/schemas/PredictionMarketSchema.js';
import usePredictionDetailStore from '../../../state/usePredictionDetailStore.js';
import usePredictionStore from '../../../state/usePredictionStore.js';
import usePredictionWatchlistStore from '../../../state/usePredictionWatchlistStore.js';
import styles from './PredictionMarketCard.module.css';

const MAX_VISIBLE_OUTCOMES = 3;

export default memo(function PredictionMarketCard({ market }) {
  const [expanded, setExpanded] = useState(false);
  const openMarket = usePredictionDetailStore((s) => s.openMarket);
  const toggleBookmark = usePredictionWatchlistStore((s) => s.toggleBookmark);
  const isBookmarked = usePredictionWatchlistStore((s) => s.isBookmarked);
  const bookmarked = isBookmarked(market?.id);

  const handleCardClick = useCallback(
    (e) => {
      e.preventDefault();
      const allMarkets = usePredictionStore.getState().markets;
      openMarket(market, allMarkets);
    },
    [market, openMarket],
  );

  if (!market) return null;

  const outcomes = market.outcomes || [];
  const visibleOutcomes = expanded ? outcomes : outcomes.slice(0, MAX_VISIBLE_OUTCOMES);
  const hiddenCount = outcomes.length - MAX_VISIBLE_OUTCOMES;
  const catConfig = CATEGORY_CONFIG[market.category] || CATEGORY_CONFIG.other;
  const sourceConfig = SOURCE_CONFIG[market.source] || {};
  const remaining = timeToClose(market.closeDate);

  // Breaking: >10% probability shift in 24h
  const isBreaking = Math.abs(market.change24h || 0) >= 10;
  // New: created in last 24 hours
  const isNew = market.createdDate && Date.now() - new Date(market.createdDate).getTime() < 86_400_000;

  return (
    <div className={styles.card} onClick={handleCardClick} role="button" tabIndex={0}>
      {/* Category badge + status badges */}
      <div className={styles.catBadge}>
        <span className={styles.catDot} style={{ background: catConfig.color }} />
        <span className={styles.catLabel}>{market.subcategory || catConfig.label}</span>
        {isBreaking && <span className={styles.breakingBadge}>BREAKING</span>}
        {isNew && !isBreaking && <span className={styles.newBadge}>NEW</span>}
      </div>

      {/* Title row */}
      <div className={styles.titleRow}>
        {market.imageUrl && <img className={styles.eventImage} src={market.imageUrl} alt="" />}
        <h3 className={styles.title}>{market.question}</h3>
      </div>

      {/* Outcomes */}
      <div className={styles.outcomes}>
        {visibleOutcomes.map((outcome, i) => {
          const _delta = outcome.probability - outcome.previousProbability;
          const multiplierStr = formatMultiplier(outcome.payoutMultiplier);
          return (
            <div key={i} className={styles.outcomeRow}>
              <span className={styles.outcomeLabel}>{outcome.label}</span>
              <div className={styles.outcomeRight}>
                {multiplierStr && <span className={styles.multiplier}>{multiplierStr}</span>}
                <span className={styles.probPill}>{outcome.probability}%</span>
                <button className={`${styles.tradeBtn} ${styles.yesBtn}`}>Yes</button>
                <button className={`${styles.tradeBtn} ${styles.noBtn}`}>No</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Show more */}
      {hiddenCount > 0 && !expanded && (
        <button
          className={styles.showMore}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setExpanded(true);
          }}
        >
          Show {hiddenCount} more
        </button>
      )}
      {expanded && hiddenCount > 0 && (
        <button
          className={styles.showMore}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setExpanded(false);
          }}
        >
          Show less
        </button>
      )}

      {/* Footer */}
      <div className={styles.footer}>
        <span className={styles.volume}>{formatVolume(market.volume24h)} Vol.</span>
        {remaining && <span className={styles.remaining}>{remaining}</span>}
        {market.relatedMarketCount > 1 && (
          <span className={styles.relatedCount}>{market.relatedMarketCount} markets</span>
        )}
        <div className={styles.footerActions}>
          <span className={styles.sourceDot} style={{ background: sourceConfig.color }} title={sourceConfig.label} />
          <button
            className={`${styles.iconBtn} ${bookmarked ? styles.bookmarked : ''}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleBookmark(market.id);
            }}
            title="Bookmark"
          >
            {bookmarked ? '♥' : '♡'}
          </button>
          <button
            className={styles.iconBtn}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            title="Share"
          >
            ↗
          </button>
        </div>
      </div>
    </div>
  );
});
