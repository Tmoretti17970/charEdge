// ═══════════════════════════════════════════════════════════════════
// charEdge — Workspace Presets Picker (Sprint 9)
// Dropdown to switch between built-in and custom workspace presets.
// ═══════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback } from 'react';
import { C, F } from '@/constants.js';
import { useChartToolsStore } from '../../../../state/chart/useChartToolsStore';
import { useChartCoreStore } from '../../../../state/chart/useChartCoreStore';
import { useChartFeaturesStore } from '../../../../state/chart/useChartFeaturesStore';
import {
  useWorkspaceStore,
  BUILT_IN_PRESETS,
  captureState,
  restoreState,
} from '../../../../state/useWorkspaceStore';
import w from './WorkspacePresets.module.css';

export default function WorkspacePresets() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [renamingId, setRenamingId] = useState(null); // Task 1.1.6: inline rename
  const [renameValue, setRenameValue] = useState('');
  const ref = useRef(null);

  const activePreset = useWorkspaceStore((s) => s.activePreset);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const applyPreset = useWorkspaceStore((s) => s.applyPreset);
  const remove = useWorkspaceStore((s) => s.remove);
  const rename = useWorkspaceStore((s) => s.rename);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Apply a built-in preset
  const handleApply = useCallback((presetId) => {
    const state = applyPreset(presetId);
    if (state) {
      restoreState(state, {
        chartStore: useChartCoreStore,
      });
    }
    setOpen(false);
  }, [applyPreset]);

  // Apply a custom workspace
  const handleLoadCustom = useCallback((ws) => {
    restoreState(ws.state, {
      chartStore: useChartCoreStore,
    });
    useWorkspaceStore.getState().load(ws.id);
    useWorkspaceStore.setState({ activePreset: ws.id });
    setOpen(false);
  }, []);

  // Save current state as custom preset
  const handleSave = useCallback(() => {
    if (!saveName.trim()) return;
    const state = captureState({ chartStore: useChartCoreStore });
    useWorkspaceStore.getState().saveCustomPreset(saveName.trim(), state);
    setSaveName('');
    setSaving(false);
  }, [saveName]);

  // Task 1.1.6: Commit inline rename
  const commitRename = useCallback(() => {
    if (renamingId && renameValue.trim()) {
      rename(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue('');
  }, [renamingId, renameValue, rename]);

  // Task 1.1.6: Ctrl+1..4 keyboard shortcuts for built-in presets
  useEffect(() => {
    const handler = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const idx = parseInt(e.key) - 1;
      if (idx >= 0 && idx < BUILT_IN_PRESETS.length) {
        e.preventDefault();
        const state = applyPreset(BUILT_IN_PRESETS[idx].id);
        if (state) {
          restoreState(state, { chartStore: useChartCoreStore });
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [applyPreset]);

  // Find active label
  const builtIn = BUILT_IN_PRESETS.find((p) => p.id === activePreset);
  const customWs = workspaces.find((w) => w.id === activePreset);
  const activeLabel = builtIn?.name || customWs?.name || null;
  const _activeIcon = builtIn?.icon || '📂';

  return (
    <div ref={ref} className={w.root}>
      {/* Trigger button */}
      <button
        className="tf-trade-capsule__util-btn"
        data-active={open || undefined}
        onClick={() => setOpen(!open)}
        title="Workspace Presets"
      >
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className={w.triggerSvg}>
          <rect x="1" y="1" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.2" fill="none" />
          <rect x="8" y="1" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.2" fill="none" />
          <rect x="1" y="8" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.2" fill="none" />
          <rect x="8" y="8" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.2" fill="none" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className={`tf-chart-dropdown ${w.dropdown}`}>
          {/* Built-in presets */}
          <div className="tf-chart-dropdown-label">PRESETS</div>
          {BUILT_IN_PRESETS.map((preset) => {
            const isActive = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                className="tf-chart-dropdown-item"
                data-active={isActive || undefined}
                onClick={() => handleApply(preset.id)}
              >
                <span className={w.presetIcon}>{preset.icon}</span>
                <div className={w.presetContent}>
                  <div className={w.presetName} data-active={isActive ? 'true' : undefined}>
                    {preset.name}
                  </div>
                  <div className={w.presetDesc}>
                    {preset.description}
                  </div>
                </div>
                {isActive && (
                  <span className={w.checkMark}>✓</span>
                )}
              </button>
            );
          })}

          {/* Custom presets */}
          {workspaces.length > 0 && (
            <>
              <div className="tf-chart-dropdown-sep" />
              <div className="tf-chart-dropdown-label">CUSTOM</div>
              {workspaces.map((ws) => {
                const isActive = activePreset === ws.id;
                return (
                  <div key={ws.id} className={w.customRow}>
                    <button
                      className={`tf-chart-dropdown-item ${w.customItemBtn}`}
                      data-active={isActive || undefined}
                      onClick={() => handleLoadCustom(ws)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setRenamingId(ws.id);
                        setRenameValue(ws.name);
                      }}
                    >
                      <span className={w.customIcon}>📂</span>
                      {renamingId === ws.id ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename();
                            if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); }
                            e.stopPropagation();
                          }}
                          onBlur={commitRename}
                          onClick={(e) => e.stopPropagation()}
                          className={w.renameInput}
                        />
                      ) : (
                        <span className={w.customName} data-active={isActive ? 'true' : undefined}>
                          {ws.name}
                        </span>
                      )}
                      {isActive && (
                        <span className={w.customCheckMark}>✓</span>
                      )}
                    </button>
                    <button
                      className={w.deleteBtn}
                      onClick={(e) => { e.stopPropagation(); remove(ws.id); }}
                      title="Delete preset"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </>
          )}

          {/* Save custom */}
          <div className="tf-chart-dropdown-sep" />
          {saving ? (
            <div className={w.saveRow}>
              <input
                autoFocus
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setSaving(false); }}
                placeholder="Preset name…"
                className={w.saveInput}
              />
              <button className={w.saveBtn} onClick={handleSave}>
                Save
              </button>
            </div>
          ) : (
            <button
              className={`tf-chart-dropdown-item ${w.savePresetBtn}`}
              onClick={() => setSaving(true)}
            >
              <span className={w.addPresetIcon}>+</span>
              Save Current as Preset
            </button>
          )}
        </div>
      )}
    </div>
  );
}
