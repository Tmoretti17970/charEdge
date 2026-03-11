import { useEffect, useState, useMemo } from 'react';
import { C, F, M } from '../../../constants.js';
import { useGamificationStore, getRankForXP, getXPToNextLevel } from '../../../state/useGamificationStore';
import { useSocialStore } from '../../../state/useSocialStore.js';
import { alpha } from '@/shared/colorUtils';

function TrustBadge({ score }) {
  if (!score) return null;
  const isElite = score >= 90;
  return (
    <div
      style={{
        padding: '2px 4px',
        borderRadius: 4,
        background: isElite ? alpha(C.p, 0.15) : alpha(C.b, 0.1),
        color: isElite ? C.p : C.b,
        fontSize: 9,
        fontWeight: 800,
        fontFamily: F,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        marginLeft: 6,
        border: `1px solid ${isElite ? alpha(C.p, 0.3) : alpha(C.b, 0.2)}`,
        boxShadow: isElite ? `0 0 8px ${alpha(C.p, 0.4)}` : 'none',
      }}
      title={`Trust Score: ${score}/100`}
    >
      {isElite ? '💎' : '✓'} {score}
    </div>
  );
}

const METRICS = [
  { id: 'pnl', label: 'PnL' },
  { id: 'winRate', label: 'Win %' },
  { id: 'sharpe', label: 'Sharpe' },
  { id: 'profitFactor', label: 'PF' },
];

const PERIODS = [
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '90d', label: '90D' },
];

function formatValue(value, metric) {
  if (metric === 'pnl') return `$${value.toLocaleString()}`;
  if (metric === 'winRate') return `${value}%`;
  return value.toFixed(2);
}

function getRankBadge(rank) {
  if (rank === 1) return { emoji: '🥇', glow: '#ffd700' };
  if (rank === 2) return { emoji: '🥈', glow: '#c0c0c0' };
  if (rank === 3) return { emoji: '🥉', glow: '#cd7f32' };
  return null;
}

