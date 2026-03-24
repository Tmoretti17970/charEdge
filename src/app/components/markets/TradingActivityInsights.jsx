// ═══════════════════════════════════════════════════════════════════
// charEdge — Trading Activity Insights (Sprint 35)
//
// Per-symbol trading activity card for the detail panel.
// Shows: total trades, win rate, avg/net P&L, holding status,
// and last trade date from `useJournalStore`.
// ═══════════════════════════════════════════════════════════════════

import { memo, useMemo } from 'react';
import { C } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore.js';
import { radii } from '../../../theme/tokens.js';
import st from './TradingActivityInsights.module.css';

function fmtPnl(val) {
  if (val == null || isNaN(val)) return '—';
  const sign = val >= 0 ? '+' : '';
  return `${sign}$${Math.abs(val).toFixed(2)}`;
}

function TradingActivityInsights({ symbol }) {
  const trades = useJournalStore((s) => s.trades);

  const stats = useMemo(() => {
    if (!symbol || !trades?.length) return null;

    const symbolTrades = trades.filter(
      (t) => t.symbol === symbol || t.symbol === symbol.replace('USDT', ''),
    );

    if (symbolTrades.length === 0) return null;

    const closed = symbolTrades.filter((t) => t.exitPrice != null);
    const wins = closed.filter((t) => (t.pnl ?? 0) > 0);
    const totalPnl = closed.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const avgPnl = closed.length > 0 ? totalPnl / closed.length : 0;
    const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;

    // Open positions
    const open = symbolTrades.filter((t) => t.exitPrice == null && t.entryPrice != null);
    const holdingStatus = open.length > 0
      ? open[0].side === 'sell' ? 'Short' : 'Long'
      : 'No Position';

    // Last trade
    const sorted = [...closed].sort((a, b) => new Date(b.exitDate || b.date) - new Date(a.exitDate || a.date));
    const last = sorted[0];

    return {
      totalTrades: symbolTrades.length,
      closedTrades: closed.length,
      winRate,
      avgPnl,
      totalPnl,
      holdingStatus,
      openCount: open.length,
      lastTrade: last ? {
        date: last.exitDate || last.date,
        pnl: last.pnl ?? 0,
      } : null,
    };
  }, [symbol, trades]);

  if (!stats) {
    return (
      <div style={{ padding: '8px 20px' }}>
        <div style={{ fontSize: 11, color: C.t3, fontFamily: 'var(--tf-font)' }}>
          No trades recorded for this symbol.
        </div>
      </div>
    );
  }

  const statItems = [
    { label: 'Total Trades', value: stats.totalTrades },
    { label: 'Win Rate', value: `${stats.winRate.toFixed(0)}%`, color: stats.winRate >= 50 ? C.g : C.r },
    { label: 'Avg P&L', value: fmtPnl(stats.avgPnl), color: stats.avgPnl >= 0 ? C.g : C.r },
    { label: 'Net P&L', value: fmtPnl(stats.totalPnl), color: stats.totalPnl >= 0 ? C.g : C.r },
  ];

  const statusColor = stats.holdingStatus === 'Long' ? C.g
    : stats.holdingStatus === 'Short' ? C.r : C.t3;
  const statusIcon = stats.holdingStatus === 'Long' ? '📈'
    : stats.holdingStatus === 'Short' ? '📉' : '💤';

  return (
    <div style={{ padding: '8px 20px 12px' }}>
      {/* Stat grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 8,
        marginBottom: 10,
      }}>
        {statItems.map((s) => (
          <div
            key={s.label}
            style={{
              background: `${C.sf}`,
              borderRadius: radii.sm,
              padding: '8px 10px',
            }}
          >
            <div style={{ fontSize: 9, fontFamily: 'var(--tf-font)', color: C.t3, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {s.label}
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--tf-mono)', color: s.color || C.t1 }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Holding status */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderRadius: radii.sm,
        background: `${statusColor}08`,
        border: `1px solid ${statusColor}20`,
      }}>
        <span style={{ fontSize: 14 }}>{statusIcon}</span>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--tf-mono)', color: statusColor }}>
            {stats.holdingStatus}
          </div>
          {stats.openCount > 0 && (
            <div style={{ fontSize: 9, fontFamily: 'var(--tf-mono)', color: C.t3 }}>
              {stats.openCount} open position{stats.openCount > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* Last trade */}
      {stats.lastTrade && (
        <div style={{
          marginTop: 8,
          fontSize: 10,
          fontFamily: 'var(--tf-mono)',
          color: C.t3,
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span>Last trade: {new Date(stats.lastTrade.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          <span style={{ color: stats.lastTrade.pnl >= 0 ? C.g : C.r, fontWeight: 700 }}>
            {fmtPnl(stats.lastTrade.pnl)}
          </span>
        </div>
      )}
    </div>
  );
}

export default memo(TradingActivityInsights);
