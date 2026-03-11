// ═══════════════════════════════════════════════════════════════════
// charEdge — Daily Pulse Widget
//
// "First 10 seconds" hero card: time-aware greeting, P&L streak,
// yesterday's recap, today's challenge preview, and market mood.
// Positioned at the very top of the Dashboard narrative layout.
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { C, F, M } from '../../../constants.js';
import { useGamificationStore } from '../../../state/useGamificationStore';
import { useJournalStore } from '../../../state/useJournalStore';
import { useUserStore } from '../../../state/useUserStore';
import { fmtD } from '../../../utils.js';
import { logger } from '@/observability/logger';

// ─── Helpers ────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5)  return { text: 'Burning the midnight oil', emoji: '🌙' };
  if (h < 12) return { text: 'Good morning', emoji: '☀️' };
  if (h < 17) return { text: 'Good afternoon', emoji: '🌤️' };
  if (h < 21) return { text: 'Good evening', emoji: '🌆' };
  return { text: 'Night session', emoji: '🌙' };
}

function startOfDay(d) {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function _isSameDay(a, b) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

// ─── Component ──────────────────────────────────────────────────

export default function DailyPulse() {
  const trades = useJournalStore((s) => s.trades);
  const xp = useGamificationStore((s) => s.xp);

  // Try to get trader name from settings
  let traderName = '';
  try {
    traderName = useUserStore.getState()?.profile?.name || '';
  } catch (e) { logger.ui.warn('Operation failed', e); }

  const greeting = getGreeting();

  // ── Compute streak + yesterday + today stats ──
  const stats = useMemo(() => {
    if (!trades.length) return null;

    const now = new Date();
    const today = startOfDay(now);

    // Group trades by day (sorted by date, most recent first)
    const sorted = [...trades].sort((a, b) => new Date(b.date) - new Date(a.date));
    const dayMap = new Map();
    for (const t of sorted) {
      if (!t.date) continue;
      const dayKey = startOfDay(t.date).getTime();
      if (!dayMap.has(dayKey)) dayMap.set(dayKey, []);
      dayMap.get(dayKey).push(t);
    }

    // Today's trades
    const todayTrades = dayMap.get(today.getTime()) || [];
    const todayPnl = todayTrades.reduce((s, t) => s + (t.pnl || 0), 0);

    // Yesterday's trades
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yestTrades = dayMap.get(yesterday.getTime()) || [];
    const yestPnl = yestTrades.reduce((s, t) => s + (t.pnl || 0), 0);
    const yestWins = yestTrades.filter((t) => (t.pnl || 0) > 0).length;
    const yestBest = yestTrades.length
      ? yestTrades.reduce((best, t) => ((t.pnl || 0) > (best.pnl || 0) ? t : best), yestTrades[0])
      : null;

    // P&L streak — count consecutive profitable/unprofitable days
    const dayKeys = [...dayMap.keys()].sort((a, b) => b - a); // newest first
    let streak = 0;
    let streakType = null; // 'win' or 'loss'
    for (const dayKey of dayKeys) {
      const dayTrades = dayMap.get(dayKey);
      const dayPnl = dayTrades.reduce((s, t) => s + (t.pnl || 0), 0);
      const isWin = dayPnl > 0;
      if (streakType === null) {
        streakType = isWin ? 'win' : 'loss';
        streak = 1;
      } else if ((isWin && streakType === 'win') || (!isWin && streakType === 'loss')) {
        streak++;
      } else {
        break;
      }
    }

    // Market mood — based on last 5 trades direction
    const recent5 = sorted.slice(0, 5);
    const longs = recent5.filter((t) => t.side === 'long').length;
    const shorts = recent5.filter((t) => t.side === 'short').length;
    const mood = longs > shorts ? 'bullish' : shorts > longs ? 'bearish' : 'neutral';

    return {
      todayCount: todayTrades.length,
      todayPnl,
      yestCount: yestTrades.length,
      yestPnl,
      yestWins,
      yestBest,
      streak,
      streakType,
      mood,
      totalTrades: trades.length,
    };
  }, [trades]);

  // ── Render ──

  const nameLabel = traderName || 'Trader';

  if (!stats) {
    return (
      <div
        style={{
          padding: '24px 28px',
          borderRadius: 14,
          background: `linear-gradient(135deg, ${C.b}15, ${C.b}05)`,
          border: `1px solid ${C.b}20`,
          marginBottom: 20,
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 700, color: C.t1, fontFamily: F }}>
          {greeting.emoji} {greeting.text}, {nameLabel}
        </div>
        <div style={{ fontSize: 13, color: C.t3, marginTop: 6, fontFamily: F }}>
          Log your first trade to see your daily pulse here.
        </div>
      </div>
    );
  }

  const streakEmoji =
    stats.streakType === 'win'
      ? stats.streak >= 5 ? '🔥🔥' : stats.streak >= 3 ? '🔥' : '✅'
      : stats.streak >= 3 ? '⚠️' : '📉';

  const streakText =
    stats.streakType === 'win'
      ? `${stats.streak}-day win streak ${streakEmoji}`
      : `${stats.streak}-day losing streak — time to review ${streakEmoji}`;

  const moodEmoji = stats.mood === 'bullish' ? '📈' : stats.mood === 'bearish' ? '📉' : '➡️';

  return (
    <div
      style={{
        borderRadius: 14,
        background: `linear-gradient(135deg, ${C.b}12, transparent)`,
        border: `1px solid ${C.b}18`,
        overflow: 'hidden',
        marginBottom: 20,
      }}
    >
      {/* Hero greeting */}
      <div style={{ padding: '20px 24px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.t1, fontFamily: F }}>
              {greeting.emoji} {greeting.text}, {nameLabel}
            </div>
            <div style={{ fontSize: 12, color: C.t3, fontFamily: M, marginTop: 4 }}>
              {stats.totalTrades} trades logged · {streakText}
            </div>
          </div>

          {/* Today's P&L badge */}
          {stats.todayCount > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: C.t3, fontFamily: M, marginBottom: 2 }}>Today</div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  fontFamily: M,
                  color: stats.todayPnl >= 0 ? C.g : C.r,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmtD(stats.todayPnl)}
              </div>
              <div style={{ fontSize: 10, color: C.t3, fontFamily: M }}>
                {stats.todayCount} trade{stats.todayCount !== 1 ? 's' : ''}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          padding: '0 24px 16px',
          flexWrap: 'wrap',
        }}
      >
        {/* Yesterday recap */}
        {stats.yestCount > 0 && (
          <div
            style={{
              flex: '1 1 180px',
              padding: '10px 14px',
              borderRadius: 8,
              background: C.sf,
              border: `1px solid ${C.bd}`,
              marginRight: 10,
            }}
          >
            <div style={{ fontSize: 10, color: C.t3, fontFamily: M, fontWeight: 600, marginBottom: 4 }}>
              YESTERDAY
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  fontFamily: M,
                  color: stats.yestPnl >= 0 ? C.g : C.r,
                }}
              >
                {fmtD(stats.yestPnl)}
              </span>
              <span style={{ fontSize: 10, color: C.t3, fontFamily: M }}>
                {stats.yestCount} trades · {stats.yestWins}W {stats.yestCount - stats.yestWins}L
              </span>
            </div>
            {stats.yestBest && (
              <div style={{ fontSize: 10, color: C.t2, fontFamily: M, marginTop: 4 }}>
                Best: {stats.yestBest.symbol} {fmtD(stats.yestBest.pnl || 0)}
              </div>
            )}
          </div>
        )}

        {/* Market mood */}
        <div
          style={{
            flex: '0 0 auto',
            padding: '10px 14px',
            borderRadius: 8,
            background: C.sf,
            border: `1px solid ${C.bd}`,
            marginRight: 10,
            minWidth: 120,
          }}
        >
          <div style={{ fontSize: 10, color: C.t3, fontFamily: M, fontWeight: 600, marginBottom: 4 }}>
            YOUR BIAS
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: M }}>
            {moodEmoji} {stats.mood.charAt(0).toUpperCase() + stats.mood.slice(1)}
          </div>
          <div style={{ fontSize: 9, color: C.t3, fontFamily: M, marginTop: 2 }}>
            Based on last 5 trades
          </div>
        </div>

        {/* XP badge */}
        <div
          style={{
            flex: '0 0 auto',
            padding: '10px 14px',
            borderRadius: 8,
            background: C.sf,
            border: `1px solid ${C.bd}`,
            minWidth: 90,
          }}
        >
          <div style={{ fontSize: 10, color: C.t3, fontFamily: M, fontWeight: 600, marginBottom: 4 }}>
            TOTAL XP
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.b, fontFamily: M }}>
            {xp?.toLocaleString?.() || 0}
          </div>
        </div>
      </div>
    </div>
  );
}
