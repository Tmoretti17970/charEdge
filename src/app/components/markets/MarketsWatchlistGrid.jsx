// ═══════════════════════════════════════════════════════════════════
// charEdge — Markets Watchlist Grid (Sprint 4 + Sprint 6-7)
//
// Full-page watchlist grid for the Markets tab. Built on the same
// data layer as HomeWatchlist with:
//   - Dynamic columns from useMarketsPrefsStore (Sprint 6)
//   - Sortable column headers via prefs store (Sprint 7)
//   - Asset class filtering + group-by (Sprint 7)
//   - Live prices, sparklines, P&L from existing hooks
//
// Reuses: useWatchlistStore, useWatchlistStreaming, Sparkline,
//         enrichWithTradeStats, SparklineService, useMarketsPrefsStore
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { C } from '../../../constants.js';
import '../../../styles/markets-animations.css';
import { fmtCompact } from '../../../data/FundamentalService.js';
import { useDragReorder } from '../../../hooks/useDragReorder';
import { useFundamentalsEnrich } from '../../../hooks/useFundamentalsEnrich';
import { useVirtualScroll } from '../../../hooks/useVirtualScroll';
import useWatchlistStreaming from '../../../hooks/useWatchlistStreaming.js';
import { useChartCoreStore } from '../../../state/chart/useChartCoreStore';
import { useAlertStore } from '../../../state/useAlertStore';
import { useJournalStore } from '../../../state/useJournalStore';
import { useMarketsPrefsStore, ALL_COLUMNS } from '../../../state/useMarketsPrefsStore';
import { useUIStore } from '../../../state/useUIStore';
import { useWatchlistStore, enrichWithTradeStats, groupByAssetClass } from '../../../state/useWatchlistStore.js';
import { radii, transition } from '../../../theme/tokens.js';
import Sparkline from '../ui/Sparkline.jsx';
import EarningsBadge from './EarningsBadge.jsx';
import MarketsRowContextMenu from './MarketsRowContextMenu.jsx';

// ─── Format helpers ────────────────────────────────────────────

function fmtPrice(val) {
  if (val == null || isNaN(val)) return '—';
  if (val >= 1000) return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (val >= 1) return `$${val.toFixed(2)}`;
  return `$${val.toFixed(4)}`;
}

function fmtChange(val) {
  if (val == null || isNaN(val)) return '—';
  const sign = val >= 0 ? '+' : '';
  return `${sign}${val.toFixed(2)}%`;
}

