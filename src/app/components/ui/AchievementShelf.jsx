// ═══════════════════════════════════════════════════════════════════
// charEdge — Achievement Shelf (Gamification Sprint A)
//
// Grid of achievement badges for the Settings/Profile page.
// Locked = greyed silhouette, Unlocked = full color + glow.
// Shows name, description, rarity tag, and unlock date.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState } from 'react';
import { C, F, M } from '../../../constants.js';
import { useGamificationStore, ACHIEVEMENTS, RANKS, getRankForXP, getXPToNextLevel } from '../../../state/useGamificationStore';
import { RARITY_COLORS } from './AchievementToast.jsx';
import { alpha } from '@/shared/colorUtils';

// ─── Stats Header ───────────────────────────────────────────────

function StatsHeader() {
  const xp = useGamificationStore((s) => s.xp);
  const streaks = useGamificationStore((s) => s.streaks);
  const achievements = useGamificationStore((s) => s.achievements);

  const rank = getRankForXP(xp);
  const { progress, nextRank } = getXPToNextLevel(xp);
  const unlockedCount = Object.keys(achievements).length;
  const totalCount = ACHIEVEMENTS.length;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: 12,
      marginBottom: 24,
    }}>
      {/* Rank card */}
      <StatCard
        label="Current Rank"
        value={`${rank.emoji} ${rank.name}`}
        sub={`Level ${rank.level} • ${xp.toLocaleString()} XP`}
        accent={rank.color}
      />

      {/* Progress card */}
      <div style={{
        background: alpha(C.sf, 0.5),
        border: `1px solid ${C.bd}`,
        borderRadius: 12,
        padding: '12px 16px',
      }}>
        <div style={{ fontSize: 10, fontWeight: 600, fontFamily: M, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
          Next Level
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: F, color: C.t1, marginBottom: 8 }}>
          {nextRank ? `${nextRank.emoji} ${nextRank.name}` : '🏆 Max Rank!'}
        </div>
        {nextRank && (
          <>
            <div style={{
              width: '100%',
              height: 4,
              borderRadius: 2,
              background: alpha(C.bd, 0.3),
              overflow: 'hidden',
              marginBottom: 4,
            }}>
              <div style={{
                width: `${Math.round(progress * 100)}%`,
                height: '100%',
                borderRadius: 2,
                background: `linear-gradient(90deg, ${rank.color}, ${nextRank.color})`,
              }} />
            </div>
            <div style={{ fontSize: 10, fontFamily: M, color: C.t3 }}>
              {(nextRank.minXP - xp).toLocaleString()} XP to go
            </div>
          </>
        )}
      </div>

      {/* Streaks card */}
      <StatCard
        label="Best Streaks"
        value={`🔥 ${streaks.trading.best}d`}
        sub={`Trading • 📝 ${streaks.journaling.best}d Journal`}
        accent="#FF9500"
      />

      {/* Achievements card */}
      <StatCard
        label="Achievements"
        value={`${unlockedCount}/${totalCount}`}
        sub={`${Math.round((unlockedCount / totalCount) * 100)}% complete`}
        accent="#AF52DE"
      />
    </div>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: alpha(C.sf, 0.5),
      border: `1px solid ${C.bd}`,
      borderRadius: 12,
      padding: '12px 16px',
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, fontFamily: M, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: F, color: accent || C.t1, marginBottom: 2 }}>
        {value}
      </div>
      <div style={{ fontSize: 10, fontFamily: M, color: C.t3 }}>
        {sub}
      </div>
    </div>
  );
}

// ─── Achievement Badge ──────────────────────────────────────────

