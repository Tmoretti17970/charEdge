import { useEffect, useState } from 'react';
import { C, F, M } from '../../../constants.js';
import { useSocialStore } from '../../../state/useSocialStore.js';
import CopyTradeModal from './CopyTradeModal.jsx';
import { alpha } from '../../../utils/colorUtils.js';

function StatBox({ label, value, isGreen, isRed }) {
  const color = isGreen ? C.g : isRed ? C.r : C.t1;
  return (
    <div
      style={{
        background: alpha(C.bd, 0.4),
        borderRadius: 12,
        padding: '16px 12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: C.t3,
          fontWeight: 700,
          fontFamily: F,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 18, fontWeight: 800, color, fontFamily: M }}>{value}</span>
    </div>
  );
}

export default function TraderProfileModal() {
  const { activeProfileId, setActiveProfile, fetchProfile, getCachedProfile } = useSocialStore();
  const following = useSocialStore((s) => s.following);
  const toggleFollow = useSocialStore((s) => s.toggleFollow);
  const isCopying = useSocialStore((s) => s.isCopying);
  const [copyTradeOpen, setCopyTradeOpen] = useState(false);

  useEffect(() => {
    if (activeProfileId) {
      fetchProfile(activeProfileId);
    }
  }, [activeProfileId]);

  if (!activeProfileId) return null;

  const profile = getCachedProfile(activeProfileId);

  // Close when clicking background
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      setActiveProfile(null);
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: alpha(C.bg, 0.8),
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          background: C.bg2,
          borderRadius: 20,
          border: `1px solid ${C.bd}`,
          width: '100%',
          maxWidth: 500,
          boxShadow: `0 20px 40px ${alpha(C.bg, 0.8)}`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header / Cover */}
        <div
          style={{
            height: 100,
            background: `linear-gradient(135deg, ${C.bd}, ${alpha(C.b, 0.2)})`,
            position: 'relative',
          }}
        >
          <button
            onClick={() => setActiveProfile(null)}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              background: alpha(C.bg, 0.5),
              border: 'none',
              color: C.t1,
              width: 32,
              height: 32,
              borderRadius: 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Profile Info */}
        <div style={{ padding: '0 24px 24px 24px', position: 'relative' }}>
          {/* Avatar (overlapping cover) */}
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: C.bg2,
              border: `4px solid ${C.bg2}`,
              marginTop: -40,
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 40,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              backgroundColor: alpha(C.b, 0.1),
            }}
          >
            {profile?.avatar || '👤'}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.t1, fontFamily: F }}>
                {profile?.displayName || profile?.username || 'Trader'}
              </h2>
              <div style={{ fontSize: 13, color: C.t3, fontFamily: M, marginTop: 4 }}>
                @{profile?.username || 'unknown'}
              </div>
            </div>
            <button
              onClick={() => toggleFollow(activeProfileId)}
              style={{
                padding: '8px 20px',
                borderRadius: 20,
                background: following.includes(activeProfileId) ? 'transparent' : C.b,
                color: following.includes(activeProfileId) ? C.b : '#fff',
                border: following.includes(activeProfileId) ? `1px solid ${C.b}` : 'none',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: F,
                transition: 'all 0.2s ease',
              }}
            >
              {following.includes(activeProfileId) ? '✓ Following' : 'Follow'}
            </button>
            {/* Copy Trade Button */}
            <button
              onClick={() => setCopyTradeOpen(true)}
              style={{
                padding: '8px 16px',
                borderRadius: 20,
                background: isCopying(activeProfileId) ? alpha(C.g, 0.1) : alpha(C.p, 0.12),
                color: isCopying(activeProfileId) ? C.g : C.p,
                border: 'none',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: F,
                transition: 'all 0.2s ease',
              }}
            >
              {isCopying(activeProfileId) ? '✓ Copying' : '📋 Copy Trades'}
            </button>
          </div>

          <p
            style={{
              marginTop: 16,
              fontSize: 14,
              color: C.t2,
              lineHeight: 1.5,
              fontFamily: F,
            }}
          >
            {profile?.bio || 'No bio provided.'}
          </p>

          {/* Joined Date */}
          <div style={{ marginTop: 12, fontSize: 12, color: C.t3, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Joined {profile?.joinedAt ? new Date(profile.joinedAt).toLocaleDateString() : 'Unknown'}
          </div>

          {/* Stats Grid */}
          {profile?.stats && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 12,
                marginTop: 24,
              }}
            >
              <StatBox
                label="Total PnL"
                value={`$${profile.stats.totalPnl.toLocaleString()}`}
                isGreen={profile.stats.totalPnl > 0}
                isRed={profile.stats.totalPnl < 0}
              />
              <StatBox
                label="Win Rate"
                value={`${profile.stats.winRate}%`}
                isGreen={profile.stats.winRate >= 50}
                isRed={profile.stats.winRate < 50}
              />
              <StatBox
                label="Sharpe"
                value={profile.stats.sharpe.toFixed(2)}
                isGreen={profile.stats.sharpe > 1.5}
                isRed={profile.stats.sharpe < 1.0}
              />
              <StatBox
                label="Profit Factor"
                value={profile.stats.profitFactor.toFixed(2)}
                isGreen={profile.stats.profitFactor >= 2}
                isRed={profile.stats.profitFactor < 1}
              />
              <StatBox
                label="Avg R:R"
                value={`1:${profile.stats.avgRR.toFixed(1)}`}
                isGreen={profile.stats.avgRR >= 2}
              />
              <StatBox label="Trades" value={profile.stats.tradeCount} />
            </div>
          )}

          {/* Equity Curve */}
          {profile?.stats && (() => {
            const w = 440, h = 80, pts = 30;
            const seed = [...(profile.username || 'x')].reduce((a, c) => a + c.charCodeAt(0), 0);
            const rng = (i) => ((seed * 9301 + i * 49297) % 233280) / 233280;
            const winBias = (profile.stats.winRate || 50) / 100;
            const vals = [1000];
            for (let i = 1; i < pts; i++) {
              const r = rng(i);
              const change = r < winBias ? rng(i + 100) * 200 : -rng(i + 200) * 150;
              vals.push(Math.max(200, vals[i - 1] + change));
            }
            const maxV = Math.max(...vals), minV = Math.min(...vals);
            const range = maxV - minV || 1;
            const points = vals.map((v, i) => `${(i / (pts - 1)) * w},${h - 6 - ((v - minV) / range) * (h - 12)}`).join(' ');
            const positive = vals[vals.length - 1] >= vals[0];
            const color = positive ? C.g : C.r;
            const areaPoints = `0,${h} ${points} ${w},${h}`;

            return (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, fontFamily: F, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                  30-Day Equity Curve
                </div>
                <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ borderRadius: 8, background: alpha(C.sf, 0.4), display: 'block' }}>
                  <defs>
                    <linearGradient id={`eq-grad-${profile.userId}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity="0.2" />
                      <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polygon points={areaPoints} fill={`url(#eq-grad-${profile.userId})`} />
                  <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            );
          })()}
        </div>
      </div>
      {/* Copy Trade Modal */}
      <CopyTradeModal
        open={copyTradeOpen}
        onClose={() => setCopyTradeOpen(false)}
        trader={profile ? { userId: profile.userId, name: profile.displayName || profile.username, avatar: profile.avatar } : null}
      />
    </div>
  );
}
