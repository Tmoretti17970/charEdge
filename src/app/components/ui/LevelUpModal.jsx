// ═══════════════════════════════════════════════════════════════════
// charEdge — Level Up Modal (Gamification Sprint A)
//
// Full-screen celebration modal triggered when XP crosses a rank
// threshold. Shows old rank → new rank with particle animation.
// Auto-dismisses after 5 seconds or on click.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { C, F, M } from '../../../constants.js';
import { useGamificationStore } from '../../../state/useGamificationStore.js';
import { alpha } from '../../../utils/colorUtils.js';

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

export default function LevelUpModal() {
  const pendingLevelUp = useGamificationStore((s) => s._pendingLevelUp);
  const clearPendingLevelUp = useGamificationStore((s) => s.clearPendingLevelUp);
  const levelUpEnabled = useGamificationStore((s) => s.notificationPrefs.levelUp);
  const [visible, setVisible] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const dismiss = useCallback(() => {
    setVisible(false);
    clearPendingLevelUp();
  }, [clearPendingLevelUp]);

  useEffect(() => {
    if (pendingLevelUp) {
      if (!levelUpEnabled) {
        // Notification disabled — silently consume
        clearPendingLevelUp();
        return;
      }
      setVisible(true);
      // Auto-dismiss after 5s
      const timer = setTimeout(dismiss, 5000);
      return () => clearTimeout(timer);
    }
  }, [pendingLevelUp, dismiss, levelUpEnabled, clearPendingLevelUp]);

  // Sprint 1: Framer Motion transitions
  const springTransition = prefersReducedMotion
    ? { duration: 0.01 }
    : { type: 'spring', stiffness: 300, damping: 25 };

  const showModal = visible && pendingLevelUp;
  const { oldRank, newRank } = pendingLevelUp || {};

  // Generate confetti particles
  const particles = showModal
    ? Array.from({ length: 40 }, (_, i) => ({
        delay: Math.random() * 0.5,
        color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
      }))
    : [];

  return (
    <AnimatePresence>
      {showModal && (
    <motion.div
      key="levelup-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: prefersReducedMotion ? 0.01 : 0.3 }}
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
      }}
    >
      {/* Confetti */}
      {particles.map((p, i) => (
        <Particle key={i} delay={p.delay} color={p.color} />
      ))}

      {/* Card */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={springTransition}
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
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>
  );
}

export { LevelUpModal };
