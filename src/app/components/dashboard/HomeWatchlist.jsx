// ═══════════════════════════════════════════════════════════════════
// charEdge — HomeWatchlist
//
// Coinbase-style watchlist for the home dashboard (Sprints 6–16).
// Sprint 22: Migrated from inline styles → CSS Modules + tokens.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { C, M } from '../../../constants.js';
import useWatchlistStreaming from '../../../hooks/useWatchlistStreaming.js';
import { useChartCoreStore } from '../../../state/chart/useChartCoreStore';
import { useJournalStore } from '../../../state/useJournalStore';
import { useUIStore } from '../../../state/useUIStore';
import { useWatchlistStore, enrichWithTradeStats } from '../../../state/useWatchlistStore.js';
import Sparkline from '../ui/Sparkline.jsx';
import s from './HomeWatchlist.module.css';

// Sprint 16: lazy import alert store to avoid circular deps
let _cachedAlertStore = null;

function getAlertSymbols() {
  try {
    if (!_cachedAlertStore) {
      import('../../../state/useAlertStore.ts').then((mod) => {
        _cachedAlertStore = mod.default;
      }).catch(() => {});
      return new Set();
    }
    if (!_cachedAlertStore) return new Set();
    const alerts = _cachedAlertStore.getState().alerts || [];
    const syms = new Set();
    for (const a of alerts) {
      if (a.active && a.symbol) syms.add(a.symbol.toUpperCase());
    }
    return syms;
  } catch { return new Set(); }
}

// ─── Popular suggestions for empty state (Sprint 12) ───────────
const POPULAR = [
  { symbol: 'BTC', name: 'Bitcoin', assetClass: 'crypto' },
  { symbol: 'ETH', name: 'Ethereum', assetClass: 'crypto' },
  { symbol: 'SPY', name: 'S&P 500 ETF', assetClass: 'etf' },
  { symbol: 'AAPL', name: 'Apple', assetClass: 'stocks' },
  { symbol: 'TSLA', name: 'Tesla', assetClass: 'stocks' },
  { symbol: 'SOL', name: 'Solana', assetClass: 'crypto' },
];

// ─── Sort options ──────────────────────────────────────────────
const SORT_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'change_desc', label: '% Change ↓' },
  { value: 'change_asc', label: '% Change ↑' },
  { value: 'pnl_desc', label: 'P&L ↓' },
];

// ─── Format helpers ────────────────────────────────────────────
function fmtPrice(val) {
  if (val == null || isNaN(val)) return '—';
  if (val >= 1000) return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (val >= 1) return `$${val.toFixed(2)}`;
  return `$${val.toFixed(4)}`;
}

function fmtChange(val) {
  if (val == null || isNaN(val)) return '';
  const sign = val >= 0 ? '+' : '';
  return `${sign}${val.toFixed(2)}%`;
}

function fmtPnl(val) {
  if (val == null || isNaN(val)) return '';
  const sign = val >= 0 ? '+' : '';
  return `${sign}$${Math.abs(val).toFixed(0)}`;
}

// ═══════════════════════════════════════════════════════════════════
// HomeWatchlist — Main Component
// ═══════════════════════════════════════════════════════════════════

