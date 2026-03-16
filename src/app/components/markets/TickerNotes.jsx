// ═══════════════════════════════════════════════════════════════════
// charEdge — Ticker Notes (Sprint 37)
//
// Inline markdown-style notes per symbol in the detail panel.
// Toggle between view and edit mode.
// Persisted via useWatchlistStore notes state.
// ═══════════════════════════════════════════════════════════════════

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { C, F, M } from '../../../constants.js';
import { useWatchlistStore } from '../../../state/useWatchlistStore.js';
import { radii, transition } from '../../../theme/tokens.js';

function TickerNotes({ symbol }) {
  const notes = useWatchlistStore((s) => s.notes || {});
  const setNote = useWatchlistStore((s) => s.setNote);

  const noteData = notes[symbol];
  const savedText = noteData?.text || '';

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(savedText);
  const textareaRef = useRef(null);

  // Sync draft when symbol changes
  useEffect(() => {
    setDraft(noteData?.text || '');
    setEditing(false);
  }, [symbol, noteData?.text]);

  const handleSave = useCallback(() => {
    const trimmed = draft.trim();
    if (setNote) {
      setNote(symbol, trimmed);
    }
    setEditing(false);
  }, [draft, symbol, setNote]);

  const handleKeyDown = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setDraft(savedText);
      setEditing(false);
    }
  }, [handleSave, savedText]);

  const handleEdit = useCallback(() => {
    setDraft(savedText);
    setEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, [savedText]);

  const MAX_CHARS = 1000;
  const lastEdited = noteData?.updatedAt
    ? new Date(noteData.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  if (editing) {
    return (
      <div style={{ padding: '8px 20px 12px' }}>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_CHARS))}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          placeholder="Why are you watching this? Notes, thesis, reminders…"
          style={{
            width: '100%',
            minHeight: 80,
            maxHeight: 200,
            padding: '10px 12px',
            borderRadius: radii.sm,
            border: `1px solid ${C.bd}50`,
            background: `${C.sf}`,
            color: C.t1,
            fontFamily: F,
            fontSize: 12,
            lineHeight: 1.6,
            resize: 'vertical',
            outline: 'none',
            transition: `border ${transition.fast}`,
          }}
        />
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          marginTop: 5, alignItems: 'center',
        }}>
          <span style={{ fontSize: 9, fontFamily: M, color: C.t3 }}>
            {draft.length}/{MAX_CHARS} · ⌘Enter to save
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => { setDraft(savedText); setEditing(false); }}
              style={{
                background: 'transparent', border: `1px solid ${C.bd}30`,
                borderRadius: radii.xs, padding: '3px 10px',
                color: C.t3, fontSize: 10, fontFamily: M, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={{
                background: '#6e5ce6', border: 'none',
                borderRadius: radii.xs, padding: '3px 10px',
                color: '#fff', fontSize: 10, fontWeight: 700, fontFamily: M, cursor: 'pointer',
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 20px 12px' }}>
      {savedText ? (
        <>
          <div
            onClick={handleEdit}
            style={{
              fontSize: 12,
              fontFamily: F,
              color: C.t2,
              lineHeight: 1.6,
              cursor: 'pointer',
              padding: '6px 10px',
              borderRadius: radii.sm,
              transition: `background ${transition.fast}`,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = `${C.sf}`; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            {savedText}
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            marginTop: 4, alignItems: 'center',
          }}>
            {lastEdited && (
              <span style={{ fontSize: 9, fontFamily: M, color: C.t3 }}>
                Edited {lastEdited}
              </span>
            )}
            <button
              onClick={handleEdit}
              style={{
                background: 'transparent', border: 'none',
                color: C.t3, fontSize: 10, fontFamily: M, cursor: 'pointer',
                padding: '2px 6px',
              }}
            >
              ✏️ Edit
            </button>
          </div>
        </>
      ) : (
        <div
          onClick={handleEdit}
          style={{
            fontSize: 11,
            fontFamily: F,
            color: C.t3,
            cursor: 'pointer',
            padding: '10px 12px',
            borderRadius: radii.sm,
            border: `1px dashed ${C.bd}40`,
            textAlign: 'center',
            transition: `all ${transition.fast}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = `${C.bd}80`;
            e.currentTarget.style.color = C.t2;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = `${C.bd}40`;
            e.currentTarget.style.color = C.t3;
          }}
        >
          📝 Add notes — thesis, reminders, why you're watching…
        </div>
      )}
    </div>
  );
}

export default memo(TickerNotes);
