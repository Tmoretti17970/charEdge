// ═══════════════════════════════════════════════════════════════════
// charEdge — AssetBreakdown (Sprint 45)
//
// Compact row showing P&L by asset class with horizontal bar chart.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, memo } from 'react';
import { C, M } from '../../../constants.js';
import { getAssetClass } from '../../../constants.js';
import { radii } from '../../../theme/tokens.js';

function AssetBreakdown({ trades = [] }) {
  const classes = useMemo(() => {
    const map = {};
    for (const t of trades) {
      const cls = (typeof getAssetClass === 'function' ? getAssetClass(t.symbol) : t.assetClass) || 'Other';
      if (!map[cls]) map[cls] = { name: cls, pnl: 0, count: 0 };
      map[cls].pnl += t.pnl || 0;
      map[cls].count += 1;
    }
    return Object.values(map).sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
  }, [trades]);

  if (classes.length === 0) return null;

  const maxAbs = Math.max(...classes.map((c) => Math.abs(c.pnl)), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 0' }}>
      {classes.slice(0, 4).map((cls) => {
        const color = cls.pnl >= 0 ? C.g : C.r;
        const barWidth = Math.max((Math.abs(cls.pnl) / maxAbs) * 100, 4);
        return (
          <div key={cls.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.t2, width: 70, flexShrink: 0 }}>
              {cls.name}
            </span>
            <div style={{ flex: 1, height: 16, background: `${C.bd}15`, borderRadius: radii.xs, overflow: 'hidden' }}>
              <div style={{
                width: `${barWidth}%`,
                height: '100%',
                background: `${color}30`,
                borderRadius: radii.xs,
                transition: 'width 0.3s ease',
              }} />
            </div>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              fontFamily: M,
              color,
              fontVariantNumeric: 'tabular-nums',
              width: 60,
              textAlign: 'right',
              flexShrink: 0,
            }}>
              {cls.pnl >= 0 ? '+' : ''}${Math.abs(cls.pnl).toFixed(0)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default memo(AssetBreakdown);
