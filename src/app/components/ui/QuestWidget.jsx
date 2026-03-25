// ═══════════════════════════════════════════════════════════════════
// charEdge — Quest Widget (Compact)
//
// Compact card for Home/Dashboard showing the first enabled financial
// goal. Only visible when gamification is enabled and a goal is active.
// ═══════════════════════════════════════════════════════════════════

import { memo, useMemo } from 'react';
import { C, M } from '../../../constants.js';
import { useGamificationStore } from '../../../state/useGamificationStore';

const PERIOD_LABELS = {
  daily: '📅 Daily P&L Goal',
  weekly: '📆 Weekly P&L Goal',
  monthly: '🗓️ Monthly P&L Goal',
  yearly: '📊 Yearly P&L Goal',
};

const QuestWidget = memo(function QuestWidget() {
  const enabled = useGamificationStore((s) => s.enabled);
  const goals = useGamificationStore((s) => s.goals);
  const level = useGamificationStore((s) => s.level);

  // Find first enabled goal with a target > 0
  const activeGoal = useMemo(() => {
    if (!goals || typeof goals !== 'object') return null;
    for (const period of ['daily', 'weekly', 'monthly', 'yearly']) {
      const g = goals[period];
      if (g && g.enabled && g.target > 0) {
        return { period, ...g };
      }
    }
    return null;
  }, [goals]);

  if (!enabled || !activeGoal) return null;

  const label = PERIOD_LABELS[activeGoal.period] || 'Goal';

  return (
    <div
      style={{
        padding: '12px 16px',
        background: C.sf,
        borderRadius: 10,
        border: `1px solid ${C.bd}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      {/* Quest icon */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: `linear-gradient(135deg, ${C.b}20, ${C.y}15)`,
          border: `1px solid ${C.b}25`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          flexShrink: 0,
        }}
      >
        ⚔️
      </div>

      {/* Quest info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.t1 }}>{label}</div>
        <div style={{ fontSize: 10, color: C.t3, marginTop: 1 }}>Target: ${activeGoal.target.toLocaleString()}</div>
      </div>

      {/* Level badge */}
      <div
        style={{
          padding: '3px 8px',
          borderRadius: 8,
          background: C.y + '15',
          border: `1px solid ${C.y}30`,
          fontSize: 10,
          fontWeight: 700,
          fontFamily: M,
          color: C.y,
          flexShrink: 0,
        }}
      >
        LV.{level || 1}
      </div>
    </div>
  );
});

export default QuestWidget;