export default function TraderLeaderboard() {
  const {
    leaderboard,
    leaderboardLoading,
    leaderboardMetric,
    leaderboardPeriod,
    setLeaderboardMetric,
    setLeaderboardPeriod,
    loadLeaderboard,
    setActiveProfile,
    getCurrentSeason,
    leagueHistory,
  } = useSocialStore();

  const xp = useGamificationStore((s) => s.xp);
  const enabled = useGamificationStore((s) => s.enabled);
  const followingList = useSocialStore((s) => s.following);
  const toggleFollow = useSocialStore((s) => s.toggleFollow);

  const rank = useMemo(() => getRankForXP(xp), [xp]);
  const progress = useMemo(() => getXPToNextLevel(xp), [xp]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const season = useMemo(() => getCurrentSeason(), [leaderboard]);

  const [hoveredRow, setHoveredRow] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadLeaderboard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const MOVEMENT_ICONS = { promoted: '↑', demoted: '↓', stayed: '→' };
  const MOVEMENT_COLORS = { promoted: '#34C759', demoted: '#FF3B30', stayed: C.t3 };

  return (
    <div
      style={{
        background: C.bg2,
        borderRadius: 16,
        border: `1px solid ${C.bd}`,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: F }}>🏆 Alpha Board</h3>
        <span style={{ fontSize: 10, color: C.t3, fontFamily: M }}>Updated just now</span>
      </div>

      {/* Season Banner */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 14px',
        borderRadius: 10,
        background: `linear-gradient(135deg, ${alpha(season.league.color, 0.08)}, ${alpha(season.league.color, 0.02)})`,
        border: `1px solid ${alpha(season.league.color, 0.2)}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{season.league.emoji}</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, fontFamily: F, color: C.t1 }}>
              Season: {season.name}
            </div>
            <div style={{ fontSize: 10, fontFamily: M, color: C.t3 }}>
              {season.league.name} League · #{season.position}
            </div>
          </div>
        </div>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          fontFamily: M,
          color: season.league.color,
          background: alpha(season.league.color, 0.12),
          padding: '3px 8px',
          borderRadius: 6,
        }}>
          {season.daysLeft}d left
        </div>
      </div>

      {/* Your Rank Card */}
      {enabled && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 14px',
          borderRadius: 10,
          background: alpha(rank.color, 0.06),
          border: `1px solid ${alpha(rank.color, 0.15)}`,
        }}>
          <span style={{ fontSize: 22 }}>{rank.emoji}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, fontFamily: F, color: C.t1 }}>
              {rank.name} · Lv.{rank.level}
            </div>
            {progress.nextRank && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <div style={{
                  flex: 1,
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
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                <span style={{ fontSize: 9, fontFamily: M, color: C.t3 }}>
                  {xp.toLocaleString()} XP
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Metric tabs */}
      <div style={{ display: 'flex', gap: 6 }}>
        {METRICS.map((m) => (
          <button
            key={m.id}
            onClick={() => setLeaderboardMetric(m.id)}
            style={{
              padding: '5px 10px',
              borderRadius: 8,
              border: `1px solid ${leaderboardMetric === m.id ? C.b : C.bd}`,
              background: leaderboardMetric === m.id ? alpha(C.b, 0.12) : 'transparent',
              color: leaderboardMetric === m.id ? C.b : C.t3,
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 700,
              fontFamily: F,
              transition: 'all 0.2s ease',
            }}
          >
            {m.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => setLeaderboardPeriod(p.id)}
            style={{
              padding: '4px 8px',
              borderRadius: 6,
              border: 'none',
              background: leaderboardPeriod === p.id ? C.sf : 'transparent',
              color: leaderboardPeriod === p.id ? C.t1 : C.t3,
              cursor: 'pointer',
              fontSize: 10,
              fontWeight: 600,
              fontFamily: M,
              transition: 'all 0.15s',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Leaderboard rows */}
      {leaderboardLoading ? (
        <div style={{ padding: 30, textAlign: 'center', color: C.t3, fontSize: 13 }}>Loading leaderboard...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {leaderboard.map((entry) => {
            const badge = getRankBadge(entry.rank);
            const isHovered = hoveredRow === entry.userId;
            const isPositive = leaderboardMetric === 'pnl' ? entry.value > 0 : true;
            const trustScore = 60 + (entry.username.length * 5) % 40;

            return (
              <div
                key={entry.userId}
                onMouseEnter={() => setHoveredRow(entry.userId)}
                onMouseLeave={() => setHoveredRow(null)}
                onClick={() => setActiveProfile(entry.userId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  background: isHovered ? alpha(C.t3, 0.06) : badge ? alpha(C.b, 0.04) : 'transparent',
                  borderRadius: 10,
                  border: `1px solid ${badge ? alpha(C.b, 0.12) : 'transparent'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Rank */}
                <div
                  style={{
                    width: 28,
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: badge ? 18 : 12,
                    fontWeight: 700,
                    fontFamily: M,
                    color: badge ? undefined : C.t3,
                    borderRadius: '50%',
                    background: badge ? 'transparent' : alpha(C.t3, 0.08),
                  }}
                >
                  {badge ? badge.emoji : entry.rank}
                </div>

                {/* Avatar */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${C.b}30, ${C.p}30)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                  }}
                >
                  {entry.avatar}
                </div>

                {/* Name */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.t1,
                      fontFamily: F,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {entry.username}
                    <TrustBadge score={trustScore} />
                  </div>
                  <div style={{ fontSize: 10, color: C.t3, fontFamily: M }}>{entry.tradeCount} trades</div>
                </div>

                {/* Follow Icon (visible on hover) */}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFollow(entry.userId); }}
                  title={followingList.includes(entry.userId) ? 'Unfollow' : 'Follow'}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    border: followingList.includes(entry.userId) ? `1px solid ${C.b}` : `1px solid ${C.bd}`,
                    background: followingList.includes(entry.userId) ? alpha(C.b, 0.1) : 'transparent',
                    color: followingList.includes(entry.userId) ? C.b : C.t3,
                    cursor: 'pointer',
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: isHovered || followingList.includes(entry.userId) ? 1 : 0,
                    transition: 'all 0.15s ease',
                    flexShrink: 0,
                  }}
                >
                  {followingList.includes(entry.userId) ? '✓' : '+'}
                </button>

                {/* Value */}
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: M,
                    color: isPositive ? C.g : C.r,
                    textAlign: 'right',
                  }}
                >
                  {formatValue(entry.value, leaderboardMetric)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Season History */}
      {leagueHistory.length > 0 && (
        <div>
          <button
            className="tf-btn"
            onClick={() => setShowHistory(!showHistory)}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: `1px solid ${C.bd}40`,
              background: 'transparent',
              color: C.t3,
              fontSize: 11,
              fontWeight: 600,
              fontFamily: F,
              cursor: 'pointer',
              width: '100%',
              textAlign: 'center',
            }}
          >
            {showHistory ? '▾' : '▸'} Season History ({leagueHistory.length})
          </button>
          {showHistory && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
              {leagueHistory.slice().reverse().map((h, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 10px',
                    borderRadius: 6,
                    background: alpha(C.sf, 0.5),
                    fontSize: 11,
                    fontFamily: M,
                  }}
                >
                  <span style={{ color: C.t2 }}>{h.season}</span>
                  <span style={{ color: C.t3 }}>{h.league} · #{h.position}</span>
                  <span style={{
                    color: MOVEMENT_COLORS[h.movement],
                    fontWeight: 700,
                    fontSize: 13,
                  }}>
                    {MOVEMENT_ICONS[h.movement]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

