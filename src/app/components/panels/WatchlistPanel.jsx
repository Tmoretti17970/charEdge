// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Watchlist Panel
//
// Compact sidebar/overlay widget showing:
//   - Watched symbols grouped by asset class
//   - Trade stats (P&L, count) from journal data
//   - Click to navigate chart to symbol
//   - Quick add via text input
//   - Star/unstar toggle
//
// Responsive: works as sidebar panel or overlay on mobile.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { C, F, M } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore';
import { useUIStore } from '../../../state/useUIStore';
import { useWatchlistStore, groupByAssetClass, enrichWithTradeStats } from '../../../state/useWatchlistStore.js';
import { useChartCoreStore } from '../../../state/chart/useChartCoreStore';

const ASSET_ICONS = {
  futures: '📊',
  stocks: '📈',
  crypto: '₿',
  etf: '🏦',
  forex: '💱',
  options: '⚡',
  other: '📋',
};

function WatchlistPanel({ compact = false }) {
  const items = useWatchlistStore((s) => s.items);
  const addSymbol = useWatchlistStore((s) => s.add);
  const removeSymbol = useWatchlistStore((s) => s.remove);
  const trades = useJournalStore((s) => s.trades);
  const setChartSymbol = useChartCoreStore((s) => s.setSymbol);
  const setPage = useUIStore((s) => s.setPage);
  const [inputValue, setInputValue] = useState('');
  const [hoveredSymbol, setHoveredSymbol] = useState(null);
  const [sortBy, setSortBy] = useState('default'); // 'default', 'change_desc', 'change_asc', 'pnl_desc'

  // Data caches for sorting and display
  const [tickers, setTickers] = useState({});
  const [sparklines, setSparklines] = useState({});
  const [sentiments, _setSentiments] = useState({});

  useEffect(() => {
    let mounted = true;
    import('../../../data/FetchService.ts').then(async ({ fetch24hTicker, fetchSparkline }) => {
      // Batch fetch all tickers in one call (crypto symbols → single Binance request)
      const symbolsToFetch = items.filter(i => !tickers[i.symbol]).map(i => i.symbol);
      if (symbolsToFetch.length > 0) {
        const tickerResults = await fetch24hTicker(symbolsToFetch);
        const newTickers = { ...tickers };
        for (const t of tickerResults) {
          if (t?.symbol) newTickers[t.symbol.replace('USDT', '')] = t;
          // Also store by raw symbol for non-crypto
          if (t?.symbol) newTickers[t.symbol] = t;
        }
        if (mounted) setTickers(newTickers);
      }

      // Sparklines: batchGetQuotes already includes sparkline data for
      // crypto symbols. Only fetch individually for symbols missing data.
      const { batchGetQuotes } = await import('../../../data/QuoteService.js');
      const missingSparklines = items.filter(i => !sparklines[i.symbol]).map(i => i.symbol);
      if (missingSparklines.length > 0) {
        const quoteMap = await batchGetQuotes(missingSparklines);
        const newSparklines = { ...sparklines };

        // Use sparklines from batch quotes first
        const stillMissing = [];
        for (const sym of missingSparklines) {
          const quote = quoteMap.get(sym.toUpperCase());
          if (quote?.sparkline?.length > 0) {
            newSparklines[sym] = quote.sparkline;
          } else {
            stillMissing.push(sym);
          }
        }

        // Fallback: fetch remaining sparklines individually
        if (stillMissing.length > 0) {
          const sparkPromises = stillMissing.map(async (sym) => {
            const item = items.find(i => i.symbol === sym);
            const sData = await fetchSparkline(sym, item?.assetClass === 'crypto');
            return { symbol: sym, data: sData };
          });
          const sparkResults = await Promise.all(sparkPromises);
          for (const { symbol, data } of sparkResults) {
            if (data && data.length > 0) newSparklines[symbol] = data;
          }
        }

        if (mounted) setSparklines(newSparklines);
      }
    });
    return () => {
      mounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // Enrich with trade stats and sort
  const processedItems = useMemo(() => {
    const finalItems = enrichWithTradeStats(items, trades);

    if (sortBy === 'pnl_desc') {
      finalItems.sort((a, b) => (b.totalPnl || 0) - (a.totalPnl || 0));
    } else if (sortBy === 'change_desc' || sortBy === 'change_asc') {
      finalItems.sort((a, b) => {
        const tA = tickers[a.symbol];
        const tB = tickers[b.symbol];
        const cA = tA ? parseFloat(tA.priceChangePercent) : 0;
        const cB = tB ? parseFloat(tB.priceChangePercent) : 0;
        return sortBy === 'change_desc' ? cB - cA : cA - cB;
      });
    }
    return finalItems;
  }, [items, trades, sortBy, tickers]);

  const grouped = useMemo(() => groupByAssetClass(processedItems), [processedItems]);

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

  return (
    <div
      style={{
        fontFamily: F,
        background: compact ? 'transparent' : C.bg2,
        borderRadius: compact ? 0 : 8,
        border: compact ? 'none' : `1px solid ${C.bd}`,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: compact ? '8px 0' : '10px 12px',
          borderBottom: `1px solid ${C.bd}`,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>Watchlist</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
            <option value="default">Default</option>
            <option value="change_desc">% Change (High)</option>
            <option value="change_asc">% Change (Low)</option>
            <option value="pnl_desc">PnL</option>
          </select>
          <span style={{ fontSize: 10, fontFamily: M, color: C.t3 }}>{items.length}</span>
        </div>
      </div>

      {/* Quick add */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: compact ? '6px 0' : '8px 12px',
          borderBottom: `1px solid ${C.bd}`,
        }}
      >
        <input
          aria-label="Search watchlist"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add symbol..."
          style={{
            flex: 1,
            background: C.sf,
            border: `1px solid ${C.bd}`,
            borderRadius: 4,
            padding: '4px 8px',
            fontSize: 11,
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
            borderRadius: 4,
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            padding: '4px 8px',
            cursor: inputValue.trim() ? 'pointer' : 'default',
            opacity: inputValue.trim() ? 1 : 0.4,
          }}
        >
          +
        </button>
      </div>

      {/* Groups */}
      <div style={{ maxHeight: compact ? 300 : 400, overflowY: 'auto' }}>
        {items.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: C.t3, fontSize: 11 }}>No symbols in watchlist</div>
        ) : (
          Array.from(grouped.entries()).map(([assetClass, groupItems]) => (
            <div key={assetClass}>
              <div
                style={{
                  padding: '6px 12px 2px',
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: C.t3,
                  fontFamily: M,
                }}
              >
                {ASSET_ICONS[assetClass] || '📋'} {assetClass}
              </div>
              {groupItems.map((item) => (
                <WatchlistRow
                  key={item.symbol}
                  item={item}
                  ticker={tickers[item.symbol]}
                  sparkline={sparklines[item.symbol]}
                  sentiment={sentiments[item.symbol]}
                  hovered={hoveredSymbol === item.symbol}
                  onHover={() => setHoveredSymbol(item.symbol)}
                  onLeave={() => setHoveredSymbol(null)}
                  onClick={() => handleClickSymbol(item.symbol)}
                  onRemove={() => removeSymbol(item.symbol)}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Watchlist Row ──────────────────────────────────────────────

function WatchlistRow({ item, ticker, sparkline, sentiment, hovered, onHover, onLeave, onClick, onRemove }) {
  const hasTrades = item.tradeCount > 0;

  // Determine change color
  const isPositive = ticker ? parseFloat(ticker.priceChangePercent) >= 0 : false;
  const changeColor = ticker ? (isPositive ? C.g : C.r) : C.t3;

  return (
    <div
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        cursor: 'pointer',
        background: hovered ? C.sf : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      {/* Symbol */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: M }}>{item.symbol}</div>
          {ticker && (
            <div style={{ fontSize: 10, fontFamily: M, color: changeColor }}>
              {isPositive ? '+' : ''}
              {parseFloat(ticker.priceChangePercent).toFixed(2)}%
            </div>
          )}
        </div>
        {item.name !== item.symbol && (
          <div style={{ fontSize: 9, color: C.t3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.name}
          </div>
        )}
      </div>

      {/* Sentiment Bar */}
      {sentiment && (
        <div style={{ width: 40, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2, opacity: 0.9 }}>
          <div style={{ display: 'flex', height: 4, width: '100%', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${sentiment.bullish}%`, background: C.g }} />
            <div style={{ width: `${sentiment.neutral}%`, background: C.t3 }} />
            <div style={{ width: `${sentiment.bearish}%`, background: C.r }} />
          </div>
          <div style={{ fontSize: 8, color: C.t3, fontFamily: M, textAlign: 'center' }}>{sentiment.bullish}% B</div>
        </div>
      )}

      {/* Sparkline */}
      {sparkline && sparkline.length > 0 && (
        <div style={{ width: 40, height: 20, flexShrink: 0, opacity: 0.8 }}>
          <SVGSparkline data={sparkline} color={changeColor} />
        </div>
      )}

      {/* Trade stats */}
      {hasTrades && (
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              fontFamily: M,
              color: item.totalPnl >= 0 ? C.g : C.r,
            }}
          >
            {item.totalPnl >= 0 ? '+' : ''}${item.totalPnl.toFixed(0)}
          </div>
          <div style={{ fontSize: 8, color: C.t3, fontFamily: M }}>{item.tradeCount} trades</div>
        </div>
      )}

      {/* Remove button (on hover) */}
      {hovered && (
        <button
          className="tf-btn"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={{
            background: 'none',
            border: 'none',
            color: C.t3,
            fontSize: 12,
            cursor: 'pointer',
            padding: '0 2px',
            flexShrink: 0,
          }}
          title="Remove from watchlist"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// ─── SVG Sparkline ──────────────────────────────────────────────

function SVGSparkline({ data, color }) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 40;
  const h = 20;

  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((val - min) / range) * h;
      return `${x},${y}`;
    })
    .join(' L ');

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path
        d={`M ${points}`}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export { WatchlistPanel };

export default React.memo(WatchlistPanel);
