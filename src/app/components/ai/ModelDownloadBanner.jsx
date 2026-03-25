// ═══════════════════════════════════════════════════════════════════
// charEdge — Model Download Banner (Sprint 57)
//
// Opt-in banner for downloading the AI model to enable in-browser
// LLM intelligence. Shows progress bar during download.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { C } from '../../../constants.js';
import { useWebGPUCapability } from '../../../hooks/useWebGPUCapability.ts';
import { webLLMProvider, MODEL_CATALOG } from '@/WebLLMProvider.ts';

const ACCENT = '#6e5ce6';
const DISMISSED_KEY = 'charEdge:aiModelDismissed';

export default function ModelDownloadBanner() {
  const gpu = useWebGPUCapability();
  const [status, setStatus] = useState(webLLMProvider.status);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Subscribe to provider status
  useEffect(() => {
    return webLLMProvider.onStatusChange(setStatus);
  }, []);

  const handleDownload = useCallback(async () => {
    const modelId = gpu.canRun3B ? MODEL_CATALOG.medium.id : MODEL_CATALOG.small.id;
    await webLLMProvider.loadModel(modelId);
  }, [gpu.canRun3B]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, 'true');
    } catch {
      /* ignore */
    }
  }, []);

  // Don't show if: no WebGPU, already loaded, dismissed, or still checking
  if (!gpu.checked || !gpu.hasWebGPU || status.loaded || dismissed) return null;

  const model = gpu.canRun3B ? MODEL_CATALOG.medium : MODEL_CATALOG.small;

  // ─── Loading state ───────────────────────────────────────────
  if (status.loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 20px',
          background: `${ACCENT}08`,
          borderBottom: `1px solid ${ACCENT}15`,
        }}
      >
        <span style={{ fontSize: 16 }}>🧠</span>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 11,
              fontFamily: 'var(--tf-font)',
              fontWeight: 600,
              color: C.t1,
              marginBottom: 4,
            }}
          >
            Downloading {model.label}…
          </div>
          {/* Progress bar */}
          <div
            style={{
              width: '100%',
              height: 4,
              borderRadius: 2,
              background: `${C.bd}30`,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${status.progress}%`,
                height: '100%',
                borderRadius: 2,
                background: `linear-gradient(90deg, ${ACCENT}, #8b7cf7)`,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <div
            style={{
              fontSize: 9,
              fontFamily: 'var(--tf-mono)',
              color: C.t3,
              marginTop: 2,
            }}
          >
            {status.progressText}
          </div>
        </div>
      </div>
    );
  }

  // ─── Error state ─────────────────────────────────────────────
  if (status.error) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 20px',
          background: `${C.r}08`,
          borderBottom: `1px solid ${C.r}15`,
        }}
      >
        <span style={{ fontSize: 16 }}>⚠️</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--tf-font)', fontWeight: 600, color: C.t1 }}>
            AI model failed to load
          </div>
          <div style={{ fontSize: 9, fontFamily: 'var(--tf-mono)', color: C.t3 }}>{status.error}</div>
        </div>
        <button
          onClick={handleDownload}
          style={{
            padding: '4px 12px',
            borderRadius: 6,
            border: 'none',
            background: `${C.r}15`,
            color: C.r,
            fontSize: 10,
            fontWeight: 700,
            fontFamily: 'var(--tf-mono)',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
        <button
          onClick={handleDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: C.t3,
            cursor: 'pointer',
            fontSize: 14,
            padding: '2px 6px',
          }}
        >
          ✕
        </button>
      </div>
    );
  }

  // ─── Opt-in banner ───────────────────────────────────────────
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 20px',
        background: `linear-gradient(90deg, ${ACCENT}06, ${ACCENT}12)`,
        borderBottom: `1px solid ${ACCENT}15`,
      }}
    >
      <span style={{ fontSize: 16 }}>🧠</span>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 11,
            fontFamily: 'var(--tf-font)',
            fontWeight: 600,
            color: C.t1,
          }}
        >
          Enable AI Intelligence
        </div>
        <div
          style={{
            fontSize: 9,
            fontFamily: 'var(--tf-mono)',
            color: C.t3,
          }}
        >
          Download {model.label} ({model.size}) · {model.speed} · runs entirely in your browser
        </div>
      </div>
      <button
        onClick={handleDownload}
        style={{
          padding: '5px 14px',
          borderRadius: 8,
          border: 'none',
          background: ACCENT,
          color: '#fff',
          fontSize: 10,
          fontWeight: 700,
          fontFamily: 'var(--tf-mono)',
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        Download
      </button>
      <button
        onClick={handleDismiss}
        style={{
          background: 'none',
          border: 'none',
          color: C.t3,
          cursor: 'pointer',
          fontSize: 14,
          padding: '2px 6px',
        }}
      >
        ✕
      </button>
    </div>
  );
}
