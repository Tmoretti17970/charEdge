// ═══════════════════════════════════════════════════════════════════
// charEdge — Inline Text Editor
// Apple-style transparent textarea overlay for editing drawing text
// in-place on the canvas. Listens for `charEdge:edit-drawing-text`
// events from DrawingEngine.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';

export default function InlineTextEditor({ canvasRect }) {
  const [editState, setEditState] = useState(null); // { id, text, x, y, type }
  const textareaRef = useRef(null);

  // Listen for inline text edit trigger
  useEffect(() => {
    const handleEditText = (e) => {
      const { id, text, x, y, type } = e.detail;
      setEditState({ id, text, x, y, type });
    };
    window.addEventListener('charEdge:edit-drawing-text', handleEditText);
    return () => window.removeEventListener('charEdge:edit-drawing-text', handleEditText);
  }, []);

  // Auto-focus
  useEffect(() => {
    if (editState && textareaRef.current) {
      const ta = textareaRef.current;
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }
  }, [editState]);

  // Commit text
  const commit = useCallback(() => {
    if (!editState) return;
    window.dispatchEvent(new CustomEvent('charEdge:submit-drawing-text', {
      detail: { id: editState.id, text: editState.text },
    }));
    setEditState(null);
  }, [editState]);

  // Cancel
  const cancel = useCallback(() => {
    setEditState(null);
  }, []);

  // Handle keydown
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      cancel();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      commit();
    }
  }, [commit, cancel]);

  if (!editState || !canvasRect) return null;

  // Position relative to the canvas
  const posX = canvasRect.left + editState.x;
  const posY = canvasRect.top + editState.y;

  // Font sizing — callout is smaller
  const isCallout = editState.type === 'callout';
  const fontSize = isCallout ? 12 : 14;

  return (
    <>
      {/* Backdrop to catch clicks outside */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'transparent', cursor: 'default',
        }}
        onMouseDown={(e) => { e.stopPropagation(); commit(); }}
      />

      {/* Textarea overlay */}
      <textarea
        ref={textareaRef}
        value={editState.text}
        onChange={(e) => setEditState(prev => prev ? { ...prev, text: e.target.value } : null)}
        onKeyDown={handleKeyDown}
        onBlur={commit}
        style={{
          position: 'fixed',
          left: posX,
          top: posY - 4,
          zIndex: 9999,
          minWidth: 120,
          maxWidth: 400,
          minHeight: 28,
          padding: '4px 8px',
          margin: 0,
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: `${fontSize}px`,
          fontWeight: 400,
          lineHeight: 1.4,
          color: '#D1D4DC',
          background: 'rgba(28, 30, 38, 0.9)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(41, 98, 255, 0.5)',
          borderRadius: '6px',
          outline: 'none',
          resize: 'both',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(41, 98, 255, 0.2)',
          caretColor: '#2962FF',
          // Auto-grow hack: fieldSizing is not widely supported, so we set initial size
          fieldSizing: 'content',
        }}
        rows={1}
      />
    </>
  );
}
