// ═══════════════════════════════════════════════════════════════════
// charEdge — Keyboard Shortcuts Overlay
// Triggered by pressing '?' on the charts page.
// Glassmorphism modal showing all available shortcuts.
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useCallback } from 'react';
import s from './KeyboardShortcutsOverlay.module.css';

const SHORTCUT_GROUPS = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['Scroll / Drag'], desc: 'Pan chart left/right' },
      { keys: ['Ctrl + Scroll'], desc: 'Zoom in/out' },
      { keys: ['Pinch'], desc: 'Zoom (touch)' },
      { keys: ['Double-click'], desc: 'Reset zoom' },
    ],
  },
  {
    title: 'Timeframes',
    shortcuts: [
      { keys: ['1'], desc: '1 minute' },
      { keys: ['2'], desc: '5 minute' },
      { keys: ['3'], desc: '15 minute' },
      { keys: ['4'], desc: '1 hour' },
      { keys: ['5'], desc: '4 hour' },
      { keys: ['6'], desc: '1 day' },
    ],
  },
  {
    title: 'Drawing Tools',
    shortcuts: [
      { keys: ['T'], desc: 'Trend Line' },
      { keys: ['H'], desc: 'Horizontal Line' },
      { keys: ['V'], desc: 'Vertical Line' },
      { keys: ['R'], desc: 'Rectangle' },
      { keys: ['F'], desc: 'Fibonacci' },
      { keys: ['M'], desc: 'Measure' },
      { keys: ['Esc'], desc: 'Cancel / Deselect' },
      { keys: ['Del'], desc: 'Delete selected' },
      { keys: ['Ctrl', 'Z'], desc: 'Undo' },
      { keys: ['Ctrl', '⇧', 'Z'], desc: 'Redo' },
      { keys: ['Ctrl', 'D'], desc: 'Duplicate' },
      { keys: ['Tab'], desc: 'Cycle drawings' },
    ],
  },
  {
    title: 'Panels & Features',
    shortcuts: [
      { keys: ['I'], desc: 'Toggle AI Insights' },
      { keys: ['Ctrl', 'K'], desc: 'Open AI Copilot' },
      { keys: ['Ctrl', 'S'], desc: 'Share Snapshot' },
      { keys: ['?'], desc: 'This help overlay' },
    ],
  },
];

function KeyboardShortcutsOverlay({ onClose }) {
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' || e.key === '?') {
      e.preventDefault();
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div onClick={onClose} className={s.backdrop}>
      <div onClick={(e) => e.stopPropagation()} className={s.dialog}>
        {/* Header */}
        <div className={s.header}>
          <div>
            <h2 className={s.title}>⌨️ Keyboard Shortcuts</h2>
            <p className={s.subtitle}>
              Press <kbd className={s.kbd}>?</kbd> or <kbd className={s.kbd}>Esc</kbd> to close
            </p>
          </div>
          <button onClick={onClose} className={s.closeBtn}>✕</button>
        </div>

        {/* Groups */}
        <div className={s.grid}>
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className={s.groupTitle}>{group.title}</h3>
              <div className={s.groupList}>
                {group.shortcuts.map((sc, i) => (
                  <div key={i} className={s.shortcutRow}>
                    <div className={s.keysWrap}>
                      {sc.keys.map((k, ki) => (
                        <React.Fragment key={ki}>
                          {ki > 0 && <span className={s.keySep}>+</span>}
                          <kbd className={s.kbd}>{k}</kbd>
                        </React.Fragment>
                      ))}
                    </div>
                    <span className={s.scDesc}>{sc.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default React.memo(KeyboardShortcutsOverlay);
