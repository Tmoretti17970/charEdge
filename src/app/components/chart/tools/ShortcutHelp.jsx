// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Keyboard Shortcut Help Modal
// Apple-style overlay showing all available drawing tool shortcuts.
// Triggered by pressing '?' while no input is focused.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import s from './ShortcutHelp.module.css';

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
    if (e.key === '?' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) { e.preventDefault(); setOpen(prev => !prev); }
    if (e.key === 'Escape' && open) setOpen(false);
  }, [open]);

  useEffect(() => { window.addEventListener('keydown', handleKey); return () => window.removeEventListener('keydown', handleKey); }, [handleKey]);

  if (!open) return null;

  return (
    <div onClick={() => setOpen(false)} className={s.backdrop}>
      <div onClick={e => e.stopPropagation()} className={s.panel}>
        <div className={s.header}>
          <h2 className={s.title}>⌨ Drawing Shortcuts</h2>
          <button onClick={() => setOpen(false)} className={s.escBtn}>ESC</button>
        </div>
        {SHORTCUTS.map((item, i) => {
          if (item.section) return <div key={i} className={s.section} style={{ marginTop: i > 0 ? 16 : 0 }}>{item.section}</div>;
          return (
            <div key={i} className={s.row}>
              <span className={s.desc}>{item.desc}</span>
              <kbd className={s.kbd}>{item.key}</kbd>
            </div>
          );
        })}
      </div>
    </div>
  );
}
