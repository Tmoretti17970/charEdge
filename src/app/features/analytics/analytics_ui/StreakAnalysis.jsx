// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Streak Analysis Panel (Sprint 3: B.3)
//
// Visualizes consecutive win/loss patterns, recovery time,
// and tilt correlation. Added to the Risk analytics tab.
// ═══════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import { fmtD } from '../../../../utils.js';
import { Card } from '../../../components/ui/UIKit.jsx';
import { SectionLabel } from './AnalyticsPrimitives.jsx';
import { C, M } from '@/constants.js';

/**
 * Compute streak sequences from trades (sorted by date).
 * Returns array of { type: 'win'|'loss', length, pnl, startDate, endDate }
 */
function computeStreaks(trades) {
  if (!trades?.length) return [];

  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));
  const streaks = [];
  let current = null;

  for (const t of sorted) {
    const type = t.pnl > 0 ? 'win' : t.pnl < 0 ? 'loss' : null;
    if (!type) {
      if (current) streaks.push(current);
      current = null;
      continue;
    }

    if (current && current.type === type) {
      current.length++;
      current.pnl += t.pnl;
      current.endDate = t.date;
    } else {
      if (current) streaks.push(current);
      current = { type, length: 1, pnl: t.pnl, startDate: t.date, endDate: t.date };
    }
  }
  if (current) streaks.push(current);

  return streaks;
}

/**
 * Compute recovery time: how many trades after a losing streak to return to net positive.
 */
function computeRecovery(streaks) {
  const recoveries = [];
  for (let i = 0; i < streaks.length; i++) {
    if (streaks[i].type !== 'loss' || streaks[i].length < 2) continue;
    const deficit = Math.abs(streaks[i].pnl);
    let recovered = 0;
    let trades = 0;
    for (let j = i + 1; j < streaks.length && recovered < deficit; j++) {
      if (streaks[j].type === 'win') {
        recovered += streaks[j].pnl;
        trades += streaks[j].length;
      } else {
        recovered += streaks[j].pnl; // negative
        trades += streaks[j].length;
      }
    }
    recoveries.push({
      streakLength: streaks[i].length,
      deficit,
      recovered,
      tradesNeeded: trades,
      fullRecovery: recovered >= deficit,
    });
  }
  return recoveries;
}

function StreakAnalysis({ result, trades }) {
  const streaks = useMemo(() => computeStreaks(trades), [trades]);
  const recoveries = useMemo(() => computeRecovery(streaks), [streaks]);

  // Find longest streaks
  const _winStreaks = streaks.filter((s) => s.type === 'win').sort((a, b) => b.length - a.length);
  const _lossStreaks = streaks.filter((s) => s.type === 'loss').sort((a, b) => b.length - a.length);

  // Current streak (from the end)
  const currentStreak = streaks.length > 0 ? streaks[streaks.length - 1] : null;

  if (!streaks.length) {
    return (
      <Card style={{ padding: 16, marginBottom: 16 }}>
        <SectionLabel text="Streak Analysis" />
        <div style={{ padding: 20, textAlign: 'center', color: C.t3, fontSize: 12 }}>
          Log more trades to see streak patterns.
        </div>
      </Card>
    );
  }

  const maxLen = Math.max(...streaks.map((s) => s.length), 1);

  return (
    <div>
      {/* Current Streak Badge */}
      {currentStreak && (
        <Card
          style={{
            padding: 14,
            marginBottom: 16,
            borderLeft: `3px solid ${currentStreak.type === 'win' ? C.g : C.r}`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 28,
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: (currentStreak.type === 'win' ? C.g : C.r) + '15',
              borderRadius: 10,
            }}
          >
            {currentStreak.type === 'win' ? '🔥' : '❄️'}
          </div>
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                fontFamily: M,
                color: currentStreak.type === 'win' ? C.g : C.r,
              }}
            >
              {currentStreak.length} {currentStreak.type === 'win' ? 'Win' : 'Loss'} Streak
            </div>
            <div
              style={{
                fontSize: 11,
                color: C.t3,
                fontFamily: M,
              }}
            >
              Active · {fmtD(currentStreak.pnl)} P&L
            </div>
          </div>
        </Card>
      )}

      {/* Streak History Visualization */}
      <Card style={{ padding: 16, marginBottom: 16 }}>
        <SectionLabel text="Streak History" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
          {streaks.slice(-20).map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: s.type === 'win' ? C.g : C.r,
                  flexShrink: 0,
                }}
              />
              <div
                style={{
                  height: 16,
                  borderRadius: 3,
                  background: (s.type === 'win' ? C.g : C.r) + '40',
                  width: `${Math.max(4, (s.length / maxLen) * 100)}%`,
                  minWidth: 20,
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    fontFamily: M,
                    color: s.type === 'win' ? C.g : C.r,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.length}
                  {s.type === 'win' ? 'W' : 'L'}
                </span>
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontFamily: M,
                  color: C.t3,
                  fontVariantNumeric: 'tabular-nums',
                  flexShrink: 0,
                }}
              >
                {fmtD(s.pnl)}
              </div>
            </div>
          ))}
        </div>
        <div
          style={{
            fontSize: 9,
            color: C.t3,
            fontFamily: M,
            marginTop: 8,
            borderTop: `1px solid ${C.bd}30`,
            paddingTop: 6,
          }}
        >
          Last {Math.min(20, streaks.length)} streaks shown
        </div>
      </Card>

      {/* Recovery Analysis */}
      {recoveries.length > 0 && (
        <Card style={{ padding: 16, marginBottom: 16 }}>
          <SectionLabel text="Recovery Analysis" />
          <div
            style={{
              fontSize: 12,
              color: C.t2,
              lineHeight: 1.6,
              marginTop: 4,
              marginBottom: 12,
            }}
          >
            How many trades it takes to recover from losing streaks:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recoveries.slice(-5).map((r, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: r.fullRecovery ? C.g + '08' : C.r + '08',
                  border: `1px solid ${r.fullRecovery ? C.g : C.r}15`,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: M,
                    color: C.r,
                    minWidth: 50,
                  }}
                >
                  {r.streakLength}L streak
                </div>
                <div style={{ fontSize: 10, color: C.t3 }}>→</div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: M,
                    color: C.t2,
                  }}
                >
                  {r.tradesNeeded} trades to{' '}
                  <span
                    style={{
                      color: r.fullRecovery ? C.g : C.y,
                      fontWeight: 700,
                    }}
                  >
                    {r.fullRecovery ? 'recover' : 'partial recovery'}
                  </span>
                </div>
                <div
                  style={{
                    marginLeft: 'auto',
                    fontSize: 10,
                    fontFamily: M,
                    fontWeight: 700,
                    color: C.r,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  -{fmtD(r.deficit)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tilt Correlation */}
      {result?.tiltTradesCount > 0 && (
        <Card
          style={{
            padding: 14,
            marginBottom: 16,
            background: `linear-gradient(to right, ${C.bg2}, ${C.r}06)`,
            borderLeft: `3px solid ${C.r}60`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 14 }}>🔥</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                fontFamily: M,
                color: C.r,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Tilt / Revenge Trades
            </span>
          </div>
          <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.6 }}>
            <strong style={{ color: C.r }}>{result.tiltTradesCount} trades</strong> were taken within 15 minutes of a
            loss, costing <strong style={{ color: C.r }}>{fmtD(result.tiltPnl)}</strong>.
          </div>
        </Card>
      )}
    </div>
  );
}

export default React.memo(StreakAnalysis);
export { StreakAnalysis, computeStreaks, computeRecovery };
