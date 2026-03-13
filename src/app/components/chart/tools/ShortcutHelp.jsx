// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Keyboard Shortcut Help Modal
// Apple-style overlay showing all available drawing tool shortcuts.
// Triggered by pressing '?' while no input is focused.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';

const SHORTCUTS = [
  { section: 'Selection' },
  { key: 'Escape', desc: 'Deselect / Cancel creation' },
  { key: 'Delete', desc: 'Delete selected drawing' },
  { key: 'Ctrl + A', desc: 'Select all drawings' },

  { section: 'Editing' },
  { key: '↑ ↓ ← →', desc: 'Nudge 1px' },
  { key: 'Shift + Arrow', desc: 'Nudge 10px' },
  { key: 'Ctrl + D', desc: 'Duplicate selected' },
  { key: 'Alt + Drag', desc: 'Clone and drag' },
  { key: 'Ctrl + C / V', desc: 'Copy / Paste' },

  { section: 'Properties' },
  { key: 'Ctrl + L', desc: 'Toggle lock' },
  { key: 'Ctrl + H', desc: 'Toggle visibility' },
  { key: '[ / ]', desc: 'Send to back / Bring to front' },

  { section: 'History' },
  { key: 'Ctrl + Z', desc: 'Undo' },
  { key: 'Ctrl + Shift + Z', desc: 'Redo' },

  { section: 'Tools' },
  { key: 'Enter', desc: 'Finish polyline' },
  { key: 'Backspace', desc: 'Undo last point (while creating)' },
  { key: '?', desc: 'Show this help' },
];

export default function ShortcutHelp() {
  const [open, setOpen] = useState(false);

  const handleKey = useCallback((e) => {
    if (e.key === '?' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      setOpen(prev => !prev);
    }
    if (e.key === 'Escape' && open) {
      setOpen(false);
    }
  }, [open]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  if (!open) return null;

  return (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'rgba(24, 26, 32, 0.97)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: '24px 28px',
          maxWidth: 440,
          width: '90vw',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
          animation: 'scaleInSm 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#D1D4DC', letterSpacing: '-0.02em' }}>
            ⌨ Drawing Shortcuts
          </h2>
          <button
            onClick={() => setOpen(false)}
            style={{
              background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 6,
              color: '#787B86', fontSize: 12, padding: '4px 10px', cursor: 'pointer',
            }}
          >
            ESC
          </button>
        </div>

        {/* Shortcuts list */}
        {SHORTCUTS.map((item, i) => {
          if (item.section) {
            return (
              <div key={i} style={{
                fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px',
                color: '#2962FF', marginTop: i > 0 ? 16 : 0, marginBottom: 6,
                paddingBottom: 4, borderBottom: '1px solid rgba(41,98,255,0.15)',
              }}>
                {item.section}
              </div>
            );
          }
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.03)',
            }}>
              <span style={{ color: '#D1D4DC', fontSize: 13 }}>{item.desc}</span>
              <kbd style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 4, padding: '2px 8px', fontSize: 11, color: '#B2B5BE',
                fontFamily: 'SF Mono, Menlo, monospace', whiteSpace: 'nowrap',
                boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
              }}>
                {item.key}
              </kbd>
            </div>
          );
        })}
      </div>
    </div>
  );
}
