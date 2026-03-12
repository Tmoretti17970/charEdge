// ═══════════════════════════════════════════════════════════════════
// charEdge v10.1 — Keyboard Shortcuts Panel
// Sprint 4: Press "?" to see all available shortcuts.
// Auto-discovers registered hotkeys from useHotkeys system.
// ═══════════════════════════════════════════════════════════════════
import React, { useEffect, useState, useMemo } from 'react';
import { C, F, M } from '../../../constants.js';
import { radii } from '../../../theme/tokens.js';

// ─── Curated shortcut groups (static, always shown) ────────────
const SHORTCUT_GROUPS = [
  {
    title: 'Navigation',
    shortcuts: [
      { key: '1–7', desc: 'Switch pages (Dashboard → Community)' },
      { key: 'Ctrl + .', desc: 'Toggle activity log' },
      { key: '?', desc: 'Show this help' },
    ],
  },
  {
    title: 'Journal',
    shortcuts: [
      { key: 'J / K', desc: 'Navigate trades (down / up)' },
      { key: 'Enter', desc: 'Expand / collapse focused trade' },
      { key: 'E', desc: 'Edit focused trade' },
      { key: 'D', desc: 'Delete focused trade' },
      { key: 'B', desc: 'Toggle bulk select mode' },
      { key: 'Esc', desc: 'Clear selection' },
      { key: 'Ctrl + Z', desc: 'Undo' },
      { key: 'Ctrl + Shift + Z', desc: 'Redo' },
    ],
  },
  {
    title: 'Charts',
    shortcuts: [
      { key: 'Scroll', desc: 'Zoom in/out' },
      { key: 'Click + Drag', desc: 'Pan chart' },
      { key: 'D', desc: 'Toggle drawing sidebar' },
      { key: 'F', desc: 'Toggle focus mode' },
      { key: '+ / −', desc: 'Zoom in / out' },
      { key: '/', desc: 'Quick symbol search' },
      { key: 'Space + Drag', desc: 'Pan chart (alt)' },
      { key: 'T', desc: 'Trend Line' },
      { key: 'H', desc: 'Horizontal Line' },
      { key: 'R', desc: 'Rectangle' },
      { key: 'L', desc: 'Straight Line' },
      { key: 'N', desc: 'Toggle Magnet Mode' },
      { key: 'I', desc: 'Toggle Insights Panel' },
      { key: 'Ctrl + I', desc: 'Toggle Indicator Panel' },
      { key: 'Ctrl + K', desc: 'Command Palette / AI Copilot' },
      { key: 'Ctrl + S', desc: 'Publish Snapshot' },
      { key: '1–6', desc: 'Quick timeframe switch' },
      { key: 'Right-click', desc: 'Radial context menu' },
      { key: 'Esc', desc: 'Cancel drawing / exit trade mode' },
    ],
  },
];

/**
 * Full-screen keyboard shortcuts overlay.
 * Renders when isOpen=true, dismisses on Esc or clicking backdrop.
 */
function KeyboardShortcuts({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <KeyboardShortcutsInner onClose={onClose} />
  );
}

function KeyboardShortcutsInner({ onClose }) {
  const [filter, setFilter] = useState('');

  // Close on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Filter shortcut groups
  const filteredGroups = useMemo(() => {
    if (!filter.trim()) return SHORTCUT_GROUPS;
    const q = filter.toLowerCase();
    return SHORTCUT_GROUPS.map((g) => ({
      ...g,
      shortcuts: g.shortcuts.filter(
        (sc) => sc.desc.toLowerCase().includes(q) || sc.key.toLowerCase().includes(q)
      ),
    })).filter((g) => g.shortcuts.length > 0);
  }, [filter]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.sf,
          borderRadius: radii.lg,
          border: `1px solid ${C.bd}`,
          boxShadow: '0 16px 64px rgba(0,0,0,0.5)',
          maxWidth: 520,
          width: '100%',
          maxHeight: '80vh',
          overflow: 'auto',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px 12px',
            borderBottom: `1px solid ${C.bd}`,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: C.t1,
                fontFamily: F,
              }}
            >
              Keyboard Shortcuts
            </div>
            <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>
              Press <Kbd>?</Kbd> anytime to open this panel
            </div>
          </div>
          <button
            className="tf-btn"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: C.t3,
              fontSize: 18,
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            ×
          </button>
        </div>

        {/* Search filter */}
        <div style={{ padding: '4px 20px 8px' }}>
          <input
            autoFocus
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search shortcuts…"
            style={{
              width: '100%',
              background: C.bg,
              border: `1px solid ${C.bd}`,
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 11,
              fontFamily: F,
              color: C.t1,
              outline: 'none',
            }}
          />
        </div>

        {/* Shortcut groups */}
        <div style={{ padding: '8px 0' }}>
          {filteredGroups.map((group, gi) => (
            <div key={gi}>
              <div
                style={{
                  padding: '10px 20px 4px',
                  fontSize: 9,
                  fontWeight: 700,
                  color: C.b,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {group.title}
              </div>
              {group.shortcuts.map((sc, si) => (
                <div
                  key={si}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 20px',
                  }}
                >
                  <span style={{ fontSize: 12, color: C.t2 }}>{sc.desc}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {sc.key.split(' + ').map((k, ki) => (
                      <React.Fragment key={ki}>
                        {ki > 0 && <span style={{ color: C.t3, fontSize: 10, lineHeight: '22px' }}>+</span>}
                        <Kbd>{k.trim()}</Kbd>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
              {gi < filteredGroups.length - 1 && (
                <div style={{ height: 1, background: C.bd + '40', margin: '6px 20px' }} />
              )}
            </div>
          ))}
          {filteredGroups.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: C.t3, fontSize: 11 }}>
              No shortcuts match "{filter}"
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '10px 20px 14px',
            borderTop: `1px solid ${C.bd}`,
            fontSize: 10,
            color: C.t3,
            textAlign: 'center',
          }}
        >
          Press <Kbd>Esc</Kbd> to close
        </div>
      </div>
    </div>
  );
}

// ─── Key Badge ──────────────────────────────────────────────────
function Kbd({ children }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 7px',
        fontSize: 10,
        fontFamily: M,
        fontWeight: 600,
        color: C.t2,
        background: C.bg,
        border: `1px solid ${C.bd}`,
        borderRadius: 4,
        boxShadow: `0 1px 0 ${C.bd}`,
        lineHeight: '16px',
        minWidth: 20,
        textAlign: 'center',
      }}
    >
      {children}
    </span>
  );
}

export { KeyboardShortcuts };

export default React.memo(KeyboardShortcuts);
