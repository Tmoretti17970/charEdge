// ═══════════════════════════════════════════════════════════════════
// charEdge — Tournament Panel
// ═══════════════════════════════════════════════════════════════════

import { useGamificationStore } from '../../../state/useGamificationStore.js';
import { useState } from 'react';
import { C, F, M } from '../../../constants.js';
import { alpha } from '../../../utils/colorUtils.js';

// ─── Countdown Display ──────────────────────────────────────────
function Countdown({ endDate, color }) {
  const end = new Date(endDate).getTime();
  const remaining = end - Date.now();
  if (remaining <= 0) return <span style={{ color: C.t3 }}>Ended</span>;

  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  const mins = Math.floor((remaining % 3600000) / 60000);

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {days > 0 && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: M }}>{days}</div>
          <div style={{ fontSize: 9, color: C.t3, textTransform: 'uppercase' }}>days</div>
        </div>
      )}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: M }}>{hours}</div>
        <div style={{ fontSize: 9, color: C.t3, textTransform: 'uppercase' }}>hrs</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: M }}>{mins}</div>
        <div style={{ fontSize: 9, color: C.t3, textTransform: 'uppercase' }}>min</div>
      </div>
    </div>
  );
}

// ─── Podium ─────────────────────────────────────────────────────
function Podium({ leaderboard }) {
  if (leaderboard.length < 3) return null;
  const medals = ['🥇', '🥈', '🥉'];
  const heights = [72, 56, 48];
  const order = [1, 0, 2]; // 2nd, 1st, 3rd

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 8, margin: '16px 0' }}>
      {order.map((idx) => {
        const entry = leaderboard[idx];
        return (
          <div key={idx} style={{ textAlign: 'center', width: 80 }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{entry.avatar}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: F, marginBottom: 4 }}>{entry.name}</div>
            <div style={{
              height: heights[idx], borderRadius: '8px 8px 0 0',
              background: `linear-gradient(180deg, ${alpha(C.b, 0.2)}, ${alpha(C.b, 0.05)})`,
              border: `1px solid ${C.bd}`, borderBottom: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20,
            }}>
              {medals[idx]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Tournament Card ────────────────────────────────────────────
function TournamentCard({ tournament, onEnter, onLeave, isEntered }) {
  const [showRules, setShowRules] = useState(false);
  const isActive = tournament.status === 'active';
  const isUpcoming = tournament.status === 'upcoming';
  const isCompleted = tournament.status === 'completed';

  const card = {
    background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 16,
    padding: 24, position: 'relative', overflow: 'hidden',
  };

  return (
    <div className="tf-tournament-hero" style={card}>
      {/* Top accent */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${tournament.color}, ${alpha(tournament.color, 0.3)})`,
      }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 28 }}>{tournament.icon}</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: C.t1, fontFamily: F }}>{tournament.name}</div>
            <div style={{ fontSize: 11, color: C.t3, fontFamily: F, marginTop: 2 }}>{tournament.description}</div>
          </div>
        </div>
        <span style={{
          padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700,
          background: alpha(
            isActive ? C.g : isUpcoming ? C.y : C.t3,
            0.12
          ),
          color: isActive ? C.g : isUpcoming ? C.y : C.t3,
          textTransform: 'uppercase',
        }}>
          {tournament.status}
        </span>
      </div>

      {/* Countdown or Podium */}
      {isActive && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 10, color: C.t3, fontFamily: F, marginBottom: 4, textTransform: 'uppercase' }}>Time Remaining</div>
            <Countdown endDate={tournament.endDate} color={tournament.color} />
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: C.t3, fontFamily: F, marginBottom: 4, textTransform: 'uppercase' }}>Entrants</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.t1, fontFamily: M }}>
              {tournament.entrants}<span style={{ fontSize: 12, color: C.t3 }}>/{tournament.maxEntrants}</span>
            </div>
          </div>
        </div>
      )}

      {isUpcoming && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: C.t3, fontFamily: F, marginBottom: 4, textTransform: 'uppercase' }}>Starts In</div>
          <Countdown endDate={tournament.startDate} color={tournament.color} />
          <div style={{ fontSize: 12, color: C.t2, fontFamily: F, marginTop: 8 }}>
            {tournament.entrants} / {tournament.maxEntrants} registered
          </div>
        </div>
      )}

      {isCompleted && <Podium leaderboard={tournament.leaderboard} />}

      {/* Prizes */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: C.t3, fontFamily: F, textTransform: 'uppercase', marginBottom: 8 }}>Prizes</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {tournament.prizes.map((prize, i) => (
            <div key={i} style={{ fontSize: 12, color: C.t2, fontFamily: F, padding: '4px 0' }}>
              {prize}
            </div>
          ))}
        </div>
      </div>

      {/* Rules Toggle */}
      <button
        onClick={() => setShowRules(!showRules)}
        style={{
          padding: 0, border: 'none', background: 'none',
          color: C.t3, fontSize: 11, fontFamily: F, cursor: 'pointer',
          marginBottom: showRules ? 8 : 14,
        }}
      >
        {showRules ? '▾ Hide Rules' : '▸ Show Rules'}
      </button>
      {showRules && (
        <div style={{
          padding: 12, borderRadius: 8, background: C.sf,
          border: `1px solid ${C.bd}`, marginBottom: 14,
        }}>
          {tournament.rules.map((rule, i) => (
            <div key={i} style={{ fontSize: 11, color: C.t2, fontFamily: F, padding: '3px 0' }}>
              • {rule}
            </div>
          ))}
        </div>
      )}

      {/* Leaderboard (active) */}
      {isActive && tournament.leaderboard.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.t3, fontFamily: F, textTransform: 'uppercase', marginBottom: 8 }}>Leaderboard</div>
          <div style={{ background: C.sf, borderRadius: 10, border: `1px solid ${C.bd}`, overflow: 'hidden' }}>
            {tournament.leaderboard.map((entry) => (
              <div key={entry.rank} style={{
                display: 'grid', gridTemplateColumns: '28px 24px 1fr 80px 60px',
                alignItems: 'center', gap: 8,
                padding: '8px 12px',
                borderBottom: `1px solid ${alpha(C.bd, 0.5)}`,
                background: entry.name === 'You' ? alpha(C.b, 0.06) : 'transparent',
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: entry.rank <= 3 ? C.b : C.t3, fontFamily: M, textAlign: 'center' }}>
                  {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : `#${entry.rank}`}
                </span>
                <span style={{ fontSize: 14 }}>{entry.avatar}</span>
                <span style={{ fontSize: 12, fontWeight: entry.name === 'You' ? 700 : 500, color: entry.name === 'You' ? C.b : C.t1, fontFamily: F }}>
                  {entry.name}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.g, fontFamily: M, textAlign: 'right' }}>
                  +${entry.pnl.toLocaleString()}
                </span>
                <span style={{ fontSize: 10, color: C.t3, fontFamily: M, textAlign: 'right' }}>
                  {entry.winRate}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Button */}
      {!isCompleted && (
        <button
          onClick={() => isEntered ? onLeave(tournament.id) : onEnter(tournament.id)}
          style={{
            width: '100%', padding: '10px 0', borderRadius: 10, border: 'none',
            background: isEntered
              ? alpha(C.r, 0.1)
              : `linear-gradient(135deg, ${tournament.color}, ${alpha(tournament.color, 0.7)})`,
            color: isEntered ? C.r : '#fff',
            fontSize: 13, fontWeight: 700, fontFamily: F, cursor: 'pointer',
            transition: 'opacity 0.2s',
          }}
        >
          {isEntered ? '✕ Leave Tournament' : '🏆 Enter Tournament'}
        </button>
      )}
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────
export default function TournamentPanel() {
  const tournaments = useGamificationStore((s) => s.tournaments);
  const enterTournament = useGamificationStore((s) => s.enterTournament);
  const leaveTournament = useGamificationStore((s) => s.leaveTournament);
  const isEntered = useGamificationStore((s) => s.isEntered);

  const active = tournaments.filter((t) => t.status === 'active');
  const upcoming = tournaments.filter((t) => t.status === 'upcoming');
  const completed = tournaments.filter((t) => t.status === 'completed');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Active */}
      {active.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 20 }}>🔥</span>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.t1, fontFamily: F }}>Active Tournaments</h2>
            <span style={{
              fontSize: 11, fontWeight: 700, color: C.t3,
              background: alpha(C.t3, 0.1), padding: '3px 8px', borderRadius: 6, fontFamily: M,
            }}>
              {active.length}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 20 }}>
            {active.map((t) => (
              <TournamentCard key={t.id} tournament={t} onEnter={enterTournament} onLeave={leaveTournament} isEntered={isEntered(t.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 20 }}>📅</span>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.t1, fontFamily: F }}>Upcoming</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 20 }}>
            {upcoming.map((t) => (
              <TournamentCard key={t.id} tournament={t} onEnter={enterTournament} onLeave={leaveTournament} isEntered={isEntered(t.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 20 }}>✅</span>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.t1, fontFamily: F }}>Completed</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 20 }}>
            {completed.map((t) => (
              <TournamentCard key={t.id} tournament={t} onEnter={enterTournament} onLeave={leaveTournament} isEntered={isEntered(t.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
