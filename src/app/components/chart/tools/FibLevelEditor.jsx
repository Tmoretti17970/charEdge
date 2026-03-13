// ═══════════════════════════════════════════════════════════════════
// charEdge — Fibonacci Level Editor
// Renders inside DrawingSettingsDialog for Fib tools.
// Each level: checkbox toggle + value input + color swatch.
// "Add Level" button for custom levels.
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';

const DEFAULT_FIB_LEVELS = [
  { value: 0, color: '#787B86', enabled: true },
  { value: 0.236, color: '#F44336', enabled: true },
  { value: 0.382, color: '#FF9800', enabled: true },
  { value: 0.5, color: '#FFEB3B', enabled: true },
  { value: 0.618, color: '#4CAF50', enabled: true },
  { value: 0.786, color: '#00BCD4', enabled: true },
  { value: 1, color: '#787B86', enabled: true },
  { value: 1.618, color: '#2196F3', enabled: false },
  { value: 2.618, color: '#9C27B0', enabled: false },
];

export function getDefaultFibLevels() {
  return DEFAULT_FIB_LEVELS.map(l => ({ ...l }));
}

export default function FibLevelEditor({ levels, onChange }) {
  const [addingLevel, setAddingLevel] = useState(false);
  const [newValue, setNewValue] = useState('');

  // Ensure we have levels
  const currentLevels = levels && levels.length > 0
    ? levels
    : getDefaultFibLevels();

  const updateLevel = useCallback((idx, patch) => {
    const updated = currentLevels.map((l, i) =>
      i === idx ? { ...l, ...patch } : l
    );
    onChange(updated);
  }, [currentLevels, onChange]);

  const removeLevel = useCallback((idx) => {
    const updated = currentLevels.filter((_, i) => i !== idx);
    onChange(updated);
  }, [currentLevels, onChange]);

  const addLevel = useCallback(() => {
    const val = parseFloat(newValue);
    if (isNaN(val)) return;
    const updated = [...currentLevels, {
      value: val,
      color: '#2962FF',
      enabled: true,
    }].sort((a, b) => a.value - b.value);
    onChange(updated);
    setNewValue('');
    setAddingLevel(false);
  }, [currentLevels, newValue, onChange]);

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{
        fontSize: '11px', fontWeight: 600, color: '#787B86',
        textTransform: 'uppercase', letterSpacing: '0.5px',
        marginBottom: 8, fontFamily: '-apple-system, sans-serif',
      }}>
        Fibonacci Levels
      </div>

      {/* Level rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {currentLevels.map((level, idx) => (
          <div key={idx} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '4px 0',
            opacity: level.enabled ? 1 : 0.5,
            transition: 'opacity 0.15s ease',
          }}>
            {/* Enable/disable checkbox */}
            <input
              type="checkbox"
              checked={level.enabled}
              onChange={(e) => updateLevel(idx, { enabled: e.target.checked })}
              style={{
                width: 14, height: 14, cursor: 'pointer',
                accentColor: '#2962FF',
              }}
            />

            {/* Level value */}
            <span style={{
              fontFamily: 'SF Mono, monospace',
              fontSize: '12px', color: '#D1D4DC',
              minWidth: 50,
            }}>
              {(level.value * 100).toFixed(1)}%
            </span>

            {/* Color swatch */}
            <input
              type="color"
              value={level.color}
              onChange={(e) => updateLevel(idx, { color: e.target.value })}
              style={{
                width: 22, height: 22,
                border: 'none', borderRadius: '4px',
                cursor: 'pointer', background: 'transparent',
                padding: 0,
              }}
            />

            {/* Remove button (only for custom levels beyond the default 9) */}
            {idx >= 7 && (
              <button
                onClick={() => removeLevel(idx)}
                style={{
                  width: 18, height: 18,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'transparent', border: 'none',
                  color: '#787B86', cursor: 'pointer', fontSize: '14px',
                  borderRadius: '4px',
                }}
                title="Remove level"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add level */}
      {addingLevel ? (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
          <input
            type="number"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addLevel();
              if (e.key === 'Escape') setAddingLevel(false);
            }}
            placeholder="e.g. 0.886"
            step="0.001"
            autoFocus
            style={{
              width: 80, padding: '4px 8px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px', color: '#D1D4DC',
              fontSize: '12px', outline: 'none',
              fontFamily: 'SF Mono, monospace',
            }}
          />
          <button
            onClick={addLevel}
            style={{
              padding: '4px 10px',
              background: 'rgba(41, 98, 255, 0.2)',
              border: '1px solid rgba(41, 98, 255, 0.3)',
              borderRadius: '6px', color: '#2962FF',
              fontSize: '11px', fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Add
          </button>
          <button
            onClick={() => setAddingLevel(false)}
            style={{
              padding: '4px 8px',
              background: 'transparent', border: 'none',
              color: '#787B86', fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAddingLevel(true)}
          style={{
            marginTop: 8, padding: '6px 12px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px', color: '#787B86',
            fontSize: '12px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
            transition: 'background 0.12s ease',
            fontFamily: '-apple-system, sans-serif',
          }}
        >
          + Add Level
        </button>
      )}
    </div>
  );
}
