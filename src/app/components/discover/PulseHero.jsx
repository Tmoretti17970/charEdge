// ═══════════════════════════════════════════════════════════════════
// charEdge — The Pulse Hero Strip
//
// Apple-style glanceable market status strip. Answers "what kind of
// day is it?" in under 5 seconds. Shows:
//   - Market regime indicator (Risk-On / Neutral / Cautious / Risk-Off)
//   - Fear & Greed gauge (0-100 circular)
//   - VIX level with delta
//   - AI market summary (one-liner)
// ═══════════════════════════════════════════════════════════════════

import { Activity, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import React from 'react';
import useIntelPulseStore from '../../../state/useIntelPulseStore.js';
import FearGreedGauge from './FearGreedGauge.jsx';
import s from './PulseHero.module.css';

function PulseHero() {
  const { vix, vixChange, fearGreedScore, fearGreedLabel, fearGreedColor, regime, summary } = useIntelPulseStore();

  return (
    <div className={s.strip}>
      {/* Left: Metrics row */}
      <div className={s.metrics}>
        {/* Market Regime */}
        <div className={s.metricCard}>
          <div className={s.metricLabel}>Market Regime</div>
          <div className={s.regimeRow}>
            <span className={s.regimeDot} style={{ background: regime.color }} />
            <span className={s.regimeText} style={{ color: regime.color }}>
              {regime.label}
            </span>
          </div>
          <div className={s.metricSub}>{regime.description}</div>
        </div>

        {/* Fear & Greed */}
        <div className={s.metricCard}>
          <div className={s.metricLabel}>Fear & Greed</div>
          <div className={s.gaugeWrap}>
            <FearGreedGauge score={fearGreedScore} label={fearGreedLabel} color={fearGreedColor} />
          </div>
        </div>

        {/* VIX */}
        <div className={s.metricCard}>
          <div className={s.metricLabel}>VIX Index</div>
          <div className={s.vixValue}>{vix.toFixed(1)}</div>
          <div className={s.vixDelta} style={{ color: vixChange < 0 ? '#22c55e' : '#ef4444' }}>
            {vixChange < 0 ? (
              <TrendingDown size={12} />
            ) : vixChange > 0 ? (
              <TrendingUp size={12} />
            ) : (
              <Minus size={12} />
            )}
            <span>
              {vixChange > 0 ? '+' : ''}
              {vixChange.toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom: AI Summary */}
      <div className={s.summaryRow}>
        <Activity size={14} className={s.summaryIcon} />
        <span className={s.summaryText}>{summary}</span>
      </div>
    </div>
  );
}

export default React.memo(PulseHero);
