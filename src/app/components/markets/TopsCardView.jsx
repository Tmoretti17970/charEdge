// ═══════════════════════════════════════════════════════════════════
// charEdge — Tops Card View
//
// Grid of Apple-style cards for the Top discovery tab.
// Adapted from MarketsCardView to work with TopMarketsStore data.
// Shows: icon, name, price, 24h change, sparkline per asset.
// ═══════════════════════════════════════════════════════════════════

import { memo, useMemo, useCallback } from 'react';
import { C } from '../../../constants.js';
import useTopMarketsStore from '../../../state/useTopMarketsStore.js';
import { useWatchlistStore } from '../../../state/useWatchlistStore.js';
import styles from './TopsCardView.module.css';

const ASSET_CLASS_COLORS = {
  crypto: '#F7931A',
  stock: '#4A90D9',
  futures: '#8B5CF6',
  etf: '#10B981',
  forex: '#06B6D4',
};

function fmtPrice(val) {
  if (val == null || isNaN(val)) return '—';
  if (val >= 1000) return `$${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (val >= 1) return `$${val.toFixed(2)}`;
  return `$${val.toFixed(4)}`;
}

function fmtChange(val) {
  if (val == null || isNaN(val)) return '—';
  const sign = val >= 0 ? '+' : '';
  return `${sign}${val.toFixed(2)}%`;
}

function MiniSparkline({ data, width = 64, height = 28 }) {
  if (!data || data.length < 2) return <div style={{ width, height }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const isUp = data[data.length - 1] >= data[0];
  const color = isUp ? 'var(--tf-green, #34C759)' : 'var(--tf-red, #FF3B30)';
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={`sg-${isUp ? 'up' : 'dn'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${pts} ${width},${height}`}
        fill={`url(#sg-${isUp ? 'up' : 'dn'})`}
      />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const AssetCard = memo(function AssetCard({ market }) {
  const isUp = (market.change24h || 0) >= 0;
  const changeColor = isUp ? 'var(--tf-green, #34C759)' : 'var(--tf-red, #FF3B30)';
  const has = useWatchlistStore((s) => s.has(market.symbol));
  const add = useWatchlistStore((s) => s.add);
  const remove = useWatchlistStore((s) => s.remove);

  const toggleStar = useCallback((e) => {
    e.stopPropagation();
    if (has) remove(market.symbol);
    else add({ symbol: market.symbol, name: market.name, assetClass: market.assetClass });
  }, [has, market, add, remove]);

  return (
    <div className={styles.card}>
      {/* Header: icon + name + star */}
      <div className={styles.cardHeader}>
        <div className={styles.cardIdentity}>
          {market.image ? (
            <img src={market.image} alt="" className={styles.cardIcon} loading="lazy" />
          ) : (
            <span
              className={styles.cardIcon}
              style={{
                background: ASSET_CLASS_COLORS[market.assetClass] || C.bd,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 700,
                color: '#fff',
              }}
            >
              {market.symbol?.charAt(0)}
            </span>
          )}
          <div>
            <span className={styles.cardSymbol}>{market.symbol}</span>
            <span className={styles.cardName}>{market.name}</span>
          </div>
        </div>
        <button onClick={toggleStar} className={styles.starBtn} aria-label={has ? 'Remove from watchlist' : 'Add to watchlist'}>
          {has ? '★' : '☆'}
        </button>
      </div>

      {/* Sparkline */}
      <div className={styles.cardSparkline}>
        <MiniSparkline data={market.sparkline7d} width={120} height={40} />
      </div>

      {/* Footer: price + change */}
      <div className={styles.cardFooter}>
        <span className={styles.cardPrice}>{fmtPrice(market.price)}</span>
        <span className={styles.cardChange} style={{ color: changeColor }}>
          {isUp ? '▲' : '▼'} {fmtChange(market.change24h)}
        </span>
      </div>

      {/* Rank badge */}
      <span className={styles.rankBadge}>#{market.rank}</span>
    </div>
  );
});

export default memo(function TopsCardView() {
  const markets = useTopMarketsStore((s) => s.markets);
  const assetClassFilter = useTopMarketsStore((s) => s.assetClassFilter);
  const topicFilter = useTopMarketsStore((s) => s.topicFilter);
  const searchQuery = useTopMarketsStore((s) => s.searchQuery);
  const sortBy = useTopMarketsStore((s) => s.sortBy);
  const sortDir = useTopMarketsStore((s) => s.sortDir);

  const filtered = useMemo(() => {
    return useTopMarketsStore.getState().getFilteredMarkets();
  }, [markets, assetClassFilter, topicFilter, searchQuery, sortBy, sortDir]);

  // Show up to 60 cards (more feels cluttered)
  const items = filtered.slice(0, 60);

  if (items.length === 0) {
    return (
      <div className={styles.empty}>
        <span>No assets match your filters</span>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {items.map(market => (
        <AssetCard key={market.id} market={market} />
      ))}
    </div>
  );
});
