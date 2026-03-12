// ═══════════════════════════════════════════════════════════════════
// charEdge — Sidebar XP Badge (Gamification Sprint A)
//
// Compact widget for the 72px sidebar showing:
//   • Circular SVG progress ring (XP to next level)
//   • Current rank emoji + level number
//   • Streak flame icon + counter (if active)
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { C, F, M } from '../../../constants.js';
import { useGamificationStore, getRankForXP, getXPToNextLevel } from '../../../state/useGamificationStore';
import { alpha } from '@/shared/colorUtils';

function SidebarXPBadge() {
  const xp = useGamificationStore((s) => s.xp);
  const enabled = useGamificationStore((s) => s.enabled);
  const streaks = useGamificationStore((s) => s.streaks);
  const [hovered, setHovered] = useState(false);
  const badgeRef = useRef(null);

  if (!enabled) return null;

  const rank = getRankForXP(xp);
  const { progress, nextRank } = getXPToNextLevel(xp);
  const tradingStreak = streaks.trading.current;

  // SVG ring dimensions
  const size = 42;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  // Calculate tooltip position from badge bounding rect
  let tooltipStyle = {};
  if (hovered && badgeRef.current) {
    const rect = badgeRef.current.getBoundingClientRect();
    tooltipStyle = {
      position: 'fixed',
      left: rect.right + 10,
      top: rect.top + rect.height / 2,
      transform: 'translateY(-50%)',
    };
  }

  return (
    <div
      ref={badgeRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        marginBottom: 12,
        position: 'relative',
        cursor: 'default',
      }}
    >
      {/* XP Ring */}
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={alpha(C.bd, 0.3)}
            strokeWidth={strokeWidth}
          />
          {/* Progress ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={rank.color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
              filter: `drop-shadow(0 0 4px ${alpha(rank.color, 0.4)})`,
            }}
          />
        </svg>
        {/* Rank emoji centered */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 16,
            lineHeight: 1,
          }}
        >
          {rank.emoji}
        </div>
      </div>

      {/* Level label */}
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          fontFamily: M,
          color: rank.color,
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
        }}
      >
        Lv.{rank.level}
      </div>

      {/* Streak flame (if active) */}
      {tradingStreak > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            fontSize: 10,
            fontWeight: 700,
            fontFamily: M,
            color: '#FF9500',
            animation: 'tf-pulse 2s ease-in-out infinite',
          }}
        >
          <span style={{ fontSize: 12 }}>🔥</span>
          {tradingStreak}
        </div>
      )}

      {/* Hover tooltip — portaled to body so it escapes sidebar overflow */}
      {hovered && createPortal(
        <div
          className="tf-tooltip"
          style={{
            ...tooltipStyle,
            background: alpha(C.sf2, 0.95),
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: `1px solid ${alpha(C.bd, 0.4)}`,
            borderRadius: 10,
            padding: '10px 14px',
            minWidth: 160,
            pointerEvents: 'none',
            zIndex: 10000,
            boxShadow: `0 4px 16px ${alpha(C.bg, 0.4)}`,
            animation: 'tf-fade-in 0.12s ease-out',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, fontFamily: F, color: C.t1, marginBottom: 4 }}>
            {rank.emoji} {rank.name}
          </div>
          <div style={{ fontSize: 10, fontFamily: M, color: C.t2, marginBottom: 6 }}>
            {xp.toLocaleString()} XP
            {nextRank && ` • ${(nextRank.minXP - xp).toLocaleString()} to ${nextRank.name}`}
          </div>

          {/* Mini progress bar */}
          <div style={{
            width: '100%',
            height: 4,
            borderRadius: 2,
            background: alpha(C.bd, 0.3),
            overflow: 'hidden',
            marginBottom: 6,
          }}>
            <div style={{
              width: `${Math.round(progress * 100)}%`,
              height: '100%',
              borderRadius: 2,
              background: rank.color,
              transition: 'width 0.4s ease',
            }} />
          </div>

          {/* Streaks row */}
          <div style={{ display: 'flex', gap: 10, fontSize: 10, fontFamily: M, color: C.t3 }}>
            {tradingStreak > 0 && (
              <span>🔥 {tradingStreak}d streak</span>
            )}
            {streaks.journaling.current > 0 && (
              <span>📝 {streaks.journaling.current}d</span>
            )}
            {streaks.profitable.current > 0 && (
              <span>💰 {streaks.profitable.current}d</span>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export { SidebarXPBadge };

export default React.memo(SidebarXPBadge);
