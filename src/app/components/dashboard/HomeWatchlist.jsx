// ═══════════════════════════════════════════════════════════════════
// charEdge — HomeWatchlist
//
// Coinbase-style watchlist for the home dashboard (Sprints 6–16).
// Live prices via useWatchlistStreaming, sparklines via SparklineService,
// trade enrichment via useWatchlistStore + useJournalStore.
// Sprint 15: Row hover glow + smooth transitions.
// Sprint 16: Price alert indicator per row.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { C, M } from '../../../constants.js';
import useWatchlistStreaming from '../../../hooks/useWatchlistStreaming.js';
import { useChartCoreStore } from '../../../state/chart/useChartCoreStore';
import { useJournalStore } from '../../../state/useJournalStore';
import { useUIStore } from '../../../state/useUIStore';
import { useWatchlistStore, enrichWithTradeStats } from '../../../state/useWatchlistStore.js';
import { radii } from '../../../theme/tokens.js';
import Sparkline from '../ui/Sparkline.jsx';

// Sprint 16: lazy import alert store to avoid circular deps
let _cachedAlertStore = null;

function getAlertSymbols() {
  try {
    if (!_cachedAlertStore) {
      // Kick off lazy ESM import — will be ready on next render cycle
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

    // Attach price data for sorting
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
      <div
        style={{
          padding: '28px 24px',
          background: C.sf,
          border: `1px solid ${C.bd}40`,
          borderRadius: radii.lg,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, marginBottom: 4 }}>
          Start tracking your assets
        </div>
        <div style={{ fontSize: 12, color: C.t3, marginBottom: 16 }}>
          Add symbols to see live prices, sparklines, and your trading P&L
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            justifyContent: 'center',
          }}
        >
          {POPULAR.map((s) => (
            <button
              key={s.symbol}
              className="tf-btn"
              onClick={() => addSymbol(s)}
              style={{
                padding: '6px 14px',
                borderRadius: radii.md,
                fontSize: 12,
                fontWeight: 700,
                fontFamily: M,
                background: `${C.b}10`,
                color: C.b,
                border: `1px solid ${C.b}25`,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `${C.b}20`;
                e.currentTarget.style.borderColor = C.b;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = `${C.b}10`;
                e.currentTarget.style.borderColor = `${C.b}25`;
              }}
            >
              + {s.symbol}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── Main render ─────────────────────────────────────────────
  return (
    <div
      style={{
        background: C.sf,
        border: `1px solid ${C.bd}40`,
        borderRadius: radii.lg,
        overflow: 'hidden',
      }}
    >
      {/* Header (Sprint 6 + Sprint 11 portfolio P&L) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: `1px solid ${C.bd}30`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: C.t1 }}>Watchlist</span>
          <span
            style={{
              fontSize: 10,
              fontFamily: M,
              color: C.t3,
              padding: '2px 6px',
              background: `${C.bd}20`,
              borderRadius: radii.xs,
            }}
          >
            {items.length}
          </span>
          {portfolioPnl.count > 0 && (
            <span
              style={{
                fontSize: 11,
                fontFamily: M,
                fontWeight: 700,
                color: portfolioPnl.total >= 0 ? C.g : C.r,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {fmtPnl(portfolioPnl.total)} · {portfolioPnl.count} trades
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Sort dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: C.t3,
              fontSize: 10,
              fontFamily: M,
              outline: 'none',
              cursor: 'pointer',
            }}
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
      <div
        style={{
          display: 'flex',
          gap: 6,
          padding: '10px 20px',
          borderBottom: `1px solid ${C.bd}20`,
        }}
      >
        <input
          aria-label="Add symbol to watchlist"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add symbol (e.g. BTC, AAPL)..."
          style={{
            flex: 1,
            background: 'transparent',
            border: `1px solid ${C.bd}40`,
            borderRadius: radii.sm,
            padding: '6px 12px',
            fontSize: 12,
            fontFamily: M,
            color: C.t1,
            outline: 'none',
          }}
        />
        <button
          className="tf-btn"
          onClick={handleAdd}
          disabled={!inputValue.trim()}
          style={{
            background: C.b,
            border: 'none',
            borderRadius: radii.sm,
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            padding: '6px 14px',
            cursor: inputValue.trim() ? 'pointer' : 'default',
            opacity: inputValue.trim() ? 1 : 0.4,
            whiteSpace: 'nowrap',
          }}
        >
          + Add
        </button>
      </div>

      {/* Scrollable rows container */}
      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        {/* Sprint 9: Top Movers */}
        {topMovers.length > 0 && sortBy === 'default' && (
          <div style={{ borderBottom: `1px solid ${C.bd}20` }}>
            <div
              style={{
                padding: '8px 20px 4px',
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: C.t3,
                fontFamily: M,
              }}
            >
              🔥 Top Movers
            </div>
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
            <div
              style={{
                padding: '8px 20px 4px',
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: C.t3,
                fontFamily: M,
              }}
            >
              All Assets
            </div>
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
    // Sprint 40: long-press timer
    touchRef.current.timer = setTimeout(() => {
      setShowContextMenu(true);
    }, 500);
  }, []);

  const handleTouchMove = useCallback((e) => {
    clearTimeout(touchRef.current.timer);
    const dx = e.touches[0].clientX - touchRef.current.startX;
    const dy = Math.abs(e.touches[0].clientY - touchRef.current.startY);
    if (dy > 20) { setSwipeX(0); return; } // vertical scroll, cancel
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
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: isMobile
            ? '1fr 50px auto'
            : '1fr 70px auto auto',
          gap: isMobile ? 8 : 12,
          alignItems: 'center',
          padding: compact ? '8px 20px' : (isMobile ? '14px 20px' : '10px 20px'),
          minHeight: isMobile ? 56 : undefined,
          cursor: 'pointer',
          background: hovered ? `${C.b}06` : 'transparent',
          borderBottom: `1px solid ${C.bd}15`,
          transition: 'background 0.15s, box-shadow 0.15s, transform 0.15s',
          boxShadow: hovered ? `inset 0 0 0 1px ${C.b}12` : 'none',
          transform: swipeX ? `translateX(${swipeX}px)` : undefined,
        }}
      >
        {/* Symbol + name */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: C.t1,
                fontFamily: M,
              }}
            >
              {item.symbol}
            </span>
            {hasAlert && (
              <span style={{ fontSize: 10, opacity: 0.7 }} title="Has active alert">🔔</span>
            )}
            {item.assetClass && item.assetClass !== 'other' && (
              <span
                style={{
                  fontSize: 8,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  color: C.t3,
                  background: `${C.bd}30`,
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
              }}
            >
              {item.name}
            </div>
          )}
        </div>

        {/* Sparkline */}
        <div style={{ width: isMobile ? 50 : 70, height: 24, flexShrink: 0 }}>
          {sparkline && sparkline.length > 1 ? (
            <Sparkline
              data={sparkline}
              width={isMobile ? 50 : 70}
              height={24}
              color={changeColor}
              showArea={false}
            />
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

        {/* Price + change */}
        <div style={{ textAlign: 'right', minWidth: 80 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              fontFamily: M,
              color: C.t1,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.2,
            }}
          >
            {fmtPrice(item.livePrice)}
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              fontFamily: M,
              color: changeColor,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {fmtChange(item.changePercent)}
          </div>
        </div>

        {/* Trade P&L (desktop only) */}
        {!isMobile && (
          <div style={{ textAlign: 'right', minWidth: 70 }}>
            {hasTrades ? (
              <>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: M,
                    color: item.totalPnl >= 0 ? C.g : C.r,
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1.2,
                  }}
                >
                  {fmtPnl(item.totalPnl)}
                </div>
                <div style={{ fontSize: 9, color: C.t3, fontFamily: M }}>
                  {item.tradeCount} trade{item.tradeCount !== 1 ? 's' : ''}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 10, color: C.t3 }}>—</div>
            )}
          </div>
        )}

        {/* Hover remove (desktop) */}
        {hovered && !isMobile && (
          <button
            className="tf-btn"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            style={{
              position: 'absolute',
              right: 8,
              background: `${C.r}15`,
              border: `1px solid ${C.r}30`,
              borderRadius: radii.sm,
              color: C.r,
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 8px',
              cursor: 'pointer',
            }}
            title="Remove from watchlist"
          >
            ✕
          </button>
        )}

        {/* Swipe-to-remove indicator (mobile) */}
        {swipeX < -20 && (
          <div style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: Math.abs(swipeX),
            background: C.r,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
          }}>
            {swipeX < -60 ? 'Release' : '✕'}
          </div>
        )}
      </div>

      {/* Sprint 40: Long-press context menu */}
      {showContextMenu && (
        <div
          onClick={() => setShowContextMenu(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.3)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              background: C.sf,
              borderRadius: `${radii.lg}px ${radii.lg}px 0 0`,
              padding: '12px 0',
              boxShadow: '0 -4px 24px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ padding: '6px 20px', fontSize: 13, fontWeight: 700, color: C.t1 }}>
              {item.symbol}
            </div>
            {[
              { label: '📈 View Chart', action: () => { onClick(); setShowContextMenu(false); } },
              { label: '🔔 Set Alert', action: () => setShowContextMenu(false) },
              { label: '❌ Remove', action: () => { onRemove(); setShowContextMenu(false); }, color: C.r },
            ].map((opt) => (
              <button
                key={opt.label}
                onClick={opt.action}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '14px 20px',
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  fontSize: 14,
                  color: opt.color || C.t1,
                  cursor: 'pointer',
                }}
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
