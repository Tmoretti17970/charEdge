// ═══════════════════════════════════════════════════════════════════
// charEdge — 52-Week Range Bar (Sprint 34)
//
// Mini horizontal bar showing current price position within the
// 52-week high/low range. Green zone near low, red zone near high.
// Compact version for grid column, expanded version for detail panel.
// ═══════════════════════════════════════════════════════════════════

import { memo, useState } from 'react';
import { C, M } from '../../../constants.js';
import { transition } from '../../../theme/tokens.js';

function fmtPrice(val) {
  if (val == null || isNaN(val)) return '—';
  if (val >= 1000) return `$${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (val >= 1) return `$${val.toFixed(2)}`;
  return `$${val.toFixed(4)}`;
}

function WeekRangeBar({ low52w, high52w, currentPrice, expanded = false }) {
  const [hovered, setHovered] = useState(false);

  if (low52w == null || high52w == null || currentPrice == null) {
    return (
      <div style={{ fontSize: 10, color: C.t3, fontFamily: M }}>—</div>
    );
  }

  const range = high52w - low52w;
  const pct = range > 0 ? Math.max(0, Math.min(1, (currentPrice - low52w) / range)) : 0.5;
  const pctLabel = `${(pct * 100).toFixed(0)}%`;

  // Near low = green (opportunity), near high = red (caution)
  const dotColor = pct < 0.3 ? C.g : pct > 0.7 ? C.r : '#f5a623';
  const barH = expanded ? 8 : 5;
  const barW = expanded ? '100%' : 110;

  return (
    <div
      style={{
        position: 'relative',
        width: barW,
        padding: expanded ? '8px 20px 12px' : '0',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Expanded labels */}
      {expanded && (
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          marginBottom: 6,
        }}>
          <span style={{ fontSize: 10, fontFamily: M, color: C.t3 }}>
            {fmtPrice(low52w)}
          </span>
          <span style={{ fontSize: 10, fontFamily: M, color: dotColor, fontWeight: 700 }}>
            {pctLabel} of range
          </span>
          <span style={{ fontSize: 10, fontFamily: M, color: C.t3 }}>
            {fmtPrice(high52w)}
          </span>
        </div>
      )}

      {/* Bar track */}
      <div
        style={{
          position: 'relative',
          height: barH,
          borderRadius: barH / 2,
          background: `linear-gradient(90deg, ${C.g}30, #f5a62330, ${C.r}30)`,
          overflow: 'visible',
        }}
      >
        {/* Filled portion */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: `${pct * 100}%`,
            borderRadius: `${barH / 2}px 0 0 ${barH / 2}px`,
            background: `linear-gradient(90deg, ${C.g}60, ${dotColor}60)`,
            transition: `width ${transition.base}`,
          }}
        />

        {/* Current price dot */}
        <div
          style={{
            position: 'absolute',
            left: `${pct * 100}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: expanded ? 14 : 10,
            height: expanded ? 14 : 10,
            borderRadius: '50%',
            background: dotColor,
            border: `2px solid ${C.bg}`,
            boxShadow: `0 0 6px ${dotColor}50`,
            transition: `all ${transition.base}`,
            zIndex: 2,
          }}
        />
      </div>

      {/* Tooltip on hover (compact mode only) */}
      {!expanded && hovered && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 6,
            background: `${C.bg}f0`,
            border: `1px solid ${C.bd}30`,
            borderRadius: 6,
            padding: '6px 10px',
            whiteSpace: 'nowrap',
            zIndex: 20,
            backdropFilter: 'blur(12px)',
            boxShadow: `0 4px 16px ${C.bd}20`,
          }}
        >
          <div style={{ fontSize: 9, fontFamily: M, color: C.t3, marginBottom: 3 }}>
            52-Week Range
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontFamily: M, color: C.g }}>{fmtPrice(low52w)}</span>
            <span style={{ fontSize: 10, fontFamily: M, color: dotColor, fontWeight: 700 }}>
              → {fmtPrice(currentPrice)} ({pctLabel})
            </span>
            <span style={{ fontSize: 10, fontFamily: M, color: C.r }}>{fmtPrice(high52w)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(WeekRangeBar);
