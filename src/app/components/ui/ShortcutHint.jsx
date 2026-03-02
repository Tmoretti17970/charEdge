// ═══════════════════════════════════════════════════════════════════
// charEdge — ShortcutHint (Sprint 15)
//
// Inline keyboard shortcut badge shown next to controls.
// Renders a styled key combo like ⌘K, Ctrl+N, etc.
//
// Usage:  <ShortcutHint keys="Ctrl+K" />
// ═══════════════════════════════════════════════════════════════════

import { C, M } from '../../../constants.js';

const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

function formatKey(key) {
  if (IS_MAC) {
    return key
      .replace(/Ctrl\+/gi, '⌘')
      .replace(/Alt\+/gi, '⌥')
      .replace(/Shift\+/gi, '⇧');
  }
  return key;
}

export default function ShortcutHint({ keys, style = {} }) {
  if (!keys) return null;
  const parts = formatKey(keys).split('+').filter(Boolean);

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        marginLeft: 6,
        ...style,
      }}
    >
      {parts.map((part, i) => (
        <kbd
          key={i}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 18,
            height: 18,
            padding: '0 4px',
            borderRadius: 4,
            background: C.bg2,
            border: `1px solid ${C.bd}`,
            color: C.t3,
            fontSize: 9,
            fontWeight: 600,
            fontFamily: M,
            lineHeight: 1,
            textTransform: 'uppercase',
            boxShadow: `0 1px 0 ${C.bd}`,
          }}
        >
          {part}
        </kbd>
      ))}
    </span>
  );
}
