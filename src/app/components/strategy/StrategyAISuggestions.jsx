// ═══════════════════════════════════════════════════════════════════
// charEdge — Strategy AI Suggestions (Sprint 25)
//
// Inline suggestion cards that render inside the Strategy Builder.
// Pulls analysis from StrategyAdvisor.analyze() and displays
// actionable, ranked suggestions with grade and strengths/weaknesses.
// ═══════════════════════════════════════════════════════════════════

import { useState, useMemo, memo } from 'react';
import { strategyAdvisor } from '../../../charting_library/ai/StrategyAdvisor.js';
import { C, F, M } from '../../../constants.js';
import { radii, transition } from '../../../theme/tokens.js';

// ─── Impact colors ──────────────────────────────────────────────

const IMPACT = {
  high: { color: '#ff453a', label: 'HIGH', bg: '#ff453a12' },
  medium: { color: '#f0b64e', label: 'MEDIUM', bg: '#f0b64e12' },
  low: { color: '#34c759', label: 'LOW', bg: '#34c75912' },
};

const GRADE_COLORS = {
  A: '#34c759',
  B: '#6e5ce6',
  C: '#f0b64e',
  D: '#ff9f0a',
  F: '#ff453a',
};

// ─── Component ──────────────────────────────────────────────────

function StrategyAISuggestions({ strategyConfig, backtestResults }) {
  const [collapsed, setCollapsed] = useState(false);

  const analysis = useMemo(() => {
    if (!strategyConfig || !backtestResults) return null;
    return strategyAdvisor.analyze(strategyConfig, backtestResults);
  }, [strategyConfig, backtestResults]);

  if (!analysis || analysis.suggestions.length === 0) {
    return (
      <div
        style={{
          margin: '12px 0',
          padding: '12px 16px',
          background: `${C.bd}06`,
          borderRadius: radii.md,
          border: `1px solid ${C.bd}15`,
          fontSize: 11,
          fontFamily: M,
          color: C.t3,
          fontStyle: 'italic',
        }}
      >
        🧠 Run a backtest to see AI suggestions
      </div>
    );
  }

  const { suggestions, overallGrade, strengths, weaknesses, summary } = analysis;
  const gradeColor = GRADE_COLORS[overallGrade] || C.t3;

  return (
    <div
      style={{
        margin: '12px 0',
        borderRadius: radii.md,
        border: `1px solid ${C.bd}15`,
        background: `${C.bd}04`,
        overflow: 'hidden',
      }}
    >
      {/* ── Header ───────────────────────────────────────── */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '10px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `${gradeColor}15`,
              fontWeight: 900,
              fontSize: 12,
              fontFamily: M,
              color: gradeColor,
              border: `2px solid ${gradeColor}40`,
            }}
          >
            {overallGrade}
          </span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 11, fontWeight: 700, fontFamily: F, color: C.t1 }}>🧠 AI Strategy Review</div>
            <div style={{ fontSize: 9, fontFamily: M, color: C.t3, marginTop: 1 }}>
              {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <span style={{ fontSize: 10, color: C.t3 }}>{collapsed ? '▸' : '▾'}</span>
      </button>

      {!collapsed && (
        <div style={{ padding: '0 16px 14px' }}>
          {/* ── Summary ─────────────────────────────────── */}
          <div
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              background: `${gradeColor}08`,
              fontSize: 10,
              fontFamily: M,
              color: C.t2,
              marginBottom: 10,
              lineHeight: 1.6,
            }}
          >
            {summary}
          </div>

          {/* ── Strengths / Weaknesses ──────────────────── */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            {strengths.length > 0 && (
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 8,
                    fontWeight: 700,
                    fontFamily: M,
                    color: '#34c759',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: 4,
                  }}
                >
                  ✅ Strengths
                </div>
                {strengths.map((s, i) => (
                  <div key={i} style={{ fontSize: 9, fontFamily: M, color: C.t2, marginBottom: 2 }}>
                    • {s}
                  </div>
                ))}
              </div>
            )}
            {weaknesses.length > 0 && (
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 8,
                    fontWeight: 700,
                    fontFamily: M,
                    color: '#ff453a',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: 4,
                  }}
                >
                  ⚠️ Weaknesses
                </div>
                {weaknesses.map((w, i) => (
                  <div key={i} style={{ fontSize: 9, fontFamily: M, color: C.t2, marginBottom: 2 }}>
                    • {w}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Suggestion Cards ────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {suggestions.map((sg, i) => {
              const imp = IMPACT[sg.impact] || IMPACT.low;
              return (
                <div
                  key={i}
                  style={{
                    padding: '10px 12px',
                    borderRadius: radii.sm,
                    border: `1px solid ${C.bd}12`,
                    background: `${C.bd}06`,
                    transition: `background ${transition.fast}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 14 }}>{sg.icon}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, fontFamily: F, color: C.t1, flex: 1 }}>
                      {sg.title}
                    </span>
                    <span
                      style={{
                        fontSize: 7,
                        fontWeight: 800,
                        fontFamily: M,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: imp.bg,
                        color: imp.color,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                      }}
                    >
                      {imp.label}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: 9,
                      fontFamily: M,
                      color: C.t2,
                      margin: 0,
                      lineHeight: 1.6,
                    }}
                  >
                    {sg.description}
                  </p>
                  {sg.action && (
                    <button
                      style={{
                        marginTop: 6,
                        padding: '4px 10px',
                        borderRadius: radii.xs,
                        fontSize: 9,
                        fontWeight: 700,
                        fontFamily: M,
                        background: `${imp.color}10`,
                        color: imp.color,
                        border: `1px solid ${imp.color}25`,
                        cursor: 'pointer',
                        transition: `background ${transition.fast}`,
                      }}
                    >
                      Apply Suggestion
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export { StrategyAISuggestions };
export default memo(StrategyAISuggestions);
