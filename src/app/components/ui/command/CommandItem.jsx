// ═══════════════════════════════════════════════════════════════════
// charEdge — Command Item Component
// Extracted from CommandPalette (Phase 0.1): individual command row.
// ═══════════════════════════════════════════════════════════════════

import { C, M } from '@/constants.js';

export default function CommandItem({ cmd, isSelected, onSelect, onExecute }) {
  return (
    <div
      onClick={onExecute}
      onMouseEnter={onSelect}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 18px',
        margin: '0 6px',
        borderRadius: 8,
        cursor: 'pointer',
        background: isSelected ? `${C.b}18` : 'transparent',
        transition: 'background 0.12s ease',
      }}
    >
      <span
        style={{
          fontSize: 13,
          color: isSelected ? C.t1 : C.t2,
          fontWeight: isSelected ? 600 : 400,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {cmd.icon && (
          <span style={{ fontSize: 14, width: 22, textAlign: 'center', flexShrink: 0, opacity: isSelected ? 1 : 0.7 }}>{cmd.icon}</span>
        )}
        <span>{cmd.label}</span>
        {cmd.sublabel && (
          <span style={{ fontSize: 11, color: C.t3, marginLeft: 4 }}>{cmd.sublabel}</span>
        )}
      </span>
      {cmd.shortcut && (
        <kbd
          style={{
            padding: '2px 7px',
            borderRadius: 5,
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid rgba(255,255,255,0.08)`,
            fontSize: 10,
            fontFamily: M,
            fontWeight: 600,
            color: C.t3,
            boxShadow: '0 1px 0 rgba(0,0,0,0.2)',
            flexShrink: 0,
          }}
        >
          {cmd.shortcut}
        </kbd>
      )}
    </div>
  );
}
