// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Annotations Panel
// Per-symbol note-taking panel for annotating chart events.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { C, F } from '../../../../constants.js';
import { useAnnotationStore } from '../../../../state/useAnnotationStore.js';
import { useChartStore } from '../../../../state/useChartStore.js';

const EMOJI_OPTIONS = ['📌', '⚠️', '🎯', '💡', '🚀', '🔴', '🟢', '📊', '🧠', '❓'];

export default function ChartAnnotationsPanel({ onClose }) {
  const symbol = useChartStore((s) => s.symbol);
  const data = useChartStore((s) => s.data);
  const annotations = useAnnotationStore((s) => s.getForSymbol(symbol));
  const addAnnotation = useAnnotationStore((s) => s.addAnnotation);
  const removeAnnotation = useAnnotationStore((s) => s.removeAnnotation);
  const editAnnotation = useAnnotationStore((s) => s.editAnnotation);

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
      text: text.trim(),
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
      editAnnotation(symbol, id, { text: editText.trim() });
    }
    setEditingId(null);
    setEditText('');
  };

  const sortedAnnotations = useMemo(() => {
    return [...annotations].sort((a, b) => b.createdAt - a.createdAt);
  }, [annotations]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: F }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}>📝</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>
            Annotations — {symbol}
          </span>
          <span style={{
            fontSize: 10, padding: '1px 6px', borderRadius: 8,
            background: `${C.b}15`, color: C.b, fontWeight: 600,
          }}>
            {annotations.length}
          </span>
        </div>
      </div>

      {/* Add Form */}
      <form onSubmit={handleAdd} style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          {EMOJI_OPTIONS.map((em) => (
            <button
              key={em}
              type="button"
              onClick={() => setEmoji(em)}
              style={{
                width: 26, height: 26, borderRadius: 6,
                border: `1px solid ${emoji === em ? C.b : 'transparent'}`,
                background: emoji === em ? `${C.b}15` : 'transparent',
                cursor: 'pointer', fontSize: 13,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.1s ease',
              }}
            >
              {em}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a note at current price..."
            style={{
              flex: 1, padding: '7px 10px',
              background: C.sf, border: `1px solid ${C.bd}`,
              borderRadius: 8, color: C.t1, fontFamily: F, fontSize: 12,
              outline: 'none',
            }}
            onFocus={(e) => e.target.style.borderColor = C.b}
            onBlur={(e) => e.target.style.borderColor = C.bd}
          />
          <button
            type="submit"
            disabled={!text.trim()}
            style={{
              padding: '7px 14px',
              background: text.trim() ? (C.b || '#2962FF') : C.sf,
              border: 'none', borderRadius: 8,
              color: text.trim() ? '#fff' : C.t3,
              fontFamily: F, fontSize: 11, fontWeight: 700,
              cursor: text.trim() ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s ease',
            }}
          >
            Add
          </button>
        </div>
        <div style={{ fontSize: 9, color: C.t3, marginTop: 4, fontFamily: F }}>
          Price: {currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })} · {new Date().toLocaleTimeString()}
        </div>
      </form>

      {/* Divider */}
      <div style={{ height: 1, background: C.bd, marginBottom: 10 }} />

      {/* Annotations List */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sortedAnnotations.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '24px 0',
            color: C.t3, fontSize: 12, fontFamily: F,
          }}>
            <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>📝</div>
            No annotations yet.
            <br />
            <span style={{ fontSize: 10, opacity: 0.7 }}>
              Add notes about key levels, patterns, or ideas.
            </span>
          </div>
        ) : (
          sortedAnnotations.map((ann) => (
            <div
              key={ann.id}
              style={{
                padding: '8px 10px',
                background: C.sf,
                border: `1px solid ${C.bd}`,
                borderRadius: 8,
                transition: 'all 0.12s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = C.b + '40';
                e.currentTarget.style.background = `${C.b}08`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = C.bd;
                e.currentTarget.style.background = C.sf;
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{ann.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editingId === ann.id ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(ann.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                        style={{
                          flex: 1, padding: '3px 6px',
                          background: C.bg, border: `1px solid ${C.b}`,
                          borderRadius: 4, color: C.t1, fontFamily: F, fontSize: 11,
                          outline: 'none',
                        }}
                      />
                      <button
                        onClick={() => handleSaveEdit(ann.id)}
                        style={{
                          padding: '3px 8px', background: C.b, border: 'none',
                          borderRadius: 4, color: '#fff', fontSize: 10,
                          fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        ✓
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{ fontSize: 12, color: C.t1, lineHeight: 1.4, cursor: 'text' }}
                      onClick={() => handleStartEdit(ann)}
                    >
                      {ann.text}
                    </div>
                  )}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    marginTop: 3, fontSize: 9, color: C.t3,
                  }}>
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
                  style={{
                    background: 'none', border: 'none', color: C.t3,
                    cursor: 'pointer', fontSize: 12, padding: '2px 4px',
                    borderRadius: 4, flexShrink: 0,
                    opacity: 0.5, transition: 'opacity 0.1s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.color = '#EF5350';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '0.5';
                    e.currentTarget.style.color = C.t3;
                  }}
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
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.bd}` }}>
          <button
            onClick={() => {
              if (confirm(`Clear all ${annotations.length} annotations for ${symbol}?`)) {
                useAnnotationStore.getState().clearSymbol(symbol);
              }
            }}
            style={{
              width: '100%', padding: '6px 0',
              background: 'transparent', border: `1px solid ${C.bd}`,
              borderRadius: 6, color: C.t3, fontFamily: F,
              fontSize: 10, cursor: 'pointer',
              transition: 'all 0.12s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#EF5350';
              e.currentTarget.style.color = '#EF5350';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = C.bd;
              e.currentTarget.style.color = C.t3;
            }}
          >
            Clear All Annotations
          </button>
        </div>
      )}
    </div>
  );
}
