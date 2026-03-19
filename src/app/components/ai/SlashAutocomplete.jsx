// ═══════════════════════════════════════════════════════════════════
// charEdge — SlashAutocomplete (extracted from CopilotChatInline)
//
// Sprint 3+18: Command autocomplete dropdown with keyboard navigation.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C, F, M } from '../../../../constants.js';

export default function SlashAutocomplete({ suggestions, selectedIdx, onSelect }) {
  if (suggestions.length === 0) return null;

  return (
    <div style={{
      margin: '0 16px 4px', background: C.sf,
      border: `1px solid ${C.bd}`, borderRadius: 8,
      overflow: 'hidden', boxShadow: '0 -4px 16px rgba(0,0,0,0.15)',
      maxHeight: 175, overflowY: 'auto',
      animation: 'copilotSlideUp 0.15s ease',
    }}>
      {suggestions.slice(0, 5).map((cmd, i) => (
        <button
          key={cmd.name}
          onClick={() => onSelect(cmd)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            width: '100%', padding: '6px 10px',
            background: i === selectedIdx ? C.b + '15' : 'transparent',
            border: 'none', cursor: 'pointer',
            textAlign: 'left', fontFamily: F,
            borderBottom: i < Math.min(suggestions.length, 5) - 1 ? `1px solid ${C.bd}` : 'none',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: C.b, minWidth: 65 }}>
            /{cmd.name}
          </span>
          <span style={{ fontSize: 11, color: C.t2, flex: 1 }}>
            {cmd.description}
          </span>
          <span style={{
            fontSize: 8, fontWeight: 600, padding: '1px 5px',
            borderRadius: 4, background: C.b + '12', color: C.b,
            textTransform: 'uppercase', letterSpacing: 0.3,
          }}>
            {cmd.category}
          </span>
        </button>
      ))}
      {/* Keyboard hints */}
      <div style={{
        padding: '3px 10px', borderTop: `1px solid ${C.bd}`,
        fontSize: 8, color: C.t3, fontFamily: M,
        display: 'flex', gap: 8,
      }}>
        <span>↑↓ navigate</span>
        <span>⏎/Tab select</span>
        <span>Esc dismiss</span>
      </div>
    </div>
  );
}
