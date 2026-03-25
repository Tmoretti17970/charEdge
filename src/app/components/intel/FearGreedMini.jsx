// ═══════════════════════════════════════════════════════════════════
// charEdge — Fear & Greed Mini Gauge
//
// Compact semi-circle SVG gauge for the Market Pulse strip.
// Adapted from quarantined FearGreedWidget. Fits within ~80x60px.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { C, F } from '../../../constants.js';
import { sentimentAdapter } from '../../../data/adapters/SentimentAdapter.js';
import { alpha } from '@/shared/colorUtils';

// ─── Mock Data (fallback) ────────────────────────────────────────
const MOCK_FG = { value: 68, previousClose: 62 };

function getColor(value) {
  if (value <= 20) return '#e74c3c';
  if (value <= 40) return '#e67e22';
  if (value <= 60) return '#f1c40f';
  if (value <= 80) return '#2ecc71';
  return '#27ae60';
}

function getLabel(value) {
  if (value <= 20) return 'Extreme Fear';
  if (value <= 40) return 'Fear';
  if (value <= 60) return 'Neutral';
  if (value <= 80) return 'Greed';
  return 'Extreme Greed';
}

// ─── Semi-circle Arc ─────────────────────────────────────────────
function MiniArc({ value, size = 80 }) {
  const cx = size / 2;
  const cy = size / 2 + 4;
  const radius = size / 2 - 8;
  const startAngle = Math.PI; // left
  const valueAngle = startAngle - (value / 100) * Math.PI;

  const arcPath = (start, end) => {
    const x1 = cx + radius * Math.cos(start);
    const y1 = cy + radius * Math.sin(start);
    const x2 = cx + radius * Math.cos(end);
    const y2 = cy + radius * Math.sin(end);
    const largeArc = Math.abs(end - start) > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 0 ${x2} ${y2}`;
  };

  const color = getColor(value);

  return (
    <svg width={size} height={size / 2 + 8} viewBox={`0 0 ${size} ${size / 2 + 8}`} role="img" aria-hidden="true">
      <defs>
        <linearGradient id="fgMiniGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#e74c3c" />
          <stop offset="25%" stopColor="#e67e22" />
          <stop offset="50%" stopColor="#f1c40f" />
          <stop offset="75%" stopColor="#2ecc71" />
          <stop offset="100%" stopColor="#27ae60" />
        </linearGradient>
      </defs>
      {/* Background arc */}
      <path d={arcPath(startAngle, 0)} fill="none" stroke={alpha(C.t3, 0.15)} strokeWidth="6" strokeLinecap="round" />
      {/* Value arc */}
      <path
        d={arcPath(startAngle, valueAngle)}
        fill="none"
        stroke="url(#fgMiniGrad)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* Needle dot */}
      <circle
        cx={cx + (radius - 2) * Math.cos(valueAngle)}
        cy={cy + (radius - 2) * Math.sin(valueAngle)}
        r="3"
        fill={color}
      />
      {/* Center value */}
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        fill={C.t1}
        fontSize="16"
        fontWeight="800"
        fontFamily="var(--tf-mono)"
      >
        {value}
      </text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FearGreedMini Component
// ═══════════════════════════════════════════════════════════════════

function FearGreedMini() {
  const [fgData, setFgData] = useState(MOCK_FG);

  useEffect(() => {
    async function fetchFG() {
      try {
        const result = await sentimentAdapter.fetchFearGreed();
        if (result?.current?.value != null) {
          const currentVal = result.current.value;
          const prevVal = result.history?.[1]?.value ?? MOCK_FG.previousClose;
          setFgData({ value: currentVal, previousClose: prevVal });
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[FearGreedMini] Fetch failed, using fallback:', err.message);
      }
    }
    fetchFG();
  }, []);

  const { value, previousClose } = fgData;
  const delta = value - previousClose;
  const color = getColor(value);
  const label = getLabel(value);

  return (
    <div
      role="img"
      aria-label={`Fear and Greed Index: ${value}, ${label}, ${delta >= 0 ? 'up' : 'down'} ${Math.abs(delta)} from previous`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: 80,
        flexShrink: 0,
      }}
    >
      <MiniArc value={value} size={80} />

      {/* Label */}
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          color,
          fontFamily: F,
          marginTop: -2,
          textAlign: 'center',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </div>

      {/* Delta from previous */}
      <div
        style={{
          fontSize: 8,
          fontWeight: 600,
          color: delta >= 0 ? C.g : C.r,
          fontFamily: 'var(--tf-mono)',
          marginTop: 2,
          lineHeight: 1,
        }}
      >
        {delta >= 0 ? '+' : ''}
        {delta} from prev
      </div>
    </div>
  );
}

export default React.memo(FearGreedMini);
