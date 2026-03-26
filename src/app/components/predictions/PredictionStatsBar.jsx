// Stats bar — Apple-style glanceable metrics strip
import React, { memo } from 'react';
import { formatStatValue, formatCount } from '../../../data/services/PredictionStatsService.js';
import usePredictionStore from '../../../state/usePredictionStore.js';
import styles from './PredictionStatsBar.module.css';

const STAT_ITEMS = [
  { key: 'totalActiveMarkets', label: 'ACTIVE MARKETS', format: 'count' },
  { key: 'totalVolume', label: 'TOTAL VOLUME', format: 'currency' },
  { key: 'volume24h', label: '24H VOLUME', format: 'currency' },
  { key: 'totalOpenInterest', label: 'OPEN INTEREST', format: 'currency' },
  { key: 'totalLiquidity', label: 'LIQUIDITY', format: 'currency' },
];

export default memo(function PredictionStatsBar() {
  const stats = usePredictionStore((s) => s.stats);

  return (
    <div className={styles.bar}>
      {STAT_ITEMS.map((item, i) => {
        const value = stats?.[item.key] || 0;
        const formatted = item.format === 'count' ? formatCount(value) : formatStatValue(value);
        return (
          <React.Fragment key={item.key}>
            {i > 0 && <div className={styles.divider} />}
            <div className={styles.stat}>
              <span className={styles.label}>{item.label}</span>
              <span className={styles.value}>{formatted}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
});
