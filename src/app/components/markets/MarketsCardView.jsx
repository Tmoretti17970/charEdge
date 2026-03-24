// ═══════════════════════════════════════════════════════════════════
// charEdge — Markets Card View (Sprint 17)
//
// Grid of responsive cards showing each asset with:
//   - Symbol + name, price, 24h change, sparkline
//   - Hover glow effect, click to open detail panel
//
// Reuses data from MarketsWatchlistGrid data layer.
// ═══════════════════════════════════════════════════════════════════

import { memo, useCallback, useMemo } from 'react';
import { C } from '../../../constants.js';
import { useWatchlistStore, enrichWithTradeStats } from '../../../state/useWatchlistStore.js';
import { useJournalStore } from '../../../state/useJournalStore';
import { useMarketsPrefsStore } from '../../../state/useMarketsPrefsStore';
import useWatchlistStreaming from '../../../hooks/useWatchlistStreaming.js';
import { radii, transition } from '../../../theme/tokens.js';
import Sparkline from '../ui/Sparkline.jsx';
import st from './MarketsCardView.module.css';

const ACCENT = '#6e5ce6';

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
  if (val >= 1e9) return `${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `${(val / 1e3).toFixed(1)}K`;
  return val.toFixed(0);
}

function MarketsCardView() {
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

  const handleClick = useCallback((symbol) => {
    setSelectedSymbol(symbol);
  }, [setSelectedSymbol]);

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 20px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 14,
        alignContent: 'start',
      }}
    >
      {filtered.map((item) => {
        const change = item.change24h ?? item.change ?? 0;
        const isUp = change >= 0;
        const changeColor = isUp ? C.g : C.r;

        return (
          <div
            key={item.symbol}
            onClick={() => handleClick(item.symbol)}
            style={{
              background: `${C.sf}80`,
              border: `1px solid ${C.bd}30`,
              borderRadius: radii.lg,
              padding: '14px 16px',
              cursor: 'pointer',
              transition: `all ${transition.fast}`,
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = `${ACCENT}50`;
              e.currentTarget.style.boxShadow = `0 4px 20px ${ACCENT}12`;
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = `${C.bd}30`;
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {/* Header: symbol + price */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--tf-font)', color: C.t1, letterSpacing: '-0.01em' }}>
                  {item.symbol?.replace('USDT', '')}
                </div>
                <div style={{ fontSize: 10, fontFamily: 'var(--tf-mono)', color: C.t3, marginTop: 2 }}>
                  {item.assetClass || 'Crypto'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--tf-mono)', color: C.t1 }}>
                  {fmtPrice(item.price)}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--tf-mono)', color: changeColor, marginTop: 2 }}>
                  {fmtChange(change)}
                </div>
              </div>
            </div>

            {/* Sparkline */}
            <div style={{ height: 40, margin: '0 -4px' }}>
              <Sparkline symbol={item.symbol} height={40} color={isUp ? C.g : C.r} />
            </div>

            {/* Footer: volume */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <span style={{ fontSize: 9, fontFamily: 'var(--tf-mono)', color: C.t3 }}>
                Vol {fmtVolume(item.volume)}
              </span>
              {item.tradeCount > 0 && (
                <span style={{ fontSize: 9, fontFamily: 'var(--tf-mono)', color: C.t3 }}>
                  {item.tradeCount} trades
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default memo(MarketsCardView);
