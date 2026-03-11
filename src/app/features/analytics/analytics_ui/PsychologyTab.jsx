// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Analytics Psychology Tab
// Emotional state analysis, win rate by emotion, P&L breakdown
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react';
import { C, M } from '../../../../constants.js';
import { fmtD } from '../../../../utils.js';
import { Card } from '../../../components/ui/UIKit.jsx';
import BreakdownBarChart from '../../../components/widgets/BreakdownBarChart.jsx';
import { SectionLabel, WinRateByCategory, headerRow, dataRow } from './AnalyticsPrimitives.jsx';

function PsychologyTab({ result, computing }) {
  const [aiEnabled, setAiEnabled] = useState(false);

  // All hooks must be called before any early return (React Rules of Hooks)
  const emotions = useMemo(
    () => {
      if (!result?.byEmo) return [];
      return Object.entries(result.byEmo)
        .map(([name, d]) => ({ name, ...d, wr: d.count > 0 ? (d.wins / d.count) * 100 : 0 }))
        .sort((a, b) => b.pnl - a.pnl);
    },
    [result?.byEmo],
  );

  if (!result || !result.byEmo) {
    return <div style={{ padding: 40, textAlign: 'center', color: C.t3 }}>{computing ? 'Computing psychology...' : 'No psychology data available.'}</div>;
  }

  const bestEmo = emotions[0];
  const worstEmo = emotions[emotions.length - 1];

  return (
    <div>
      {/* AI Edge Toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: aiEnabled ? C.b : C.t3, cursor: 'pointer', fontFamily: M, fontWeight: 700 }}>
          <input
            type="checkbox"
            checked={aiEnabled}
            onChange={(e) => setAiEnabled(e.target.checked)}
            style={{ accentColor: C.b }}
          />
          ✨ Enable AI Edge
        </label>
      </div>

      {/* Tilt / Revenge Trade Detector */}
      {aiEnabled && result.tiltTradesCount > 0 && (
        <Card style={{ padding: 16, marginBottom: 16, background: `linear-gradient(to right, ${C.bg2}, rgba(242, 92, 92, 0.05))` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>🚨</span>
            <SectionLabel text="AI Tilt Detector (Revenge Trading)" />
          </div>
          <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.6 }}>
            The AI detected <strong style={{ color: C.r }}>{result.tiltTradesCount} trades</strong> taken within 15 minutes of a previous loss.
            This "tilt" behavior has cost you <strong style={{ color: C.r }}>{fmtD(result.tiltPnl)}</strong> in capital.
            <br />
            <span style={{ fontSize: 11, color: C.t3, marginTop: 4, display: 'inline-block' }}>Recommendation: Enforce a mandatory 30-minute screen break after any stop-out.</span>
          </div>
        </Card>
      )}

      {/* Quick Insight */}
      {emotions.length >= 2 && (
        <Card style={{ padding: 16, marginBottom: 16, borderLeft: `3px solid ${C.b}` }}>
          <div style={{ fontSize: 13, color: C.t1, lineHeight: 1.6 }}>
            You trade best when feeling <strong style={{ color: C.g }}>{bestEmo?.name}</strong> ({fmtD(bestEmo?.pnl)},{' '}
            {bestEmo?.wr.toFixed(0)}% win rate) and worst when feeling{' '}
            <strong style={{ color: C.r }}>{worstEmo?.name}</strong> ({fmtD(worstEmo?.pnl)}, {worstEmo?.wr.toFixed(0)}%
            win rate).
          </div>
        </Card>
      )}

      {/* Emotion → P&L Correlation */}
      {result.emotionCorrelation && result.emotionCorrelation.sampleSize >= 5 && (
        <Card style={{ padding: 16, marginBottom: 16, borderLeft: `3px solid ${Math.abs(result.emotionCorrelation.pearsonR) > 0.3 ? C.b : C.bd}` }}>
          <SectionLabel text="Emotion ↔ P&L Correlation" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
            <div style={{
              fontSize: 32, fontWeight: 800, fontFamily: M, fontVariantNumeric: 'tabular-nums',
              color: result.emotionCorrelation.pearsonR > 0.2 ? C.g : result.emotionCorrelation.pearsonR < -0.2 ? C.r : C.t3,
            }}>
              {result.emotionCorrelation.pearsonR >= 0 ? '+' : ''}{result.emotionCorrelation.pearsonR.toFixed(3)}
            </div>
            <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.5 }}>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>Pearson r</div>
              <div style={{ fontSize: 11, color: C.t3 }}>
                {Math.abs(result.emotionCorrelation.pearsonR) < 0.1
                  ? 'No meaningful correlation between emotional state and P&L.'
                  : Math.abs(result.emotionCorrelation.pearsonR) < 0.3
                    ? 'Weak correlation — emotions have minor influence on outcomes.'
                    : result.emotionCorrelation.pearsonR > 0
                      ? 'Positive mood correlates with better outcomes. Trade when you feel good.'
                      : 'Negative mood correlates with better outcomes. You may overtrade when confident.'}
              </div>
              <div style={{ fontSize: 10, color: C.t3, marginTop: 4 }}>Based on {result.emotionCorrelation.sampleSize} tagged trades</div>
            </div>
          </div>
        </Card>
      )}

      {/* Streak Impact */}
      {result.streakImpact && result.streakImpact.avgPnlBaseline !== 0 && (
        <Card style={{ padding: 16, marginBottom: 16 }}>
          <SectionLabel text="Streak Impact Analysis" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 8 }}>
            <div style={{ textAlign: 'center', padding: 10, background: C.g + '08', borderRadius: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 800, fontFamily: M, color: C.g }}>{fmtD(result.streakImpact.avgPnlDuringWinStreak)}</div>
              <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>Avg P&L (Win Streak)</div>
            </div>
            <div style={{ textAlign: 'center', padding: 10, background: C.sf2, borderRadius: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 800, fontFamily: M, color: C.t2 }}>{fmtD(result.streakImpact.avgPnlBaseline)}</div>
              <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>Avg P&L (Baseline)</div>
            </div>
            <div style={{ textAlign: 'center', padding: 10, background: C.r + '08', borderRadius: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 800, fontFamily: M, color: C.r }}>{fmtD(result.streakImpact.avgPnlDuringLossStreak)}</div>
              <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>Avg P&L (Loss Streak)</div>
            </div>
          </div>
          {Math.abs(result.streakImpact.streakSensitivity) > 2 && (
            <div style={{ fontSize: 11, color: C.y, fontFamily: M, marginTop: 8, padding: '6px 10px', background: C.y + '08', borderRadius: 6 }}>
              ⚠ High streak sensitivity ({result.streakImpact.streakSensitivity.toFixed(1)}×) — your results swing significantly during streaks.
            </div>
          )}
        </Card>
      )}

      {/* Chart */}
      <Card style={{ padding: 16, marginBottom: 16 }}>
        <SectionLabel text="P&L by Emotional State" />
        <BreakdownBarChart data={result.byEmo} height={Math.max(150, emotions.length * 40)} />
      </Card>

      {/* Win Rate by Emotion */}
      <Card style={{ padding: 16, marginBottom: 16 }}>
        <SectionLabel text="Win Rate by Emotion" />
        <WinRateByCategory data={emotions} />
      </Card>

      {/* Table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ ...headerRow, gridTemplateColumns: '1fr 80px 60px 60px 80px' }}>
          <div>Emotion</div>
          <div style={{ textAlign: 'right' }}>P&L</div>
          <div style={{ textAlign: 'right' }}>Trades</div>
          <div style={{ textAlign: 'right' }}>Win %</div>
          <div style={{ textAlign: 'right' }}>Avg P&L</div>
        </div>
        {emotions.map((e) => (
          <div key={e.name} style={{ ...dataRow, gridTemplateColumns: '1fr 80px 60px 60px 80px' }}>
            <div style={{ fontWeight: 700, color: C.t1 }}>{e.name}</div>
            <div style={{ textAlign: 'right', fontFamily: M, fontWeight: 700, color: e.pnl >= 0 ? C.g : C.r, fontVariantNumeric: 'tabular-nums' }}>
              {fmtD(e.pnl)}
            </div>
            <div style={{ textAlign: 'right', fontFamily: M, fontVariantNumeric: 'tabular-nums' }}>{e.count}</div>
            <div style={{ textAlign: 'right', fontFamily: M, color: e.wr >= 50 ? C.g : C.r, fontVariantNumeric: 'tabular-nums' }}>{e.wr.toFixed(0)}%</div>
            <div
              style={{
                textAlign: 'right',
                fontFamily: M,
                color: e.count > 0 ? (e.pnl / e.count >= 0 ? C.g : C.r) : C.t3,
              }}
            >
              {e.count > 0 ? fmtD(e.pnl / e.count) : '—'}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
export default React.memo(PsychologyTab);
