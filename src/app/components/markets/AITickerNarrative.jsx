// ═══════════════════════════════════════════════════════════════════
// charEdge — AI Ticker Narrative (Sprint 13)
//
// Generates an AI-style narrative summary for the selected ticker.
// Uses lightweight heuristics from the kline data to produce a
// contextual paragraph covering trend, momentum, volume, and key
// levels — similar to what the full LocalInsightEngine produces
// but self-contained for the detail panel.
//
// Features:
//   - Dynamic narrative based on actual price data
//   - Streaming text animation (typewriter effect)
//   - AI orb accent styling
//   - "Regenerate" button
// ═══════════════════════════════════════════════════════════════════

import { memo, useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { C, F, M } from '../../../constants.js';
import { radii, transition } from '../../../theme/tokens.js';
import useHistoricalData from '../../../hooks/useHistoricalData.js';

const ACCENT = '#6e5ce6';
const GREEN  = '#22c55e';
const RED    = '#ef4444';

// ═══════════════════════════════════════════════════════════════════
// Narrative generator (heuristic-based)
// ═══════════════════════════════════════════════════════════════════

function generateNarrative(symbol, candles) {
  if (!candles || candles.length < 20) return 'Insufficient data to generate insights.';

  const closes = candles.map((c) => c.close);
  const last = closes[closes.length - 1];
  const first = closes[0];
  const totalChange = ((last - first) / first) * 100;

  // Recent momentum (last 5 candles)
  const recent = closes.slice(-5);
  const recentChange = ((recent[recent.length - 1] - recent[0]) / recent[0]) * 100;

  // Volume analysis
  const volumes = candles.map((c) => c.volume);
  const avgVol = volumes.reduce((s, v) => s + v, 0) / volumes.length;
  const recentVol = volumes.slice(-5).reduce((s, v) => s + v, 0) / 5;
  const volRatio = avgVol > 0 ? recentVol / avgVol : 1;

  // Support/Resistance levels
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const resistance = Math.max(...highs);
  const support = Math.min(...lows);
  const range = resistance - support;
  const positionInRange = range > 0 ? ((last - support) / range) * 100 : 50;

  // Build narrative
  const parts = [];

  // Trend description
  if (totalChange > 5) {
    parts.push(`**${symbol}** has been on a strong uptrend, gaining ${totalChange.toFixed(1)}% over the period.`);
  } else if (totalChange > 1) {
    parts.push(`**${symbol}** is showing a moderate upward bias, advancing ${totalChange.toFixed(1)}% over the period.`);
  } else if (totalChange < -5) {
    parts.push(`**${symbol}** has been under significant selling pressure, declining ${Math.abs(totalChange).toFixed(1)}% over the period.`);
  } else if (totalChange < -1) {
    parts.push(`**${symbol}** is trending slightly lower, retreating ${Math.abs(totalChange).toFixed(1)}% over the review period.`);
  } else {
    parts.push(`**${symbol}** is consolidating in a tight range with minimal directional bias (${totalChange > 0 ? '+' : ''}${totalChange.toFixed(1)}%).`);
  }

  // Recent momentum
  if (Math.abs(recentChange) > 2) {
    const dir = recentChange > 0 ? 'bullish' : 'bearish';
    parts.push(`Short-term momentum is ${dir}, with price ${recentChange > 0 ? 'pushing higher' : 'pulling back'} ${Math.abs(recentChange).toFixed(1)}% in recent sessions.`);
  } else {
    parts.push('Near-term momentum remains subdued with no clear directional conviction.');
  }

  // Volume
  if (volRatio > 1.5) {
    parts.push('Volume has surged above average — institutions may be actively positioning.');
  } else if (volRatio > 1.1) {
    parts.push('Volume is slightly elevated vs. its recent average, suggesting building interest.');
  } else if (volRatio < 0.6) {
    parts.push('Volume has dried up considerably — watch for a breakout on renewed participation.');
  }

  // Key levels
  if (positionInRange > 85) {
    parts.push(`Price is testing resistance near $${resistance >= 1 ? resistance.toFixed(2) : resistance.toFixed(4)} — a breakout could accelerate gains.`);
  } else if (positionInRange < 15) {
    parts.push(`Price is approaching support at $${support >= 1 ? support.toFixed(2) : support.toFixed(4)} — this level has held previously.`);
  }

  return parts.join(' ');
}

// ═══════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════

function AITickerNarrative({ symbol }) {
  const { candles } = useHistoricalData(symbol);
  const [displayText, setDisplayText] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamKey, setStreamKey] = useState(0);
  const fullText = useMemo(
    () => generateNarrative(symbol, candles),
    [symbol, candles]
  );
  const animRef = useRef(null);

  // Typewriter streaming effect
  useEffect(() => {
    if (!fullText) return;
    setStreaming(true);
    setDisplayText('');
    let idx = 0;

    const interval = setInterval(() => {
      idx += 2; // 2 chars at a time for faster streaming
      if (idx >= fullText.length) {
        setDisplayText(fullText);
        setStreaming(false);
        clearInterval(interval);
      } else {
        setDisplayText(fullText.slice(0, idx));
      }
    }, 12);

    animRef.current = interval;
    return () => clearInterval(interval);
  }, [fullText, streamKey]);

  const handleRegenerate = useCallback(() => {
    setStreamKey((k) => k + 1);
  }, []);

  // Parse bold markers
  function renderText(text) {
    return text.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <span key={i} style={{ fontWeight: 700, color: C.t1 }}>
            {part.slice(2, -2)}
          </span>
        );
      }
      return part;
    });
  }

  return (
    <div style={{ padding: '4px 20px 12px' }}>
      {/* AI indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: ACCENT,
            boxShadow: `0 0 8px ${ACCENT}60`,
            animation: streaming ? 'ai-pulse 1.5s ease-in-out infinite' : 'none',
          }}
        />
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            fontFamily: M,
            color: streaming ? ACCENT : C.t3,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {streaming ? 'Generating…' : 'AI Analysis'}
        </span>
      </div>

      {/* Narrative text */}
      <p
        style={{
          margin: 0,
          fontSize: 12,
          fontFamily: F,
          color: C.t2,
          lineHeight: 1.6,
          letterSpacing: '0.01em',
        }}
      >
        {renderText(displayText)}
        {streaming && (
          <span
            style={{
              display: 'inline-block',
              width: 2,
              height: 14,
              background: ACCENT,
              marginLeft: 2,
              verticalAlign: 'text-bottom',
              animation: 'blink-cursor 0.8s step-end infinite',
            }}
          />
        )}
      </p>

      {/* Regenerate button */}
      {!streaming && displayText.length > 0 && (
        <button
          onClick={handleRegenerate}
          style={{
            marginTop: 8,
            padding: '3px 10px',
            borderRadius: radii.xs,
            fontSize: 9,
            fontWeight: 600,
            fontFamily: M,
            border: `1px solid ${C.bd}20`,
            background: 'transparent',
            color: C.t3,
            cursor: 'pointer',
            transition: `all ${transition.fast}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = ACCENT;
            e.currentTarget.style.color = ACCENT;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = `${C.bd}20`;
            e.currentTarget.style.color = C.t3;
          }}
        >
          ↻ Regenerate
        </button>
      )}

      <style>{`
        @keyframes ai-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes blink-cursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export { AITickerNarrative };
export default memo(AITickerNarrative);
