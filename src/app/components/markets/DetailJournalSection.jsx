// ═══════════════════════════════════════════════════════════════════
// charEdge — Detail Panel Journal Section (Sprint 38)
//
// Shows trade history for the selected symbol in the Markets detail
// panel: trade count, win rate, mini equity curve, recent trades.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, memo } from 'react';
import { C, F, M } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore';
import { useUIStore } from '../../../state/useUIStore';
import { radii } from '../../../theme/tokens.js';

// ─── Mini Equity Curve (SVG) ─────────────────────────────────────

function MiniEquityCurve({ trades, width = 200, height = 40 }) {
  if (!trades || trades.length < 2) return null;

  // Build cumulative P&L series
  let cum = 0;
  const points = trades.map((t) => {
    cum += t.pnl || 0;
    return cum;
  });

  const min = Math.min(0, ...points);
  const max = Math.max(0, ...points);
  const range = max - min || 1;

  const coords = points.map((v, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 6) - 3;
    return `${x},${y}`;
  }).join(' ');

  const finalColor = cum >= 0 ? C.g : C.r;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      {/* Zero line */}
      <line
        x1="0" y1={height - ((0 - min) / range) * (height - 6) - 3}
        x2={width} y2={height - ((0 - min) / range) * (height - 6) - 3}
        stroke={C.bd} strokeWidth="0.5" strokeDasharray="3,3"
      />
      <polyline
        points={coords}
        fill="none"
        stroke={finalColor}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Trade Row ───────────────────────────────────────────────────

function TradeRow({ trade }) {
  const isWin = (trade.pnl || 0) >= 0;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '5px 0',
      borderBottom: `1px solid ${C.bd}20`,
      fontSize: 11, fontFamily: M,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
        background: isWin ? C.g : C.r,
      }} />
      <span style={{ color: C.t3, width: 62, flexShrink: 0 }}>
        {trade.date ? new Date(trade.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
      </span>
      <span style={{
        fontWeight: 600, color: trade.direction === 'long' ? C.g : C.r,
        textTransform: 'uppercase', fontSize: 9, width: 36,
      }}>
        {trade.direction || '—'}
      </span>
      <span style={{ flex: 1, color: C.t3, fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {trade.notes || ''}
      </span>
      <span style={{
        fontWeight: 700, fontVariantNumeric: 'tabular-nums',
        color: isWin ? C.g : C.r, flexShrink: 0,
      }}>
        {isWin ? '+' : ''}{(trade.pnl || 0).toFixed(2)}
      </span>
    </div>
  );
}

// ─── Main Section ────────────────────────────────────────────────

function DetailJournalSection({ symbol }) {
  const trades = useJournalStore((s) => s.trades);
  const setPage = useUIStore((s) => s.setPage);

  // Filter trades for this symbol
  const symbolTrades = useMemo(() => {
    if (!trades || !symbol) return [];
    return trades
      .filter((t) => (t.symbol || '').toUpperCase() === symbol.toUpperCase())
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }, [trades, symbol]);

  if (symbolTrades.length === 0) {
    return (
      <div style={{
        padding: '12px 0', textAlign: 'center',
        fontSize: 11, color: C.t3, fontFamily: F,
      }}>
        No trades recorded for {symbol}
      </div>
    );
  }

  const wins = symbolTrades.filter((t) => (t.pnl || 0) > 0).length;
  const winRate = ((wins / symbolTrades.length) * 100).toFixed(0);
  const totalPnl = symbolTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const recentTrades = symbolTrades.slice(0, 5);

  return (
    <div>
      {/* Stats row */}
      <div style={{
        display: 'flex', gap: 10, marginBottom: 10,
      }}>
        {[
          { label: 'Trades', value: symbolTrades.length },
          { label: 'Win Rate', value: `${winRate}%` },
          { label: 'Total P&L', value: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`, color: totalPnl >= 0 ? C.g : C.r },
        ].map((stat) => (
          <div key={stat.label} style={{
            flex: 1, padding: '6px 8px',
            borderRadius: radii.sm, background: C.bg2,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 8, color: C.t3, fontFamily: M, textTransform: 'uppercase', marginBottom: 2 }}>
              {stat.label}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: M, color: stat.color || C.t1 }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Equity curve */}
      {symbolTrades.length >= 2 && (
        <div style={{ marginBottom: 10 }}>
          <MiniEquityCurve trades={[...symbolTrades].reverse()} />
        </div>
      )}

      {/* Recent trades */}
      <div>
        {recentTrades.map((trade, i) => (
          <TradeRow key={trade.id || i} trade={trade} />
        ))}
      </div>

      {/* Link to journal */}
      {symbolTrades.length > 5 && (
        <div style={{
          textAlign: 'center', paddingTop: 8,
          fontSize: 10, color: C.b, fontFamily: F,
          cursor: 'pointer', fontWeight: 600,
        }}
          onClick={() => setPage('journal')}
        >
          View all {symbolTrades.length} trades →
        </div>
      )}
    </div>
  );
}

export default memo(DetailJournalSection);
