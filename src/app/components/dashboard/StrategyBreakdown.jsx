// ═══════════════════════════════════════════════════════════════════
// charEdge — StrategyBreakdown (Sprint 44)
//
// Compact row showing P&L per strategy tag.
// Only renders if trades have strategy tags.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, memo } from 'react';
import { C, M } from '../../../constants.js';
import { radii } from '../../../theme/tokens.js';

function StrategyBreakdown({ trades = [] }) {
  const strategies = useMemo(() => {
    const map = {};
    for (const t of trades) {
      const strat = t.strategy || t.tag || t.setup;
      if (!strat) continue;
      if (!map[strat]) map[strat] = { name: strat, pnl: 0, wins: 0, total: 0 };
      map[strat].pnl += t.pnl || 0;
      map[strat].total += 1;
      if ((t.pnl || 0) > 0) map[strat].wins += 1;
    }
    return Object.values(map).sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
  }, [trades]);

  if (strategies.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        padding: '10px 0',
      }}
    >
      {strategies.slice(0, 5).map((s) => {
        const wr = s.total > 0 ? Math.round((s.wins / s.total) * 100) : 0;
        const color = s.pnl >= 0 ? C.g : C.r;
        return (
          <div
            key={s.name}
            style={{
              padding: '6px 12px',
              background: `${color}08`,
              border: `1px solid ${color}20`,
              borderRadius: radii.md,
              fontSize: 11,
              fontFamily: M,
              fontWeight: 600,
              color: C.t1,
              display: 'flex',
              gap: 6,
              alignItems: 'baseline',
            }}
          >
            <span>{s.name}</span>
            <span style={{ color, fontWeight: 700 }}>
              {s.pnl >= 0 ? '+' : ''}${Math.abs(s.pnl).toFixed(0)}
            </span>
            <span style={{ fontSize: 9, color: C.t3 }}>
              {wr}% WR
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default memo(StrategyBreakdown);
