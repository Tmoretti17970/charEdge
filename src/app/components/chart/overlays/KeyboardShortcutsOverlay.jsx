// ═══════════════════════════════════════════════════════════════════
// charEdge — Keyboard Shortcuts Overlay
// Triggered by pressing '?' on the charts page.
// Glassmorphism modal showing all available shortcuts.
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useCallback } from 'react';
import { C, F, M } from '../../../../constants.js';

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
      { keys: ['Esc'], desc: 'Deselect tool / cancel' },
      { keys: ['Del'], desc: 'Delete selected drawing' },
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

export default function KeyboardShortcutsOverlay({ onClose }) {
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
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        animation: 'scaleInSm 0.2s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: `${C.sf2}ee`,
          border: `1px solid ${C.bd}`,
          borderRadius: 16,
          padding: '24px 32px',
          maxWidth: 520,
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 20,
        }}>
          <div>
            <h2 style={{
              margin: 0, fontFamily: F, fontSize: 18, fontWeight: 700, color: C.t1,
            }}>
              ⌨️ Keyboard Shortcuts
            </h2>
            <p style={{
              margin: '4px 0 0', fontFamily: F, fontSize: 12, color: C.t3,
            }}>
              Press <kbd style={kbdStyle}>?</kbd> or <kbd style={kbdStyle}>Esc</kbd> to close
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: C.t3, fontSize: 20,
              cursor: 'pointer', padding: '4px 8px', borderRadius: 6,
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = C.t1}
            onMouseLeave={(e) => e.currentTarget.style.color = C.t3}
          >
            ✕
          </button>
        </div>

        {/* Groups */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 style={{
                fontFamily: F, fontSize: 11, fontWeight: 700, color: C.b,
                textTransform: 'uppercase', letterSpacing: '0.8px',
                margin: '0 0 8px', padding: '0 0 4px',
                borderBottom: `1px solid ${C.bd}`,
              }}>
                {group.title}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {group.shortcuts.map((sc, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 8,
                  }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {sc.keys.map((k, ki) => (
                        <React.Fragment key={ki}>
                          {ki > 0 && <span style={{ color: C.t3, fontSize: 10, lineHeight: '22px' }}>+</span>}
                          <kbd style={kbdStyle}>{k}</kbd>
                        </React.Fragment>
                      ))}
                    </div>
                    <span style={{
                      fontFamily: F, fontSize: 12, color: C.t2,
                      textAlign: 'right', whiteSpace: 'nowrap',
                    }}>
                      {sc.desc}
                    </span>
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

const kbdStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 24,
  height: 22,
  padding: '0 6px',
  background: `${C.sf}`,
  border: `1px solid ${C.bd}`,
  borderRadius: 5,
  fontFamily: M,
  fontSize: 11,
  fontWeight: 600,
  color: C.t1,
  boxShadow: `0 1px 2px rgba(0,0,0,0.3)`,
};
