// ═══════════════════════════════════════════════════════════════════
// charEdge — Shareable Trader Card (Gamification Sprint B)
//
// Auto-generated card showing rank, stats, top badges.
// Rendered in Settings > Profile and accessible via command palette.
// "Copy" button captures the card to clipboard as an image.
// ═══════════════════════════════════════════════════════════════════

import { useRef, useCallback, useState } from 'react';
import { C, F, M } from '../../../constants.js';
import { useGamificationStore, getRankForXP, getXPToNextLevel, ACHIEVEMENTS } from '../../../state/useGamificationStore.js';
import { useSocialStore } from '../../../state/useSocialStore.js';
import { useJournalStore } from '../../../state/useJournalStore.js';
import { alpha } from '../../../utils/colorUtils.js';

// ─── Profile Frames ─────────────────────────────────────────────
const CARD_FRAMES = [
  { id: 'basic',     name: 'Basic',       unlockRank: 1, border: '1px solid',  glow: false },
  { id: 'silver',    name: 'Silver Edge',  unlockRank: 2, border: '2px solid',  glow: false },
  { id: 'sapphire',  name: 'Sapphire',     unlockRank: 3, border: '2px solid',  glow: true, glowColor: '#007AFF' },
  { id: 'amethyst',  name: 'Amethyst',     unlockRank: 4, border: '2px solid',  glow: true, glowColor: '#AF52DE' },
  { id: 'golden',    name: 'Golden Forge',  unlockRank: 5, border: '2px solid',  glow: true, glowColor: '#FF9500' },
  { id: 'legendary', name: 'Legendary',     unlockRank: 6, border: '3px solid',  glow: true, glowColor: '#FF3B30' },
];

function getFrameForRank(rankLevel) {
  let frame = CARD_FRAMES[0];
  for (const f of CARD_FRAMES) {
    if (rankLevel >= f.unlockRank) frame = f;
    else break;
  }
  return frame;
}

