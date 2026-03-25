// ═══════════════════════════════════════════════════════════════════
// charEdge — Setup Scorer Pre-Trade Widget (Phase 2 Task #30)
//
// Shows a traffic-light score (🟢/🟡/🔴) for a proposed setup
// against historical trade data. Auto-triggers when a user opens
// a trade form with a symbol + setup type filled in.
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { C, M } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore';
import { setupScorer } from '@/SetupScorer';

// ─── Sample Size Warning (Task #31) ─────────────────────────────

export function SampleSizeWarning({ sampleSize, threshold = 20 }) {
  if (sampleSize >= threshold) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px',
        borderRadius: 5,
        background: C.y + '08',
        border: `1px solid ${C.y}15`,
        fontSize: 10,
        fontFamily: M,
        color: C.y,
        marginTop: 6,
      }}
    >
      <span style={{ fontSize: 12 }}>⚠️</span>
      <span>
        Based on {sampleSize} trade{sampleSize !== 1 ? 's' : ''} — {threshold - sampleSize} more needed for reliable
        analysis
      </span>
    </div>
  );
}

// ─── Confidence Badge ────────────────────────────────────────────

function ConfidenceBadge({ confidence }) {
  const colorMap = { high: C.g, medium: C.y, low: C.r };
  const color = colorMap[confidence] || C.t3;

  return (
    <span
      style={{
        fontSize: 8,
        fontWeight: 700,
        fontFamily: M,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        padding: '2px 6px',
        borderRadius: 3,
        background: color + '12',
        color,
      }}
    >
      {confidence} confidence
    </span>
  );
}

// ─── Main Widget ──────────────────────────────────────────────────

export default function SetupScorerWidget({ symbol, setup, timeframe, side }) {
  const trades = useJournalStore((s) => s.trades);

  const scoreResult = useMemo(() => {
    if (!symbol || !setup || !trades || trades.length < 2) return null;

    return setupScorer.score(trades, {
      symbol: symbol || '',
      setup: setup || '',
      timeframe: timeframe || undefined,
      side: side || undefined,
    });
  }, [trades, symbol, setup, timeframe, side]);

  if (!scoreResult) return null;

  const { emoji, signal, score, reason, historicalWinRate, avgPnl, sampleSize, confidence } = scoreResult;

  const bgColor = signal === 'green' ? C.g : signal === 'yellow' ? C.y : C.r;

  return (
    <div
      style={{
        padding: '10px 14px',
        borderRadius: 8,
        background: C.sf,
        border: `1px solid ${bgColor}25`,
        marginBottom: 10,
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 20 }}>{emoji}</span>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              fontFamily: M,
              color: C.t1,
            }}
          >
            {setup} on {symbol}
          </div>
          <div
            style={{
              fontSize: 9,
              fontFamily: M,
              color: C.t3,
            }}
          >
            Score: {score}/100
          </div>
        </div>
        <ConfidenceBadge confidence={confidence} />
      </div>

      {/* Reason text */}
      <div
        style={{
          fontSize: 10,
          fontFamily: M,
          color: C.t2,
          lineHeight: 1.5,
          marginBottom: 6,
        }}
      >
        {reason}
      </div>

      {/* Stats row */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          padding: '6px 0',
          borderTop: `1px solid ${C.bd}20`,
        }}
      >
        <div>
          <span style={{ fontSize: 9, fontWeight: 700, fontFamily: M, color: C.t3, textTransform: 'uppercase' }}>
            Win Rate
          </span>
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              fontFamily: M,
              color: historicalWinRate >= 55 ? C.g : historicalWinRate >= 40 ? C.y : C.r,
            }}
          >
            {historicalWinRate}%
          </div>
        </div>
        <div>
          <span style={{ fontSize: 9, fontWeight: 700, fontFamily: M, color: C.t3, textTransform: 'uppercase' }}>
            Avg P&L
          </span>
          <div style={{ fontSize: 13, fontWeight: 800, fontFamily: M, color: avgPnl >= 0 ? C.g : C.r }}>
            ${avgPnl.toFixed(2)}
          </div>
        </div>
        <div>
          <span style={{ fontSize: 9, fontWeight: 700, fontFamily: M, color: C.t3, textTransform: 'uppercase' }}>
            Sample
          </span>
          <div style={{ fontSize: 13, fontWeight: 800, fontFamily: M, color: C.t1 }}>{sampleSize}</div>
        </div>
      </div>

      {/* Sample size warning (Task #31) */}
      <SampleSizeWarning sampleSize={sampleSize} />
    </div>
  );
}
