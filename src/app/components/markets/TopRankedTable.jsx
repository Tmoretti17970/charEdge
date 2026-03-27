// ═══════════════════════════════════════════════════════════════════
// charEdge — Top Ranked Table (Phase 3: Real-time + Automation)
//
// CoinMarketCap-style ranked market table with:
//   - Virtual scrolling for 200+ rows (useVirtualScroll)
//   - Price flash animations on real-time updates
//   - Keyboard navigation (j/k/arrows, Enter, Escape, /)
//   - Inline detail expansion panel
// ═══════════════════════════════════════════════════════════════════

import React, { memo, useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { C, M } from '../../../constants.js';
import { useMarketsKeyboard } from '../../../hooks/useMarketsKeyboard.ts';
import { useVirtualScroll } from '../../../hooks/useVirtualScroll.ts';
import { fmt } from '../../../shared/formatting.ts';
import useTopMarketsStore from '../../../state/useTopMarketsStore.js';
import { useWatchlistStore } from '../../../state/useWatchlistStore.js';
import styles from './TopRankedTable.module.css';

const ROW_HEIGHT = 56; // px per row (for virtual scroll)
const _DETAIL_ROW_HEIGHT = 180; // expanded detail panel height

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
  return n.toFixed(2) + '%';
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
  const color = isUp ? C.g || '#34C759' : C.r || '#FF3B30';

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

// ─── Inline Detail Expansion Panel ──────────────────────────────

function DetailPanel({ market }) {
  if (!market) return null;

  const isUp = (market.change24h || 0) >= 0;
  const changeColor = isUp ? C.g || '#34C759' : C.r || '#FF3B30';

  return (
    <tr className={styles.detailRow}>
      <td colSpan={COLUMNS.length + 1}>
        <div className={styles.detailPanel}>
          <div className={styles.detailGrid}>
            {/* Price overview */}
            <div className={styles.detailSection}>
              <span className={styles.detailLabel}>Current Price</span>
              <span className={styles.detailValue} style={{ fontFamily: M, fontSize: 20, fontWeight: 700 }}>
                ${fmt(market.price)}
              </span>
              <span style={{ color: changeColor, fontFamily: M, fontSize: 13, fontWeight: 600 }}>
                {isUp ? '▲' : '▼'} {fmtPercent(Math.abs(market.change24h || 0))} today
              </span>
            </div>

            {/* Key stats */}
            <div className={styles.detailSection}>
              <span className={styles.detailLabel}>Market Cap</span>
              <span className={styles.detailValue}>{fmtCompact(market.marketCap)}</span>
            </div>

            <div className={styles.detailSection}>
              <span className={styles.detailLabel}>24h Volume</span>
              <span className={styles.detailValue}>{fmtCompact(market.volume24h)}</span>
            </div>

            <div className={styles.detailSection}>
              <span className={styles.detailLabel}>Circulating Supply</span>
              <span className={styles.detailValue}>{fmtSupply(market.supply, market.symbol)}</span>
            </div>

            {/* Performance row */}
            <div className={styles.detailSection}>
              <span className={styles.detailLabel}>Performance</span>
              <div className={styles.perfRow}>
                <PerfBadge label="1h" value={market.change1h} />
                <PerfBadge label="24h" value={market.change24h} />
                <PerfBadge label="7d" value={market.change7d} />
              </div>
            </div>

            {/* Sparkline large */}
            <div className={styles.detailSection}>
              <span className={styles.detailLabel}>7-Day Trend</span>
              <MiniSparkline data={market.sparkline7d} width={200} height={48} />
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

function PerfBadge({ label, value }) {
  if (value == null) return null;
  const isUp = value >= 0;
  const bg = isUp ? 'rgba(52, 199, 89, 0.1)' : 'rgba(255, 59, 48, 0.1)';
  const color = isUp ? C.g || '#34C759' : C.r || '#FF3B30';
  return (
    <span className={styles.perfBadge} style={{ background: bg, color }}>
      {label}: {isUp ? '+' : ''}
      {value.toFixed(2)}%
    </span>
  );
}

// ─── Table Component ────────────────────────────────────────────

export default memo(function TopRankedTable({ priceUpdates = {}, searchRef }) {
  const sortBy = useTopMarketsStore((s) => s.sortBy);
  const sortDir = useTopMarketsStore((s) => s.sortDir);
  const setSortBy = useTopMarketsStore((s) => s.setSortBy);
  const loading = useTopMarketsStore((s) => s.loading);
  const markets = useTopMarketsStore((s) => s.markets);
  const assetClassFilter = useTopMarketsStore((s) => s.assetClassFilter);
  const topicFilter = useTopMarketsStore((s) => s.topicFilter);
  const searchQuery = useTopMarketsStore((s) => s.searchQuery);

  const containerRef = useRef(null);
  const [expandedSymbol, setExpandedSymbol] = useState(null);

  // Get ALL filtered items (no pagination — virtual scroll handles windowing)
  const allItems = useMemo(() => {
    return useTopMarketsStore.getState().getFilteredMarkets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markets, sortBy, sortDir, assetClassFilter, topicFilter, searchQuery]);

  // Virtual scrolling
  const { virtualItems, totalHeight, isVirtualized } = useVirtualScroll({
    itemCount: allItems.length,
    itemHeight: ROW_HEIGHT,
    containerRef,
    overscan: 8,
    enabled: true,
  });

  // Keyboard navigation
  const handleSelect = useCallback((symbol) => {
    setExpandedSymbol((prev) => (prev === symbol ? null : symbol));
  }, []);

  const handleRemove = useCallback(() => {
    // No-op for tops table (not a watchlist)
  }, []);

  const handleDoubleClick = useCallback(() => {
    // Future: navigate to chart
  }, []);

  const { focusedIndex } = useMarketsKeyboard({
    items: allItems,
    onSelect: handleSelect,
    onRemove: handleRemove,
    onDoubleClick: handleDoubleClick,
    searchRef,
    detailOpen: expandedSymbol != null,
    closeDetail: () => setExpandedSymbol(null),
  });

  const handleSort = useCallback(
    (colId) => {
      const col = COLUMNS.find((c) => c.id === colId);
      if (col?.sortable) setSortBy(colId);
    },
    [setSortBy],
  );

  const handleRowClick = useCallback((symbol) => {
    setExpandedSymbol((prev) => (prev === symbol ? null : symbol));
  }, []);

  if (loading && allItems.length === 0) {
    return <TableSkeleton />;
  }

  return (
    <div className={styles.wrapper} ref={containerRef}>
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
        <tbody style={isVirtualized ? { position: 'relative', height: totalHeight } : undefined}>
          {isVirtualized
            ? // Virtualized rendering
              virtualItems.map((vi) => {
                const market = allItems[vi.index];
                if (!market) return null;
                const update = priceUpdates[market.symbol];
                return (
                  <MarketRow
                    key={market.id}
                    market={market}
                    index={vi.index}
                    offsetY={vi.offsetY}
                    virtualized
                    priceDirection={update?.direction}
                    isFocused={focusedIndex === vi.index}
                    isExpanded={expandedSymbol === market.symbol}
                    onClick={() => handleRowClick(market.symbol)}
                  />
                );
              })
            : // Non-virtualized rendering
              allItems.map((market, i) => {
                const update = priceUpdates[market.symbol];
                return (
                  <React.Fragment key={market.id}>
                    <MarketRow
                      market={market}
                      index={i}
                      priceDirection={update?.direction}
                      isFocused={focusedIndex === i}
                      isExpanded={expandedSymbol === market.symbol}
                      onClick={() => handleRowClick(market.symbol)}
                    />
                    {expandedSymbol === market.symbol && <DetailPanel market={market} />}
                  </React.Fragment>
                );
              })}
        </tbody>
      </table>

      {/* Item count footer */}
      <div className={styles.pagination}>
        <span className={styles.pageInfo}>
          {allItems.length} assets{isVirtualized ? ' · Virtual scroll active' : ''}
          {focusedIndex >= 0 ? ` · Row ${focusedIndex + 1} focused` : ''}
        </span>
      </div>
    </div>
  );
});

// ─── Market Row ─────────────────────────────────────────────────

const MarketRow = memo(function MarketRow({
  market,
  _index,
  offsetY,
  virtualized,
  priceDirection,
  isFocused,
  isExpanded,
  onClick,
}) {
  const rowRef = useRef(null);
  const flashKeyRef = useRef(0);

  // Price flash animation: re-trigger by updating key
  useEffect(() => {
    if (priceDirection) {
      flashKeyRef.current += 1;
      const el = rowRef.current;
      if (!el) return;

      // Apply flash class
      const flashClass = priceDirection === 'up' ? 'markets-row-flash-up' : 'markets-row-flash-down';
      el.classList.add(flashClass);

      const timer = setTimeout(() => {
        el.classList.remove(flashClass);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [priceDirection, market.price]);

  // Scroll focused row into view
  useEffect(() => {
    if (isFocused && rowRef.current) {
      rowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isFocused]);

  const changeColor = (val) => {
    if (val == null) return C.t3;
    return val >= 0 ? C.g : C.r;
  };

  // Price direction indicator class for the price cell
  const priceFlashClass =
    priceDirection === 'up' ? 'markets-price-tick-up' : priceDirection === 'down' ? 'markets-price-tick-down' : '';

  const rowStyle = virtualized
    ? { position: 'absolute', top: offsetY, left: 0, right: 0, height: ROW_HEIGHT }
    : undefined;

  const rowClasses = [
    styles.row,
    'markets-row-transition',
    isFocused ? 'markets-row-focused' : '',
    isExpanded ? styles.rowExpanded : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <tr
      ref={rowRef}
      className={rowClasses}
      style={rowStyle}
      onClick={onClick}
      data-symbol={market.symbol}
      aria-selected={isFocused}
      role="row"
    >
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
      <td className={`${styles.td} ${priceFlashClass}`} style={{ textAlign: 'right', fontFamily: M, fontWeight: 600 }}>
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
            <tr key={i} className={`${styles.row} ${styles.skeletonRow}`}>
              <td className={styles.td}>
                <div className={styles.skeleton} style={{ width: 16, height: 16, borderRadius: '50%' }} />
              </td>
              {/* Rank */}
              <td className={styles.td}>
                <div className={styles.skeleton} style={{ width: 20 }} />
              </td>
              {/* Name — icon + text */}
              <td className={styles.td}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className={styles.skeletonCircle} />
                  <div style={{ flex: 1 }}>
                    <div className={styles.skeleton} style={{ width: '55%', marginBottom: 6 }} />
                    <div className={styles.skeleton} style={{ width: '35%', height: 10 }} />
                  </div>
                </div>
              </td>
              {/* Price */}
              <td className={styles.td}>
                <div className={styles.skeleton} style={{ width: '75%', marginLeft: 'auto' }} />
              </td>
              {/* 1h% */}
              <td className={styles.td}>
                <div className={styles.skeleton} style={{ width: '60%', marginLeft: 'auto' }} />
              </td>
              {/* 24h% */}
              <td className={styles.td}>
                <div className={styles.skeleton} style={{ width: '60%', marginLeft: 'auto' }} />
              </td>
              {/* 7d% */}
              <td className={styles.td}>
                <div className={styles.skeleton} style={{ width: '60%', marginLeft: 'auto' }} />
              </td>
              {/* Market Cap */}
              <td className={styles.td}>
                <div className={styles.skeleton} style={{ width: '70%', marginLeft: 'auto' }} />
              </td>
              {/* Volume */}
              <td className={styles.td}>
                <div className={styles.skeleton} style={{ width: '65%', marginLeft: 'auto' }} />
              </td>
              {/* Supply */}
              <td className={styles.td}>
                <div className={styles.skeleton} style={{ width: '55%', marginLeft: 'auto' }} />
              </td>
              {/* Sparkline */}
              <td className={styles.td}>
                <div className={styles.skeleton} style={{ width: 80, height: 24, borderRadius: 4, margin: '0 auto' }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
