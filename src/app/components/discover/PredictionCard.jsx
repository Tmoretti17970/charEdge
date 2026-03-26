// ═══════════════════════════════════════════════════════════════════
// charEdge — Prediction Card
//
// Individual prediction market card showing probability ring,
// question, delta, volume, and resolution date.
// ═══════════════════════════════════════════════════════════════════

import { TrendingUp, TrendingDown, Minus, ExternalLink } from 'lucide-react';
import React from 'react';
import s from './PredictionCard.module.css';

const CATEGORY_COLORS = {
  economics: '#5c9cf5',
  markets: '#22c55e',
  crypto: '#f59e0b',
  politics: '#a855f7',
  other: '#6b7280',
};

const RING_SIZE = 44;
const RING_STROKE = 4;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_R;

function PredictionCard({ market }) {
  const color = CATEGORY_COLORS[market.category] || CATEGORY_COLORS.other;
  // V2 schema: read from outcomes[0], fall back to flat probability
  const probability = market.outcomes?.[0]?.probability ?? market.probability ?? 0;
  const progress = (probability / 100) * RING_CIRC;
  const offset = RING_CIRC - progress;
  const delta = market.change24h || 0;

  const resolveDate = market.closeDate
    ? new Date(market.closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '—';

  const volume =
    market.volume24h >= 1e6
      ? `$${(market.volume24h / 1e6).toFixed(1)}M`
      : market.volume24h >= 1e3
        ? `$${(market.volume24h / 1e3).toFixed(0)}K`
        : `$${market.volume24h}`;

  return (
    <a
      href={market.url}
      target="_blank"
      rel="noopener noreferrer"
      className={s.card}
      title={`View on ${market.source === 'kalshi' ? 'Kalshi' : 'Polymarket'}`}
    >
      {/* Probability Ring */}
      <div className={s.ringWrap}>
        <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_R}
            fill="none"
            stroke="var(--tf-bd)"
            strokeWidth={RING_STROKE}
            opacity={0.3}
          />
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_R}
            fill="none"
            stroke={color}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={RING_CIRC}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            className={s.progressRing}
          />
        </svg>
        <span className={s.ringValue} style={{ color }}>
          {probability}%
        </span>
      </div>

      {/* Content */}
      <div className={s.content}>
        <div className={s.question}>{market.question}</div>
        <div className={s.meta}>
          {/* Delta */}
          <span className={s.delta} style={{ color: delta > 0 ? '#22c55e' : delta < 0 ? '#ef4444' : 'var(--tf-t3)' }}>
            {delta > 0 ? <TrendingUp size={10} /> : delta < 0 ? <TrendingDown size={10} /> : <Minus size={10} />}
            {delta > 0 ? '+' : ''}
            {delta}%
          </span>
          {/* Volume */}
          <span className={s.volume}>{volume}</span>
          {/* Resolution */}
          <span className={s.resolve}>{resolveDate}</span>
          {/* Source */}
          <span className={s.source}>{market.source === 'kalshi' ? 'K' : 'P'}</span>
        </div>
      </div>

      {/* External link icon */}
      <ExternalLink size={12} className={s.linkIcon} />
    </a>
  );
}

export default React.memo(PredictionCard);
