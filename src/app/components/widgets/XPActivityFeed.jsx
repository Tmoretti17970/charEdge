// ═══════════════════════════════════════════════════════════════════
// charEdge — XP Activity Feed Widget (Gamification Sprint B)
//
// Dashboard widget showing recent XP awards with source icons,
// descriptions, and relative timestamps.
// ═══════════════════════════════════════════════════════════════════

import { memo, useMemo } from 'react';
import { C, F, M } from '../../../constants.js';
import { useGamificationStore, getRankForXP, getXPToNextLevel } from '../../../state/useGamificationStore.js';
import { Card } from '../ui/UIKit.jsx';
import { alpha } from '../../../utils/colorUtils.js';

// ─── Source → Icon + Label mapping ─────────────────────────────

const SOURCE_MAP = {
  trade_logged:   { icon: '📊', label: 'Trade logged' },
  notes_written:  { icon: '📝', label: 'Notes written' },
  checklist_done: { icon: '✅', label: 'Checklist completed' },
  daily_debrief:  { icon: '☀️', label: 'Daily debrief' },
  daily_goal_hit: { icon: '🎯', label: 'Daily goal hit' },
  weekly_goal_hit:{ icon: '🏆', label: 'Weekly goal hit' },
  streak_7:       { icon: '🔥', label: '7-day streak!' },
  streak_30:      { icon: '🔥', label: '30-day streak!' },
  streak_100:     { icon: '💎', label: '100-day streak!' },
  chart_shared:   { icon: '📸', label: 'Chart shared' },
  poll_voted:     { icon: '🗳️', label: 'Poll voted' },
  trade_graded:   { icon: '📋', label: 'Trade graded' },
  challenge_done: { icon: '⚡', label: 'Challenge completed' },
};

function getSourceInfo(source) {
  return SOURCE_MAP[source] || { icon: '✨', label: source?.replace(/_/g, ' ') || 'Bonus XP' };
}

function relativeTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return new Date(ts).toLocaleDateString();
}

// ═══════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════

export const XPActivityFeed = memo(function XPActivityFeed() {
  const xp = useGamificationStore((s) => s.xp);
  const xpLog = useGamificationStore((s) => s.xpLog);
  const enabled = useGamificationStore((s) => s.enabled);

  const rank = useMemo(() => getRankForXP(xp), [xp]);
  const progress = useMemo(() => getXPToNextLevel(xp), [xp]);

  if (!enabled) return null;

  const entries = xpLog.slice(0, 10);

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header with rank + XP bar */}
      <div style={{
        padding: '12px 14px 10px',
        borderBottom: `1px solid ${C.bd}20`,
        background: alpha(rank.color, 0.04),
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            fontFamily: F,
            color: C.t1,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span style={{ fontSize: 16 }}>{rank.emoji}</span>
            {rank.name}
          </div>
          <div style={{
            fontSize: 12,
            fontWeight: 800,
            fontFamily: M,
            color: rank.color,
          }}>
            {xp.toLocaleString()} XP
          </div>
        </div>

        {/* Progress bar */}
        {progress.nextRank && (
          <div>
            <div style={{
              height: 4,
              borderRadius: 2,
              background: alpha(C.bd, 0.3),
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${Math.round(progress.progress * 100)}%`,
                height: '100%',
                borderRadius: 2,
                background: `linear-gradient(90deg, ${rank.color}, ${progress.nextRank.color})`,
                transition: 'width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }} />
            </div>
            <div style={{
              fontSize: 9,
              fontFamily: M,
              color: C.t3,
              marginTop: 3,
              textAlign: 'right',
            }}>
              {progress.needed.toLocaleString()} XP to {progress.nextRank.emoji} {progress.nextRank.name}
            </div>
          </div>
        )}
      </div>

      {/* Activity list */}
      {entries.length === 0 ? (
        <div style={{ padding: '20px 14px', fontSize: 11, color: C.t3, textAlign: 'center' }}>
          Start trading to earn XP ✨
        </div>
      ) : (
        <div style={{ maxHeight: 240, overflowY: 'auto' }}>
          {entries.map((entry, i) => {
            const info = getSourceInfo(entry.source);
            return (
              <div
                key={`${entry.ts}-${i}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '7px 14px',
                  borderBottom: i < entries.length - 1 ? `1px solid ${C.bd}10` : 'none',
                }}
              >
                <span style={{ fontSize: 14, width: 20, textAlign: 'center', flexShrink: 0 }}>
                  {info.icon}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: F,
                    color: C.t1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {info.label}
                  </div>
                  <div style={{ fontSize: 9, fontFamily: M, color: C.t3 }}>
                    {relativeTime(entry.ts)}
                  </div>
                </div>
                <div style={{
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: M,
                  color: '#34C759',
                  flexShrink: 0,
                }}>
                  +{entry.amount}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
});

export default XPActivityFeed;
