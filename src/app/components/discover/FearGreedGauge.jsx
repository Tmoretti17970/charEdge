// ═══════════════════════════════════════════════════════════════════
// charEdge — Fear & Greed Gauge
//
// Circular gauge showing market sentiment score (0-100).
// Apple-style with smooth gradient fill and centered label.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import s from './FearGreedGauge.module.css';

const SIZE = 80;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function FearGreedGauge({ score, label, color }) {
  const progress = (score / 100) * CIRCUMFERENCE;
  const offset = CIRCUMFERENCE - progress;

  return (
    <div className={s.wrap}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className={s.svg}>
        {/* Background ring */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--tf-bd)"
          strokeWidth={STROKE}
          opacity={0.3}
        />
        {/* Progress ring */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          className={s.progressRing}
        />
      </svg>
      <div className={s.center}>
        <span className={s.score} style={{ color }}>
          {score}
        </span>
      </div>
      <div className={s.label} style={{ color }}>
        {label}
      </div>
    </div>
  );
}

export default React.memo(FearGreedGauge);
