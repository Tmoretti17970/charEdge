import { useSocialStore } from '../../../state/useSocialStore.js';
import { useState } from 'react';
import { C, F, M } from '../../../constants.js';

export default function PollCard({ pollId, compact = false, inFeed = false }) {
  const { polls, userVotes, vote } = useSocialStore();
  const [hovered, setHovered] = useState(false);

  const poll = polls.find((p) => p.id === pollId);
  if (!poll) return null;

  const hasVoted = !!userVotes[pollId];
  const selectedOptionId = userVotes[pollId];

  const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);

  const handleVote = (optionId) => {
    if (!hasVoted) {
      vote(pollId, optionId);
    }
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: inFeed ? C.bg2 : C.bg,
        border: `1px solid ${inFeed && hovered ? C.b : C.bd}`,
        borderRadius: inFeed ? 14 : 12,
        padding: compact ? 16 : (inFeed ? 20 : 24),
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 12 : 16,
        transition: 'all 0.2s ease',
        transform: inFeed && hovered ? 'translateY(-2px)' : 'none',
        boxShadow: inFeed && hovered ? `0 6px 20px ${C.bg}66` : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {inFeed && (
            <div style={{ fontSize: 11, fontWeight: 700, color: C.p, fontFamily: F, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              🎯 Prediction Market
            </div>
          )}
          <h3
            style={{
              margin: 0,
              fontFamily: F,
              fontSize: compact ? 14 : 16,
              fontWeight: 600,
              color: C.t1,
              lineHeight: 1.4,
            }}
          >
            {poll.question}
          </h3>
        </div>
        {!compact && poll.ticker && (
          <span
            style={{
              background: C.sf,
              color: C.t2,
              padding: '4px 8px',
              borderRadius: 6,
              fontSize: 12,
              fontFamily: M,
              fontWeight: 700,
            }}
          >
            {poll.ticker}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {poll.options.map((opt) => {
          const isSelected = selectedOptionId === opt.id;
          const percentage = totalVotes > 0 ? ((opt.votes / totalVotes) * 100).toFixed(1) : 0;
          const multiplier = percentage > 0 ? (100 / percentage).toFixed(2) : 0;

          return (
            <button
              key={opt.id}
              onClick={() => handleVote(opt.id)}
              disabled={hasVoted}
              style={{
                position: 'relative',
                width: '100%',
                padding: compact ? '8px 12px' : '12px 16px',
                background: isSelected ? C.b + '15' : C.sf,
                border: `1px solid ${isSelected ? C.b : C.bd}`,
                borderRadius: 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: hasVoted ? 'default' : 'pointer',
                overflow: 'hidden',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!hasVoted) e.currentTarget.style.borderColor = C.t3;
              }}
              onMouseLeave={(e) => {
                if (!hasVoted) e.currentTarget.style.borderColor = isSelected ? C.b : C.bd;
              }}
            >
              {/* Always show progress bar to indicate odds/volume */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: `${Math.round(percentage)}%`,
                  background: isSelected ? C.b : C.t3,
                  opacity: 0.15,
                  zIndex: 0,
                  transition: 'width 0.5s ease-out',
                }}
              />

              <div
                style={{
                  position: 'relative',
                  zIndex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                }}
              >
                <span
                  style={{
                    fontFamily: F,
                    fontSize: compact ? 13 : 14,
                    fontWeight: isSelected ? 700 : 600,
                    color: isSelected ? C.b : C.t1,
                  }}
                >
                  {opt.label}
                </span>
                {!compact && (
                  <span style={{ fontSize: 11, color: C.t3, marginTop: 4 }}>{opt.votes.toLocaleString()} votes</span>
                )}
              </div>

              <div
                style={{
                  position: 'relative',
                  zIndex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                }}
              >
                <span
                  style={{
                    fontFamily: M,
                    fontSize: compact ? 12 : 14,
                    fontWeight: 700,
                    color: isSelected ? C.b : C.t1,
                  }}
                >
                  {percentage}%
                </span>
                {!compact && (
                  <span style={{ fontSize: 11, color: percentage > 50 ? C.up : C.t2, marginTop: 4, fontWeight: 600 }}>
                    {multiplier}x Payout
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          fontFamily: M,
          color: C.t3,
          marginTop: compact ? 0 : 4,
        }}
      >
        <span>{totalVotes.toLocaleString()} votes</span>
        {poll.status === 'active' ? (
          <span>Ends {new Date(poll.expiresAt).toLocaleDateString()}</span>
        ) : (
          <span>Resolved</span>
        )}
      </div>
    </div>
  );
}
