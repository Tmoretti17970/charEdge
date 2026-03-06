// ═══════════════════════════════════════════════════════════════════
// charEdge — Achievement Showcase (Sprint 14)
//
// Mini ribbon showing recent achievements and next-to-earn badge.
// Pulls from the existing gamification store and displays earned
// badges with rarity glow effects.
// ═══════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import { C, M, F } from '../../../constants.js';
import { useGamificationStore } from '../../../state/useGamificationStore.js';
import { useBreakpoints } from '../../../utils/useMediaQuery.js';

// Rarity colors
const RARITY = {
  common: { bg: C.t3 + '12', border: C.t3 + '20', glow: 'none', label: 'Common' },
  uncommon: { bg: C.g + '10', border: C.g + '20', glow: `0 0 8px ${C.g}30`, label: 'Uncommon' },
  rare: { bg: C.b + '10', border: C.b + '20', glow: `0 0 12px ${C.b}40`, label: 'Rare' },
  epic: { bg: C.p + '10', border: C.p + '20', glow: `0 0 16px ${C.p}50`, label: 'Epic' },
  legendary: { bg: C.y + '10', border: C.y + '20', glow: `0 0 20px ${C.y}60`, label: 'Legendary' },
};

// Achievement definitions (mirrored from gamification store for display)
const ACHIEVEMENT_DEFS = [
  { id: 'first_blood', name: 'First Blood', emoji: '🔥', rarity: 'common', description: 'Log your first trade' },
  { id: 'journaler', name: 'Journaler', emoji: '📝', rarity: 'common', description: 'Write notes on 10 trades' },
  { id: 'sharpshooter', name: 'Sharpshooter', emoji: '🎯', rarity: 'uncommon', description: '5 consecutive winning trades' },
  { id: 'zen_master', name: 'Zen Master', emoji: '🧘', rarity: 'uncommon', description: 'Complete pre-trade checklist 50 times' },
  { id: 'data_nerd', name: 'Data Nerd', emoji: '📊', rarity: 'common', description: 'Log 25 trades with detailed notes' },
  { id: 'summit', name: 'Summit', emoji: '🏔️', rarity: 'rare', description: 'Hit a monthly PnL goal' },
  { id: 'inferno', name: 'Inferno', emoji: '🔥', rarity: 'rare', description: '30-day trading streak' },
  { id: 'brick_by_brick', name: 'Brick by Brick', emoji: '🧱', rarity: 'uncommon', description: '100 total trades logged' },
  { id: 'comeback_king', name: 'Comeback King', emoji: '🌊', rarity: 'epic', description: 'Recover from a drawdown' },
  { id: 'forge_master', name: 'Forge Master', emoji: '🏆', rarity: 'legendary', description: 'Reach the maximum rank' },
  { id: 'discipline', name: 'Iron Discipline', emoji: '📕', rarity: 'uncommon', description: '7-day journaling streak' },
  { id: 'centurion', name: 'Centurion', emoji: '💎', rarity: 'uncommon', description: 'Earn 1,000 XP' },
];

export default function AchievementShowcase() {
  const achievementMap = useGamificationStore((s) => s.achievements) || {};
  const xp = useGamificationStore((s) => s.xp) || 0;
  const level = useGamificationStore((s) => s.level) || 1;
  const { isMobile } = useBreakpoints();

  // Get recent earned achievements (merge definitions with store state)
  const earned = useMemo(() => {
    return ACHIEVEMENT_DEFS
      .filter((a) => achievementMap[a.id])
      .map((a) => ({
        ...a,
        unlockedAt: achievementMap[a.id]?.unlockedAt || 0,
      }))
      .sort((a, b) => b.unlockedAt - a.unlockedAt)
      .slice(0, 5);
  }, [achievementMap]);

  // Next achievement to earn
  const nextAchievement = useMemo(() => {
    const locked = ACHIEVEMENT_DEFS.filter((a) => !achievementMap[a.id]);
    if (!locked.length) return null;
    return locked[0];
  }, [achievementMap]);

  if (earned.length === 0 && !nextAchievement) return null;

  return (
    <div className="tf-container tf-achievements"
      style={{
        padding: isMobile ? '12px 14px' : '14px 18px',
        borderRadius: 10,
        background: C.sf,
        border: `1px solid ${C.bd}`,
        marginBottom: 14,
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12 }}>🏅</span>
          <span style={{ fontSize: 9, fontWeight: 700, fontFamily: M, color: C.t3, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Achievements
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, fontFamily: M, color: C.b }}>
            Lv.{level}
          </span>
          <span style={{ fontSize: 9, fontFamily: M, color: C.t3 }}>
            {xp} XP
          </span>
        </div>
      </div>

      {/* Achievement ribbon */}
      <div style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        scrollbarWidth: 'none',
        paddingBottom: 4,
      }}>
        {earned.map((a) => {
          const rarity = RARITY[a.rarity || 'common'] || RARITY.common;
          return (
            <div
              key={a.id || a.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                borderRadius: 6,
                background: rarity.bg,
                border: `1px solid ${rarity.border}`,
                boxShadow: rarity.glow,
                flexShrink: 0,
                cursor: 'default',
              }}
              title={a.description || a.name}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>{a.emoji || a.icon || '🏆'}</span>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, fontFamily: F, color: C.t1, whiteSpace: 'nowrap' }}>
                  {a.name || a.title}
                </div>
                <div style={{ fontSize: 8, fontFamily: M, color: C.t3, textTransform: 'uppercase' }}>
                  {rarity.label}
                </div>
              </div>
            </div>
          );
        })}

        {/* Next achievement */}
        {nextAchievement && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            borderRadius: 6,
            background: C.bg2 + '40',
            border: `1px dashed ${C.bd}`,
            flexShrink: 0,
            opacity: 0.7,
          }}>
            <span style={{ fontSize: 14, lineHeight: 1, filter: 'grayscale(1)' }}>
              {nextAchievement.emoji || nextAchievement.icon || '🔒'}
            </span>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, fontFamily: F, color: C.t2, whiteSpace: 'nowrap' }}>
                {nextAchievement.name || nextAchievement.title}
              </div>
              <div style={{ fontSize: 8, fontFamily: M, color: C.t3 }}>
                NEXT • {Math.round((nextAchievement.progress || 0) * 100)}%
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
