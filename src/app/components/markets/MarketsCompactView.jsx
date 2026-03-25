// ═══════════════════════════════════════════════════════════════════
// charEdge — Markets Compact View (Sprint 17)
//
// Dense, minimal list showing symbol + price + change in a compact
// two-column layout. Optimized for scanning large watchlists fast.
// ═══════════════════════════════════════════════════════════════════

import { memo, useCallback, useMemo } from 'react';
import { C } from '../../../constants.js';
import useWatchlistStreaming from '../../../hooks/useWatchlistStreaming.js';
import { useJournalStore } from '../../../state/useJournalStore';
import { useMarketsPrefsStore } from '../../../state/useMarketsPrefsStore';
import { useWatchlistStore, enrichWithTradeStats } from '../../../state/useWatchlistStore.js';
import { transition } from '../../../theme/tokens.js';

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

function MarketsCompactView() {
  const items = useWatchlistStore((s) => s.items);
  const trades = useJournalStore((s) => s.trades);
  const setSelectedSymbol = useMarketsPrefsStore((s) => s.setSelectedSymbol);
  const assetClassFilters = useMarketsPrefsStore((s) => s.assetClassFilters);

  const symbols = useMemo(() => items.map((i) => i.symbol), [items]);
  useWatchlistStreaming(symbols, symbols.length > 0);
  const enriched = enrichWithTradeStats(items, trades);
  const filtered = useMemo(() => {
    if (assetClassFilters.length === 0) return enriched;
    return enriched.filter((item) => assetClassFilters.includes(item.assetClass));
  }, [enriched, assetClassFilters]);

  const handleClick = useCallback(
    (symbol) => {
      setSelectedSymbol(symbol);
    },
    [setSelectedSymbol],
  );

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px 16px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 2,
        alignContent: 'start',
      }}
    >
      {filtered.map((item) => {
        const change = item.change24h ?? item.change ?? 0;
        const isUp = change >= 0;

        return (
          <div
            key={item.symbol}
            onClick={() => handleClick(item.symbol)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              borderRadius: 4,
              cursor: 'pointer',
              transition: `background ${transition.fast}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `${C.sf}`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            {/* Symbol */}
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                fontFamily: 'var(--tf-font)',
                color: C.t1,
                minWidth: 60,
              }}
            >
              {item.symbol?.replace('USDT', '')}
            </span>

            {/* Price */}
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'var(--tf-mono)',
                color: C.t1,
                flex: 1,
                textAlign: 'right',
                paddingRight: 8,
              }}
            >
              {fmtPrice(item.price)}
            </span>

            {/* Change */}
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                fontFamily: 'var(--tf-mono)',
                color: isUp ? C.g : C.r,
                minWidth: 55,
                textAlign: 'right',
              }}
            >
              {fmtChange(change)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default memo(MarketsCompactView);
