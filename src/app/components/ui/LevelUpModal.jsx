// ═══════════════════════════════════════════════════════════════════
// charEdge — Level Up Modal (Gamification Sprint A)
//
// Full-screen celebration modal triggered when XP crosses a rank
// threshold. Shows old rank → new rank with particle animation.
// Auto-dismisses after 5 seconds or on click.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useEffect, useState, useCallback } from 'react';
import { C, F, M } from '../../../constants.js';
import { useGamificationStore } from '../../../state/useGamificationStore';
import { alpha } from '@/shared/colorUtils';

// ─── Confetti Particle ──────────────────────────────────────────

const PARTICLE_COLORS = ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#007AFF', '#AF52DE', '#FF6B9D'];

function Particle({ delay, color }) {
  const startX = 50 + (Math.random() - 0.5) * 20;
  const endX = Math.random() * 100;
  const endY = 100 + Math.random() * 20;
  const dur = 1.5 + Math.random() * 1.5;
  const size = 4 + Math.random() * 6;
  const rotation = Math.random() * 720;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${startX}%`,
        top: '40%',
        width: size,
        height: size,
        borderRadius: Math.random() > 0.5 ? '50%' : 2,
        background: color,
        opacity: 0,
        animation: `tf-confetti-fall ${dur}s ${delay}s ease-out forwards`,
        '--end-x': `${endX - startX}vw`,
        '--end-y': `${endY}vh`,
        '--rotation': `${rotation}deg`,
        pointerEvents: 'none',
      }}
    />
  );
}

// ─── Level Up Modal ─────────────────────────────────────────────

function LevelUpModal() {
  const pendingLevelUp = useGamificationStore((s) => s._pendingLevelUp);
  const clearPendingLevelUp = useGamificationStore((s) => s.clearPendingLevelUp);
  const levelUpEnabled = useGamificationStore((s) => s.notificationPrefs.levelUp);
  const [visible, setVisible] = useState(false);
  const skipMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const [animating, setAnimating] = useState(false);

  const dismiss = useCallback(() => {
    setAnimating(false);
    setTimeout(() => {
      setVisible(false);
      clearPendingLevelUp();
    }, skipMotion ? 0 : 300);
  }, [clearPendingLevelUp, skipMotion]);

  useEffect(() => {
    if (pendingLevelUp) {
      if (!levelUpEnabled) {
        clearPendingLevelUp();
        return;
      }
      setVisible(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimating(true)));
      const timer = setTimeout(dismiss, 5000);
      return () => clearTimeout(timer);
    }
  }, [pendingLevelUp, dismiss, levelUpEnabled, clearPendingLevelUp]);

  const showModal = visible && pendingLevelUp;
  const { oldRank, newRank } = pendingLevelUp || {};

  // Generate confetti particles
  const particles = showModal
    ? Array.from({ length: 40 }, (_, i) => ({
      delay: Math.random() * 0.5,
      color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
    }))
    : [];

  const dur = skipMotion ? '0ms' : '300ms';

  if (!showModal) return null;

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: alpha('#000', 0.7),
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        cursor: 'pointer',
        overflow: 'hidden',
        opacity: animating ? 1 : 0,
        transition: `opacity ${dur} ease`,
      }}
    >
      {/* Confetti */}
      {particles.map((p, i) => (
        <Particle key={i} delay={p.delay} color={p.color} />
      ))}

      {/* Card */}
      <div
        style={{
          background: alpha(C.sf, 0.95),
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: `1px solid ${alpha(newRank.color, 0.3)}`,
          borderRadius: 24,
          padding: '48px 56px',
          textAlign: 'center',
          maxWidth: 400,
          boxShadow: `0 0 60px ${alpha(newRank.color, 0.3)}, 0 20px 60px ${alpha(C.bg, 0.5)}`,
          position: 'relative',
          transform: animating ? 'scale(1)' : 'scale(0.95)',
          opacity: animating ? 1 : 0,
          transition: `transform ${dur} cubic-bezier(0.32, 0.72, 0, 1), opacity ${dur} ease`,
        }}
      >
        {/* Glow ring */}
        <div
          style={{
            position: 'absolute',
            top: -2,
            left: -2,
            right: -2,
            bottom: -2,
            borderRadius: 26,
            background: `linear-gradient(135deg, ${alpha(newRank.color, 0.2)}, transparent, ${alpha(newRank.color, 0.1)})`,
            pointerEvents: 'none',
          }}
        />

        {/* Title */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            fontFamily: M,
            color: newRank.color,
            textTransform: 'uppercase',
            letterSpacing: '2px',
            marginBottom: 16,
          }}
        >
          Level Up!
        </div>

        {/* Rank transition */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 20 }}>
          <div style={{ textAlign: 'center', opacity: 0.5 }}>
            <div style={{ fontSize: 28 }}>{oldRank.emoji}</div>
            <div style={{ fontSize: 10, fontFamily: M, color: C.t3, marginTop: 4 }}>{oldRank.name}</div>
          </div>
          <div style={{ fontSize: 20, color: newRank.color, fontWeight: 700, animation: 'tf-pulse 1s ease-in-out infinite' }}>
            →
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, animation: 'tf-bounce 0.6s 0.3s ease-out' }}>{newRank.emoji}</div>
            <div style={{
              fontSize: 14,
              fontWeight: 800,
              fontFamily: F,
              color: newRank.color,
              marginTop: 4,
              textShadow: `0 0 20px ${alpha(newRank.color, 0.5)}`,
            }}>
              {newRank.name}
            </div>
          </div>
        </div>

        {/* Description */}
        <div style={{ fontSize: 12, color: C.t2, fontFamily: F, lineHeight: 1.5, marginBottom: 8 }}>
          You've reached <span style={{ color: newRank.color, fontWeight: 700 }}>Level {newRank.level}</span>
        </div>

        {/* Dismiss hint */}
        <div style={{ fontSize: 10, color: C.t3, fontFamily: M, marginTop: 16, opacity: 0.6 }}>
          Click anywhere to dismiss
        </div>
      </div>
    </div>
  );
}

export { LevelUpModal };

export default React.memo(LevelUpModal);
