// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Annotations Panel
// Per-symbol note-taking panel for annotating chart events.
// ═══════════════════════════════════════════════════════════════════

import { useState, useRef, useMemo } from 'react';
import { C, F } from '@/constants.js';
import { useChartStore } from '../../../../state/useChartStore';
import { useChartBars } from '../../../hooks/useChartBars.js';
import { useChartCoreStore } from '../../../../state/chart/useChartCoreStore';
import s from './ChartAnnotationsPanel.module.css';

const EMOJI_OPTIONS = ['📌', '⚠️', '🎯', '💡', '🚀', '🔴', '🟢', '📊', '🧠', '❓'];

// P2 1.3: Sanitize annotation text — strip HTML tags and limit length
function sanitizeAnnotation(text) {
  return text
    .replace(/<[^>]*>/g, '')         // Strip HTML tags
    .replace(/&/g, '&amp;')          // Encode ampersands
    .replace(/</g, '&lt;')           // Encode angle brackets
    .replace(/>/g, '&gt;')           // Encode angle brackets
    .slice(0, 500);                  // Cap length at 500 chars
}

export default function ChartAnnotationsPanel({ _onClose }) {
  const symbol = useChartCoreStore((s) => s.symbol);
  const data = useChartBars();
  const annotations = useChartStore((s) => s.getForSymbol(symbol));
  const addAnnotation = useChartStore((s) => s.addAnnotation);
  const removeAnnotation = useChartStore((s) => s.removeAnnotation);
  const editAnnotation = useChartStore((s) => s.editAnnotation);

  const [text, setText] = useState('');
  const [emoji, setEmoji] = useState('📌');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const inputRef = useRef(null);

  // Auto-fill price from latest bar
  const currentPrice = useMemo(() => {
    if (!data?.length) return 0;
    return data[data.length - 1].close;
  }, [data]);

  const handleAdd = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    addAnnotation(symbol, {
      timestamp: Date.now(),
      price: currentPrice,
      text: sanitizeAnnotation(text.trim()),
      emoji,
    });
    setText('');
    setEmoji('📌');
    inputRef.current?.focus();
  };

  const handleStartEdit = (ann) => {
    setEditingId(ann.id);
    setEditText(ann.text);
  };

  const handleSaveEdit = (id) => {
    if (editText.trim()) {
      editAnnotation(symbol, id, { text: sanitizeAnnotation(editText.trim()) });
    }
    setEditingId(null);
    setEditText('');
  };

  const sortedAnnotations = useMemo(() => {
    return [...annotations].sort((a, b) => b.createdAt - a.createdAt);
  }, [annotations]);

  return (
    <div className={s.root}>
      {/* Header */}
      <div className={s.header}>
        <div className={s.headerLeft}>
          <span className={s.headerEmoji}>📝</span>
          <span className={s.headerTitle}>
            Annotations — {symbol}
          </span>
          <span className={s.headerBadge}>
            {annotations.length}
          </span>
        </div>
      </div>

      {/* Add Form */}
      <form onSubmit={handleAdd} className={s.addForm}>
        <div className={s.emojiRow}>
          {EMOJI_OPTIONS.map((em) => (
            <button
              key={em}
              type="button"
              onClick={() => setEmoji(em)}
              className={s.emojiBtn}
              style={{
                border: `1px solid ${emoji === em ? C.b : 'transparent'}`,
                background: emoji === em ? `${C.b}15` : 'transparent',
              }}
            >
              {em}
            </button>
          ))}
        </div>
        <div className={s.inputRow}>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a note at current price..."
            className={s.annotationInput}
          />
          <button type="submit" disabled={!text.trim()} className={s.addBtn}>
            Add
          </button>
        </div>
        <div className={s.metaLine}>
          Price: {currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })} · {new Date().toLocaleTimeString()}
        </div>
      </form>

      <div className={s.divider} />

      {/* Annotations List */}
      <div className={s.list}>
        {sortedAnnotations.length === 0 ? (
          <div className={s.emptyState}>
            <div className={s.emptyEmoji}>📝</div>
            No annotations yet.
            <br />
            <span className={s.emptyHint}>
              Add notes about key levels, patterns, or ideas.
            </span>
          </div>
        ) : (
          sortedAnnotations.map((ann) => (
            <div
              key={ann.id}
              className={s.card}
            >
              <div className={s.cardBody}>
                <span className={s.cardEmoji}>{ann.emoji}</span>
                <div className={s.cardContent}>
                  {editingId === ann.id ? (
                    <div className={s.editRow}>
                      <input
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(ann.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                        className={s.editInput}
                      />
                      <button onClick={() => handleSaveEdit(ann.id)} className={s.editSaveBtn}>
                        ✓
                      </button>
                    </div>
                  ) : (
                    <div
                      className={s.cardText}
                      onClick={() => handleStartEdit(ann)}
                    >
                      {ann.text}
                    </div>
                  )}
                  <div className={s.cardMeta}>
                    <span>
                      {ann.price?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                    <span>·</span>
                    <span>
                      {new Date(ann.createdAt).toLocaleString(undefined, {
                        month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => removeAnnotation(symbol, ann.id)}
                  className={s.deleteBtn}
                  title="Delete annotation"
                >
                  ×
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer: clear all */}
      {annotations.length > 0 && (
        <div className={s.footer}>
          <button
            onClick={() => {
              if (confirm(`Clear all ${annotations.length} annotations for ${symbol}?`)) {
                useChartStore.getState().clearSymbol(symbol);
              }
            }}
            className={s.clearAllBtn}
          >
            Clear All Annotations
          </button>
        </div>
      )}
    </div>
  );
}
