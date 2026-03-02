// ═══════════════════════════════════════════════════════════════════
// charEdge — Sidebar P&L Widget
// Always-visible today's P&L summary in the sidebar.
// Shows colored dollar amount, win/loss count, and trade count.
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { C, M } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore.js';

/** Get start-of-day timestamp for comparison */
function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export default function SidebarPnL({ expanded = false }) {
  const trades = useJournalStore((s) => s.trades);

  const { totalPnl, wins, losses, count } = useMemo(() => {
    const start = todayStart();
    let total = 0, w = 0, l = 0, c = 0;
    for (const t of trades) {
      const ts = new Date(t.date).getTime();
      if (ts >= start) {
        total += t.pnl || 0;
        if ((t.pnl || 0) > 0) w++;
        else if ((t.pnl || 0) < 0) l++;
        c++;
      }
    }
    return { totalPnl: total, wins: w, losses: l, count: c };
  }, [trades]);

  const color = totalPnl > 0 ? C.g : totalPnl < 0 ? C.r : C.t3;
  const sign = totalPnl > 0 ? '+' : '';
  const formatted = `${sign}$${Math.abs(totalPnl).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

  // Collapsed: compact P&L chip
  if (!expanded) {
    return (
      <div
        title={`Today: ${formatted} (${count} trades)`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          padding: '8px 4px',
          cursor: 'default',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            fontFamily: M,
            color,
            letterSpacing: '-0.02em',
          }}
        >
          {formatted}
        </span>
        {count > 0 && (
          <span
            style={{
              fontSize: 8,
              fontFamily: M,
              color: C.t3,
              letterSpacing: '0.02em',
            }}
          >
            {wins}W {losses}L
          </span>
        )}
      </div>
    );
  }

  // Expanded: full P&L widget with label
  return (
    <div
      style={{
        padding: '10px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 600,
          fontFamily: M,
          color: C.t3,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        Today's P&L
      </span>
      <span
        style={{
          fontSize: 18,
          fontWeight: 800,
          fontFamily: M,
          color,
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
        }}
      >
        {formatted}
      </span>
      {count > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            fontSize: 10,
            fontFamily: M,
          }}
        >
          <span style={{ color: C.g }}>{wins}W</span>
          <span style={{ color: C.r }}>{losses}L</span>
          <span style={{ color: C.t3 }}>·</span>
          <span style={{ color: C.t3 }}>{count} trades</span>
        </div>
      )}
      {count === 0 && (
        <span style={{ fontSize: 10, fontFamily: M, color: C.t3 }}>
          No trades yet
        </span>
      )}
    </div>
  );
}
