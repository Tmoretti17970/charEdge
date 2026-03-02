// ═══════════════════════════════════════════════════════════════════
// charEdge — What-If Scenario Analyzer
//
// "If you had held AAPL 2 more hours, you'd have made $X more..."
// Counterfactual analysis for recent trades based on entry/exit data.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { C, F, M } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore.js';
import { Card } from '../../components/ui/UIKit.jsx';
import { fmtD } from '../../../utils.js';

// ─── Helpers ────────────────────────────────────────────────────

function generateScenarios(trade) {
  const scenarios = [];
  const pnl = trade.pnl || 0;
  const entry = trade.entry || 0;
  const exit = trade.exit || 0;
  const isLong = trade.side === 'long';

  if (!entry || !exit) return scenarios;

  // 1. Double position scenario
  scenarios.push({
    label: 'Sized 2× position',
    altPnl: pnl * 2,
    diff: pnl,
    emoji: pnl > 0 ? '📈' : '📉',
    insight: pnl > 0 ? 'Double the win' : 'Double the pain — good sizing!',
  });

  // 2. Half position scenario
  scenarios.push({
    label: 'Sized 0.5× position',
    altPnl: pnl * 0.5,
    diff: pnl * -0.5,
    emoji: pnl < 0 ? '🛡️' : '💡',
    insight: pnl < 0 ? 'Half the damage' : 'Half the gain',
  });

  // 3. Reversed direction
  scenarios.push({
    label: `Took the ${isLong ? 'short' : 'long'} instead`,
    altPnl: -pnl,
    diff: -pnl * 2,
    emoji: pnl > 0 ? '❌' : '✅',
    insight: pnl > 0 ? 'Wrong call would\'ve hurt' : 'The opposite trade was the winner',
  });

  // 4. Tighter stop (50% distance)
  if (pnl < 0) {
    const halfLoss = pnl * 0.5;
    scenarios.push({
      label: 'Used a tighter stop',
      altPnl: halfLoss,
      diff: -halfLoss,
      emoji: '🎯',
      insight: `Saved ${fmtD(Math.abs(halfLoss))} with a 50% tighter stop`,
    });
  }

  // 5. Took partial profit (if profitable)
  if (pnl > 0) {
    const partial = pnl * 0.6;
    scenarios.push({
      label: 'Took 60% partial at midpoint',
      altPnl: partial,
      diff: partial - pnl,
      emoji: '🔒',
      insight: 'Locked in profits early — safer but less upside',
    });
  }

  return scenarios.slice(0, 3); // Show max 3 scenarios
}

// ─── Component ──────────────────────────────────────────────────

export default function WhatIfPanel() {
  const trades = useJournalStore((s) => s.trades);
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Get recent trades with entry/exit
  const eligible = useMemo(() => {
    return [...trades]
      .filter((t) => t.entry && t.exit && t.pnl != null)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);
  }, [trades]);

  if (eligible.length === 0) {
    return (
      <Card style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 16 }}>🔮</span>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F }}>What-If Analyzer</div>
        </div>
        <div style={{ fontSize: 12, color: C.t3, fontFamily: F }}>
          Log trades with entry &amp; exit prices to see counterfactual scenarios.
        </div>
      </Card>
    );
  }

  const trade = eligible[selectedIdx] || eligible[0];
  const scenarios = generateScenarios(trade);
  const pnl = trade.pnl || 0;

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 20px 12px', borderBottom: `1px solid ${C.bd}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>🔮</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F }}>What-If Analyzer</div>
            <div style={{ fontSize: 10, color: C.t3, fontFamily: M }}>
              Counterfactual scenarios for your trades
            </div>
          </div>
        </div>
      </div>

      {/* Trade selector pills */}
      <div style={{ display: 'flex', gap: 4, padding: '10px 20px', overflowX: 'auto', flexWrap: 'nowrap' }}>
        {eligible.map((t, i) => (
          <button
            key={t.id || i}
            onClick={() => setSelectedIdx(i)}
            style={{
              padding: '4px 10px',
              borderRadius: 12,
              border: selectedIdx === i ? `1px solid ${C.b}` : `1px solid ${C.bd}`,
              background: selectedIdx === i ? C.b + '18' : 'transparent',
              color: selectedIdx === i ? C.b : C.t3,
              fontSize: 10,
              fontWeight: 700,
              fontFamily: M,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {t.symbol} {(t.pnl || 0) >= 0 ? '+' : ''}{fmtD(t.pnl || 0)}
          </button>
        ))}
      </div>

      {/* Selected trade summary */}
      <div
        style={{
          padding: '0 20px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: 12,
          fontFamily: M,
        }}
      >
        <span style={{ fontWeight: 700, color: C.t1, fontSize: 14 }}>{trade.symbol}</span>
        <span style={{ color: trade.side === 'long' ? C.g : C.r, fontWeight: 700, fontSize: 10 }}>
          {(trade.side || '').toUpperCase()}
        </span>
        <span style={{ color: C.t3, fontSize: 10 }}>
          {trade.entry?.toFixed(2)} → {trade.exit?.toFixed(2)}
        </span>
        <span style={{ fontWeight: 800, color: pnl >= 0 ? C.g : C.r }}>{fmtD(pnl)}</span>
      </div>

      {/* Scenarios */}
      <div style={{ padding: '0 20px 16px' }}>
        {scenarios.map((s, i) => (
          <div
            key={i}
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: C.sf,
              border: `1px solid ${C.bd}`,
              marginBottom: i < scenarios.length - 1 ? 8 : 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13 }}>{s.emoji}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.t1, fontFamily: F }}>{s.label}</span>
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  fontFamily: M,
                  color: s.altPnl >= 0 ? C.g : C.r,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmtD(s.altPnl)}
              </span>
            </div>
            <div style={{ fontSize: 10, color: C.t3, fontFamily: M }}>
              {s.insight}
              <span style={{ marginLeft: 6, color: s.diff >= 0 ? C.g : C.r }}>
                ({s.diff >= 0 ? '+' : ''}{fmtD(s.diff)} vs actual)
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
