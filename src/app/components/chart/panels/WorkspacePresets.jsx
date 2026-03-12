// ═══════════════════════════════════════════════════════════════════
// charEdge — Workspace Presets Picker (Sprint 9)
// Dropdown to switch between built-in and custom workspace presets.
// ═══════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback } from 'react';
import { C, F } from '../../../../constants.js';
import { useChartToolsStore } from '../../../../state/chart/useChartToolsStore';
import { useChartCoreStore } from '../../../../state/chart/useChartCoreStore';
import { useChartFeaturesStore } from '../../../../state/chart/useChartFeaturesStore';
import {
  useWorkspaceStore,
  BUILT_IN_PRESETS,
  captureState,
  restoreState,
} from '../../../../state/useWorkspaceStore';

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
    <div ref={ref} style={{ position: 'relative', display: 'flex', flexShrink: 0 }}>
      {/* Trigger button */}
      <button
        className="tf-chart-toolbar-btn"
        data-active={open || undefined}
        onClick={() => setOpen(!open)}
        title="Workspace Presets"
        style={{ gap: 4, fontSize: 11 }}
      >
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ opacity: 0.6 }}>
          <rect x="1" y="1" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.2" fill="none" />
          <rect x="8" y="1" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.2" fill="none" />
          <rect x="1" y="8" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.2" fill="none" />
          <rect x="8" y="8" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.2" fill="none" />
        </svg>
        {activeLabel && (
          <span style={{ maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeLabel}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="tf-chart-dropdown"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 6,
            minWidth: 260,
            maxHeight: '70vh',
            overflowY: 'auto',
          }}
        >
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
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 16, width: 22, textAlign: 'center', flexShrink: 0 }}>
                  {preset.icon}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: isActive ? C.b : C.t1,
                    fontFamily: F,
                  }}>
                    {preset.name}
                  </div>
                  <div style={{
                    fontSize: 9,
                    color: C.t3,
                    fontFamily: F,
                    marginTop: 1,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {preset.description}
                  </div>
                </div>
                {isActive && (
                  <span style={{ color: C.b, fontSize: 13, flexShrink: 0, fontWeight: 700 }}>✓</span>
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
                  <div
                    key={ws.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 0 }}
                  >
                    <button
                      className="tf-chart-dropdown-item"
                      data-active={isActive || undefined}
                      onClick={() => handleLoadCustom(ws)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setRenamingId(ws.id);
                        setRenameValue(ws.name);
                      }}
                      style={{ flex: 1, textAlign: 'left' }}
                    >
                      <span style={{ fontSize: 14, width: 22, textAlign: 'center', flexShrink: 0 }}>📂</span>
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
                          style={{
                            flex: 1,
                            background: C.bg,
                            border: `1px solid ${C.bd}`,
                            borderRadius: 4,
                            padding: '2px 6px',
                            fontSize: 12,
                            fontFamily: F,
                            color: C.t1,
                            outline: 'none',
                          }}
                        />
                      ) : (
                        <span style={{
                          fontSize: 12,
                          fontWeight: isActive ? 600 : 500,
                          color: isActive ? C.b : C.t1,
                          fontFamily: F,
                        }}>
                          {ws.name}
                        </span>
                      )}
                      {isActive && (
                        <span style={{ marginLeft: 'auto', color: C.b, fontSize: 13, fontWeight: 700 }}>✓</span>
                      )}
                    </button>
                    <button
                      className="tf-btn"
                      onClick={(e) => { e.stopPropagation(); remove(ws.id); }}
                      title="Delete preset"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: C.t3,
                        fontSize: 11,
                        cursor: 'pointer',
                        padding: '6px 8px',
                        borderRadius: 4,
                        transition: 'color 0.15s',
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#EF5350'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = C.t3; }}
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
            <div style={{ padding: '6px 10px', display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                autoFocus
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setSaving(false); }}
                placeholder="Preset name…"
                style={{
                  flex: 1,
                  background: C.bg,
                  border: `1px solid ${C.bd}`,
                  borderRadius: 6,
                  padding: '4px 8px',
                  fontSize: 11,
                  fontFamily: F,
                  color: C.t1,
                  outline: 'none',
                }}
              />
              <button
                className="tf-btn"
                onClick={handleSave}
                style={{
                  background: C.b,
                  border: 'none',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: F,
                  padding: '4px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Save
              </button>
            </div>
          ) : (
            <button
              className="tf-chart-dropdown-item"
              onClick={() => setSaving(true)}
              style={{ fontWeight: 600, color: C.b }}
            >
              <span style={{ fontSize: 14, width: 22, textAlign: 'center', flexShrink: 0 }}>+</span>
              Save Current as Preset
            </button>
          )}
        </div>
      )}
    </div>
  );
}
