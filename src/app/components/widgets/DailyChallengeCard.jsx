// ═══════════════════════════════════════════════════════════════════
// charEdge — Daily Challenge Card (Gamification Sprint A)
//
// Dashboard bento widget showing today's challenge with progress bar,
// XP reward preview, and time remaining.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { C, F, M } from '../../../constants.js';
import { useGamificationStore } from '../../../state/useGamificationStore.js';
import { alpha } from '../../../utils/colorUtils.js';

export default function DailyChallengeCard() {
  const challenge = useGamificationStore((s) => s.dailyChallenge);
  const enabled = useGamificationStore((s) => s.enabled);
  const [timeLeft, setTimeLeft] = useState('');

  // Update countdown every minute
  useEffect(() => {
    if (!challenge?.expiresAt) return;
    const tick = () => {
      const ms = challenge.expiresAt - Date.now();
      if (ms <= 0) { setTimeLeft('Expired'); return; }
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      setTimeLeft(`${h}h ${m}m left`);
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [challenge?.expiresAt]);

  if (!enabled || !challenge) return null;

  const progressPct = Math.min(100, Math.round((challenge.progress / challenge.target) * 100));
  const isComplete = challenge.completed;

  return (
    <div
      style={{
        background: isComplete
          ? `linear-gradient(135deg, ${alpha('#34C759', 0.08)}, ${alpha('#34C759', 0.02)})`
          : alpha(C.sf, 0.6),
        border: `1px solid ${isComplete ? alpha('#34C759', 0.3) : C.bd}`,
        borderRadius: 16,
        padding: '16px 18px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Completion glow */}
      {isComplete && (
        <div
          style={{
            position: 'absolute',
            top: -20,
            right: -20,
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: alpha('#34C759', 0.1),
            filter: 'blur(20px)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, fontFamily: M, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>
            ⚡ Daily Challenge
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, fontFamily: F, color: C.t1, lineHeight: 1.4 }}>
            {challenge.description}
          </div>
        </div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            fontFamily: M,
            color: isComplete ? '#34C759' : '#FF9500',
            background: isComplete ? alpha('#34C759', 0.12) : alpha('#FF9500', 0.12),
            borderRadius: 6,
            padding: '3px 8px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          +{challenge.xpReward} XP
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        width: '100%',
        height: 6,
        borderRadius: 3,
        background: alpha(C.bd, 0.3),
        overflow: 'hidden',
        marginBottom: 8,
      }}>
        <div style={{
          width: `${progressPct}%`,
          height: '100%',
          borderRadius: 3,
          background: isComplete
            ? '#34C759'
            : `linear-gradient(90deg, #007AFF, #AF52DE)`,
          transition: 'width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          boxShadow: isComplete ? '0 0 8px rgba(52, 199, 89, 0.5)' : 'none',
        }} />
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 10, fontFamily: M, color: C.t3 }}>
          {isComplete ? (
            <span style={{ color: '#34C759', fontWeight: 700 }}>✓ Completed!</span>
          ) : (
            `${challenge.progress}/${challenge.target}`
          )}
        </div>
        <div style={{ fontSize: 10, fontFamily: M, color: C.t3 }}>
          {isComplete ? '' : timeLeft}
        </div>
      </div>
    </div>
  );
}

export { DailyChallengeCard };
