// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Share Snapshot Modal
//
// Modal for sharing the current chart view to the community feed.
// Captures: chart config (symbol, tf, type, indicators), title,
// description, and tags.
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import { C, M } from '../../../constants.js';
import { useSocialStore } from '../../../state/useSocialStore.js';
import { space, radii, text, transition, preset } from '../../../theme/tokens.js';
import { Btn } from '../../components/ui/UIKit.jsx';

const SUGGESTED_TAGS = [
  'btc',
  'eth',
  'sol',
  'breakout',
  'scalp',
  'swing',
  'macro',
  'structure',
  'orderflow',
  'volume',
  'meanreversion',
  'compression',
  'watchlist',
  'algo',
  'trendfollow',
];

/**
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {Object} props.chartConfig - { symbol, tf, chartType, indicators }
 */
export default function ShareSnapshotModal({ isOpen, onClose, chartConfig }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);
  const createSnapshot = useSocialStore((s) => s.createSnapshot);

  const handleShare = useCallback(async () => {
    if (!title.trim()) return;
    setSharing(true);

    const res = await createSnapshot({
      title: title.trim(),
      description: description.trim(),
      symbol: chartConfig?.symbol || 'BTC',
      timeframe: chartConfig?.tf || '3m',
      chartType: chartConfig?.chartType || 'candles',
      indicators: chartConfig?.indicators || [],
      tags,
    });

    setSharing(false);
    if (res.ok) {
      setShared(true);
      setTimeout(() => {
        setShared(false);
        setTitle('');
        setDescription('');
        setTags([]);
        onClose();
      }, 1200);
    }
  }, [title, description, tags, chartConfig, createSnapshot, onClose]);

  const addTag = useCallback(
    (tag) => {
      const clean = tag.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (clean && !tags.includes(clean) && tags.length < 5) {
        setTags([...tags, clean]);
      }
      setTagInput('');
    },
    [tags],
  );

  const removeTag = useCallback(
    (tag) => {
      setTags(tags.filter((t) => t !== tag));
    },
    [tags],
  );

  const handleTagKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        if (tagInput.trim()) addTag(tagInput.trim());
      }
    },
    [tagInput, addTag],
  );

  if (!isOpen) return null;

  return (
    <>
      <div style={preset.overlay} onClick={onClose} />
      <div
        style={{
          ...preset.modal,
          width: 480,
          maxWidth: '92vw',
          padding: 0,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: `${space[4]}px ${space[5]}px`,
            borderBottom: `1px solid ${C.bd}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={text.h2}>📤 Share to Community</h2>
          <button
            className="tf-btn"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: C.t3, fontSize: 18, cursor: 'pointer' }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: `${space[4]}px ${space[5]}px` }}>
          {/* Chart config preview */}
          <div
            style={{
              display: 'flex',
              gap: space[2],
              marginBottom: space[4],
              padding: space[2],
              background: C.sf2,
              borderRadius: radii.md,
            }}
          >
            <span style={{ ...preset.badge, background: C.b + '20', color: C.b, fontWeight: 800 }}>
              {chartConfig?.symbol || 'BTC'}
            </span>
            <span style={{ ...text.monoXs, color: C.t3, alignSelf: 'center' }}>{chartConfig?.tf || '3m'}</span>
            <span style={{ ...text.captionSm, color: C.t3, alignSelf: 'center' }}>
              {chartConfig?.chartType || 'candles'}
            </span>
            {chartConfig?.indicators?.length > 0 && (
              <span style={{ ...text.captionSm, color: C.t3, alignSelf: 'center', marginLeft: 'auto' }}>
                {chartConfig.indicators.length} indicator{chartConfig.indicators.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Title */}
          <div style={{ marginBottom: space[3] }}>
            <label style={{ ...text.label, display: 'block', marginBottom: space[1] }}>Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's the trade idea?"
              maxLength={100}
              style={{ ...preset.input, fontWeight: 600 }}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: space[3] }}>
            <label style={{ ...text.label, display: 'block', marginBottom: space[1] }}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain your thesis, setup, entry/exit criteria..."
              rows={3}
              maxLength={500}
              style={{ ...preset.input, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          {/* Tags */}
          <div style={{ marginBottom: space[3] }}>
            <label style={{ ...text.label, display: 'block', marginBottom: space[1] }}>Tags ({tags.length}/5)</label>

            {/* Current tags */}
            {tags.length > 0 && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: space[2] }}>
                {tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: 10,
                      fontFamily: M,
                      color: C.b,
                      background: C.b + '15',
                      padding: '3px 8px',
                      borderRadius: radii.pill,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    #{tag}
                    <button
                      className="tf-btn"
                      onClick={() => removeTag(tag)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: C.b,
                        fontSize: 10,
                        cursor: 'pointer',
                        padding: 0,
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Tag input */}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder="Add a tag..."
              style={{ ...preset.input, fontSize: 11, marginBottom: space[2] }}
            />

            {/* Suggested */}
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {SUGGESTED_TAGS.filter((t) => !tags.includes(t))
                .slice(0, 8)
                .map((tag) => (
                  <button
                    className="tf-btn"
                    key={tag}
                    onClick={() => addTag(tag)}
                    style={{
                      fontSize: 9,
                      fontFamily: M,
                      color: C.t3,
                      background: C.sf,
                      border: `1px solid ${C.bd}`,
                      padding: '2px 6px',
                      borderRadius: radii.pill,
                      cursor: 'pointer',
                      transition: `all ${transition.fast}`,
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.borderColor = C.b;
                      e.target.style.color = C.b;
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.borderColor = C.bd;
                      e.target.style.color = C.t3;
                    }}
                  >
                    +{tag}
                  </button>
                ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: `${space[3]}px ${space[5]}px ${space[4]}px`,
            borderTop: `1px solid ${C.bd}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: space[2],
          }}
        >
          <Btn variant="ghost" onClick={onClose} style={{ fontSize: 11 }}>
            Cancel
          </Btn>
          <Btn
            onClick={handleShare}
            disabled={!title.trim() || sharing}
            style={{ fontSize: 11, opacity: !title.trim() || sharing ? 0.5 : 1 }}
          >
            {shared ? '✓ Shared!' : sharing ? 'Sharing...' : '📤 Share'}
          </Btn>
        </div>
      </div>
    </>
  );
}
