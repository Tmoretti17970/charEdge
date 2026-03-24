// ═══════════════════════════════════════════════════════════════════
// charEdge — Fibonacci Level Editor
// Renders inside DrawingSettingsDialog for Fib tools.
// Each level: checkbox toggle + value input + color swatch.
// "Add Level" button for custom levels.
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback, useMemo } from 'react';
import { useChartToolsStore } from '../../../../state/chart/useChartToolsStore';
import s from './FibLevelEditor.module.css';

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
  const [savingPreset, setSavingPreset] = useState(false);
  const [presetName, setPresetName] = useState('');
  const { fibPresets, saveFibPreset, deleteFibPreset } = useChartToolsStore();

  // Ensure we have levels
  const currentLevels = levels && levels.length > 0
    ? levels
    : getDefaultFibLevels();

  const presetNames = useMemo(() => Object.keys(fibPresets || {}), [fibPresets]);

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

  const handleSavePreset = useCallback(() => {
    if (!presetName.trim()) return;
    saveFibPreset(presetName.trim(), currentLevels);
    setPresetName('');
    setSavingPreset(false);
  }, [presetName, currentLevels, saveFibPreset]);

  const handleLoadPreset = useCallback((name) => {
    const preset = fibPresets?.[name];
    if (preset) onChange(preset.map(l => ({ ...l })));
  }, [fibPresets, onChange]);

  const handleResetDefaults = useCallback(() => {
    onChange(getDefaultFibLevels());
  }, [onChange]);

  return (
    <div className={s.container}>
      <div className={s.header}>
        <div className={s.title}>Fibonacci Levels</div>

        {/* Preset dropdown */}
        {presetNames.length > 0 && (
          <select
            onChange={(e) => { if (e.target.value) handleLoadPreset(e.target.value); e.target.value = ''; }}
            className={s.presetSelect}
          >
            <option value="">Load preset…</option>
            {presetNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Level rows */}
      <div className={s.levelList}>
        {currentLevels.map((level, idx) => (
          <div key={idx} className={s.levelRow} data-disabled={!level.enabled || undefined}>
            {/* Enable/disable checkbox */}
            <input
              type="checkbox"
              checked={level.enabled}
              onChange={(e) => updateLevel(idx, { enabled: e.target.checked })}
              className={s.levelCheckbox}
            />

            {/* Level value */}
            <span className={s.levelValue}>
              {(level.value * 100).toFixed(1)}%
            </span>

            {/* Color swatch */}
            <input
              type="color"
              value={level.color}
              onChange={(e) => updateLevel(idx, { color: e.target.value })}
              className={s.levelColorInput}
            />

            {/* Remove button (only for custom levels beyond the default 9) */}
            {idx >= 7 && (
              <button
                onClick={() => removeLevel(idx)}
                className={s.removeBtn}
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
        <div className={s.actionRow}>
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
            className={s.customInput}
          />
          <button onClick={addLevel} className={s.btnPrimary}>Add</button>
          <button onClick={() => setAddingLevel(false)} className={s.btnGhost}>Cancel</button>
        </div>
      ) : (
        <div className={s.actionRow}>
          <button onClick={() => setAddingLevel(true)} className={s.btn}>+ Add Level</button>
          <button onClick={handleResetDefaults} className={s.btn}>↺ Reset</button>
          <button onClick={() => setSavingPreset(true)} className={s.btn}>💾 Save</button>
        </div>
      )}

      {/* Save preset */}
      {savingPreset && (
        <div className={s.saveRow}>
          <input
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSavePreset(); if (e.key === 'Escape') setSavingPreset(false); }}
            placeholder="Preset name…"
            autoFocus
            className={s.presetInput}
          />
          <button onClick={handleSavePreset} className={s.btnPrimary}>Save</button>
          <button onClick={() => setSavingPreset(false)} className={s.btnGhost}>Cancel</button>
        </div>
      )}
    </div>
  );
}
