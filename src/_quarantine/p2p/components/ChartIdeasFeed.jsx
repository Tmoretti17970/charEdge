import React from 'react';
import { useEffect, useState } from 'react';
import { C, F, M } from '../../../constants.js';
import { MOCK_COMMENTS, MOCK_PROFILES } from '../../../data/socialMockData.js';
import { useSocialStore } from '../../../state/useSocialStore.js';
import { alpha } from '@/shared/colorUtils';
import s from './ChartIdeasFeed.module.css';

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

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

// ─── Mini Chart Thumbnail ───────────────────────────────────
function MiniChart({ symbol, width = 320, height = 80 }) {
  // Generate a deterministic pseudo-random chart based on symbol
  const seed = [...symbol].reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng = (i) => ((seed * 9301 + i * 49297) % 233280) / 233280;

  const bars = 24;
  const barW = width / bars;
  const prices = [];
  let price = 40 + rng(0) * 30;

  for (let i = 0; i < bars; i++) {
    const open = price;
    const change = (rng(i * 3 + 1) - 0.45) * 6;
    const close = Math.max(5, open + change);
    const high = Math.max(open, close) + rng(i * 3 + 2) * 4;
    const low = Math.min(open, close) - rng(i * 3 + 3) * 4;
    prices.push({ open, close, high: Math.max(high, 5), low: Math.max(low, 2) });
    price = close;
  }

  const allHigh = Math.max(...prices.map((p) => p.high));
  const allLow = Math.min(...prices.map((p) => p.low));
  const range = allHigh - allLow || 1;
  const yScale = (v) => height - 6 - ((v - allLow) / range) * (height - 12);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ borderRadius: 8, background: alpha(C.sf, 0.6) }}
    >
      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((pct) => (
        <line
          key={pct}
          x1={0} y1={height * pct} x2={width} y2={height * pct}
          stroke={alpha(C.bd, 0.3)} strokeWidth={0.5}
        />
      ))}
      {/* Candles */}
      {prices.map((bar, i) => {
        const x = i * barW + barW * 0.5;
        const bullish = bar.close >= bar.open;
        const color = bullish ? C.g : C.r;
        return (
          <g key={i}>
            {/* Wick */}
            <line
              x1={x} y1={yScale(bar.high)} x2={x} y2={yScale(bar.low)}
              stroke={color} strokeWidth={1} opacity={0.6}
            />
            {/* Body */}
            <rect
              x={x - barW * 0.3}
              y={yScale(Math.max(bar.open, bar.close))}
              width={barW * 0.6}
              height={Math.max(1, Math.abs(yScale(bar.open) - yScale(bar.close)))}
              fill={color}
              rx={1}
              opacity={0.85}
            />
          </g>
        );
      })}
    </svg>
  );
}

// ─── Reaction Emoji Button ──────────────────────────────────
const REACTIONS = ['🔥', '📈', '📉', '💎', '🧠'];

