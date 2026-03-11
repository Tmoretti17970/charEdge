// ═══════════════════════════════════════════════════════════════════
// charEdge — Milestone Celebration Modal (Sprint C)
//
// Full-screen confetti modal triggered when a milestone is reached.
// Reuses the particle pattern from LevelUpModal.
// Auto-dismisses after 5s or on click.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react';
import { C, F, M } from '../../../constants.js';
import { useGamificationStore } from '../../../state/useGamificationStore';
import { alpha } from '@/shared/colorUtils';

const PARTICLE_COLORS = ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#007AFF', '#AF52DE', '#FF6B9D'];

function Particle({ delay, color }) {
  const startX = 50 + (Math.random() - 0.5) * 20;
  const endX = Math.random() * 100;
  const dur = 1.5 + Math.random() * 1.5;
  const size = 4 + Math.random() * 6;

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
        '--end-y': `${100 + Math.random() * 20}vh`,
        '--rotation': `${Math.random() * 720}deg`,
        pointerEvents: 'none',
      }}
    />
  );
}

export default function MilestoneModal() {
  const pendingMilestone = useGamificationStore((s) => s._pendingMilestone);
  const clearPendingMilestone = useGamificationStore((s) => s.clearPendingMilestone);
  const notifEnabled = useGamificationStore((s) => s.notificationPrefs.achievements);
  const [visible, setVisible] = useState(false);
  const skipMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const [animating, setAnimating] = useState(false);

  const dismiss = useCallback(() => {
    setAnimating(false);
    // Wait for exit transition before unmounting
    setTimeout(() => {
      setVisible(false);
      clearPendingMilestone();
    }, skipMotion ? 0 : 300);
  }, [clearPendingMilestone, skipMotion]);

  useEffect(() => {
    if (pendingMilestone) {
      if (!notifEnabled) {
        clearPendingMilestone();
        return;
      }
      setVisible(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimating(true)));
      const timer = setTimeout(dismiss, 5000);
      return () => clearTimeout(timer);
    }
  }, [pendingMilestone, dismiss, notifEnabled, clearPendingMilestone]);

  const showModal = visible && pendingMilestone;
  const particles = showModal
    ? Array.from({ length: 30 }, (_, i) => ({
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
      {particles.map((p, i) => (
        <Particle key={i} delay={p.delay} color={p.color} />
      ))}

      <div
        style={{
          background: alpha(C.sf, 0.95),
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: `1px solid ${alpha('#FFD700', 0.3)}`,
          borderRadius: 24,
          padding: '48px 56px',
          textAlign: 'center',
          maxWidth: 380,
          boxShadow: `0 0 60px ${alpha('#FFD700', 0.2)}, 0 20px 60px ${alpha(C.bg, 0.5)}`,
          position: 'relative',
          transform: animating ? 'scale(1)' : 'scale(0.95)',
          opacity: animating ? 1 : 0,
          transition: `transform ${dur} cubic-bezier(0.32, 0.72, 0, 1), opacity ${dur} ease`,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            fontFamily: M,
            color: '#FFD700',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            marginBottom: 16,
          }}
        >
          🎉 Milestone Reached!
        </div>

        <div style={{ fontSize: 56, marginBottom: 12 }}>
          {pendingMilestone.emoji}
        </div>

        <div
          style={{
            fontSize: 18,
            fontWeight: 800,
            fontFamily: F,
            color: C.t1,
            marginBottom: 8,
          }}
        >
          {pendingMilestone.title}
        </div>

        <div style={{ fontSize: 10, color: C.t3, fontFamily: M, marginTop: 16, opacity: 0.6 }}>
          Click anywhere to dismiss
        </div>
      </div>
    </div>
  );
}

export { MilestoneModal };
