// ═══════════════════════════════════════════════════════════════════
// charEdge — Journal Health Streak (Sprint 19)
//
// Shows streak of consecutive days with journal entries, encouraging
// daily journaling. Displays current streak, best streak, and
// visual streak calendar dots.
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { C, F, M } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore';
import { radii } from '../../../theme/tokens.js';
import { Card } from '../ui/UIKit.jsx';

function computeStreak(trades) {
  if (!trades || trades.length === 0) return { current: 0, best: 0, recentDays: [] };

  // Build set of unique days with trades
  const daySet = new Set();
  for (const t of trades) {
    if (t.date) daySet.add(t.date.slice(0, 10));
  }

  const sortedDays = [...daySet].sort().reverse();
  if (sortedDays.length === 0) return { current: 0, best: 0, recentDays: [] };

  // Current streak: count consecutive days backwards from today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let current = 0;
  const checkDate = new Date(today);

  while (true) {
    const dateStr = checkDate.toISOString().slice(0, 10);
    if (daySet.has(dateStr)) {
      current++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Best streak
  let best = 0;
  let run = 1;
  const ascending = [...daySet].sort();
  for (let i = 1; i < ascending.length; i++) {
    const prev = new Date(ascending[i - 1]);
    const curr = new Date(ascending[i]);
    const diffDays = (curr - prev) / 86400000;
    if (diffDays === 1) {
      run++;
      if (run > best) best = run;
    } else {
      run = 1;
    }
  }
  if (run > best) best = run;
  if (current > best) best = current;

  // Recent 14 days for dot calendar
  const recentDays = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    recentDays.push({ date: dateStr, active: daySet.has(dateStr) });
  }

  return { current, best, recentDays };
}

export default function JournalHealthStreak() {
  const trades = useJournalStore((s) => s.trades);
  const { current, best, recentDays } = useMemo(() => computeStreak(trades), [trades]);

  if (!trades || trades.length < 3) return null;

  return (
    <Card
      style={{
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}
    >
      {/* Streak fire icon */}
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: radii.md,
          background: current > 0
            ? `linear-gradient(135deg, ${C.y}25, ${C.r}15)`
            : `${C.sf}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          flexShrink: 0,
        }}
      >
        {current > 0 ? '🔥' : '📝'}
      </div>

      {/* Stats */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: C.t1, fontFamily: M }}>
            {current}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.t3, fontFamily: F }}>
            day streak
          </span>
          <span style={{ fontSize: 10, color: C.t3, fontFamily: M, marginLeft: 'auto' }}>
            Best: {best} 🏆
          </span>
        </div>

        {/* Recent 14-day dot calendar */}
        <div style={{ display: 'flex', gap: 3 }}>
          {recentDays.map((d) => (
            <div
              key={d.date}
              title={d.date}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: d.active ? C.g : `${C.bd}40`,
                transition: 'background 0.15s',
              }}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}
