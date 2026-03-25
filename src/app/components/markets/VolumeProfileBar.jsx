// ═══════════════════════════════════════════════════════════════════
// charEdge — Volume Profile Bar (Sprint 36)
//
// Compact bar comparing current volume to 20-day average volume.
// Shows ratio label and badges: ⚡ if >1.5×, 🔥 if >3×.
// Inline version for grid column, expanded version for detail panel.
// ═══════════════════════════════════════════════════════════════════

import { memo, useState } from 'react';
import { C } from '../../../constants.js';
import { transition } from '../../../theme/tokens.js';

function fmtVol(v) {
  if (v == null || isNaN(v)) return '—';
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
}

function VolumeProfileBar({ currentVolume, avgVolume, expanded = false }) {
  const [hovered, setHovered] = useState(false);

  if (currentVolume == null || avgVolume == null || avgVolume <= 0) {
    return <div style={{ fontSize: 10, color: C.t3, fontFamily: 'var(--tf-mono)' }}>—</div>;
  }

  const ratio = currentVolume / avgVolume;
  const clampedRatio = Math.min(ratio, 3);
  const pct = (clampedRatio / 3) * 100;

  const barColor = ratio > 1.5 ? C.g : ratio > 1 ? '#f5a623' : C.t3;
  const badge = ratio > 3 ? '🔥' : ratio > 1.5 ? '⚡' : '';
  const ratioLabel = `${ratio.toFixed(1)}×`;

  const barH = expanded ? 8 : 5;

  return (
    <div
      style={{
        position: 'relative',
        width: expanded ? '100%' : 100,
        padding: expanded ? '8px 20px 12px' : 0,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Expanded header */}
      {expanded && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}
        >
          <span style={{ fontSize: 10, fontFamily: 'var(--tf-mono)', color: C.t3 }}>Avg: {fmtVol(avgVolume)}</span>
          <span style={{ fontSize: 10, fontFamily: 'var(--tf-mono)', color: barColor, fontWeight: 700 }}>
            {ratioLabel} avg {badge}
          </span>
          <span style={{ fontSize: 10, fontFamily: 'var(--tf-mono)', color: C.t3 }}>Now: {fmtVol(currentVolume)}</span>
        </div>
      )}

      {/* Bar container */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <div
          style={{
            position: 'relative',
            flex: 1,
            height: barH,
            borderRadius: barH / 2,
            background: `${C.bd}20`,
            overflow: 'hidden',
          }}
        >
          {/* Average line marker at 33% (1× of 3×) */}
          <div
            style={{
              position: 'absolute',
              left: '33.3%',
              top: 0,
              width: 1,
              height: '100%',
              background: `${C.t3}60`,
              zIndex: 2,
            }}
          />

          {/* Current volume bar */}
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              borderRadius: barH / 2,
              background: barColor,
              transition: `width ${transition.base}`,
            }}
          />
        </div>

        {/* Compact labels */}
        {!expanded && (
          <span
            style={{
              fontSize: 9,
              fontFamily: 'var(--tf-mono)',
              color: barColor,
              fontWeight: 700,
              minWidth: 26,
              textAlign: 'right',
            }}
          >
            {badge || ratioLabel}
          </span>
        )}
      </div>

      {/* Tooltip (compact mode) */}
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
          <div style={{ fontSize: 9, fontFamily: 'var(--tf-mono)', color: C.t3, marginBottom: 2 }}>
            Volume vs 20d Avg
          </div>
          <div style={{ fontSize: 10, fontFamily: 'var(--tf-mono)', color: barColor, fontWeight: 700 }}>
            {fmtVol(currentVolume)} / {fmtVol(avgVolume)} = {ratioLabel} {badge}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(VolumeProfileBar);
