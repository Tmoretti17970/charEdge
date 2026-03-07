// ═══════════════════════════════════════════════════════════════════
// charEdge — Streak Celebrations (Sprint 12)
//
// Prominent streak display with animated celebrations at milestones.
// Shows current trading streak, "at risk" warnings if streak may
// break, and fires confetti-like animation on milestone days.
// ═══════════════════════════════════════════════════════════════════

import React, { useMemo, useState, useEffect } from 'react';
import { C, M, F } from '../../../constants.js';
import { radii } from '../../../theme/tokens.js';
import { useGamificationStore } from '../../../state/useGamificationStore.js';
import { useJournalStore } from '../../../state/useJournalStore.js';
import { useBreakpoints } from '../../../utils/useMediaQuery.js';

// ─── Milestone thresholds ────────────────────────────────────────

const STREAK_MILESTONES = [
  { days: 3, label: 'Getting Started!', emoji: '🔥', color: '#FF9500' },
  { days: 7, label: 'One Week Strong!', emoji: '💪', color: '#34C759' },
  { days: 14, label: 'Two Weeks!', emoji: '⚡', color: '#007AFF' },
  { days: 30, label: 'Monthly Master!', emoji: '🏆', color: '#AF52DE' },
  { days: 50, label: 'Unstoppable!', emoji: '🌟', color: '#FF3B30' },
  { days: 100, label: 'Centurion!', emoji: '👑', color: '#FFD700' },
];

function getNextMilestone(current) {
  return STREAK_MILESTONES.find((m) => m.days > current) || null;
}

function getCurrentMilestone(current) {
  let ms = null;
  for (const m of STREAK_MILESTONES) {
    if (current >= m.days) ms = m;
  }
  return ms;
}

