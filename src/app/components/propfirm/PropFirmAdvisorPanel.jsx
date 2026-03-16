// ═══════════════════════════════════════════════════════════════════
// charEdge — Prop Firm AI Advisor Panel (Sprint 26)
//
// Morning prep cards, live risk badge, pacing advisor.
// Powered by PropFirmAdvisor.js engine.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, memo } from 'react';
import { C, F, M } from '../../../constants.js';
import { radii, transition } from '../../../theme/tokens.js';
import { useJournalStore } from '../../../state/useJournalStore';
import { usePropFirmStore, computeEvaluation } from '../../../state/usePropFirmStore.js';
import { propFirmAdvisor } from '../../../charting_library/ai/PropFirmAdvisor.js';

// ─── Severity Colors ────────────────────────────────────────────

const SEV = {
  low:      { bg: `${C.g}14`, border: C.g, color: C.g, label: '🟢' },
  mid:      { bg: `${C.y}14`, border: C.y, color: C.y, label: '🟡' },
  high:     { bg: `${C.r}14`, border: C.r, color: C.r, label: '🔴' },
  critical: { bg: `${C.r}25`, border: C.r, color: C.r, label: '⚫' },
  unknown:  { bg: `${C.t3}14`, border: C.t3, color: C.t3, label: '—' },
};

// ─── Advisor Card ────────────────────────────────────────────────

function AdvisorCard({ card }) {
  const sev = SEV[card.severity] || SEV.unknown;
  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: radii.lg,
      background: sev.bg,
      borderLeft: `3px solid ${sev.border}`,
      marginBottom: 8,
      animation: 'tf-fade-in 0.3s ease-out',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 4,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, fontFamily: F, color: C.t1 }}>
          {card.icon} {card.title}
        </span>
        <span style={{
          fontSize: 16, fontWeight: 800, fontFamily: M, color: sev.color,
        }}>
          {card.value}
        </span>
      </div>
      <div style={{ fontSize: 11, color: C.t3, fontFamily: F, lineHeight: 1.4 }}>
        {card.detail}
      </div>
    </div>
  );
}

// ─── Risk Badge ──────────────────────────────────────────────────

function RiskBadge({ riskCheck }) {
  const sev = SEV[riskCheck.level] || SEV.unknown;
  return (
    <div style={{
      padding: '10px 14px',
      borderRadius: radii.lg,
      background: sev.bg,
      border: `1px solid ${sev.border}`,
      display: 'flex', alignItems: 'center', gap: 10,
      marginBottom: 14,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: sev.bg,
        border: `3px solid ${sev.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14,
      }}>
        {sev.label}
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, fontFamily: M, color: sev.color, textTransform: 'uppercase' }}>
          {riskCheck.level} Risk
        </div>
        <div style={{ fontSize: 11, color: C.t3, fontFamily: F }}>
          {riskCheck.message}
        </div>
      </div>
    </div>
  );
}

// ─── Main Panel ──────────────────────────────────────────────────

function PropFirmAdvisorPanel({ open, onClose }) {
  const trades = useJournalStore((s) => s.trades);
  const activeProfile = usePropFirmStore((s) => s.activeProfile);

  const evaluation = useMemo(() => {
    if (!activeProfile) return null;
    return computeEvaluation(trades, activeProfile);
  }, [trades, activeProfile]);

  const advice = useMemo(() => {
    if (!evaluation || !activeProfile) return null;
    return propFirmAdvisor.morningPrep(evaluation, activeProfile, trades);
  }, [evaluation, activeProfile, trades]);

  const riskCheck = useMemo(() => {
    if (!evaluation || !activeProfile) return null;
    return propFirmAdvisor.riskCheck(evaluation, activeProfile);
  }, [evaluation, activeProfile]);

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0,
      width: 360, zIndex: 1200,
      background: C.bg,
      borderLeft: `1px solid ${C.bd}`,
      boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
      display: 'flex', flexDirection: 'column',
      animation: 'tf-slide-left 0.25s ease-out',
      fontFamily: F,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 18px',
        borderBottom: `1px solid ${C.bd}`,
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.t1 }}>
            🧠 AI Advisor
          </div>
          {activeProfile && (
            <div style={{ fontSize: 10, color: C.t3, fontFamily: M, marginTop: 2 }}>
              {activeProfile.name}
            </div>
          )}
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: C.t3,
          fontSize: 18, cursor: 'pointer', padding: 4,
          borderRadius: radii.sm, transition: transition.fast,
        }}>✕</button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
        {!activeProfile ? (
          <div style={{
            textAlign: 'center', padding: 40,
            color: C.t3, fontSize: 12, fontFamily: F,
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏢</div>
            No prop firm profile active.
            <br />Set up a profile to get AI-powered advice.
          </div>
        ) : !advice ? (
          <div style={{ color: C.t3, fontSize: 12, textAlign: 'center', padding: 20 }}>
            Loading advisor…
          </div>
        ) : (
          <>
            {/* Risk Badge */}
            {riskCheck && <RiskBadge riskCheck={riskCheck} />}

            {/* Summary */}
            <div style={{
              fontSize: 12, color: C.t2, fontFamily: F,
              padding: '8px 12px', borderRadius: radii.md,
              background: C.bg2, marginBottom: 14,
              lineHeight: 1.5,
            }}>
              {advice.summary}
            </div>

            {/* Morning Prep Cards */}
            <div style={{
              fontSize: 10, fontWeight: 700, color: C.t3,
              fontFamily: M, textTransform: 'uppercase',
              marginBottom: 8,
            }}>
              Morning Prep — {advice.cards.length} items
            </div>

            {advice.cards.map((card) => (
              <AdvisorCard key={card.id} card={card} />
            ))}

            {/* CTA */}
            <button style={{
              width: '100%', padding: '12px 0',
              borderRadius: radii.md,
              background: `linear-gradient(135deg, ${C.p}, ${C.b})`,
              color: '#fff', fontSize: 13, fontWeight: 700,
              fontFamily: F, border: 'none', cursor: 'pointer',
              marginTop: 10, transition: transition.base,
            }}>
              ✨ Start Trading Day
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default memo(PropFirmAdvisorPanel);