export default function TraderCard() {
  const cardRef = useRef(null);
  const [copied, setCopied] = useState(false);

  // Gamification data
  const xp = useGamificationStore((s) => s.xp);
  const achievements = useGamificationStore((s) => s.achievements);
  const streaks = useGamificationStore((s) => s.streaks);
  const enabled = useGamificationStore((s) => s.enabled);

  // Profile data
  const myProfile = useSocialStore((s) => s.myProfile);

  // Trade stats
  const trades = useJournalStore((s) => s.trades);

  if (!enabled) return null;

  const rank = getRankForXP(xp);
  const progress = getXPToNextLevel(xp);
  const frame = getFrameForRank(rank.level);

  // Calculate win rate
  const totalTrades = trades.length;
  const wins = trades.filter((t) => (t.pnl ?? 0) > 0).length;
  const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;

  // Top 3 unlocked achievements (most recently unlocked)
  const unlockedIds = Object.entries(achievements)
    .filter(([_, v]) => v.unlockedAt)
    .sort((a, b) => b[1].unlockedAt - a[1].unlockedAt)
    .slice(0, 3)
    .map(([id]) => id);
  const topBadges = ACHIEVEMENTS.filter((a) => unlockedIds.includes(a.id));

  const username = myProfile?.username || myProfile?.displayName || 'Trader';
  const avatar = myProfile?.avatar || '🔥';

  const handleCopy = useCallback(async () => {
    // Copy card info as formatted text (no external dependencies)
    const badges = topBadges.map(b => `${b.emoji} ${b.name}`).join(' · ');
    const text = [
      `${rank.emoji} ${username} — ${rank.name} (Lv.${rank.level})`,
      `${xp.toLocaleString()} XP · ${winRate}% Win Rate · ${totalTrades} Trades`,
      `🔥 Best Streak: ${streaks.trading.best}d`,
      badges ? `🏅 ${badges}` : '',
      '— via charEdge',
    ].filter(Boolean).join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [rank, username, xp, winRate, totalTrades, streaks, topBadges]);

  // Build frame styles
  const frameStyle = {
    border: `${frame.border} ${alpha(rank.color, 0.4)}`,
    ...(frame.glow ? {
      boxShadow: `0 0 20px ${alpha(frame.glowColor, 0.15)}, 0 0 40px ${alpha(frame.glowColor, 0.05)}, inset 0 0 30px ${alpha(frame.glowColor, 0.03)}`,
    } : {}),
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Card */}
      <div
        ref={cardRef}
        style={{
          background: `linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)`,
          borderRadius: 16,
          padding: 24,
          position: 'relative',
          overflow: 'hidden',
          minHeight: 180,
          ...frameStyle,
        }}
      >
        {/* Background decoration */}
        <div style={{
          position: 'absolute',
          top: -40,
          right: -40,
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(rank.color, 0.15)}, transparent 70%)`,
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute',
          bottom: -30,
          left: -30,
          width: 150,
          height: 150,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha('#AF52DE', 0.1)}, transparent 70%)`,
          pointerEvents: 'none',
        }} />

        {/* Header: Avatar + Name + Rank */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, position: 'relative', zIndex: 1 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: `linear-gradient(135deg, ${alpha(rank.color, 0.3)}, ${alpha(rank.color, 0.1)})`,
            border: `2px solid ${alpha(rank.color, 0.5)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
          }}>
            {avatar}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', fontFamily: F }}>
              {username}
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 2,
            }}>
              <span style={{ fontSize: 14 }}>{rank.emoji}</span>
              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: M, color: rank.color }}>
                {rank.name}
              </span>
              <span style={{ fontSize: 10, color: alpha('#fff', 0.5), fontFamily: M }}>
                · Lv.{rank.level}
              </span>
            </div>
          </div>
          {/* charEdge branding */}
          <div style={{
            fontSize: 10,
            fontWeight: 800,
            fontFamily: M,
            color: alpha('#fff', 0.3),
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}>
            TF
          </div>
        </div>

        {/* XP Bar */}
        <div style={{ marginBottom: 18, position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 4,
          }}>
            <span style={{ fontSize: 10, fontFamily: M, color: alpha('#fff', 0.6) }}>
              {xp.toLocaleString()} XP
            </span>
            {progress.nextRank && (
              <span style={{ fontSize: 10, fontFamily: M, color: alpha('#fff', 0.4) }}>
                {Math.round(progress.progress * 100)}%
              </span>
            )}
          </div>
          <div style={{
            height: 6,
            borderRadius: 3,
            background: alpha('#fff', 0.1),
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${progress.nextRank ? Math.round(progress.progress * 100) : 100}%`,
              height: '100%',
              borderRadius: 3,
              background: `linear-gradient(90deg, ${rank.color}, ${progress.nextRank?.color || rank.color})`,
              boxShadow: `0 0 8px ${alpha(rank.color, 0.5)}`,
            }} />
          </div>
        </div>

        {/* Stats row */}
        <div style={{
          display: 'flex',
          gap: 16,
          marginBottom: topBadges.length > 0 ? 16 : 0,
          position: 'relative',
          zIndex: 1,
        }}>
          {[
            { label: 'Win Rate', value: `${winRate}%` },
            { label: 'Trades', value: `${totalTrades}` },
            { label: 'Best Streak', value: `${streaks.trading.best}d` },
            { label: 'Badges', value: `${Object.keys(achievements).length}` },
          ].map((stat, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, fontFamily: M, color: '#fff' }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 8, fontWeight: 600, fontFamily: M, color: alpha('#fff', 0.5), textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Top badges */}
        {topBadges.length > 0 && (
          <div style={{
            display: 'flex',
            gap: 8,
            position: 'relative',
            zIndex: 1,
          }}>
            {topBadges.map((badge) => (
              <div key={badge.id} style={{
                padding: '4px 10px',
                borderRadius: 6,
                background: alpha('#fff', 0.08),
                border: `1px solid ${alpha('#fff', 0.1)}`,
                fontSize: 11,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}>
                <span>{badge.emoji}</span>
                <span style={{ fontWeight: 600, fontFamily: F, color: alpha('#fff', 0.7), fontSize: 10 }}>
                  {badge.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Copy button */}
      <button
        onClick={handleCopy}
        className="tf-btn"
        style={{
          padding: '8px 16px',
          borderRadius: 8,
          border: `1px solid ${copied ? C.g + '40' : C.bd}`,
          background: copied ? C.g + '10' : C.sf,
          color: copied ? C.g : C.t2,
          fontSize: 12,
          fontWeight: 700,
          fontFamily: F,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          transition: 'all 0.2s',
        }}
      >
        {copied ? '✓ Copied!' : '📋 Copy as Image'}
      </button>
    </div>
  );
}

export { TraderCard };