export default function StreakCelebration() {
  const streaks = useGamificationStore((s) => s.streaks) || {};
  const trades = useJournalStore((s) => s.trades);
  const { isMobile } = useBreakpoints();
  const [showCelebration, setShowCelebration] = useState(false);

  const tradingStreak = streaks.trading?.current || 0;
  const bestStreak = streaks.trading?.best || 0;
  const lastDate = streaks.trading?.lastDate || null;

  // Check if streak is at risk
  const isAtRisk = useMemo(() => {
    if (!lastDate || tradingStreak === 0) return false;
    const today = new Date().toISOString().slice(0, 10);
    return lastDate !== today && tradingStreak > 1;
  }, [lastDate, tradingStreak]);

  // Calculate journaling streak too
  const journalStreak = streaks.journaling?.current || 0;
  const profitStreak = streaks.profitable?.current || 0;

  // Current and next milestone
  const currentMs = getCurrentMilestone(tradingStreak);
  const nextMs = getNextMilestone(tradingStreak);
  const progressToNext = nextMs
    ? Math.round(((tradingStreak - (currentMs?.days || 0)) / (nextMs.days - (currentMs?.days || 0))) * 100)
    : 100;

  // Check if we just hit a milestone
  useEffect(() => {
    if (STREAK_MILESTONES.some((m) => m.days === tradingStreak) && tradingStreak > 0) {
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [tradingStreak]);

  // Don't render if no streaks at all
  if (tradingStreak === 0 && journalStreak === 0 && profitStreak === 0) return null;

  return (
    <div className="tf-container tf-streak-celebration"
      style={{
        borderRadius: radii.md,
        background: showCelebration
          ? `linear-gradient(135deg, ${currentMs?.color || C.g}15, ${C.b}08)`
          : C.sf,
        border: `1px solid ${isAtRisk ? C.y + '30' : C.bd}`,
        marginBottom: 14,
        overflow: 'hidden',
        position: 'relative',
        transition: 'all 0.4s',
      }}
    >
      {/* Celebration overlay */}
      {showCelebration && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: `radial-gradient(circle at 50% 0%, ${currentMs?.color || C.g}20, transparent 70%)`,
          pointerEvents: 'none',
          animation: 'tf-fade-in 0.5s ease-out',
          zIndex: 0,
        }} />
      )}

      <div style={{
        padding: isMobile ? '12px 14px' : '14px 18px',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, lineHeight: 1 }}>🔥</span>
            <span style={{
              fontSize: 9, fontWeight: 700, fontFamily: M,
              color: C.t3, letterSpacing: '0.05em', textTransform: 'uppercase',
            }}>
              Streaks
            </span>
            {isAtRisk && (
              <span style={{
                fontSize: 8, fontWeight: 800, padding: '1px 6px',
                borderRadius: radii.pill, background: C.y + '15', color: C.y, fontFamily: M,
              }}>
                ⚠️ AT RISK
              </span>
            )}
            {showCelebration && currentMs && (
              <span style={{
                fontSize: 8, fontWeight: 800, padding: '1px 6px',
                borderRadius: radii.pill, background: currentMs.color + '15',
                color: currentMs.color, fontFamily: M,
                animation: 'tf-pulse 1s infinite',
              }}>
                {currentMs.emoji} {currentMs.label}
              </span>
            )}
          </div>
          {bestStreak > 0 && (
            <span style={{ fontSize: 9, fontFamily: M, color: C.t3 }}>
              Best: {bestStreak} days
            </span>
          )}
        </div>

        {/* Streak metrics row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
        }}>
          {/* Trading Streak */}
          <div style={{
            padding: '8px 10px', borderRadius: radii.xs,
            background: C.bg2 + '60',
          }}>
            <div style={{
              fontSize: 8, fontWeight: 700, fontFamily: M, color: C.t3,
              letterSpacing: '0.04em', marginBottom: 4, textTransform: 'uppercase',
            }}>
              Trading
            </div>
            <div style={{
              fontSize: 20, fontWeight: 900, fontFamily: M,
              color: tradingStreak > 0 ? C.g : C.t3, lineHeight: 1,
            }}>
              {tradingStreak}
            </div>
            <div style={{ fontSize: 9, fontFamily: M, color: C.t3, marginTop: 2 }}>
              {tradingStreak === 1 ? 'day' : 'days'}
            </div>
          </div>

          {/* Journaling Streak */}
          <div style={{
            padding: '8px 10px', borderRadius: radii.xs,
            background: C.bg2 + '60',
          }}>
            <div style={{
              fontSize: 8, fontWeight: 700, fontFamily: M, color: C.t3,
              letterSpacing: '0.04em', marginBottom: 4, textTransform: 'uppercase',
            }}>
              Journaling
            </div>
            <div style={{
              fontSize: 20, fontWeight: 900, fontFamily: M,
              color: journalStreak > 0 ? C.b : C.t3, lineHeight: 1,
            }}>
              {journalStreak}
            </div>
            <div style={{ fontSize: 9, fontFamily: M, color: C.t3, marginTop: 2 }}>
              {journalStreak === 1 ? 'day' : 'days'}
            </div>
          </div>

          {/* Profit Streak */}
          <div style={{
            padding: '8px 10px', borderRadius: radii.xs,
            background: C.bg2 + '60',
          }}>
            <div style={{
              fontSize: 8, fontWeight: 700, fontFamily: M, color: C.t3,
              letterSpacing: '0.04em', marginBottom: 4, textTransform: 'uppercase',
            }}>
              Green Days
            </div>
            <div style={{
              fontSize: 20, fontWeight: 900, fontFamily: M,
              color: profitStreak > 0 ? C.g : C.t3, lineHeight: 1,
            }}>
              {profitStreak}
            </div>
            <div style={{ fontSize: 9, fontFamily: M, color: C.t3, marginTop: 2 }}>
              {profitStreak === 1 ? 'day' : 'days'}
            </div>
          </div>
        </div>

        {/* Next milestone progress */}
        {nextMs && tradingStreak > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 3,
            }}>
              <span style={{ fontSize: 9, fontFamily: M, color: C.t3 }}>
                Next: {nextMs.emoji} {nextMs.label}
              </span>
              <span style={{ fontSize: 9, fontFamily: M, color: C.t3 }}>
                {nextMs.days - tradingStreak} days to go
              </span>
            </div>
            <div style={{
              height: 3, borderRadius: 2, background: C.bg2,
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${progressToNext}%`,
                height: '100%',
                background: nextMs.color,
                borderRadius: 2,
                transition: 'width 0.3s',
              }} />
            </div>
          </div>
        )}

        {/* At-risk warning */}
        {isAtRisk && (
          <div style={{
            marginTop: 8,
            padding: '6px 10px',
            borderRadius: radii.xs,
            background: C.y + '08',
            border: `1px solid ${C.y}15`,
            fontSize: 10,
            fontFamily: M,
            color: C.y,
            textAlign: 'center',
          }}>
            Don't break your {tradingStreak}-day streak! Log a trade today.
          </div>
        )}
      </div>
    </div>
  );
}