function AchievementBadge({ achievement, unlockData }) {
  const [hovered, setHovered] = useState(false);
  const isUnlocked = !!unlockData;
  const rarityColor = RARITY_COLORS[achievement.rarity] || RARITY_COLORS.common;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: isUnlocked
          ? alpha(rarityColor, hovered ? 0.12 : 0.06)
          : alpha(C.sf, hovered ? 0.6 : 0.3),
        border: `1px solid ${isUnlocked ? alpha(rarityColor, 0.3) : alpha(C.bd, 0.5)}`,
        borderRadius: 14,
        padding: '16px 14px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        cursor: 'default',
        transition: 'all 0.2s ease',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: isUnlocked && hovered
          ? `0 4px 20px ${alpha(rarityColor, 0.2)}`
          : 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Glow for unlocked */}
      {isUnlocked && (
        <div style={{
          position: 'absolute',
          top: -10,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 50,
          height: 50,
          borderRadius: '50%',
          background: alpha(rarityColor, 0.1),
          filter: 'blur(15px)',
          pointerEvents: 'none',
        }} />
      )}

      {/* Emoji */}
      <div style={{
        fontSize: 28,
        filter: isUnlocked ? 'none' : 'grayscale(1) opacity(0.3)',
        transition: 'filter 0.3s ease',
      }}>
        {achievement.emoji}
      </div>

      {/* Name */}
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        fontFamily: F,
        color: isUnlocked ? C.t1 : C.t3,
        textAlign: 'center',
        lineHeight: 1.3,
      }}>
        {achievement.name}
      </div>

      {/* Description */}
      <div style={{
        fontSize: 10,
        fontFamily: M,
        color: isUnlocked ? C.t2 : alpha(C.t3, 0.5),
        textAlign: 'center',
        lineHeight: 1.4,
      }}>
        {achievement.description}
      </div>

      {/* Rarity tag */}
      <div style={{
        fontSize: 9,
        fontWeight: 700,
        fontFamily: M,
        color: rarityColor,
        background: alpha(rarityColor, 0.1),
        borderRadius: 4,
        padding: '2px 6px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        {achievement.rarity}
      </div>

      {/* Unlock date */}
      {isUnlocked && unlockData.unlockedAt && (
        <div style={{ fontSize: 9, fontFamily: M, color: C.t3 }}>
          {new Date(unlockData.unlockedAt).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}

// ─── Main Shelf Component ───────────────────────────────────────

function AchievementShelf() {
  const achievements = useGamificationStore((s) => s.achievements);
  const enabled = useGamificationStore((s) => s.enabled);
  const toggleEnabled = useGamificationStore((s) => s.toggleEnabled);

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
      }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, fontFamily: F, color: C.t1, margin: '0 0 4px 0' }}>
            🎮 Achievements & Progress
          </h2>
          <p style={{ fontSize: 12, color: C.t2, fontFamily: F, margin: 0 }}>
            Track your growth, collect badges, and level up your trading game.
          </p>
        </div>
        <button
          className="tf-btn"
          onClick={toggleEnabled}
          style={{
            padding: '6px 14px',
            borderRadius: 8,
            border: `1px solid ${enabled ? alpha('#34C759', 0.3) : C.bd}`,
            background: enabled ? alpha('#34C759', 0.08) : 'transparent',
            color: enabled ? '#34C759' : C.t3,
            fontSize: 11,
            fontWeight: 600,
            fontFamily: F,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          {enabled ? '✓ Enabled' : 'Disabled'}
        </button>
      </div>

      {enabled && (
        <>
          {/* Stats overview */}
          <StatsHeader />

          {/* Rank progression */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, fontFamily: F, color: C.t2, marginBottom: 10 }}>
              Rank Progression
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {RANKS.map((rank) => {
                const currentRank = getRankForXP(useGamificationStore.getState().xp);
                const isReached = currentRank.level >= rank.level;
                return (
                  <div
                    key={rank.level}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: `1px solid ${isReached ? alpha(rank.color, 0.3) : alpha(C.bd, 0.5)}`,
                      background: isReached ? alpha(rank.color, 0.08) : 'transparent',
                      opacity: isReached ? 1 : 0.4,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{rank.emoji}</span>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, fontFamily: F, color: isReached ? rank.color : C.t3 }}>
                        {rank.name}
                      </div>
                      <div style={{ fontSize: 9, fontFamily: M, color: C.t3 }}>
                        {rank.minXP.toLocaleString()} XP
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Badge grid */}
          <div style={{ fontSize: 12, fontWeight: 700, fontFamily: F, color: C.t2, marginBottom: 10 }}>
            Badges ({Object.keys(achievements).length}/{ACHIEVEMENTS.length})
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 12,
          }}>
            {ACHIEVEMENTS.map((ach) => (
              <AchievementBadge
                key={ach.id}
                achievement={ach}
                unlockData={achievements[ach.id] || null}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export { AchievementShelf };

export default React.memo(AchievementShelf);
