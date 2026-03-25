// ═══════════════════════════════════════════════════════════════════
// charEdge — AI Models Settings Panel (Sprint 46)
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { mlPipeline } from '../../../charting_library/ai/MLPipeline.js';
import { C } from '../../../constants.js';
import { useModelStore } from '../../../state/useModelStore';
import st from './AIModelsSettings.module.css';

const MODEL_META = {
  'regime-classifier': { emoji: '🎯', desc: 'Market regime classification (8 classes)' },
  'pattern-detector': { emoji: '📊', desc: 'Chart pattern detection (12 patterns)' },
  'setup-quality': { emoji: '⭐', desc: 'Trade setup quality prediction' },
  'anomaly-autoencoder': { emoji: '🔍', desc: 'Anomaly detection via reconstruction error' },
  'behavior-classifier': { emoji: '🧠', desc: 'Session behavior classification (5 states)' },
  'entry-quality': { emoji: '📈', desc: 'ML-learned entry quality grading' },
};

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
        /* */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabledModels, mlEnabled]);

  const handlePreload = useCallback(async () => {
    try {
      await mlPipeline.preloadAll();
      setModelStatus(mlPipeline.getModelStatus());
    } catch {
      /* */
    }
  }, []);

  const modelIds = Object.keys(enabledModels);

  return (
    <div className={st.root}>
      <div className={st.header}>
        <div className={st.headerLeft}>
          <span className={st.headerIcon}>🤖</span>
          <span className={st.headerTitle}>AI & Models</span>
        </div>
        <Toggle checked={mlEnabled} onChange={toggleMlEnabled} label="ML Engine" />
      </div>

      <div
        className={st.statusBanner}
        style={{
          background: isAvailable === true ? `${C.g}10` : isAvailable === false ? `${C.r}10` : `${C.y}10`,
          border: `1px solid ${isAvailable === true ? C.g : isAvailable === false ? C.r : C.y}30`,
        }}
      >
        {isAvailable === null
          ? '⏳ Checking ONNX Runtime...'
          : isAvailable
            ? '✅ ONNX Runtime available — models run in-browser'
            : '⚠️ ONNX Runtime unavailable — using heuristic fallback'}
      </div>

      <div className={st.bulkRow}>
        <button
          onClick={enableAll}
          disabled={!mlEnabled}
          className={st.bulkBtn}
          style={{
            color: mlEnabled ? C.t2 : C.t3,
            cursor: mlEnabled ? 'pointer' : 'not-allowed',
            opacity: mlEnabled ? 1 : 0.5,
          }}
        >
          Enable All
        </button>
        <button
          onClick={disableAll}
          disabled={!mlEnabled}
          className={st.bulkBtn}
          style={{
            color: mlEnabled ? C.t2 : C.t3,
            cursor: mlEnabled ? 'pointer' : 'not-allowed',
            opacity: mlEnabled ? 1 : 0.5,
          }}
        >
          Disable All
        </button>
        <button
          onClick={handlePreload}
          disabled={!mlEnabled || !isAvailable}
          className={st.preloadBtn}
          style={{
            cursor: mlEnabled && isAvailable ? 'pointer' : 'not-allowed',
            opacity: mlEnabled && isAvailable ? 1 : 0.5,
          }}
        >
          Preload All
        </button>
      </div>

      <div className={st.modelList}>
        {modelIds.map((id) => {
          const meta = MODEL_META[id] || { emoji: '📦', desc: id };
          const status = modelStatus.find((s) => s.id === id);
          const stats = inferenceStats[id];
          const enabled = enabledModels[id];
          return (
            <div
              key={id}
              id={`model-setting-${id}`}
              className={st.modelRow}
              style={{
                background: enabled ? `${C.b}08` : 'transparent',
                border: `1px solid ${enabled ? `${C.b}20` : C.bd}`,
                opacity: mlEnabled ? 1 : 0.5,
              }}
            >
              <span className={st.modelEmoji}>{meta.emoji}</span>
              <div className={st.modelBody}>
                <div className={st.modelName}>{status?.name || id}</div>
                <div className={st.modelDesc}>{meta.desc}</div>
                <div className={st.modelStats}>
                  {status && (
                    <span style={{ color: status.loaded ? C.g : C.t3 }}>
                      {status.loaded ? '● Loaded' : '○ Unloaded'}
                    </span>
                  )}
                  {status?.sizeKB && <span style={{ color: C.t3 }}>{status.sizeKB}KB</span>}
                  {stats && (
                    <span style={{ color: '#6e5ce6' }}>
                      {stats.count} runs · {Math.round(stats.lastMs)}ms last
                    </span>
                  )}
                </div>
              </div>
              <Toggle checked={enabled} onChange={() => toggleModel(id)} disabled={!mlEnabled} />
            </div>
          );
        })}
      </div>

      <div className={st.footer}>
        Models run entirely in your browser via ONNX Runtime WebAssembly. No data leaves your device. Disabling models
        reduces memory usage.
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label || 'Toggle'}
      disabled={disabled}
      onClick={onChange}
      className={st.toggleTrack}
      style={{
        background: checked ? C.g : C.bd,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <div className={st.toggleThumb} style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }} />
    </button>
  );
}
