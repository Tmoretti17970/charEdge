// ═══════════════════════════════════════════════════════════════════
// charEdge — Tops Fear & Greed Gauge
//
// Compact Apple-style gauge showing the Fear & Greed Index.
// Fetches from existing SentimentFeed infrastructure.
// ═══════════════════════════════════════════════════════════════════

import { memo, useEffect, useState } from 'react';
import { C } from '../../../constants.js';

const LABELS = [
  { max: 20, label: 'Extreme Fear', color: '#FF3B30' },
  { max: 40, label: 'Fear', color: '#FF9500' },
  { max: 60, label: 'Neutral', color: '#FFD60A' },
  { max: 80, label: 'Greed', color: '#34C759' },
  { max: 100, label: 'Extreme Greed', color: '#30D158' },
];

function getLabel(score) {
  for (const l of LABELS) {
    if (score <= l.max) return l;
  }
  return LABELS[2];
}

export default memo(function TopsFearGreedGauge() {
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetch() {
      try {
        const { sentimentFeed } = await import('../../../ai/SentimentFeed.ts');
        const result = await sentimentFeed.fetchSentiment();
        if (!cancelled && result?.fearGreed?.score != null) {
          setScore(result.fearGreed.score);
        }
      } catch {
        // Silently fail — gauge just won't show
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetch();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || score == null) return null;

  const info = getLabel(score);
  // Arc for the gauge: 180 degree arc
  const pct = score / 100;
  const arcAngle = Math.PI * pct;
  const cx = 44,
    cy = 38,
    r = 32;
  const startX = cx - r;
  const startY = cy;
  const endX = cx + r * Math.cos(Math.PI - arcAngle);
  const endY = cy - r * Math.sin(arcAngle);
  const largeArc = pct > 0.5 ? 1 : 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 14px',
        borderRadius: 12,
        background: 'color-mix(in srgb, var(--tf-t1) 3%, transparent)',
        border: `1px solid ${C.bd}`,
        flexShrink: 0,
      }}
    >
      {/* Mini gauge SVG */}
      <svg width="44" height="28" viewBox="8 12 72 32">
        {/* Background arc */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="var(--tf-bd)"
          strokeWidth="5"
          strokeLinecap="round"
        />
        {/* Value arc */}
        {pct > 0.01 && (
          <path
            d={`M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}`}
            fill="none"
            stroke={info.color}
            strokeWidth="5"
            strokeLinecap="round"
          />
        )}
        {/* Score text */}
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          fontSize="14"
          fontWeight="700"
          fontFamily="var(--tf-mono, 'SF Mono', monospace)"
          fill={info.color}
        >
          {score}
        </text>
      </svg>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: C.t3,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            fontFamily: 'var(--tf-font)',
          }}
        >
          Fear & Greed
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: info.color,
            fontFamily: 'var(--tf-font)',
          }}
        >
          {info.label}
        </span>
      </div>
    </div>
  );
});
