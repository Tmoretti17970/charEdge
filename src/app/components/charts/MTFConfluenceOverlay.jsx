// ═══════════════════════════════════════════════════════════════════
// charEdge — MTF Confluence Overlay (Phase 2 Task #29)
//
// Toggleable chart overlay showing multi-timeframe trend arrows
// and a composite confluence score badge.
// ═══════════════════════════════════════════════════════════════════

import { useState, useMemo, useCallback } from 'react';
import s from './MTFConfluenceOverlay.module.css';

// ─── Direction arrow helper ──────────────────────────────────────

function TrendArrow({ trend, momentum, size = 18 }) {
  const color = trend === 'bullish' ? 'var(--tf-green)' : trend === 'bearish' ? 'var(--tf-red)' : 'var(--tf-t3)';
  const opacity = momentum === 'strong' ? 1 : momentum === 'moderate' ? 0.7 : 0.4;
  const rotation = trend === 'bullish' ? -90 : trend === 'bearish' ? 90 : 0;
  const symbol = trend === 'neutral' ? '―' : '→';

  return (
    <span
      className={s.trendArrow}
      style={{ width: size, height: size, fontSize: size * 0.65, color, opacity, transform: `rotate(${rotation}deg)` }}
    >
      {symbol}
    </span>
  );
}

// ─── Main Overlay  ───────────────────────────────────────────────

export default function MTFConfluenceOverlay({ confluenceResult, visible = true, onToggle }) {
  const [expanded, setExpanded] = useState(false);

  const result = confluenceResult;
  const hasData = result && result.signals && result.signals.length > 0;

  const scoreColor = useMemo(() => {
    if (!hasData) return 'var(--tf-t3)';
    if (result.score >= 70) return 'var(--tf-green)';
    if (result.score >= 40) return 'var(--tf-yellow)';
    return 'var(--tf-red)';
  }, [hasData, result]);

  const directionEmoji = useMemo(() => {
    if (!hasData) return '—';
    return result.direction === 'bullish' ? '▲' : result.direction === 'bearish' ? '▼' : '—';
  }, [hasData, result]);

  const handleToggle = useCallback(() => {
    if (onToggle) onToggle();
  }, [onToggle]);

  if (!visible && !hasData) return null;

  return (
    <div className={s.overlay} style={{ '--score-color': scoreColor }}>
      {/* Collapsed badge */}
      <button
        className={s.badge}
        onClick={() => hasData ? setExpanded(!expanded) : handleToggle()}
        title="Multi-Timeframe Confluence"
      >
        <span className={s.badgeEmoji}>{directionEmoji}</span>
        <span>MTF</span>
        {hasData && (
          <span className={s.scorePill}>
            {result.score}%
          </span>
        )}
      </button>

      {/* Expanded panel */}
      {expanded && hasData && (
        <div className={s.panel}>
          {/* Header */}
          <div className={s.panelHeader}>
            <span className={s.panelTitle}>Confluence</span>
            <span className={s.panelScore}>{result.score}%</span>
          </div>

          {/* Per-TF signals */}
          {result.signals.map((sig) => (
            <div key={sig.timeframe} className={s.signalRow}>
              <span className={s.signalTf}>{sig.timeframe}</span>
              <TrendArrow trend={sig.trend} momentum={sig.momentum} size={16} />
              <span className={s.signalInfo}>{sig.trend} · {sig.momentum}</span>
              <span className={s.signalRsi}>RSI {sig.rsiValue.toFixed(0)}</span>
            </div>
          ))}

          {/* Summary */}
          <div className={s.summary}>{result.summary}</div>
        </div>
      )}
    </div>
  );
}
