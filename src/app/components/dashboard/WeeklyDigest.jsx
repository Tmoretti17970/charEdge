// ═══════════════════════════════════════════════════════════════════
// charEdge — Weekly Digest Preview (Sprint 24)
//
// A compact preview card showing this week's performance summary,
// styled like an email digest. Shows key metrics, highlights,
// and a "share" option.
// ═══════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import { C, M, F } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore.js';
import { useGamificationStore } from '../../../state/useGamificationStore.js';
import { useBreakpoints } from '../../../utils/useMediaQuery.js';
import { fmtD } from '../../../utils.js';

export default function WeeklyDigest() {
  const trades = useJournalStore((s) => s.trades);
  const xp = useGamificationStore((s) => s.xp) || 0;
  const streaks = useGamificationStore((s) => s.streaks) || {};
  const { isMobile } = useBreakpoints();

  const digest = useMemo(() => {
    if (!trades || trades.length === 0) return null;

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weekTrades = trades.filter((t) => t.date && new Date(t.date) >= weekStart);
    if (weekTrades.length === 0) return null;

    const pnl = weekTrades.reduce((s, t) => s + (t.pnl || 0), 0);
    const wins = weekTrades.filter((t) => (t.pnl || 0) > 0).length;
    const winRate = Math.round((wins / weekTrades.length) * 100);

    // Best trade
    const best = weekTrades.reduce((b, t) => ((t.pnl || 0) > (b.pnl || 0) ? t : b), weekTrades[0]);

    // Worst trade
    const worst = weekTrades.reduce((w, t) => ((t.pnl || 0) < (w.pnl || 0) ? t : w), weekTrades[0]);

    // Trading days
    const tradingDays = new Set(weekTrades.map((t) => new Date(t.date).toISOString().slice(0, 10))).size;

    // Green vs red days
    const byDay = {};
    weekTrades.forEach((t) => {
      const day = new Date(t.date).toISOString().slice(0, 10);
      byDay[day] = (byDay[day] || 0) + (t.pnl || 0);
    });
    const greenDays = Object.values(byDay).filter((p) => p > 0).length;
    const redDays = Object.values(byDay).filter((p) => p < 0).length;

    return {
      pnl, wins, losses: weekTrades.length - wins, winRate,
      totalTrades: weekTrades.length, tradingDays, greenDays, redDays,
      best, worst,
    };
  }, [trades]);

  if (!digest) return null;

  const weekLabel = (() => {
    const d = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const weekStart = new Date(d);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    return `Week of ${monthNames[weekStart.getMonth()]} ${weekStart.getDate()}`;
  })();

  return (
    <div className="tf-container" style={{
      borderRadius: 10,
      background: `linear-gradient(135deg, ${C.p}06, ${C.b}04)`,
      border: `1px solid ${C.p}15`,
      marginBottom: 14,
      overflow: 'hidden',
    }}>
      {/* Digest header */}
      <div style={{
        padding: isMobile ? '12px 14px 8px' : '14px 18px 10px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, lineHeight: 1 }}>📬</span>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, fontFamily: M, color: C.t3, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Weekly Digest
            </div>
            <div style={{ fontSize: 10, fontFamily: M, color: C.t3, marginTop: 1 }}>
              {weekLabel}
            </div>
          </div>
        </div>
        <div style={{
          fontSize: 18, fontWeight: 900, fontFamily: M,
          color: digest.pnl >= 0 ? C.g : C.r,
        }}>
          {fmtD(digest.pnl)}
        </div>
      </div>

      {/* Metrics row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)',
        gap: 0,
        borderTop: `1px solid ${C.bd}30`,
        borderBottom: `1px solid ${C.bd}30`,
      }}>
        {[
          { label: 'Trades', value: digest.totalTrades.toString() },
          { label: 'Win Rate', value: `${digest.winRate}%`, color: digest.winRate >= 50 ? C.g : C.r },
          { label: 'Green Days', value: `${digest.greenDays}/${digest.tradingDays}`, color: C.g },
          { label: 'Best', value: `${digest.best?.symbol || '?'}`, sub: fmtD(digest.best?.pnl || 0) },
          { label: 'Worst', value: `${digest.worst?.symbol || '?'}`, sub: fmtD(digest.worst?.pnl || 0) },
          { label: 'XP Earned', value: `${xp}`, color: C.b },
        ].map((m) => (
          <div key={m.label} style={{
            padding: '8px 10px',
            textAlign: 'center',
            borderRight: `1px solid ${C.bd}15`,
          }}>
            <div style={{ fontSize: 7, fontWeight: 700, fontFamily: M, color: C.t3, letterSpacing: '0.04em', marginBottom: 3, textTransform: 'uppercase' }}>
              {m.label}
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, fontFamily: M, color: m.color || C.t1 }}>
              {m.value}
            </div>
            {m.sub && (
              <div style={{ fontSize: 8, fontFamily: M, color: C.t3, marginTop: 1 }}>
                {m.sub}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Streak summary */}
      <div style={{
        padding: isMobile ? '8px 14px 12px' : '8px 18px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, lineHeight: 1 }}>🔥</span>
          <span style={{ fontSize: 10, fontFamily: M, color: C.t2 }}>
            {streaks.trading?.current || 0}-day trading streak
          </span>
        </div>
        <button
          className="tf-btn"
          style={{
            padding: '3px 10px',
            borderRadius: 4,
            border: `1px solid ${C.b}25`,
            background: C.b + '10',
            color: C.b,
            fontSize: 9,
            fontWeight: 700,
            fontFamily: M,
            cursor: 'pointer',
          }}
        >
          Share
        </button>
      </div>
    </div>
  );
}
