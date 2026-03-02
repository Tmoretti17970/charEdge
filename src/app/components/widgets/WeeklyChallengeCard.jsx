// ═══════════════════════════════════════════════════════════════════
// charEdge — Weekly Challenge Card (Sprint D)
//
// Dashboard widget showing the current weekly challenge.
// Higher-reward, multi-day challenges alongside daily ones.
// ═══════════════════════════════════════════════════════════════════

import { memo, useEffect } from 'react';
import { C, F, M } from '../../../constants.js';
import { useGamificationStore } from '../../../state/useGamificationStore.js';
import { Card } from '../ui/UIKit.jsx';
import { alpha } from '../../../utils/colorUtils.js';

export const WeeklyChallengeCard = memo(function WeeklyChallengeCard() {
  const challenge = useGamificationStore((s) => s.weeklyChallenge);
  const enabled = useGamificationStore((s) => s.enabled);
  const generateWeeklyChallenge = useGamificationStore((s) => s.generateWeeklyChallenge);

  useEffect(() => {
    if (enabled) generateWeeklyChallenge();
  }, [enabled]);

  if (!enabled || !challenge) return null;

  const pct = Math.min(100, Math.round((challenge.progress / challenge.target) * 100));
  const isComplete = challenge.completed;

  // Calculate days remaining in week
  const now = new Date();
  const day = now.getDay();
  const daysLeft = day === 0 ? 0 : 7 - day;

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: `1px solid ${C.bd}20`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: isComplete
            ? `linear-gradient(135deg, ${alpha('#FFD700', 0.08)}, transparent)`
            : `linear-gradient(135deg, ${alpha('#AF52DE', 0.06)}, transparent)`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>🗓️</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              fontFamily: F,
              color: C.t1,
            }}
          >
            Weekly Challenge
          </span>
        </div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            fontFamily: M,
            color: isComplete ? '#34C759' : '#AF52DE',
            background: isComplete ? alpha('#34C759', 0.12) : alpha('#AF52DE', 0.1),
            padding: '2px 8px',
            borderRadius: 6,
          }}
        >
          {isComplete ? '✓ Done' : `${daysLeft}d left`}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px' }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            fontFamily: F,
            color: C.t1,
            marginBottom: 8,
          }}
        >
          {challenge.description}
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 6 }}>
          <div
            style={{
              height: 6,
              borderRadius: 3,
              background: C.bd + '30',
              overflow: 'hidden',
              border: isComplete ? '1px solid #FFD70040' : 'none',
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                borderRadius: 3,
                background: isComplete
                  ? 'linear-gradient(90deg, #FFD700, #FFA500)'
                  : 'linear-gradient(90deg, #AF52DE, #DA7FF5)',
                transition: 'width 0.5s ease',
              }}
            />
          </div>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 10, fontFamily: M, color: C.t3 }}>
            {challenge.progress}/{challenge.target}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              fontFamily: M,
              color: '#AF52DE',
            }}
          >
            + {challenge.xpReward} XP
          </span>
        </div>
      </div>
    </Card>
  );
});

export default WeeklyChallengeCard;