function ReactionBar({ _snapshotId }) {
  const [reactions, setReactions] = useState({});
  const [myReaction, setMyReaction] = useState(null);

  const handleReact = (emoji) => {
    setReactions((prev) => {
      const next = { ...prev };
      if (myReaction === emoji) {
        // Undo
        next[emoji] = Math.max(0, (next[emoji] || 1) - 1);
        setMyReaction(null);
      } else {
        // Switch reaction
        if (myReaction) next[myReaction] = Math.max(0, (next[myReaction] || 1) - 1);
        next[emoji] = (next[emoji] || 0) + 1;
        setMyReaction(emoji);
      }
      return next;
    });
  };

  return (
    <div className={s.s0}>
      {REACTIONS.map((emoji) => {
        const count = reactions[emoji] || 0;
        const active = myReaction === emoji;
        return (
          <button
            key={emoji}
            onClick={(e) => { e.stopPropagation(); handleReact(emoji); }}
            className="tf-reaction-pop"
            style={{
              padding: '3px 8px',
              borderRadius: 20,
              border: `1px solid ${active ? C.b : C.bd}`,
              background: active ? alpha(C.b, 0.1) : 'transparent',
              cursor: 'pointer',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'all 0.15s',
            }}
          >
            {emoji}
            {count > 0 && (
              <span style={{ fontSize: 10, color: C.t2, fontFamily: M, fontWeight: 700 }}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Rich Empty State ───────────────────────────────────────
function EmptyFeedState({ zenMode, onPostIdea }) {
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
      <div className={`tf-empty-float ${s.s1}`}>
        {zenMode ? '🔭' : '💡'}
      </div>
      <h3
        style={{
          margin: '0 0 8px',
          fontSize: 18,
          fontWeight: 800,
          color: C.t1,
          fontFamily: F,
        }}
      >
        {zenMode ? 'No High-Signal Ideas Yet' : 'Be the First to Share'}
      </h3>
      <p
        style={{
          margin: '0 0 20px',
          fontSize: 13,
          color: C.t3,
          lineHeight: 1.5,
          maxWidth: 360,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        {zenMode
          ? 'Zen Mode filters for top-rated traders only. Try expanding your trusted network.'
          : 'Post your chart analysis and trade setups to help the community find alpha.'}
      </p>
      {!zenMode && onPostIdea && (
        <button
          onClick={onPostIdea}
          style={{
            padding: '10px 24px',
            borderRadius: 10,
            border: 'none',
            background: C.b,
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: F,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.04)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          Share Your First Idea →
        </button>
      )}
    </div>
  );
}

function SnapshotCard({ snapshot, profile, onLike, onProfileClick, onBookmark, isBookmarked, index = 0 }) {
  const [showComments, setShowComments] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [localComments, setLocalComments] = useState([]);
  const [copied, setCopied] = useState(false);

  const trustScore = profile?.trustScore || (profile ? 60 + (profile.username.length * 5) % 40 : 0);

  const snapshotComments = [
    ...MOCK_COMMENTS.filter((c) => c.snapshotId === snapshot.id),
    ...localComments,
  ];

  const handleReply = () => {
    if (!replyText.trim()) return;
    setLocalComments((prev) => [
      ...prev,
      {
        id: `local_${Date.now()}`,
        snapshotId: snapshot.id,
        authorId: 'user_local',
        text: replyText.trim(),
        createdAt: Date.now(),
      },
    ]);
    setReplyText('');
  };

  const handleShare = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`https://charEdge.app/ideas/${snapshot.id}`).catch(() => {}); // intentional: clipboard is best-effort
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`tf-social-card tf-social-card-hover tf-social-stagger-${Math.min(index, 7)}`}
      style={{
        background: C.bg2,
        border: `1px solid ${C.bd}`,
        borderRadius: 14,
        padding: 20,
        cursor: 'pointer',
      }}
    >
      {/* Author row */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onProfileClick(snapshot.authorId);
        }}
        className={s.s2}
        onMouseEnter={(e) => (e.currentTarget.style.background = alpha(C.t3, 0.1))}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${C.b}40, ${C.p}40)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
          }}
        >
          {profile?.avatar || '👤'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F, display: 'flex', alignItems: 'center', gap: 6 }}>
            {profile?.displayName || profile?.username || 'Unknown'}
            {trustScore > 0 && <TrustBadge score={trustScore} />}
          </div>
          <div style={{ fontSize: 11, color: C.t3, fontFamily: M }}>
            @{profile?.username || 'unknown'} • {timeAgo(snapshot.createdAt)}
          </div>
        </div>
        <div
          style={{
            padding: '4px 10px',
            borderRadius: 6,
            background: alpha(C.b, 0.12),
            color: C.b,
            fontSize: 12,
            fontWeight: 700,
            fontFamily: M,
          }}
        >
          {snapshot.symbol}
        </div>
      </div>

      {/* Title */}
      <h4 style={{ margin: '0 0 8px 0', fontSize: 15, fontWeight: 700, color: C.t1, fontFamily: F, lineHeight: 1.4 }}>
        {snapshot.title}
      </h4>

      {/* Description */}
      <p
        style={{
          margin: '0 0 14px 0', fontSize: 13, color: C.t2, lineHeight: 1.5, fontFamily: F,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}
      >
        {snapshot.description}
      </p>

      {/* Chart Thumbnail */}
      <div style={{ marginBottom: 14 }}>
        <MiniChart symbol={snapshot.symbol} />
      </div>

      {/* Indicators & Timeframe */}
      <div className={s.s3}>
        <span style={{ padding: '3px 8px', borderRadius: 5, background: C.sf, color: C.t2, fontSize: 10, fontWeight: 600, fontFamily: M }}>
          {snapshot.timeframe}
        </span>
        {snapshot.indicators?.map((ind, i) => (
          <span key={i} style={{ padding: '3px 8px', borderRadius: 5, background: alpha(ind.color || C.p, 0.12), color: ind.color || C.p, fontSize: 10, fontWeight: 600, fontFamily: M }}>
            {ind.type.toUpperCase()}
          </span>
        ))}
      </div>

      {/* Tags */}
      {snapshot.tags?.length > 0 && (
        <div className={s.s4}>
          {snapshot.tags.map((tag) => (
            <span key={tag} style={{ padding: '2px 8px', borderRadius: 4, background: alpha(C.cyan, 0.08), color: C.cyan, fontSize: 10, fontWeight: 600, fontFamily: F }}>
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer: Like, Comment, Bookmark, Share */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          paddingTop: 12,
          borderTop: `1px solid ${C.bd}`,
          color: C.t3,
          fontSize: 12,
          fontWeight: 600,
          alignItems: 'center',
        }}
      >
        {/* Like */}
        <span
          onClick={(e) => { e.stopPropagation(); onLike(snapshot.id); }}
          className={s.s5}
          onMouseEnter={(e) => (e.currentTarget.style.color = C.r)}
          onMouseLeave={(e) => (e.currentTarget.style.color = C.t3)}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          {snapshot.likes}
        </span>

        {/* Comment */}
        <span
          onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }}
          style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', transition: 'color 0.15s', color: showComments ? C.b : C.t3 }}
          onMouseEnter={(e) => { if (!showComments) e.currentTarget.style.color = C.b; }}
          onMouseLeave={(e) => { if (!showComments) e.currentTarget.style.color = C.t3; }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          {snapshotComments.length}
        </span>

        {/* Bookmark */}
        <span
          onClick={(e) => { e.stopPropagation(); onBookmark(snapshot.id); }}
          style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', transition: 'color 0.15s', color: isBookmarked ? C.y : C.t3 }}
          onMouseEnter={(e) => { if (!isBookmarked) e.currentTarget.style.color = C.y; }}
          onMouseLeave={(e) => { if (!isBookmarked) e.currentTarget.style.color = isBookmarked ? C.y : C.t3; }}
          title={isBookmarked ? 'Saved' : 'Save for later'}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill={isBookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </span>

        {/* Share */}
        <span
          onClick={handleShare}
          className={s.s6}
          onMouseEnter={(e) => (e.currentTarget.style.color = C.b)}
          onMouseLeave={(e) => (e.currentTarget.style.color = C.t3)}
          title="Copy link"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          <span style={{ fontSize: 11 }}>{copied ? 'Copied!' : 'Share'}</span>
        </span>
      </div>

      {/* Comment Thread */}
      {showComments && (
        <div
          className="tf-comment-expand"
          style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: `1px solid ${C.bd}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {snapshotComments.length === 0 ? (
            <div style={{ fontSize: 12, color: C.t3, fontFamily: F, textAlign: 'center', padding: 12 }}>
              No comments yet. Be the first!
            </div>
          ) : (
            snapshotComments.map((comment) => {
              const commentAuthor = MOCK_PROFILES.find((p) => p.id === comment.authorId);
              return (
                <div
                  key={comment.id}
                  style={{
                    display: 'flex',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: alpha(C.sf, 0.4),
                  }}
                >
                  <div
                    style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: alpha(C.b, 0.1), display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, flexShrink: 0,
                    }}
                  >
                    {commentAuthor?.avatar || '👤'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className={s.s7}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: F }}>
                        {commentAuthor?.displayName || commentAuthor?.username || 'You'}
                      </span>
                      <span style={{ fontSize: 10, color: C.t3, fontFamily: M }}>
                        {timeAgo(comment.createdAt)}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.4 }}>{comment.text}</div>
                    {/* Reaction bar on each comment */}
                    <ReactionBar snapshotId={comment.id} />
                  </div>
                </div>
              );
            })
          )}

          {/* Reply Input */}
          <div className={s.s8}>
            <div
              style={{
                width: 28, height: 28, borderRadius: '50%',
                background: alpha(C.b, 0.1), display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 14, flexShrink: 0,
              }}
            >
              🔥
            </div>
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleReply(); }}
              placeholder="Add a comment..."
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 8,
                border: `1px solid ${C.bd}`, background: C.bg,
                color: C.t1, fontSize: 12, fontFamily: F, outline: 'none',
              }}
            />
            <button
              onClick={handleReply}
              disabled={!replyText.trim()}
              style={{
                padding: '6px 14px', borderRadius: 8, border: 'none',
                background: replyText.trim() ? C.b : C.sf,
                color: replyText.trim() ? '#fff' : C.t3,
                fontSize: 12, fontWeight: 700, cursor: replyText.trim() ? 'pointer' : 'default',
                fontFamily: F, transition: 'all 0.15s',
              }}
            >
              Reply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChartIdeasFeed({ zenMode = false, onPostIdea }) {
  const {
    feed,
    feedLoading,
    feedSort,
    feedTotal,
    loadFeed,
    setFeedSort,
    toggleLike,
    fetchProfile,
    profileCache,
    setActiveProfile,
    toggleBookmark,
    bookmarks,
  } = useSocialStore();

  const [profilesFetched, setProfilesFetched] = useState(false);

  useEffect(() => {
    loadFeed({ reset: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (feed.length > 0 && !profilesFetched) {
      const authorIds = [...new Set(feed.map((s) => s.authorId))];
      authorIds.forEach((id) => fetchProfile(id));
      setProfilesFetched(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed, profilesFetched]);

  const displayFeed = zenMode
    ? feed.filter((snapshot) => {
        const profile = profileCache[snapshot.authorId];
        const score = profile?.trustScore || (profile ? 60 + (profile.username.length * 5) % 40 : 0);
        return score >= 80;
      })
    : feed;

  return (
    <div className={s.s9}>
      {/* Header */}
      <div className={s.s10}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: F }}>
          💡 Chart Ideas
        </h3>
        <div className={s.s11}>
          {['recent', 'popular'].map((s) => (
            <button
              key={s}
              onClick={() => setFeedSort(s)}
              style={{
                padding: '5px 12px', borderRadius: 8,
                border: `1px solid ${feedSort === s ? C.b : C.bd}`,
                background: feedSort === s ? alpha(C.b, 0.12) : 'transparent',
                color: feedSort === s ? C.b : C.t3,
                cursor: 'pointer', fontSize: 11, fontWeight: 700,
                fontFamily: F, textTransform: 'capitalize', transition: 'all 0.2s',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      {feedLoading ? (
        <div style={{ padding: 40, textAlign: 'center', color: C.t3, fontSize: 13 }}>Loading chart ideas...</div>
      ) : displayFeed.length === 0 ? (
        <EmptyFeedState zenMode={zenMode} onPostIdea={onPostIdea} />
      ) : (
        <div className={s.s12}>
          {displayFeed.map((snapshot, i) => (
            <SnapshotCard
              key={snapshot.id}
              snapshot={snapshot}
              profile={profileCache[snapshot.authorId]}
              onLike={toggleLike}
              onProfileClick={setActiveProfile}
              onBookmark={toggleBookmark}
              isBookmarked={bookmarks.includes(snapshot.id)}
              index={i}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {feed.length < feedTotal && !feedLoading && (
        <button
          onClick={() => loadFeed()}
          className="tf-btn"
          style={{
            padding: '10px 20px', borderRadius: 10,
            border: `1px solid ${C.bd}`, background: 'transparent',
            color: C.t2, cursor: 'pointer', fontSize: 13,
            fontWeight: 600, fontFamily: F, transition: 'all 0.2s',
            alignSelf: 'center',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.b; e.currentTarget.style.color = C.b; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.bd; e.currentTarget.style.color = C.t2; }}
        >
          Load More Ideas
        </button>
      )}
    </div>
  );
}

export default React.memo(ChartIdeasFeed);
