import { useEffect, useState } from 'react';
import { C, F } from '../../../constants.js';
import { fetchTopPosts } from '../../../services/socialService.js';
import { alpha } from '../../../utils/colorUtils.js';

function TrustBadge({ score }) {
  if (!score) return null;
  const isElite = score >= 90;
  return (
    <div
      style={{
        padding: '2px 6px',
        borderRadius: 4,
        background: isElite ? alpha(C.p, 0.15) : alpha(C.b, 0.1),
        color: isElite ? C.p : C.b,
        fontSize: 10,
        fontWeight: 800,
        fontFamily: F,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        border: `1px solid ${isElite ? alpha(C.p, 0.3) : alpha(C.b, 0.2)}`,
        boxShadow: isElite ? `0 0 8px ${alpha(C.p, 0.4)}` : 'none',
      }}
      title={`Trust Score: ${score}/100`}
    >
      {isElite ? '💎' : '✓'} {score}
    </div>
  );
}

export default function TopPostsFeed({ category = 'all', zenMode = false }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchTopPosts(category).then((res) => {
      setPosts(res);
      setLoading(false);
    });
  }, [category]);

  if (loading) {
    return <div style={{ padding: 20, color: C.t3, textAlign: 'center' }}>Loading top posts...</div>;
  }

  const displayPosts = zenMode
    ? posts.filter((post) => {
        const score = post.author.trustScore || (60 + (post.author.name.length * 5) % 40);
        return score >= 80;
      })
    : posts;

  if (displayPosts.length === 0) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h3
        style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 700,
          color: C.t1,
          fontFamily: F,
          paddingBottom: 8,
          borderBottom: `1px solid ${C.bd}`,
        }}
      >
        Top Alpha Posts
      </h3>
      {displayPosts.map((post) => {
        const trustScore = post.author.trustScore || (60 + (post.author.name.length * 5) % 40);
        return (
          <div
            key={post.id}
            style={{
              background: C.bg2,
              border: `1px solid ${C.bd}`,
              borderRadius: 12,
              padding: 16,
              transition: 'border-color 0.2s ease',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.b)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.bd)}
          >
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <img
                src={post.author.avatar}
                alt={post.author.name}
                style={{ width: 40, height: 40, borderRadius: '50%' }}
              />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 700, color: C.t1, fontSize: 14 }}>{post.author.name}</span>
                  {post.author.verified && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={C.b} style={{ marginTop: 2 }}>
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                    </svg>
                  )}
                  {trustScore > 0 && <TrustBadge score={trustScore} />}
                </div>
                <div style={{ fontSize: 13, color: C.t3 }}>
                  {post.author.handle} • {post.timeAgo}
                </div>
              </div>
            </div>
            <p style={{ margin: '0 0 12px 0', color: C.t1, fontSize: 14, lineHeight: 1.5, fontFamily: F }}>
              {post.content}
            </p>
            <div style={{ display: 'flex', gap: 20, color: C.t3, fontSize: 13, fontWeight: 600 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
                {post.replies}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="17 1 21 5 17 9" />
                  <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                  <polyline points="7 23 3 19 7 15" />
                  <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                </svg>
                {post.reposts}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                {post.likes}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
