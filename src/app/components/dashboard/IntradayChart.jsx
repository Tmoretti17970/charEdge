// ═══════════════════════════════════════════════════════════════════
// charEdge — IntradayChart (Sprint 43)
//
// Small SVG line chart showing today's cumulative P&L over time.
// Red/green gradient fill based on net direction.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, memo } from 'react';
import { C, M } from '../../../constants.js';
import { radii } from '../../../theme/tokens.js';

function fmtPnl(val) {
  if (val == null || isNaN(val)) return '';
  const sign = val >= 0 ? '+' : '';
  return `${sign}$${Math.abs(val).toFixed(0)}`;
}

function IntradayChart({ trades = [], isMobile = false }) {
  // Filter today's trades and compute cumulative P&L over time
  const { points, current, high, low } = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const todayTrades = trades
      .filter((t) => {
        const ts = t.exitTime || t.entryTime || t.timestamp;
        return ts && new Date(ts).getTime() >= todayStart;
      })
      .sort((a, b) => {
        const ta = new Date(a.exitTime || a.entryTime || a.timestamp).getTime();
        const tb = new Date(b.exitTime || b.entryTime || b.timestamp).getTime();
        return ta - tb;
      });

    if (todayTrades.length < 2) return { points: [], current: 0, high: 0, low: 0 };

    let cumPnl = 0;
    let hi = 0;
    let lo = 0;
    const pts = [{ time: todayStart, value: 0 }];

    for (const trade of todayTrades) {
      cumPnl += trade.pnl || 0;
      hi = Math.max(hi, cumPnl);
      lo = Math.min(lo, cumPnl);
      pts.push({
        time: new Date(trade.exitTime || trade.entryTime || trade.timestamp).getTime(),
        value: cumPnl,
      });
    }

    return { points: pts, current: cumPnl, high: hi, low: lo };
  }, [trades]);

  if (points.length < 2) return null;

  const width = isMobile ? 320 : 400;
  const height = 72;
  const pad = 8;
  const range = Math.max(high - low, 1);
  const isPositive = current >= 0;
  const color = isPositive ? C.g : C.r;

  const timeRange = points[points.length - 1].time - points[0].time || 1;

  const svgPoints = points
    .map((p) => {
      const x = pad + ((p.time - points[0].time) / timeRange) * (width - pad * 2);
      const y = pad + ((high - p.value) / range) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');

  const fillPoints = `${pad},${height - pad} ${svgPoints} ${width - pad},${height - pad}`;

  return (
    <div
      style={{
        background: C.sf,
        border: `1px solid ${C.bd}40`,
        borderRadius: radii.lg,
        padding: '12px 16px',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Today's P&L Timeline
        </span>
        <span style={{ fontSize: 14, fontWeight: 700, fontFamily: M, color, fontVariantNumeric: 'tabular-nums' }}>
          {fmtPnl(current)}
        </span>
      </div>

      {/* Chart */}
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="intradayFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Zero line */}
        <line
          x1={pad}
          y1={pad + (high / range) * (height - pad * 2)}
          x2={width - pad}
          y2={pad + (high / range) * (height - pad * 2)}
          stroke={C.bd}
          strokeWidth="0.5"
          strokeDasharray="4,4"
        />
        <polygon fill="url(#intradayFill)" points={fillPoints} />
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={svgPoints}
        />
      </svg>
    </div>
  );
}

export default memo(IntradayChart);