function fmtVolume(val) {
  if (val == null || isNaN(val)) return '—';
  if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}B`;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toFixed(0);
}

function fmtPnl(val) {
  if (val == null || isNaN(val)) return '';
  const sign = val >= 0 ? '+' : '';
  return `${sign}$${Math.abs(val).toFixed(0)}`;
}

function fmtDate(val) {
  if (!val) return '—';
  try {
    const d = new Date(val);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
}

// ─── Asset class colors ────────────────────────────────────────

const ASSET_COLORS = {
  crypto: '#F7931A',
  stocks: '#4A90D9',
  futures: '#8B5CF6',
  etf: '#10B981',
  forex: '#06B6D4',
  options: '#EC4899',
  other: '#6B7280',
};

// ─── Grid template builder ─────────────────────────────────────

function buildGridTemplate(columns, isNarrow) {
  return columns
    .map((col) => {
      switch (col) {
        case 'symbol':
          return isNarrow ? '2fr' : '2fr';
        case 'sparkline':
          return isNarrow ? '60px' : '80px';
        case 'price':
          return '1fr';
        case 'change':
          return '1fr';
        case 'volume':
          return '1fr';
        case 'weekRange':
          return '140px';
        case 'volProfile':
          return '130px';
        case 'pnl':
          return '1fr';
        case 'tradeCount':
          return '80px';
        case 'lastTraded':
          return '90px';
        case 'assetClass':
          return '80px';
        default:
          return '1fr';
      }
    })
    .join(' ');
}

// ═══════════════════════════════════════════════════════════════════
// MarketsWatchlistGrid — Main Component
// ═══════════════════════════════════════════════════════════════════

export default function MarketsWatchlistGrid({ focusedIndex = -1, setFocusedIndex }) {
  const items = useWatchlistStore((s) => s.items);
  const storeRemoveSymbol = useWatchlistStore((s) => s.remove);
  const reorderItems = useWatchlistStore((s) => s.reorder);

  // ─── Sprint 51: Animated remove (play exit, then remove) ───
  const removeSymbol = useCallback(
    (symbol) => {
      setExitingSymbols((prev) => new Set([...prev, symbol]));
      setTimeout(() => {
        storeRemoveSymbol(symbol);
        setExitingSymbols((prev) => {
          const next = new Set(prev);
          next.delete(symbol);
          return next;
        });
      }, 300); // matches markets-row-slide-out duration
    },
    [storeRemoveSymbol],
  );
  const trades = useJournalStore((s) => s.trades);
  const setChartSymbol = useChartCoreStore((s) => s.setSymbol);
  const setPage = useUIStore((s) => s.setPage);
  const scrollContainerRef = useRef(null);

  const visibleColumns = useMarketsPrefsStore((s) => s.visibleColumns);
  const sortKey = useMarketsPrefsStore((s) => s.sortKey);
  const sortDir = useMarketsPrefsStore((s) => s.sortDir);
  const setSort = useMarketsPrefsStore((s) => s.setSort);
  const assetClassFilters = useMarketsPrefsStore((s) => s.assetClassFilters);
  const groupBy = useMarketsPrefsStore((s) => s.groupBy);
  const selectedSymbol = useMarketsPrefsStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useMarketsPrefsStore((s) => s.setSelectedSymbol);

  const [sparklines, setSparklines] = useState({});
  const [isNarrow, setIsNarrow] = useState(false);

  // ─── Sprint 51: Track enter/exit animations ────────────────
  const prevSymbolsRef = useRef(new Set());
  const [newSymbols, setNewSymbols] = useState(new Set());
  const [exitingSymbols, setExitingSymbols] = useState(new Set());

  useEffect(() => {
    const currentSyms = new Set(items.map((i) => i.symbol));
    const prevSyms = prevSymbolsRef.current;

    // Find newly added symbols
    const added = new Set();
    for (const sym of currentSyms) {
      if (!prevSyms.has(sym)) added.add(sym);
    }

    if (added.size > 0) {
      setNewSymbols(added);
      const timer = setTimeout(() => setNewSymbols(new Set()), 400);
      return () => clearTimeout(timer);
    }

    prevSymbolsRef.current = currentSyms;
  }, [items]);

  // ─── Responsive check ───────────────────────────────────────
  useEffect(() => {
    const check = () => setIsNarrow(window.innerWidth < 900);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ─── Live prices ────────────────────────────────────────────
  const symbols = useMemo(() => items.map((i) => i.symbol), [items]);
  const { prices, failedSymbols } = useWatchlistStreaming(symbols, symbols.length > 0);

  // ─── Sparkline data ─────────────────────────────────────────
  useEffect(() => {
    if (items.length === 0) return;
    let mounted = true;

    import('../../../data/SparklineService.js').then(async ({ fetchSparkline }) => {
      const missing = items.filter((i) => !sparklines[i.symbol]);
      if (missing.length === 0) return;

      const results = await Promise.all(
        missing.map(async (item) => {
          const data = await fetchSparkline(item.symbol, item.assetClass === 'crypto');
          return { symbol: item.symbol, data };
        }),
      );

      if (!mounted) return;
      setSparklines((prev) => {
        const next = { ...prev };
        for (const { symbol, data } of results) {
          if (data?.length > 0) next[symbol] = data;
        }
        return next;
      });
    });

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // ─── Fundamentals enrichment (Sprint 32) ──────────────────
  const { fundamentals } = useFundamentalsEnrich(symbols);

  // ─── Enriched items ─────────────────────────────────────
  const enrichedItems = useMemo(() => {
    const enriched = enrichWithTradeStats(items, trades);
    return enriched.map((item) => {
      const p = prices[item.symbol];
      const f = fundamentals[item.symbol];
      return {
        ...item,
        livePrice: p?.price ?? null,
        changePercent: p?.changePercent ?? null,
        volume: p?.volume ?? null,
        marketCap: f?.marketCap ?? null,
        supply: f?.supply ?? null,
        maxSupply: f?.maxSupply ?? null,
        ath: f?.ath ?? null,
        athChange: f?.athChange ?? null,
        dataFailed: failedSymbols?.has(item.symbol) ?? false,
      };
    });
  }, [items, trades, prices, fundamentals, failedSymbols]);

  // ─── Filter ─────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    if (assetClassFilters.length === 0) return enrichedItems;
    return enrichedItems.filter((item) => assetClassFilters.includes(item.assetClass));
  }, [enrichedItems, assetClassFilters]);

  // ─── Sort ───────────────────────────────────────────────────
  const sortedItems = useMemo(() => {
    if (!sortKey) return filteredItems;
    const sorted = [...filteredItems];
    const dir = sortDir === 'asc' ? 1 : -1;
    sorted.sort((a, b) => {
      let va, vb;
      switch (sortKey) {
        case 'symbol':
          va = a.symbol;
          vb = b.symbol;
          return va < vb ? -dir : dir;
        case 'price':
          va = a.livePrice ?? -Infinity;
          vb = b.livePrice ?? -Infinity;
          break;
        case 'change':
          va = a.changePercent ?? -Infinity;
          vb = b.changePercent ?? -Infinity;
          break;
        case 'volume':
          va = a.volume ?? -Infinity;
          vb = b.volume ?? -Infinity;
          break;
        case 'pnl':
          va = a.totalPnl ?? -Infinity;
          vb = b.totalPnl ?? -Infinity;
          break;
        case 'tradeCount':
          va = a.tradeCount ?? 0;
          vb = b.tradeCount ?? 0;
          break;
        default:
          return 0;
      }
      return (va - vb) * dir;
    });
    return sorted;
  }, [filteredItems, sortKey, sortDir]);

  // ─── Group ──────────────────────────────────────────────────
  const groupedData = useMemo(() => {
    if (groupBy !== 'assetClass') return null;
    const groups = groupByAssetClass(sortedItems);
    return groups;
  }, [sortedItems, groupBy]);

  // ─── Select symbol → detail panel (Sprint 9) ───────────────
  const handleClickSymbol = useCallback(
    (symbol) => {
      setSelectedSymbol(symbol);
    },
    [setSelectedSymbol],
  );

  // ─── Double-click → navigate to chart ──────────────────────
  const handleDoubleClick = useCallback(
    (symbol) => {
      setChartSymbol(symbol);
      setPage('charts');
    },
    [setChartSymbol, setPage],
  );

  // ─── Responsive columns: hide extras on narrow screens ─────
  const columns = useMemo(() => {
    if (isNarrow) {
      const mobileColumns = ['symbol', 'sparkline', 'price', 'change'];
      return visibleColumns.filter((c) => mobileColumns.includes(c));
    }
    return visibleColumns;
  }, [visibleColumns, isNarrow]);

  const gridTemplate = buildGridTemplate(columns, isNarrow);

  // ─── Column header label lookup ─────────────────────────────
  const colLabelMap = {};
  for (const col of ALL_COLUMNS) colLabelMap[col.id] = col.label;

  // ─── Render section ─────────────────────────────────────────
  // ─── Context menu (Sprint 24) ───────────────────────────────
  const [ctxMenu, setCtxMenu] = useState(null);
  const alerts = useAlertStore((s) => s.alerts);
  const alertSymbols = useMemo(() => new Set(alerts.filter((a) => a.active).map((a) => a.symbol)), [alerts]);

  const handleContextMenu = useCallback((e, sym, price) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, symbol: sym, price: price || 0 });
  }, []);

  // ─── Drag-and-drop reorder (Sprint 49) ──────────────────────
  const moveToFolder = useWatchlistStore((s) => s.moveToFolder);
  const { dragIndex, dropIndex, getDragHandlers } = useDragReorder({
    onReorder: reorderItems,
    onMoveToFolder: moveToFolder,
  });

  // ─── Sprint 56: Virtual scrolling for large lists ───────────
  const ROW_HEIGHT = 48;
  const { virtualItems, totalHeight, isVirtualized } = useVirtualScroll({
    itemCount: !groupedData ? sortedItems.length : 0,
    itemHeight: ROW_HEIGHT,
    containerRef: scrollContainerRef,
    overscan: 5,
    enabled: !groupedData, // Only virtualize flat view
  });

  const renderRows = (rowItems, _startIndex = 0) =>
    rowItems.map((item) => {
      const globalIdx = sortedItems.indexOf(item);
      return (
        <WatchlistGridRow
          key={item.symbol}
          item={item}
          sparkline={sparklines[item.symbol]}
          columns={columns}
          gridTemplate={gridTemplate}
          isNarrow={isNarrow}
          isSelected={item.symbol === selectedSymbol}
          isFocused={globalIdx === focusedIndex}
          rowIndex={globalIdx}
          onClick={() => handleClickSymbol(item.symbol)}
          onDoubleClick={() => handleDoubleClick(item.symbol)}
          onRemove={() => removeSymbol(item.symbol)}
          onContextMenu={(e) => handleContextMenu(e, item.symbol, item.price)}
          hasAlert={alertSymbols.has(item.symbol)}
          onMouseEnterRow={() => setFocusedIndex?.(globalIdx)}
          isDragging={dragIndex === globalIdx}
          isDropTarget={dropIndex === globalIdx && dragIndex !== globalIdx}
          dragHandlers={getDragHandlers(globalIdx, item.symbol)}
          isEntering={newSymbols.has(item.symbol)}
          isExiting={exitingSymbols.has(item.symbol)}
        />
      );
    });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* ─── Column Headers (Sticky) ──────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: gridTemplate,
          gap: 8,
          padding: '8px 20px',
          borderBottom: `1px solid ${C.bd}`,
          background: C.bg,
          position: 'sticky',
          top: 0,
          zIndex: 2,
        }}
      >
        {columns.map((col) => {
          const label = col === 'sparkline' ? '' : colLabelMap[col] || col;
          const sortable = col !== 'sparkline';
          const isActive = sortKey === col;
          return (
            <div
              key={col}
              onClick={sortable ? () => setSort(col) : undefined}
              style={{
                fontSize: 10,
                fontWeight: 700,
                fontFamily: 'var(--tf-mono)',
                color: isActive ? C.b : C.t3,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                cursor: sortable ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                textAlign: col === 'symbol' || col === 'sparkline' ? 'left' : 'right',
                justifyContent: col === 'symbol' || col === 'sparkline' ? 'flex-start' : 'flex-end',
                userSelect: 'none',
                transition: `color ${transition.fast}`,
              }}
            >
              {label}
              {isActive && <span style={{ fontSize: 8, opacity: 0.8 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
            </div>
          );
        })}
      </div>

      {/* ─── Rows ─────────────────────────────────────────── */}
      <div
        ref={scrollContainerRef}
        style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}
        role="listbox"
        aria-label="Watchlist"
      >
        {groupedData ? (
          // Grouped view
          Array.from(groupedData.entries()).map(([cls, groupItems]) => (
            <div key={cls}>
              <div
                style={{
                  padding: '10px 20px 6px',
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: ASSET_COLORS[cls] || C.t3,
                  fontFamily: 'var(--tf-mono)',
                  background: `${ASSET_COLORS[cls] || C.bd}06`,
                  borderBottom: `1px solid ${C.bd}20`,
                }}
              >
                {cls} · {groupItems.length}
              </div>
              {renderRows(groupItems)}
            </div>
          ))
        ) : isVirtualized ? (
          // Sprint 56: Virtualized flat view
          <div style={{ height: totalHeight, position: 'relative' }}>
            {virtualItems.map(({ index, offsetY }) => {
              const item = sortedItems[index];
              if (!item) return null;
              return (
                <div
                  key={item.symbol}
                  style={{ position: 'absolute', top: offsetY, left: 0, right: 0, height: ROW_HEIGHT }}
                >
                  <WatchlistGridRow
                    item={item}
                    sparkline={sparklines[item.symbol]}
                    columns={columns}
                    gridTemplate={gridTemplate}
                    isNarrow={isNarrow}
                    isSelected={item.symbol === selectedSymbol}
                    isFocused={index === focusedIndex}
                    rowIndex={index}
                    onClick={() => handleClickSymbol(item.symbol)}
                    onDoubleClick={() => handleDoubleClick(item.symbol)}
                    onRemove={() => removeSymbol(item.symbol)}
                    onContextMenu={(e) => handleContextMenu(e, item.symbol, item.price)}
                    hasAlert={alertSymbols.has(item.symbol)}
                    onMouseEnterRow={() => setFocusedIndex?.(index)}
                    isDragging={dragIndex === index}
                    isDropTarget={dropIndex === index && dragIndex !== index}
                    dragHandlers={getDragHandlers(index, item.symbol)}
                    isEntering={newSymbols.has(item.symbol)}
                    isExiting={exitingSymbols.has(item.symbol)}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          // Flat view (small list)
          renderRows(sortedItems)
        )}

        {filteredItems.length === 0 && (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: C.t3,
              fontSize: 13,
              fontFamily: 'var(--tf-font)',
            }}
          >
            No assets match your filters.
          </div>
        )}
      </div>

      {/* Sprint 24: Context Menu */}
      {ctxMenu && (
        <MarketsRowContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          symbol={ctxMenu.symbol}
          price={ctxMenu.price}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// WatchlistGridRow — Individual Row
// ═══════════════════════════════════════════════════════════════════

const WatchlistGridRow = memo(function WatchlistGridRow({
  item,
  sparkline,
  columns,
  gridTemplate,
  isNarrow,
  isSelected,
  isFocused,
  rowIndex,
  onClick,
  onDoubleClick,
  onRemove,
  onContextMenu,
  hasAlert,
  onMouseEnterRow,
  isDragging,
  isDropTarget,
  dragHandlers,
  isEntering,
  isExiting,
}) {
  const [hovered, setHovered] = useState(false);
  const rowRef = useRef(null);
  const prevPriceRef = useRef(item.livePrice);
  const [flashClass, setFlashClass] = useState('');
  const isPositive = (item.changePercent ?? 0) >= 0;
  const changeColor = item.changePercent != null ? (isPositive ? C.g : C.r) : C.t3;
  const hasTrades = (item.tradeCount || 0) > 0;
  const assetColor = ASSET_COLORS[item.assetClass] || ASSET_COLORS.other;
  const ACCENT = '#6e5ce6';

  // Auto-scroll into view when focused via keyboard
  useEffect(() => {
    if (isFocused && rowRef.current) {
      rowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isFocused]);

  // Price flash animation on tick
  useEffect(() => {
    if (prevPriceRef.current != null && item.livePrice != null && item.livePrice !== prevPriceRef.current) {
      setFlashClass(item.livePrice > prevPriceRef.current ? 'markets-row-flash-up' : 'markets-row-flash-down');
      const timer = setTimeout(() => setFlashClass(''), 700);
      prevPriceRef.current = item.livePrice;
      return () => clearTimeout(timer);
    }
    prevPriceRef.current = item.livePrice;
  }, [item.livePrice]);

  const cells = {
    symbol: (
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: assetColor,
              flexShrink: 0,
              boxShadow: `0 0 6px ${assetColor}40`,
            }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: 'var(--tf-mono)' }}>
                {item.symbol}
              </span>
              {hasAlert && (
                <span style={{ fontSize: 10 }} title="Active alert">
                  🔔
                </span>
              )}
              <EarningsBadge symbol={item.symbol} />
              <span
                style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: 'var(--tf-mono)', display: 'none' }}
               />
              {item.assetClass && item.assetClass !== 'other' && (
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    color: assetColor,
                    background: `${assetColor}15`,
                    padding: '1px 5px',
                    borderRadius: radii.xs,
                    letterSpacing: '0.04em',
                  }}
                >
                  {item.assetClass}
                </span>
              )}
            </div>
            {item.name && item.name !== item.symbol && (
              <div
                style={{
                  fontSize: 10,
                  color: C.t3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginTop: 1,
                  maxWidth: 180,
                }}
              >
                {item.name}
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    sparkline: (
      <div className="markets-sparkline-transition" style={{ width: isNarrow ? 60 : 80, height: 28, flexShrink: 0 }}>
        {sparkline && sparkline.length > 1 ? (
          <Sparkline data={sparkline} width={isNarrow ? 60 : 80} height={28} color={changeColor} showArea={false} />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: C.t3,
              fontSize: 8,
            }}
          >
            ···
          </div>
        )}
      </div>
    ),
    price: (
      <div style={{ textAlign: 'right' }}>
        {item.livePrice == null && item.dataFailed ? (
          <div style={{ fontSize: 10, color: C.t3, fontStyle: 'italic' }} title="Data unavailable for this symbol">
            no data
          </div>
        ) : (
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              fontFamily: 'var(--tf-mono)',
              color: C.t1,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {fmtPrice(item.livePrice)}
          </div>
        )}
      </div>
    ),
    change: (
      <div style={{ textAlign: 'right' }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            fontFamily: 'var(--tf-mono)',
            color: changeColor,
            fontVariantNumeric: 'tabular-nums',
            padding: '2px 8px',
            borderRadius: radii.xs,
            background: item.changePercent != null ? `${changeColor}12` : 'transparent',
          }}
        >
          {fmtChange(item.changePercent)}
        </span>
      </div>
    ),
    volume: (
      <div style={{ textAlign: 'right' }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            fontFamily: 'var(--tf-mono)',
            color: C.t2,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {fmtVolume(item.volume)}
        </span>
      </div>
    ),
    pnl: (
      <div style={{ textAlign: 'right' }}>
        {hasTrades ? (
          <>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'var(--tf-mono)',
                color: item.totalPnl >= 0 ? C.g : C.r,
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.2,
              }}
            >
              {fmtPnl(item.totalPnl)}
            </div>
            <div style={{ fontSize: 9, color: C.t3, fontFamily: 'var(--tf-mono)' }}>
              {item.tradeCount} trade{item.tradeCount !== 1 ? 's' : ''}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 10, color: C.t3 }}>—</div>
        )}
      </div>
    ),
    tradeCount: (
      <div style={{ textAlign: 'right', fontSize: 12, fontFamily: 'var(--tf-mono)', color: C.t2 }}>
        {item.tradeCount || '—'}
      </div>
    ),
    lastTraded: (
      <div style={{ textAlign: 'right', fontSize: 11, fontFamily: 'var(--tf-mono)', color: C.t3 }}>
        {fmtDate(item.lastTraded)}
      </div>
    ),
    weekRange: (
      <div style={{ overflow: 'visible', position: 'relative' }}>
        <div style={{ fontSize: 10, color: C.t3, fontFamily: 'var(--tf-mono)' }}>—</div>
      </div>
    ),
    volProfile: (
      <div style={{ overflow: 'visible', position: 'relative' }}>
        <div style={{ fontSize: 10, color: C.t3, fontFamily: 'var(--tf-mono)' }}>—</div>
      </div>
    ),
    marketCap: (
      <div style={{ textAlign: 'right' }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            fontFamily: 'var(--tf-mono)',
            color: C.t2,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {item.marketCap ? fmtCompact(item.marketCap) : '—'}
        </span>
      </div>
    ),
    supply: (
      <div style={{ textAlign: 'right' }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            fontFamily: 'var(--tf-mono)',
            color: C.t2,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {item.supply ? fmtCompact(item.supply, 0) : '—'}
        </span>
        {item.maxSupply && (
          <div style={{ fontSize: 9, color: C.t3, fontFamily: 'var(--tf-mono)' }}>
            / {fmtCompact(item.maxSupply, 0)}
          </div>
        )}
      </div>
    ),
    ath: (
      <div style={{ textAlign: 'right' }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            fontFamily: 'var(--tf-mono)',
            color: C.t2,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {item.ath ? fmtPrice(item.ath) : '—'}
        </span>
        {item.athChange != null && (
          <div style={{ fontSize: 9, fontFamily: 'var(--tf-mono)', color: item.athChange < -50 ? C.r : C.t3 }}>
            {item.athChange > 0 ? '+' : ''}
            {item.athChange?.toFixed(1)}%
          </div>
        )}
      </div>
    ),
    assetClass: (
      <div style={{ textAlign: 'right' }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            textTransform: 'uppercase',
            color: assetColor,
            background: `${assetColor}12`,
            padding: '2px 6px',
            borderRadius: radii.xs,
            fontFamily: 'var(--tf-mono)',
          }}
        >
          {item.assetClass || 'other'}
        </span>
      </div>
    ),
  };

  // Build CSS class list
  const rowClasses = [
    'markets-row-transition',
    'markets-row-glow',
    flashClass,
    isFocused ? 'markets-row-focused' : '',
    isDragging ? 'markets-row-dragging' : '',
    isDropTarget ? 'markets-row-drop-target' : '',
    isEntering ? 'markets-row-enter' : '',
    isExiting ? 'markets-row-exit' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={rowRef}
      className={rowClasses}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => {
        setHovered(true);
        onMouseEnterRow?.();
      }}
      onMouseLeave={() => setHovered(false)}
      role="option"
      aria-selected={isSelected}
      data-symbol={item.symbol}
      data-row-index={rowIndex}
      tabIndex={-1}
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: gridTemplate,
        gap: 8,
        alignItems: 'center',
        padding: '12px 20px',
        cursor: 'pointer',
        background: isSelected ? `${ACCENT}08` : hovered ? `${C.b}06` : 'transparent',
        borderBottom: `1px solid ${C.bd}15`,
        borderLeft: isSelected ? `3px solid ${ACCENT}` : isFocused ? `3px solid ${ACCENT}60` : '3px solid transparent',
      }}
      {...(dragHandlers || {})}
    >
      {columns.map((col) => (
        <div key={col}>{cells[col]}</div>
      ))}

      {hovered && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            background: `${C.r}12`,
            border: `1px solid ${C.r}25`,
            borderRadius: radii.sm,
            color: C.r,
            fontSize: 10,
            fontWeight: 700,
            padding: '3px 10px',
            cursor: 'pointer',
            fontFamily: 'var(--tf-mono)',
            transition: `background ${transition.fast}`,
          }}
          title="Remove from watchlist"
        >
          ✕
        </button>
      )}
    </div>
  );
});

export { WatchlistGridRow };