export default function HomeWatchlist({ isMobile }) {
  const items = useWatchlistStore((s) => s.items);
  const addSymbol = useWatchlistStore((s) => s.add);
  const removeSymbol = useWatchlistStore((s) => s.remove);
  const trades = useJournalStore((s) => s.trades);
  const setChartSymbol = useChartCoreStore((s) => s.setSymbol);
  const setPage = useUIStore((s) => s.setPage);

  const [sortBy, setSortBy] = useState('default');
  const [inputValue, setInputValue] = useState('');
  const [sparklines, setSparklines] = useState({});

  // ─── Sprint 7: Live prices ───────────────────────────────────
  const symbols = useMemo(() => items.map((i) => i.symbol), [items]);
  const { prices } = useWatchlistStreaming(symbols, symbols.length > 0);

  // ─── Sprint 8: Sparkline data ────────────────────────────────
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

    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // ─── Sprint 8: Trade enrichment + Sprint 9: sorting ─────────
  const enrichedItems = useMemo(() => {
    const enriched = enrichWithTradeStats(items, trades);
    return enriched.map((item) => {
      const p = prices[item.symbol];
      return {
        ...item,
        livePrice: p?.price ?? null,
        changePercent: p?.changePercent ?? null,
      };
    });
  }, [items, trades, prices]);

  // Sprint 9: Top Movers — top 3 by absolute change
  const topMovers = useMemo(() => {
    if (enrichedItems.length < 3) return [];
    return [...enrichedItems]
      .filter((i) => i.changePercent != null)
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
      .slice(0, 3);
  }, [enrichedItems]);

  // Sorted list (Sprint 9 sort)
  const sortedItems = useMemo(() => {
    const sorted = [...enrichedItems];
    if (sortBy === 'change_desc') {
      sorted.sort((a, b) => (b.changePercent ?? -Infinity) - (a.changePercent ?? -Infinity));
    } else if (sortBy === 'change_asc') {
      sorted.sort((a, b) => (a.changePercent ?? Infinity) - (b.changePercent ?? Infinity));
    } else if (sortBy === 'pnl_desc') {
      sorted.sort((a, b) => (b.totalPnl || 0) - (a.totalPnl || 0));
    }
    return sorted;
  }, [enrichedItems, sortBy]);

  // Sprint 11: Portfolio aggregate P&L
  const portfolioPnl = useMemo(() => {
    let total = 0;
    let count = 0;
    for (const item of enrichedItems) {
      if (item.totalPnl) {
        total += item.totalPnl;
        count += item.tradeCount || 0;
      }
    }
    return { total, count };
  }, [enrichedItems]);

  // ─── Sprint 10: Quick add ───────────────────────────────────
  const handleAdd = useCallback(() => {
    const sym = inputValue.trim().toUpperCase();
    if (sym) {
      addSymbol({ symbol: sym });
      setInputValue('');
    }
  }, [inputValue, addSymbol]);

  const handleClickSymbol = useCallback(
    (symbol) => {
      setChartSymbol(symbol);
      setPage('charts');
    },
    [setChartSymbol, setPage],
  );

  // ─── Sprint 12: Empty state ─────────────────────────────────
  if (items.length === 0) {
    return (
      <div className={s.empty}>
        <div className={s.emptyIcon}>📊</div>
        <div className={s.emptyTitle}>Start tracking your assets</div>
        <div className={s.emptyDesc}>
          Add symbols to see live prices, sparklines, and your trading P&L
        </div>
        <div className={s.emptyActions}>
          {POPULAR.map((item) => (
            <button
              key={item.symbol}
              className={`tf-btn ${s.emptyBtn}`}
              onClick={() => addSymbol(item)}
            >
              + {item.symbol}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── Main render ─────────────────────────────────────────────
  return (
    <div className={s.container}>
      {/* Header (Sprint 6 + Sprint 11 portfolio P&L) */}
      <div className={s.header}>
        <div className={s.headerLeft}>
          <span className={s.headerTitle}>Watchlist</span>
          <span className={s.headerCount}>{items.length}</span>
          {portfolioPnl.count > 0 && (
            <span className={s.headerPnl} data-dir={portfolioPnl.total >= 0 ? 'up' : 'down'}>
              {fmtPnl(portfolioPnl.total)} · {portfolioPnl.count} trades
            </span>
          )}
        </div>
        <div className={s.headerRight}>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className={s.sortSelect}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sprint 10: Quick-add search */}
      <div className={s.addBar}>
        <input
          aria-label="Add symbol to watchlist"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add symbol (e.g. BTC, AAPL)..."
          className={s.addInput}
        />
        <button
          className={`tf-btn ${s.addBtn}`}
          onClick={handleAdd}
          disabled={!inputValue.trim()}
        >
          + Add
        </button>
      </div>

      {/* Scrollable rows container */}
      <div className={s.scrollArea}>
        {/* Sprint 9: Top Movers */}
        {topMovers.length > 0 && sortBy === 'default' && (
          <div className={s.sectionDivider}>
            <div className={s.sectionLabel}>🔥 Top Movers</div>
            {topMovers.map((item) => (
              <WatchlistRow
                key={`mover-${item.symbol}`}
                item={item}
                sparkline={sparklines[item.symbol]}
                isMobile={isMobile}
                onClick={() => handleClickSymbol(item.symbol)}
                onRemove={() => removeSymbol(item.symbol)}
                compact
              />
            ))}
          </div>
        )}

        {/* All Assets */}
        <div>
          {sortBy === 'default' && topMovers.length > 0 && (
            <div className={s.sectionLabel}>All Assets</div>
          )}
          {sortedItems.map((item) => (
            <WatchlistRow
              key={item.symbol}
              item={item}
              sparkline={sparklines[item.symbol]}
              isMobile={isMobile}
              onClick={() => handleClickSymbol(item.symbol)}
              onRemove={() => removeSymbol(item.symbol)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const WatchlistRow = memo(function WatchlistRow({
  item,
  sparkline,
  isMobile,
  onClick,
  onRemove,
  compact = false,
}) {
  const [hovered, setHovered] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const touchRef = useRef({ startX: 0, startY: 0, timer: null });

  const isPositive = (item.changePercent ?? 0) >= 0;
  const changeDir = item.changePercent != null ? (isPositive ? 'up' : 'down') : 'neutral';
  const changeColor = item.changePercent != null ? (isPositive ? C.g : C.r) : C.t3;
  const hasTrades = (item.tradeCount || 0) > 0;

  // Sprint 16: alert indicator
  const alertSymbols = useMemo(() => getAlertSymbols(), []);
  const hasAlert = alertSymbols.has(item.symbol?.toUpperCase());

  // Sprint 38: Swipe-to-remove + Sprint 40: Long-press
  const handleTouchStart = useCallback((e) => {
    const t = e.touches[0];
    touchRef.current.startX = t.clientX;
    touchRef.current.startY = t.clientY;
    touchRef.current.timer = setTimeout(() => {
      setShowContextMenu(true);
    }, 500);
  }, []);

  const handleTouchMove = useCallback((e) => {
    clearTimeout(touchRef.current.timer);
    const dx = e.touches[0].clientX - touchRef.current.startX;
    const dy = Math.abs(e.touches[0].clientY - touchRef.current.startY);
    if (dy > 20) { setSwipeX(0); return; }
    if (dx < 0) setSwipeX(Math.max(dx, -100));
  }, []);

  const handleTouchEnd = useCallback(() => {
    clearTimeout(touchRef.current.timer);
    if (swipeX < -60) {
      onRemove();
    }
    setSwipeX(0);
  }, [swipeX, onRemove]);

  return (
    <>
      <div
        onClick={showContextMenu ? undefined : onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onTouchStart={isMobile ? handleTouchStart : undefined}
        onTouchMove={isMobile ? handleTouchMove : undefined}
        onTouchEnd={isMobile ? handleTouchEnd : undefined}
        className={s.row}
        data-mobile={isMobile || undefined}
        data-compact={compact || undefined}
        style={swipeX ? { transform: `translateX(${swipeX}px)` } : undefined}
      >
        {/* Symbol + name */}
        <div className={s.symbolWrap}>
          <div className={s.symbolRow}>
            <span className={s.symbolName}>{item.symbol}</span>
            {hasAlert && (
              <span className={s.alertIcon} title="Has active alert">🔔</span>
            )}
            {item.assetClass && item.assetClass !== 'other' && (
              <span className={s.assetBadge}>{item.assetClass}</span>
            )}
          </div>
          {item.name && item.name !== item.symbol && (
            <div className={s.itemName}>{item.name}</div>
          )}
        </div>

        {/* Sparkline */}
        <div className={s.sparkCell} data-mobile={isMobile || undefined}>
          {sparkline && sparkline.length > 1 ? (
            <Sparkline
              data={sparkline}
              width={isMobile ? 50 : 70}
              height={24}
              color={changeColor}
              showArea={false}
            />
          ) : (
            <div className={s.sparkPlaceholder}>···</div>
          )}
        </div>

        {/* Price + change */}
        <div className={s.priceCell}>
          <div className={s.price}>{fmtPrice(item.livePrice)}</div>
          <div className={s.change} data-dir={changeDir}>
            {fmtChange(item.changePercent)}
          </div>
        </div>

        {/* Trade P&L (desktop only) */}
        {!isMobile && (
          <div className={s.pnlCell}>
            {hasTrades ? (
              <>
                <div className={s.pnlValue} data-dir={item.totalPnl >= 0 ? 'up' : 'down'}>
                  {fmtPnl(item.totalPnl)}
                </div>
                <div className={s.pnlCount}>
                  {item.tradeCount} trade{item.tradeCount !== 1 ? 's' : ''}
                </div>
              </>
            ) : (
              <div className={s.pnlDash}>—</div>
            )}
          </div>
        )}

        {/* Hover remove (desktop) */}
        {hovered && !isMobile && (
          <button
            className={`tf-btn ${s.removeBtn}`}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            title="Remove from watchlist"
          >
            ✕
          </button>
        )}

        {/* Swipe-to-remove indicator (mobile) */}
        {swipeX < -20 && (
          <div className={s.swipeIndicator} style={{ width: Math.abs(swipeX) }}>
            {swipeX < -60 ? 'Release' : '✕'}
          </div>
        )}
      </div>

      {/* Sprint 40: Long-press context menu */}
      {showContextMenu && (
        <div className={s.contextOverlay} onClick={() => setShowContextMenu(false)}>
          <div className={s.contextSheet} onClick={(e) => e.stopPropagation()}>
            <div className={s.contextTitle}>{item.symbol}</div>
            {[
              { label: '📈 View Chart', action: () => { onClick(); setShowContextMenu(false); } },
              { label: '🔔 Set Alert', action: () => setShowContextMenu(false) },
              { label: '❌ Remove', action: () => { onRemove(); setShowContextMenu(false); }, danger: true },
            ].map((opt) => (
              <button
                key={opt.label}
                onClick={opt.action}
                className={opt.danger ? s.contextBtnDanger : s.contextBtn}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
});
