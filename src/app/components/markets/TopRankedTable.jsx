// ═══════════════════════════════════════════════════════════════════
// charEdge — Top Ranked Table
//
// CoinMarketCap-style ranked market table. Shows top assets by
// market cap with live prices, % changes, volume, and sparklines.
// ═══════════════════════════════════════════════════════════════════

import { memo, useMemo, useCallback } from 'react';
import { C, M } from '../../../constants.js';
import { fmt } from '../../../shared/formatting.ts';
import useTopMarketsStore from '../../../state/useTopMarketsStore.js';
import { useWatchlistStore } from '../../../state/useWatchlistStore.js';
import styles from './TopRankedTable.module.css';

const ASSET_CLASS_COLORS = {
  crypto: '#F7931A',
  stock: '#4A90D9',
  futures: '#8B5CF6',
  etf: '#10B981',
  forex: '#06B6D4',
};

const COLUMNS = [
  { id: 'rank', label: '#', width: 40, sortable: true, align: 'center' },
  { id: 'name', label: 'Name', width: 'auto', sortable: false, align: 'left' },
  { id: 'price', label: 'Price', width: 110, sortable: true, align: 'right' },
  { id: 'change1h', label: '1h %', width: 80, sortable: true, align: 'right' },
  { id: 'change24h', label: '24h %', width: 80, sortable: true, align: 'right' },
  { id: 'change7d', label: '7d %', width: 80, sortable: true, align: 'right' },
  { id: 'marketCap', label: 'Market Cap', width: 130, sortable: true, align: 'right' },
  { id: 'volume24h', label: 'Volume(24h)', width: 130, sortable: true, align: 'right' },
  { id: 'supply', label: 'Circulating Supply', width: 150, sortable: true, align: 'right' },
  { id: 'sparkline', label: 'Last 7 Days', width: 120, sortable: false, align: 'center' },
];

