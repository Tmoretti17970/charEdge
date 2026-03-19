// ═══════════════════════════════════════════════════════════════════
// charEdge — MTF Confluence Overlay (Phase 2 Task #29)
//
// Toggleable chart overlay showing multi-timeframe trend arrows
// and a composite confluence score badge.
// ═══════════════════════════════════════════════════════════════════

import { useState, useMemo, useCallback } from 'react';
import { C, M } from '../../../constants.js';

// ─── Direction arrow helper ──────────────────────────────────────

function TrendArrow({ trend, momentum, size = 18 }) {
  const color = trend === 'bullish' ? C.g : trend === 'bearish' ? C.r : C.t3;
  const opacity = momentum === 'strong' ? 1 : momentum === 'moderate' ? 0.7 : 0.4;
  const rotation = trend === 'bullish' ? -90 : trend === 'bearish' ? 90 : 0;
  const symbol = trend === 'neutral' ? '―' : '→';

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size,
      fontSize: size * 0.65, fontWeight: 800,
      color, opacity,
      transform: `rotate(${rotation}deg)`,
      transition: 'transform 0.3s, opacity 0.3s',
    }}>
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
    if (!hasData) return C.t3;
    if (result.score >= 70) return C.g;
    if (result.score >= 40) return C.y;
    return C.r;
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
    <div style={{
      position: 'absolute', top: 8, right: 8,
      zIndex: 20, userSelect: 'none',
    }}>
      {/* Collapsed badge */}
      <button
        className="tf-btn"
        onClick={() => hasData ? setExpanded(!expanded) : handleToggle()}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 6,
          background: C.sf + 'ee', backdropFilter: 'blur(12px)',
          border: `1px solid ${scoreColor}30`,
          fontSize: 10, fontFamily: M, fontWeight: 700,
          color: scoreColor, cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        title="Multi-Timeframe Confluence"
      >
        <span style={{ fontSize: 11 }}>{directionEmoji}</span>
        <span>MTF</span>
        {hasData && (
          <span style={{
            padding: '1px 5px', borderRadius: 4,
            background: scoreColor + '15',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {result.score}%
          </span>
        )}
      </button>

      {/* Expanded panel */}
      {expanded && hasData && (
        <div style={{
          marginTop: 4, padding: '10px 14px',
          borderRadius: 8, background: C.sf + 'f5',
          backdropFilter: 'blur(16px)',
          border: `1px solid ${C.bd}40`,
          minWidth: 200,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 8,
          }}>
            <span style={{ fontSize: 9, fontWeight: 700, fontFamily: M, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Confluence
            </span>
            <span style={{
              fontSize: 16, fontWeight: 800, fontFamily: M, color: scoreColor,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {result.score}%
            </span>
          </div>

          {/* Per-TF signals */}
          {result.signals.map((sig) => (
            <div key={sig.timeframe} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '3px 0',
              borderBottom: `1px solid ${C.bd}15`,
            }}>
              <span style={{ width: 28, fontSize: 10, fontWeight: 700, fontFamily: M, color: C.t3, textAlign: 'right' }}>
                {sig.timeframe}
              </span>
              <TrendArrow trend={sig.trend} momentum={sig.momentum} size={16} />
              <span style={{ fontSize: 10, fontFamily: M, color: C.t2, flex: 1 }}>
                {sig.trend} · {sig.momentum}
              </span>
              <span style={{ fontSize: 9, fontFamily: M, color: C.t3, fontVariantNumeric: 'tabular-nums' }}>
                RSI {sig.rsiValue.toFixed(0)}
              </span>
            </div>
          ))}

          {/* Summary */}
          <div style={{
            marginTop: 8, fontSize: 9, fontFamily: M,
            color: C.t3, lineHeight: 1.4,
          }}>
            {result.summary}
          </div>
        </div>
      )}
    </div>
  );
}
