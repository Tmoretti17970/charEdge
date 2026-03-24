// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Watchlist Panel
//
// Compact sidebar/overlay widget showing:
//   - Watched symbols grouped by asset class
//   - Trade stats (P&L, count) from journal data
//   - Click to navigate chart to symbol
//   - Quick add via text input
//   - Star/unstar toggle
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { C } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore';
import { useUIStore } from '../../../state/useUIStore';
import { useWatchlistStore, groupByAssetClass, enrichWithTradeStats } from '../../../state/useWatchlistStore.js';
import { useChartCoreStore } from '../../../state/chart/useChartCoreStore';
import st from './WatchlistPanel.module.css';

const ASSET_ICONS = {
  futures: '📊', stocks: '📈', crypto: '₿', etf: '🏦',
  forex: '💱', options: '⚡', other: '📋',
};

function WatchlistPanel({ compact = false }) {
  const items = useWatchlistStore((s) => s.items);
  const addSymbol = useWatchlistStore((s) => s.add);
  const removeSymbol = useWatchlistStore((s) => s.remove);
  const trades = useJournalStore((s) => s.trades);
  const setChartSymbol = useChartCoreStore((s) => s.setSymbol);
  const setPage = useUIStore((s) => s.setPage);
  const [inputValue, setInputValue] = useState('');
  const [sortBy, setSortBy] = useState('default');

  const [tickers, setTickers] = useState({});
  const [sparklines, setSparklines] = useState({});
  const [sentiments, _setSentiments] = useState({});

  useEffect(() => {
    let mounted = true;
    import('../../../data/FetchService.ts').then(async ({ fetch24hTicker, fetchSparkline }) => {
      const symbolsToFetch = items.filter(i => !tickers[i.symbol]).map(i => i.symbol);
      if (symbolsToFetch.length > 0) {
        const tickerResults = await fetch24hTicker(symbolsToFetch);
        const newTickers = { ...tickers };
        for (const t of tickerResults) {
          if (t?.symbol) newTickers[t.symbol.replace('USDT', '')] = t;
          if (t?.symbol) newTickers[t.symbol] = t;
        }
        if (mounted) setTickers(newTickers);
      }

      const { batchGetQuotes } = await import('../../../data/QuoteService.js');
      const missingSparklines = items.filter(i => !sparklines[i.symbol]).map(i => i.symbol);
      if (missingSparklines.length > 0) {
        const quoteMap = await batchGetQuotes(missingSparklines);
        const newSparklines = { ...sparklines };
        const stillMissing = [];
        for (const sym of missingSparklines) {
          const quote = quoteMap.get(sym.toUpperCase());
          if (quote?.sparkline?.length > 0) {
            newSparklines[sym] = quote.sparkline;
          } else {
            stillMissing.push(sym);
          }
        }
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
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

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
    if (sym) { addSymbol({ symbol: sym }); setInputValue(''); }
  }, [inputValue, addSymbol]);

  const handleClickSymbol = useCallback(
    (symbol) => { setChartSymbol(symbol); setPage('charts'); },
    [setChartSymbol, setPage],
  );

  return (
    <div className={`${st.root} ${compact ? st.rootCompact : st.rootFull}`}>
      {/* Header */}
      <div className={`${st.header} ${compact ? st.headerCompact : st.headerFull}`}>
        <span className={st.headerTitle}>Watchlist</span>
        <div className={st.headerRight}>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={st.sortSelect}>
            <option value="default">Default</option>
            <option value="change_desc">% Change (High)</option>
            <option value="change_asc">% Change (Low)</option>
            <option value="pnl_desc">PnL</option>
          </select>
          <span className={st.itemCount}>{items.length}</span>
        </div>
      </div>

      {/* Quick add */}
      <div className={`${st.addRow} ${compact ? st.addRowCompact : st.addRowFull}`}>
        <input
          aria-label="Search watchlist"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add symbol..."
          className={st.addInput}
        />
        <button
          className={`tf-btn ${st.addBtn} ${!inputValue.trim() ? st.addBtnDisabled : ''}`}
          onClick={handleAdd}
          disabled={!inputValue.trim()}
        >+</button>
      </div>

      {/* Groups */}
      <div className={st.scrollArea} style={{ maxHeight: compact ? 300 : 400 }}>
        {items.length === 0 ? (
          <div className={st.empty}>No symbols in watchlist</div>
        ) : (
          Array.from(grouped.entries()).map(([assetClass, groupItems]) => (
            <div key={assetClass}>
              <div className={st.groupLabel}>
                {ASSET_ICONS[assetClass] || '📋'} {assetClass}
              </div>
              {groupItems.map((item) => (
                <WatchlistRow
                  key={item.symbol}
                  item={item}
                  ticker={tickers[item.symbol]}
                  sparkline={sparklines[item.symbol]}
                  sentiment={sentiments[item.symbol]}
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

function WatchlistRow({ item, ticker, sparkline, sentiment, onClick, onRemove }) {
  const hasTrades = item.tradeCount > 0;
  const isPositive = ticker ? parseFloat(ticker.priceChangePercent) >= 0 : false;
  const changeColor = ticker ? (isPositive ? C.g : C.r) : C.t3;

  return (
    <div className={st.row} onClick={onClick}>
      <div className={st.rowBody}>
        <div className={st.rowTop}>
          <div className={st.rowSymbol}>{item.symbol}</div>
          {ticker && (
            <div className={st.rowChange} style={{ color: changeColor }}>
              {isPositive ? '+' : ''}{parseFloat(ticker.priceChangePercent).toFixed(2)}%
            </div>
          )}
        </div>
        {item.name !== item.symbol && (
          <div className={st.rowName}>{item.name}</div>
        )}
      </div>

      {sentiment && (
        <div className={st.sentimentWrap}>
          <div className={st.sentimentBar}>
            <div style={{ width: `${sentiment.bullish}%`, background: C.g }} />
            <div style={{ width: `${sentiment.neutral}%`, background: C.t3 }} />
            <div style={{ width: `${sentiment.bearish}%`, background: C.r }} />
          </div>
          <div className={st.sentimentLabel}>{sentiment.bullish}% B</div>
        </div>
      )}

      {sparkline && sparkline.length > 0 && (
        <div className={st.sparkWrap}>
          <SVGSparkline data={sparkline} color={changeColor} />
        </div>
      )}

      {hasTrades && (
        <div className={st.tradeStats}>
          <div className={st.tradePnl} style={{ color: item.totalPnl >= 0 ? C.g : C.r }}>
            {item.totalPnl >= 0 ? '+' : ''}${item.totalPnl.toFixed(0)}
          </div>
          <div className={st.tradeCount}>{item.tradeCount} trades</div>
        </div>
      )}

      <button
        className={`tf-btn ${st.removeBtn}`}
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        title="Remove from watchlist"
      >✕</button>
    </div>
  );
}

// ─── SVG Sparkline ──────────────────────────────────────────────

function SVGSparkline({ data, color }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 40; const h = 20;
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((val - min) / range) * h;
    return `${x},${y}`;
  }).join(' L ');

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={`M ${points}`} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export { WatchlistPanel };
export default React.memo(WatchlistPanel);
