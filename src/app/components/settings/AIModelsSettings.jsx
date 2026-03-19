// ═══════════════════════════════════════════════════════════════════
// charEdge — AI Models Settings Panel (Sprint 46)
//
// Settings section for managing ML models:
//   - Global ML toggle
//   - Per-model enable/disable switches
//   - Model status (loaded/unloaded), size, inference stats
//   - Load All / Unload All controls
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import { useModelStore } from '../../../state/useModelStore';
import { mlPipeline } from '../../../charting_library/ai/MLPipeline.js';
import { C, F, M } from '../../../constants.js';

// ─── Model Metadata ─────────────────────────────────────────────

const MODEL_META = {
  'regime-classifier': { emoji: '🎯', desc: 'Market regime classification (8 classes)' },
  'pattern-detector': { emoji: '📊', desc: 'Chart pattern detection (12 patterns)' },
  'setup-quality': { emoji: '⭐', desc: 'Trade setup quality prediction' },
  'anomaly-autoencoder': { emoji: '🔍', desc: 'Anomaly detection via reconstruction error' },
  'behavior-classifier': { emoji: '🧠', desc: 'Session behavior classification (5 states)' },
  'entry-quality': { emoji: '📈', desc: 'ML-learned entry quality grading' },
};

// ─── Component ──────────────────────────────────────────────────

export default function AIModelsSettings() {
  const mlEnabled = useModelStore((s) => s.mlEnabled);
  const enabledModels = useModelStore((s) => s.enabledModels);
  const inferenceStats = useModelStore((s) => s.inferenceStats);
  const toggleMlEnabled = useModelStore((s) => s.toggleMlEnabled);
  const toggleModel = useModelStore((s) => s.toggleModel);
  const enableAll = useModelStore((s) => s.enableAll);
  const disableAll = useModelStore((s) => s.disableAll);

  const [modelStatus, setModelStatus] = useState([]);
  const [isAvailable, setIsAvailable] = useState(null);

  // Check ML availability and model status
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const avail = await mlPipeline.isAvailable();
        if (!cancelled) setIsAvailable(avail);
      } catch {
        if (!cancelled) setIsAvailable(false);
      }
      try {
        const status = mlPipeline.getModelStatus();
        if (!cancelled) setModelStatus(status);
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [enabledModels, mlEnabled]);

  const handlePreload = useCallback(async () => {
    try {
      await mlPipeline.preloadAll();
      setModelStatus(mlPipeline.getModelStatus());
    } catch {
      // graceful
    }
  }, []);

  const modelIds = Object.keys(enabledModels);

  return (
    <div style={{ fontFamily: F }}>
      {/* ─── Header ─────────────────────────────────── */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🤖</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>AI & Models</span>
        </div>
        <Toggle checked={mlEnabled} onChange={toggleMlEnabled} label="ML Engine" />
      </div>

      {/* ─── Status Banner ──────────────────────────── */}
      <div
        style={{
          padding: '8px 12px', borderRadius: 8, marginBottom: 12,
          background: isAvailable === true ? `${C.g}10` : isAvailable === false ? `${C.r}10` : `${C.y}10`,
          border: `1px solid ${isAvailable === true ? C.g : isAvailable === false ? C.r : C.y}30`,
          fontSize: 11, color: C.t2,
        }}
      >
        {isAvailable === null ? '⏳ Checking ONNX Runtime...' :
          isAvailable ? '✅ ONNX Runtime available — models run in-browser' :
            '⚠️ ONNX Runtime unavailable — using heuristic fallback'}
      </div>

      {/* ─── Bulk Controls ──────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button
          onClick={enableAll}
          disabled={!mlEnabled}
          style={btnStyle(mlEnabled)}
        >
          Enable All
        </button>
        <button
          onClick={disableAll}
          disabled={!mlEnabled}
          style={btnStyle(mlEnabled)}
        >
          Disable All
        </button>
        <button
          onClick={handlePreload}
          disabled={!mlEnabled || !isAvailable}
          style={{
            ...btnStyle(mlEnabled && isAvailable),
            background: C.b,
            color: '#fff',
            border: 'none',
          }}
        >
          Preload All
        </button>
      </div>

      {/* ─── Model List ─────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {modelIds.map((id) => {
          const meta = MODEL_META[id] || { emoji: '📦', desc: id };
          const status = modelStatus.find((s) => s.id === id);
          const stats = inferenceStats[id];
          const enabled = enabledModels[id];

          return (
            <div
              key={id}
              id={`model-setting-${id}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 10,
                background: enabled ? `${C.b}08` : 'transparent',
                border: `1px solid ${enabled ? `${C.b}20` : C.bd}`,
                opacity: mlEnabled ? 1 : 0.5,
                transition: 'all 0.2s ease',
              }}
            >
              <span style={{ fontSize: 18 }}>{meta.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, marginBottom: 2 }}>
                  {status?.name || id}
                </div>
                <div style={{ fontSize: 10, color: C.t3, lineHeight: 1.3 }}>
                  {meta.desc}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 9, fontFamily: M }}>
                  {status && (
                    <span style={{ color: status.loaded ? C.g : C.t3 }}>
                      {status.loaded ? '● Loaded' : '○ Unloaded'}
                    </span>
                  )}
                  {status?.sizeKB && (
                    <span style={{ color: C.t3 }}>{status.sizeKB}KB</span>
                  )}
                  {stats && (
                    <span style={{ color: '#6e5ce6' }}>
                      {stats.count} runs · {Math.round(stats.lastMs)}ms last
                    </span>
                  )}
                </div>
              </div>
              <Toggle
                checked={enabled}
                onChange={() => toggleModel(id)}
                disabled={!mlEnabled}
              />
            </div>
          );
        })}
      </div>

      {/* ─── Footer Info ────────────────────────────── */}
      <div style={{ marginTop: 14, fontSize: 10, color: C.t3, lineHeight: 1.5 }}>
        Models run entirely in your browser via ONNX Runtime WebAssembly.
        No data leaves your device. Disabling models reduces memory usage.
      </div>
    </div>
  );
}

// ─── Toggle Sub-component ───────────────────────────────────────

function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label || 'Toggle'}
      disabled={disabled}
      onClick={onChange}
      style={{
        width: 36, height: 20, borderRadius: 10,
        border: 'none', padding: 2,
        background: checked ? C.g : C.bd,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'background 0.2s ease',
        display: 'flex', alignItems: 'center',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 16, height: 16, borderRadius: '50%',
          background: '#fff',
          transition: 'transform 0.2s ease',
          transform: checked ? 'translateX(16px)' : 'translateX(0)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        }}
      />
    </button>
  );
}

function btnStyle(enabled) {
  return {
    flex: 1, padding: '6px 0', borderRadius: 6,
    border: `1px solid ${C.bd}`, background: 'transparent',
    color: enabled ? C.t2 : C.t3,
    fontSize: 10, fontFamily: M, fontWeight: 600,
    cursor: enabled ? 'pointer' : 'not-allowed',
    transition: 'all 0.15s ease',
    opacity: enabled ? 1 : 0.5,
  };
}
