// ═══════════════════════════════════════════════════════════════════
// charEdge — PresetChips (extracted from CopilotChatInline)
//
// Quick-action preset buttons for the copilot chat.
// ═══════════════════════════════════════════════════════════════════

import React, { useCallback } from 'react';
import { C, F } from '@/constants.js';

const PRESETS = [
  { id: 'best', label: 'Best trade this week', emoji: '🏆' },
  { id: 'risk', label: 'Risk assessment', emoji: '🛡️' },
  { id: 'week', label: 'Week analysis', emoji: '📊' },
  { id: 'tips', label: 'Suggestions', emoji: '💡' },
];

export default function PresetChips({ onPreset, disabled }) {
  const handlePreset = useCallback((preset) => {
    if (disabled) return;
    onPreset(`${preset.emoji} ${preset.label}`);
  }, [disabled, onPreset]);

  return (
    <div style={{ padding: '4px 16px 6px', flexShrink: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => handlePreset(p)}
            disabled={disabled}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 8px', borderRadius: 8,
              border: `1px solid ${C.bd}`, background: C.sf2,
              color: C.t2, fontSize: 10, fontWeight: 500, fontFamily: F,
              cursor: disabled ? 'default' : 'pointer',
              transition: 'all 0.15s', textAlign: 'left',
              opacity: disabled ? 0.5 : 1,
            }}
            onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.borderColor = C.b + '30'; e.currentTarget.style.background = C.b + '08'; } }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.bd; e.currentTarget.style.background = C.sf2; }}
          >
            <span style={{ fontSize: 12, lineHeight: 1 }}>{p.emoji}</span>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
