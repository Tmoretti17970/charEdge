// ═══════════════════════════════════════════════════════════════════
// charEdge — Publish Trade Modal (Journal → Social)
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { C, F, M } from '../../../constants.js';
import { alpha } from '../../../utils/colorUtils.js';
import { useSocialStore } from '../../../state/useSocialStore.js';

const TAGS = ['breakout', 'reversal', 'scalp', 'swing', 'momentum', 'mean-reversion', 'news-play', 'dip-buy'];

export default function PublishTradeModal({ open, onClose, trade }) {
  const [commentary, setCommentary] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [anonymize, setAnonymize] = useState(false);
  const [published, setPublished] = useState(false);
  const createSnapshot = useSocialStore((s) => s.createSnapshot);

  if (!open || !trade) return null;

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handlePublish = () => {
    createSnapshot({
      id: `snap_pub_${Date.now()}`,
      title: `${trade.side?.toUpperCase() || 'TRADE'} ${trade.symbol} — ${trade.pnl >= 0 ? 'Winner' : 'Lesson Learned'}`,
      description: commentary || `Shared from my trade journal: ${trade.symbol} ${trade.side} trade.`,
      symbol: trade.symbol,
      chartType: 'candles',
      timeframe: '1D',
      tags: selectedTags,
      pnl: anonymize ? null : trade.pnl,
      rMultiple: trade.rMultiple || null,
      side: trade.side,
      fromJournal: true,
      tradeId: trade.id,
    });
    setPublished(true);
    setTimeout(() => {
      setPublished(false);
      setCommentary('');
      setSelectedTags([]);
      onClose();
    }, 1500);
  };

  const overlay = {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  const modal = {
    background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 18,
    padding: 28, width: 480, maxWidth: '92vw',
    boxShadow: `0 24px 64px rgba(0,0,0,0.5)`,
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        {published ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🚀</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.g, fontFamily: F }}>Published!</div>
            <div style={{ fontSize: 12, color: C.t3, fontFamily: F, marginTop: 6 }}>Your trade is now live in the feed.</div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.t1, fontFamily: F }}>📤 Publish to Social Feed</div>
                <div style={{ fontSize: 12, color: C.t3, fontFamily: F, marginTop: 2 }}>Share this trade with the community</div>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.t3, fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>

            {/* Trade Summary Card */}
            <div style={{
              padding: 16, borderRadius: 12, background: C.sf,
              border: `1px solid ${C.bd}`, marginBottom: 20,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                    background: alpha(trade.side === 'long' ? C.g : C.r, 0.12),
                    color: trade.side === 'long' ? C.g : C.r,
                  }}>
                    {(trade.side || 'TRADE').toUpperCase()}
                  </span>
                  <span style={{ fontWeight: 700, color: C.t1, fontFamily: M, fontSize: 15 }}>{trade.symbol}</span>
                </div>
                <span style={{
                  fontSize: 18, fontWeight: 800, fontFamily: M,
                  color: (trade.pnl || 0) >= 0 ? C.g : C.r,
                }}>
                  {(trade.pnl || 0) >= 0 ? '+' : ''}${(trade.pnl || 0).toLocaleString()}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 20, fontSize: 11, color: C.t3, fontFamily: F }}>
                {trade.date && <span>📅 {new Date(trade.date).toLocaleDateString()}</span>}
                {trade.rMultiple && <span>🎯 {trade.rMultiple}R</span>}
                {trade.emotion && <span>{trade.emotion}</span>}
              </div>
            </div>

            {/* Commentary */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.t2, fontFamily: F, marginBottom: 6, display: 'block' }}>
                Add Commentary (optional)
              </label>
              <textarea
                value={commentary}
                onChange={(e) => setCommentary(e.target.value)}
                placeholder="Share your thought process, what you learned, or key takeaways..."
                style={{
                  width: '100%', minHeight: 80, padding: 12, borderRadius: 10,
                  border: `1px solid ${C.bd}`, background: C.sf, color: C.t1,
                  fontSize: 13, fontFamily: F, outline: 'none', resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Tags */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.t2, fontFamily: F, marginBottom: 8, display: 'block' }}>Tags</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {TAGS.map((tag) => {
                  const selected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      style={{
                        padding: '4px 12px', borderRadius: 20,
                        border: `1px solid ${selected ? C.b : C.bd}`,
                        background: selected ? alpha(C.b, 0.1) : 'transparent',
                        color: selected ? C.b : C.t3,
                        fontSize: 11, fontWeight: 600, fontFamily: F,
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      #{tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Privacy */}
            <div style={{ marginBottom: 24 }}>
              <label
                style={{ fontSize: 12, fontWeight: 600, color: C.t2, fontFamily: F, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                onClick={() => setAnonymize(!anonymize)}
              >
                <div style={{
                  width: 36, height: 20, borderRadius: 10, padding: 2,
                  background: anonymize ? C.p : C.bd,
                  transition: 'background 0.2s', display: 'flex', alignItems: 'center',
                }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', background: '#fff',
                    transform: anonymize ? 'translateX(16px)' : 'translateX(0)',
                    transition: 'transform 0.2s',
                  }} />
                </div>
                Hide P&L amounts (anonymize)
              </label>
            </div>

            {/* Publish Button */}
            <button
              onClick={handlePublish}
              style={{
                width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
                background: `linear-gradient(135deg, ${C.g}, ${C.cyan})`,
                color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: F,
                cursor: 'pointer', transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              🚀 Publish to Feed
            </button>
          </>
        )}
      </div>
    </div>
  );
}