function fmtCompact(n) {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1e12) return sign + '$' + (a / 1e12).toFixed(2) + 'T';
  if (a >= 1e9) return sign + '$' + (a / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return sign + '$' + (a / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return sign + '$' + (a / 1e3).toFixed(1) + 'K';
  return sign + '$' + a.toFixed(2);
}

function fmtPercent(n) {
  if (n == null || isNaN(n)) return '—';
  const sign = n >= 0 ? '' : '';
  return sign + n.toFixed(2) + '%';
}

function fmtSupply(n, symbol) {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(n);
  let formatted;
  if (a >= 1e9) formatted = (a / 1e9).toFixed(2) + 'B';
  else if (a >= 1e6) formatted = (a / 1e6).toFixed(2) + 'M';
  else if (a >= 1e3) formatted = (a / 1e3).toFixed(1) + 'K';
  else formatted = a.toLocaleString();
  return `${formatted} ${symbol || ''}`;
}

// ─── Mini Sparkline (inline SVG) ────────────────────────────────

function MiniSparkline({ data, width = 100, height = 32 }) {
  if (!data || data.length < 2) {
    return <div style={{ width, height, opacity: 0.2 }} />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const isUp = data[data.length - 1] >= data[0];
  const color = isUp ? (C.g || '#34C759') : (C.r || '#FF3B30');

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Star/Bookmark Button ───────────────────────────────────────

function StarButton({ symbol, name, assetClass }) {
  const has = useWatchlistStore((s) => s.has(symbol));
  const add = useWatchlistStore((s) => s.add);
  const remove = useWatchlistStore((s) => s.remove);

  const toggle = useCallback(
    (e) => {
      e.stopPropagation();
      if (has) {
        remove(symbol);
      } else {
        add({ symbol, name, assetClass });
      }
    },
    [has, symbol, name, assetClass, add, remove],
  );

  return (
    <button
      onClick={toggle}
      aria-label={has ? 'Remove from watchlist' : 'Add to watchlist'}
      className={styles.starBtn}
      style={{ color: has ? '#f6b93b' : C.t3 }}
    >
      {has ? '★' : '☆'}
    </button>
  );
}

// ─── Table Component ────────────────────────────────────────────

export default memo(function TopRankedTable() {
  const sortBy = useTopMarketsStore((s) => s.sortBy);
  const sortDir = useTopMarketsStore((s) => s.sortDir);
  const setSortBy = useTopMarketsStore((s) => s.setSortBy);
  const loading = useTopMarketsStore((s) => s.loading);
  const markets = useTopMarketsStore((s) => s.markets);
  const assetClassFilter = useTopMarketsStore((s) => s.assetClassFilter);
  const topicFilter = useTopMarketsStore((s) => s.topicFilter);
  const searchQuery = useTopMarketsStore((s) => s.searchQuery);
  const page = useTopMarketsStore((s) => s.page);
  const pageSize = useTopMarketsStore((s) => s.pageSize);
  const setPage = useTopMarketsStore((s) => s.setPage);

  // Compute filtered/sorted/paginated results with useMemo (avoids infinite loop)
  const { items, total, totalPages } = useMemo(() => {
    return useTopMarketsStore.getState().getPaginatedMarkets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markets, sortBy, sortDir, assetClassFilter, topicFilter, searchQuery, page, pageSize]);

  const handleSort = useCallback(
    (colId) => {
      const col = COLUMNS.find((c) => c.id === colId);
      if (col?.sortable) setSortBy(colId);
    },
    [setSortBy],
  );

  if (loading && items.length === 0) {
    return <TableSkeleton />;
  }

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th style={{ width: 36 }} />
            {COLUMNS.map((col) => (
              <th
                key={col.id}
                onClick={() => col.sortable && handleSort(col.id)}
                className={`${styles.th} ${col.sortable ? styles.sortable : ''} ${sortBy === col.id ? styles.activeSort : ''}`}
                style={{
                  width: col.width === 'auto' ? undefined : col.width,
                  textAlign: col.align,
                  cursor: col.sortable ? 'pointer' : 'default',
                }}
              >
                {col.label}
                {sortBy === col.id && <span className={styles.sortArrow}>{sortDir === 'asc' ? ' ▲' : ' ▼'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((market, i) => (
            <MarketRow key={market.id} market={market} index={i} />
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className={styles.pageBtn}>
            ← Prev
          </button>
          <span className={styles.pageInfo}>
            Page {page} of {totalPages} ({total} assets)
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className={styles.pageBtn}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
});

// ─── Market Row ─────────────────────────────────────────────────

const MarketRow = memo(function MarketRow({ market }) {
  const changeColor = (val) => {
    if (val == null) return C.t3;
    return val >= 0 ? C.g : C.r;
  };

  return (
    <tr className={styles.row}>
      {/* Star */}
      <td className={styles.starCell}>
        <StarButton symbol={market.symbol} name={market.name} assetClass={market.assetClass} />
      </td>

      {/* Rank */}
      <td className={styles.td} style={{ textAlign: 'center', fontWeight: 600, color: C.t3 }}>
        {market.rank}
      </td>

      {/* Name */}
      <td className={styles.td}>
        <div className={styles.nameCell}>
          {market.image ? (
            <img src={market.image} alt="" className={styles.coinIcon} loading="lazy" />
          ) : (
            <span
              className={styles.coinIcon}
              style={{
                background: ASSET_CLASS_COLORS[market.assetClass] || C.bd,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 700,
                color: '#fff',
                borderRadius: '50%',
              }}
            >
              {market.symbol?.charAt(0)}
            </span>
          )}
          <div>
            <span className={styles.coinName}>{market.name}</span>
            <span className={styles.coinSymbol}>{market.symbol}</span>
          </div>
        </div>
      </td>

      {/* Price */}
      <td className={styles.td} style={{ textAlign: 'right', fontFamily: M, fontWeight: 600 }}>
        ${fmt(market.price)}
      </td>

      {/* 1h % */}
      <td className={styles.td} style={{ textAlign: 'right', color: changeColor(market.change1h) }}>
        {market.change1h != null ? (
          <span className={styles.changeVal}>
            {market.change1h >= 0 ? '▲' : '▼'} {fmtPercent(Math.abs(market.change1h))}
          </span>
        ) : (
          '—'
        )}
      </td>

      {/* 24h % */}
      <td className={styles.td} style={{ textAlign: 'right', color: changeColor(market.change24h) }}>
        {market.change24h != null ? (
          <span className={styles.changeVal}>
            {market.change24h >= 0 ? '▲' : '▼'} {fmtPercent(Math.abs(market.change24h))}
          </span>
        ) : (
          '—'
        )}
      </td>

      {/* 7d % */}
      <td className={styles.td} style={{ textAlign: 'right', color: changeColor(market.change7d) }}>
        {market.change7d != null ? (
          <span className={styles.changeVal}>
            {market.change7d >= 0 ? '▲' : '▼'} {fmtPercent(Math.abs(market.change7d))}
          </span>
        ) : (
          '—'
        )}
      </td>

      {/* Market Cap */}
      <td className={styles.td} style={{ textAlign: 'right', fontFamily: M }}>
        {fmtCompact(market.marketCap)}
      </td>

      {/* Volume 24h */}
      <td className={styles.td} style={{ textAlign: 'right', fontFamily: M }}>
        {fmtCompact(market.volume24h)}
      </td>

      {/* Supply */}
      <td className={styles.td} style={{ textAlign: 'right', fontFamily: M, fontSize: 11 }}>
        {fmtSupply(market.supply, market.symbol)}
      </td>

      {/* Sparkline */}
      <td className={styles.td} style={{ textAlign: 'center' }}>
        <MiniSparkline data={market.sparkline7d} width={100} height={32} />
      </td>
    </tr>
  );
});

// ─── Skeleton Loader ────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th style={{ width: 36 }} />
            {COLUMNS.map((col) => (
              <th key={col.id} className={styles.th} style={{ width: col.width === 'auto' ? undefined : col.width }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 10 }, (_, i) => (
            <tr key={i} className={styles.row}>
              <td className={styles.td} />
              {COLUMNS.map((col) => (
                <td key={col.id} className={styles.td}>
                  <div className={styles.skeleton} style={{ width: col.width === 'auto' ? '60%' : '70%' }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
