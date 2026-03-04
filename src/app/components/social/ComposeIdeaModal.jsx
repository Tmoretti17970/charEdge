// ═══════════════════════════════════════════════════════════════════
// charEdge — Compose Idea Modal
//
// Full-screen modal for creating chart idea snapshots directly
// from the Social Hub. Includes symbol, timeframe, tags, and
// description fields.
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { logger } from '../../../utils/logger.ts';
import { C, F, M } from '../../../constants.js';
import { alpha } from '../../../utils/colorUtils.js';
import { useSocialStore } from '../../../state/useSocialStore.js';

const POPULAR_SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'LINK', 'DOT', 'MATIC'];
const TIMEFRAMES = ['1m', '5m', '15m', '1H', '4H', '1D', '1W'];
const POPULAR_TAGS = ['breakout', 'scalp', 'swing', 'orderflow', 'macro', 'accumulation', 'distribution', 'reversal', 'continuation', 'support', 'resistance'];

export default function ComposeIdeaModal({ open, onClose }) {
  const createSnapshot = useSocialStore((s) => s.createSnapshot);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [symbol, setSymbol] = useState('BTC');
  const [timeframe, setTimeframe] = useState('4H');
  const [selectedTags, setSelectedTags] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag].slice(0, 5)
    );
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);

    await createSnapshot({
      title: title.trim(),
      description: description.trim(),
      symbol,
      timeframe,
      chartType: 'candles',
      indicators: [],
      tags: selectedTags,
    });

    setSubmitting(false);
    setTitle('');
    setDescription('');
    setSelectedTags([]);
    onClose();

    // Success feedback
    logger.ui.info('✅ Idea posted to the feed!');
  };

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const isValid = title.trim().length >= 5 && description.trim().length >= 10;

  return (
    <div
      onClick={handleBackdrop}
      className="tf-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: alpha(C.bg, 0.85),
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        className="tf-fade-scale"
        style={{
          background: C.bg2,
          borderRadius: 20,
          border: `1px solid ${C.bd}`,
          width: '100%',
          maxWidth: 560,
          boxShadow: `0 24px 64px ${alpha(C.bg, 0.9)}`,
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 24px 16px',
            borderBottom: `1px solid ${C.bd}`,
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 800,
                color: C.t1,
                fontFamily: F,
              }}
            >
              Share Trade Idea
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: C.t3 }}>
              Post your chart analysis to the community feed
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              border: `1px solid ${C.bd}`,
              background: 'transparent',
              color: C.t2,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              transition: 'all 0.15s',
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            overflowY: 'auto',
          }}
        >
          {/* Symbol + Timeframe Row */}
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.t3,
                  fontFamily: F,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: 6,
                  display: 'block',
                }}
              >
                Symbol
              </label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {POPULAR_SYMBOLS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSymbol(s)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 6,
                      border: `1px solid ${symbol === s ? C.b : C.bd}`,
                      background: symbol === s ? alpha(C.b, 0.12) : 'transparent',
                      color: symbol === s ? C.b : C.t2,
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: M,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Timeframe */}
          <div>
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.t3,
                fontFamily: F,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 6,
                display: 'block',
              }}
            >
              Timeframe
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 6,
                    border: `1px solid ${timeframe === tf ? C.b : C.bd}`,
                    background: timeframe === tf ? alpha(C.b, 0.12) : 'transparent',
                    color: timeframe === tf ? C.b : C.t2,
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: M,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.t3,
                fontFamily: F,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 6,
                display: 'block',
              }}
            >
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. BTC breakout from 4h consolidation"
              maxLength={100}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 10,
                border: `1px solid ${C.bd}`,
                background: C.bg,
                color: C.t1,
                fontSize: 14,
                fontFamily: F,
                fontWeight: 600,
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => (e.target.style.borderColor = C.b)}
              onBlur={(e) => (e.target.style.borderColor = C.bd)}
            />
          </div>

          {/* Description */}
          <div>
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.t3,
                fontFamily: F,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 6,
                display: 'block',
              }}
            >
              Analysis
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your trade setup, entry/exit levels, and rationale..."
              rows={4}
              maxLength={500}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 10,
                border: `1px solid ${C.bd}`,
                background: C.bg,
                color: C.t1,
                fontSize: 13,
                fontFamily: F,
                lineHeight: 1.5,
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => (e.target.style.borderColor = C.b)}
              onBlur={(e) => (e.target.style.borderColor = C.bd)}
            />
            <div
              style={{
                textAlign: 'right',
                fontSize: 10,
                color: description.length > 450 ? C.y : C.t3,
                fontFamily: M,
                marginTop: 4,
              }}
            >
              {description.length}/500
            </div>
          </div>

          {/* Tags */}
          <div>
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.t3,
                fontFamily: F,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 6,
                display: 'block',
              }}
            >
              Tags <span style={{ fontWeight: 400, textTransform: 'none' }}>(up to 5)</span>
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {POPULAR_TAGS.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: `1px solid ${active ? C.cyan : C.bd}`,
                      background: active ? alpha(C.cyan, 0.1) : 'transparent',
                      color: active ? C.cyan : C.t3,
                      fontSize: 11,
                      fontWeight: 600,
                      fontFamily: F,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: `1px solid ${C.bd}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              borderRadius: 10,
              border: `1px solid ${C.bd}`,
              background: 'transparent',
              color: C.t2,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: F,
              transition: 'all 0.15s',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            style={{
              padding: '10px 24px',
              borderRadius: 10,
              border: 'none',
              background: isValid ? C.b : C.sf,
              color: isValid ? '#fff' : C.t3,
              fontSize: 13,
              fontWeight: 700,
              cursor: isValid ? 'pointer' : 'not-allowed',
              fontFamily: F,
              transition: 'all 0.2s',
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? 'Posting...' : '🚀 Post Idea'}
          </button>
        </div>
      </div>
    </div>
  );
}
