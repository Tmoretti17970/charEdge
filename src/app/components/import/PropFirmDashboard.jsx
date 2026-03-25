// ═══════════════════════════════════════════════════════════════════
// charEdge — Prop Firm Dashboard (Phase 7 Sprint 7.10)
//
// Tracks prop firm challenge progress with visual indicators
// for profit targets, drawdown limits, and daily loss.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react';
import { C, GLASS } from '../../../constants.js';
import { PROP_FIRM_RULES, evaluatePhase } from '../../../data/connectors/brokers/PropFirmConnector.js';
import { useJournalStore } from '../../../state/useJournalStore.js';
import { Card } from '../ui/UIKit.jsx';
import { alpha } from '@/shared/colorUtils';

// ─── Progress Ring ──────────────────────────────────────────────

function ProgressRing({ progress, color, size = 60, label, value }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const filled = circ * Math.min(1, progress);

  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={alpha(C.bd, 0.2)} strokeWidth={4} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeDasharray={circ}
          strokeDashoffset={circ - filled}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--tf-mono)', color, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 9, color: C.t3, fontFamily: 'var(--tf-font)' }}>{label}</div>
    </div>
  );
}

// ─── Dashboard ──────────────────────────────────────────────────

function PropFirmDashboard() {
  const trades = useJournalStore((s) => s.trades);
  const [selectedFirm, setSelectedFirm] = useState('ftmo');
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedPhase, setSelectedPhase] = useState(0);

  const firm = PROP_FIRM_RULES[selectedFirm];
  const accountSize = selectedSize || firm?.accountSizes?.[2] || 50000;
  const phase = firm?.phases?.[selectedPhase];

  const evaluation = useMemo(() => {
    if (!phase || !trades.length) return null;
    return evaluatePhase(trades, phase, accountSize);
  }, [trades, phase, accountSize]);

  if (!firm) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: 'var(--tf-font)', margin: '0 0 12px' }}>
        🏆 Prop Firm Challenge Tracker
      </h2>

      {/* Firm selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {Object.entries(PROP_FIRM_RULES).map(([id, f]) => (
          <button
            key={id}
            onClick={() => {
              setSelectedFirm(id);
              setSelectedPhase(0);
              setSelectedSize(null);
            }}
            style={{
              padding: '5px 12px',
              borderRadius: 8,
              border: `1px solid ${selectedFirm === id ? alpha(C.b, 0.3) : alpha(C.bd, 0.3)}`,
              background: selectedFirm === id ? alpha(C.b, 0.08) : 'transparent',
              color: selectedFirm === id ? C.b : C.t2,
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'var(--tf-font)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {f.logo} {f.name}
          </button>
        ))}
      </div>

      {/* Account size selector */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        <span style={{ fontSize: 10, color: C.t3, fontFamily: 'var(--tf-font)', alignSelf: 'center', marginRight: 4 }}>
          Account:
        </span>
        {firm.accountSizes.map((size) => (
          <button
            key={size}
            onClick={() => setSelectedSize(size)}
            style={{
              padding: '3px 8px',
              borderRadius: 6,
              border: `1px solid ${accountSize === size ? alpha(C.b, 0.3) : alpha(C.bd, 0.2)}`,
              background: accountSize === size ? alpha(C.b, 0.06) : 'transparent',
              color: accountSize === size ? C.b : C.t3,
              fontSize: 10,
              fontWeight: 600,
              fontFamily: 'var(--tf-mono)',
              cursor: 'pointer',
            }}
          >
            ${size >= 1000 ? `${size / 1000}K` : size}
          </button>
        ))}
      </div>

      {/* Phase tabs */}
      {firm.phases.length > 1 && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          {firm.phases.map((p, i) => (
            <button
              key={i}
              onClick={() => setSelectedPhase(i)}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: `1px solid ${selectedPhase === i ? alpha(C.b, 0.3) : alpha(C.bd, 0.2)}`,
                background: selectedPhase === i ? alpha(C.b, 0.06) : 'transparent',
                color: selectedPhase === i ? C.b : C.t3,
                fontSize: 10,
                fontWeight: 600,
                fontFamily: 'var(--tf-font)',
                cursor: 'pointer',
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Progress cards */}
      {evaluation ? (
        <Card style={{ padding: 16, background: GLASS.subtle }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 16 }}>
            <ProgressRing
              progress={evaluation.progress.profitProgress}
              color={evaluation.progress.targetReached ? C.g : C.b}
              label="Profit Target"
              value={`$${evaluation.progress.totalPnl.toFixed(0)} / $${evaluation.progress.profitTarget.toFixed(0)}`}
            />
            {phase.maxTotalLoss && (
              <ProgressRing
                progress={evaluation.progress.drawdownUsed}
                color={
                  evaluation.progress.drawdownUsed > 0.8 ? C.r : evaluation.progress.drawdownUsed > 0.5 ? C.y : C.g
                }
                label="Max Drawdown"
                value={`${(evaluation.progress.maxDrawdown * 100).toFixed(1)}% / ${(phase.maxTotalLoss * 100).toFixed(0)}%`}
              />
            )}
            {phase.minDays > 0 && (
              <ProgressRing
                progress={evaluation.progress.tradingDays / evaluation.progress.minDays}
                color={evaluation.progress.minDaysMet ? C.g : C.b}
                label="Min Days"
                value={`${evaluation.progress.tradingDays} / ${evaluation.progress.minDays}`}
              />
            )}
          </div>

          {/* Status banner */}
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: evaluation.passed
                ? alpha(C.g, 0.08)
                : evaluation.violations.length > 0
                  ? alpha(C.r, 0.08)
                  : alpha(C.b, 0.04),
              border: `1px solid ${evaluation.passed ? alpha(C.g, 0.15) : evaluation.violations.length > 0 ? alpha(C.r, 0.15) : alpha(C.bd, 0.1)}`,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'var(--tf-font)',
                color: evaluation.passed ? C.g : evaluation.violations.length > 0 ? C.r : C.t1,
              }}
            >
              {evaluation.passed
                ? '✅ Phase Passed!'
                : evaluation.violations.length > 0
                  ? '🚨 Rule Violation'
                  : '📊 In Progress'}
            </div>
            {evaluation.violations.length > 0 && (
              <div style={{ fontSize: 10, color: C.r, marginTop: 4, fontFamily: 'var(--tf-mono)' }}>
                {evaluation.violations[0]}
              </div>
            )}
          </div>

          {/* Profit split info */}
          <div style={{ marginTop: 10, fontSize: 10, color: C.t3, fontFamily: 'var(--tf-font)', textAlign: 'center' }}>
            Profit split: {(firm.profitSplit * 100).toFixed(0)}% to you · Your payout: $
            {(evaluation.progress.totalPnl * firm.profitSplit).toFixed(2)}
          </div>
        </Card>
      ) : (
        <Card style={{ padding: 20, textAlign: 'center', background: GLASS.subtle }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.t2, fontFamily: 'var(--tf-font)' }}>
            Import trades to track your {firm.name} challenge
          </div>
          <div style={{ fontSize: 10, color: C.t3, fontFamily: 'var(--tf-font)', marginTop: 4 }}>
            Use CSV import or connect your broker above
          </div>
        </Card>
      )}
    </div>
  );
}

export default React.memo(PropFirmDashboard);
