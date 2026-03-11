// ═══════════════════════════════════════════════════════════════════
// charEdge — Streak Rewards Banner
// ═══════════════════════════════════════════════════════════════════

import { C, F, M } from '../../../constants.js';
import { alpha } from '@/shared/colorUtils';

export default function StreakRewardsBanner() {
  // Simulate a streak (in production, this would come from useGamificationStore)
  const streak = 7;
  const xpMultiplier = 1 + (streak * 0.1);
  const nextMilestone = streak < 7 ? 7 : streak < 14 ? 14 : streak < 30 ? 30 : 60;
  const progress = (streak / nextMilestone) * 100;

  const fireEmojis = streak >= 30 ? '🔥🔥🔥' : streak >= 14 ? '🔥🔥' : streak >= 7 ? '🔥' : '✨';

  return (
    <div
      className="tf-streak-banner"
      style={{
        background: `linear-gradient(135deg, ${alpha(C.b, 0.08)}, ${alpha(C.p, 0.08)})`,
        border: `1px solid ${alpha(C.b, 0.15)}`,
        borderRadius: 14,
        padding: '14px 20px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}
    >
      {/* Left: Streak Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12,
          background: alpha(C.b, 0.15),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20,
        }}>
          {fireEmojis}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F }}>
            {streak}-Day Trading Streak!
          </div>
          <div style={{ fontSize: 11, color: C.t3, fontFamily: F, marginTop: 2 }}>
            XP Bonus: <span style={{ color: C.b, fontWeight: 700, fontFamily: M }}>{xpMultiplier.toFixed(1)}×</span>
            {' · '}
            Next milestone: {nextMilestone} days
          </div>
        </div>
      </div>

      {/* Right: Progress Bar */}
      <div style={{ width: 120 }}>
        <div style={{
          height: 6, borderRadius: 3,
          background: alpha(C.b, 0.1),
          overflow: 'hidden',
        }}>
          <div
            style={{
              width: `${Math.min(progress, 100)}%`,
              height: '100%',
              borderRadius: 3,
              background: `linear-gradient(90deg, ${C.b}, ${C.p})`,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        <div style={{ fontSize: 9, color: C.t3, fontFamily: M, textAlign: 'right', marginTop: 3 }}>
          {streak}/{nextMilestone}
        </div>
      </div>
    </div>
  );
}
