// ═══════════════════════════════════════════════════════════════════
// charEdge — Following Feed
//
// Filtered feed showing only chart ideas from followed traders.
// Falls back to a prompt to follow traders if list is empty.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react';
import { C, F, M } from '../../../constants.js';
import { MOCK_SNAPSHOTS, MOCK_PROFILES } from '../../../data/socialMockData.js';
import { useSocialStore } from '../../../state/useSocialStore.js';
import { alpha } from '@/shared/colorUtils';

export default function FollowingFeed({ _zenMode = false }) {
  const following = useSocialStore((s) => s.following);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    const t = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  // Filter snapshots to only followed users
  const followedSnapshots = useMemo(() => {
    if (following.length === 0) return [];
    return MOCK_SNAPSHOTS.filter((snap) => following.includes(snap.authorId));
  }, [following]);

  if (loading) {
    return (
      <div
        style={{
          height: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: C.t3,
          fontSize: 13,
          fontFamily: F,
        }}
      >
        Loading your feed...
      </div>
    );
  }

  if (following.length === 0) {
    return (
      <div
        style={{
          padding: '48px 32px',
          textAlign: 'center',
          background: C.bg2,
          borderRadius: 16,
          border: `1px solid ${C.bd}`,
        }}
      >
        <div className="tf-empty-float" style={{ fontSize: 48, marginBottom: 16 }}>👥</div>
        <h3
          style={{
            margin: '0 0 8px 0',
            fontSize: 18,
            fontWeight: 800,
            color: C.t1,
            fontFamily: F,
          }}
        >
          Build Your Alpha Network
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: C.t3, lineHeight: 1.6, maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
          Follow top traders from the Alpha Board to curate your own personalized feed of chart ideas and trade setups.
        </p>
        <div style={{ fontSize: 11, color: C.t3, fontFamily: M }}>👈 Check the Alpha Board sidebar to start following</div>
      </div>
    );
  }

  if (followedSnapshots.length === 0) {
    return (
      <div
        style={{
          padding: '48px 32px',
          textAlign: 'center',
          background: C.bg2,
          borderRadius: 16,
          border: `1px solid ${C.bd}`,
        }}
      >
        <div className="tf-empty-float" style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
        <h3
          style={{
            margin: '0 0 8px 0',
            fontSize: 18,
            fontWeight: 800,
            color: C.t1,
            fontFamily: F,
          }}
        >
          No Posts Yet
        </h3>
        <p style={{ margin: 0, fontSize: 13, color: C.t3, lineHeight: 1.6, maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>
          The traders you follow haven't posted chart ideas yet. Switch to the "All" tab to explore what the community is sharing.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 12, color: C.t3, fontFamily: F, fontWeight: 600 }}>
        Showing ideas from {following.length} followed trader{following.length !== 1 ? 's' : ''}
      </div>

      {followedSnapshots.map((snap) => {
        const author = MOCK_PROFILES.find((p) => p.id === snap.authorId);
        if (!author) return null;

        return (
          <div
            key={snap.id}
            style={{
              background: C.bg2,
              borderRadius: 14,
              border: `1px solid ${C.bd}`,
              padding: 20,
              transition: 'border-color 0.2s',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.b)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.bd)}
          >
            {/* Author Row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: alpha(C.b, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                }}
              >
                {author.avatar}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F }}>
                  {author.displayName}
                </div>
                <div style={{ fontSize: 11, color: C.t3, fontFamily: M }}>
                  @{author.username} · {snap.symbol} · {snap.timeframe}
                </div>
              </div>
              <div style={{ flex: 1 }} />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: C.b,
                  background: alpha(C.b, 0.08),
                  padding: '3px 8px',
                  borderRadius: 6,
                  fontFamily: F,
                }}
              >
                Following
              </span>
            </div>

            {/* Content */}
            <h4
              style={{
                margin: '0 0 8px 0',
                fontSize: 15,
                fontWeight: 700,
                color: C.t1,
                fontFamily: F,
              }}
            >
              {snap.title}
            </h4>
            <p
              style={{
                margin: '0 0 12px 0',
                fontSize: 13,
                color: C.t2,
                lineHeight: 1.5,
              }}
            >
              {snap.description}
            </p>

            {/* Tags */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {snap.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: C.t2,
                    background: alpha(C.t3, 0.08),
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontFamily: M,
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>

            {/* Engagement */}
            <div
              style={{
                display: 'flex',
                gap: 16,
                fontSize: 12,
                color: C.t3,
                fontFamily: M,
                fontWeight: 600,
              }}
            >
              <span>❤️ {snap.likes}</span>
              <span>💬 {snap.commentCount}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
