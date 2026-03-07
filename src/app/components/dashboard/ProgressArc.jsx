// ═══════════════════════════════════════════════════════════════════
// charEdge — Progress Arc (Sprint 11)
//
// Week-over-week comparison showing improvement trajectory.
// Compares current 7-day performance vs previous 7-day period.
// Highlights personal bests and improvement trends.
// ═══════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import { C, M, F } from '../../../constants.js';
import { radii } from '../../../theme/tokens.js';
import { useJournalStore } from '../../../state/useJournalStore.js';
import { useBreakpoints } from '../../../utils/useMediaQuery.js';
import { fmtD } from '../../../utils.js';

export default function ProgressArc() {
  const trades = useJournalStore((s) => s.trades);
  const { isMobile } = useBreakpoints();

  const progress = useMemo(() => {
    if (!trades || trades.length < 5) return null;

    const now = new Date();
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
    const twoWeeksAgo = new Date(today); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const thisWeek = trades.filter((t) => t.date && new Date(t.date) >= weekAgo);
    const lastWeek = trades.filter((t) => t.date && new Date(t.date) >= twoWeeksAgo && new Date(t.date) < weekAgo);

    if (thisWeek.length === 0 && lastWeek.length === 0) return null;

    const calc = (arr) => {
      const pnl = arr.reduce((s, t) => s + (t.pnl || 0), 0);
      const wins = arr.filter((t) => (t.pnl || 0) > 0);
      const losses = arr.filter((t) => (t.pnl || 0) < 0);
      const winRate = arr.length > 0 ? Math.round((wins.length / arr.length) * 100) : 0;
      const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
      const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0;
      const profitFactor = avgLoss > 0 ? (avgWin * wins.length) / (avgLoss * losses.length) : wins.length > 0 ? Infinity : 0;
      return { pnl, winRate, count: arr.length, profitFactor, avgWin, avgLoss };
    };

    const tw = calc(thisWeek);
    const lw = calc(lastWeek);

    // Detect personal bests (all-time)
    const allTimePnl = trades.reduce((s, t) => s + (t.pnl || 0), 0);
    const bestTrade = [...trades].sort((a, b) => (b.pnl || 0) - (a.pnl || 0))[0];
    const weekPnlIsRecord = lw.count > 0 && tw.pnl > lw.pnl && tw.pnl > 0;

    return { thisWeek: tw, lastWeek: lw, weekPnlIsRecord, bestTrade };
  }, [trades]);

  if (!progress) return null;

  const { thisWeek: tw, lastWeek: lw } = progress;

  const metrics = [
    {
      label: 'P&L',
      current: fmtD(tw.pnl),
      prev: fmtD(lw.pnl),
      delta: lw.pnl !== 0 ? Math.round(((tw.pnl - lw.pnl) / Math.abs(lw.pnl)) * 100) : null,
      color: tw.pnl >= 0 ? C.g : C.r,
      improved: tw.pnl > lw.pnl,
    },
    {
      label: 'Win Rate',
      current: `${tw.winRate}%`,
      prev: `${lw.winRate}%`,
      delta: tw.winRate - lw.winRate,
      color: tw.winRate >= 50 ? C.g : C.r,
      improved: tw.winRate > lw.winRate,
    },
    {
      label: 'Trades',
      current: tw.count.toString(),
      prev: lw.count.toString(),
      delta: tw.count - lw.count,
      color: C.t1,
      improved: null,
    },
    {
      label: 'Profit Factor',
      current: tw.profitFactor === Infinity ? '∞' : tw.profitFactor.toFixed(2),
      prev: lw.profitFactor === Infinity ? '∞' : lw.profitFactor.toFixed(2),
      delta: null,
      color: tw.profitFactor >= 1.5 ? C.g : tw.profitFactor >= 1 ? C.y : C.r,
      improved: tw.profitFactor > lw.profitFactor,
    },
  ];

  return (
    <div className="tf-container tf-progress-arc"
      style={{
        padding: isMobile ? '12px 14px' : '14px 18px',
        borderRadius: radii.md,
        background: C.sf,
        border: `1px solid ${C.bd}`,
        marginBottom: 14,
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 700, fontFamily: M, color: C.t3, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Weekly Progress
          </span>
          {progress.weekPnlIsRecord && (
            <span style={{
              fontSize: 8,
              fontWeight: 800,
              padding: '1px 6px',
              borderRadius: radii.pill,
              background: C.g + '15',
              color: C.g,
              fontFamily: M,
            }}>
              🏅 NEW BEST
            </span>
          )}
        </div>
        <span style={{ fontSize: 9, fontFamily: M, color: C.t3 }}>
          vs last week
        </span>
      </div>

      {/* Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: 8,
      }}>
        {metrics.map((m) => (
          <div key={m.label} style={{ padding: '8px 10px', borderRadius: radii.xs, background: C.bg2 + '60' }}>
            <div style={{ fontSize: 8, fontWeight: 700, fontFamily: M, color: C.t3, letterSpacing: '0.04em', marginBottom: 4, textTransform: 'uppercase' }}>
              {m.label}
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 6,
            }}>
              <span style={{ fontSize: 15, fontWeight: 800, fontFamily: M, color: m.color }}>
                {m.current}
              </span>
              {m.improved !== null && (
                <span style={{ fontSize: 10, fontFamily: M, color: m.improved ? C.g : C.r }}>
                  {m.improved ? '▲' : '▼'}
                </span>
              )}
            </div>
            <div style={{ fontSize: 9, fontFamily: M, color: C.t3, marginTop: 2 }}>
              Prev: {m.prev}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
