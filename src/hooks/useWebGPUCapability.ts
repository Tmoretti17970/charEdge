// ═══════════════════════════════════════════════════════════════════
// charEdge — WebGPU Capability Hook (Sprint 57)
//
// Detects WebGPU availability and estimates GPU capability.
// Gates all in-browser LLM features.
//
// Usage:
//   const { hasWebGPU, canRun1B, canRun3B } = useWebGPUCapability();
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';

interface WebGPUCapability {
  /** Whether the browser supports WebGPU */
  hasWebGPU: boolean;
  /** Whether detection has completed */
  checked: boolean;
  /** GPU adapter description (if available) */
  gpuName: string | null;
  /** Estimated VRAM in MB (rough) */
  vramEstimateMB: number | null;
  /** Can run the 135M small model */
  canRun1B: boolean;
  /** Can run the 3.5B medium model */
  canRun3B: boolean;
  /** Human-readable summary */
  summary: string;
}

/**
 * Hook to detect WebGPU availability and GPU capability.
 */
export function useWebGPUCapability(): WebGPUCapability {
  const [capability, setCapability] = useState<WebGPUCapability>({
    hasWebGPU: false,
    checked: false,
    gpuName: null,
    vramEstimateMB: null,
    canRun1B: false,
    canRun3B: false,
    summary: 'Checking...',
  });

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      // Check basic WebGPU support
      if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
        if (!cancelled) {
          setCapability({
            hasWebGPU: false,
            checked: true,
            gpuName: null,
            vramEstimateMB: null,
            canRun1B: false,
            canRun3B: false,
            summary: 'WebGPU not supported in this browser',
          });
        }
        return;
      }

      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
          if (!cancelled) {
            setCapability({
              hasWebGPU: false,
              checked: true,
              gpuName: null,
              vramEstimateMB: null,
              canRun1B: false,
              canRun3B: false,
              summary: 'WebGPU adapter not available',
            });
          }
          return;
        }

        // Try to get adapter info
        const info = (adapter as unknown as Record<string, Record<string, string>>).info || {};
        const gpuName = info.description || info.device || info.vendor || 'Unknown GPU';

        // Estimate VRAM from maxBufferSize (rough heuristic)
        const limits = adapter.limits;
        const maxBuffer = limits?.maxBufferSize || 0;
        const vramEstimateMB = maxBuffer > 0 ? Math.round(maxBuffer / (1024 * 1024)) : null;

        // Capability thresholds
        const canRun1B = true; // 135M model runs on almost any WebGPU device
        const canRun3B = vramEstimateMB !== null && vramEstimateMB >= 4096;

        const summary = canRun3B
          ? `${gpuName} — Full AI (1B + 3B models)`
          : canRun1B
            ? `${gpuName} — Standard AI (1B model)`
            : `${gpuName} — Limited`;

        if (!cancelled) {
          setCapability({
            hasWebGPU: true,
            checked: true,
            gpuName,
            vramEstimateMB,
            canRun1B,
            canRun3B,
            summary,
          });
        }
      } catch {
        if (!cancelled) {
          setCapability({
            hasWebGPU: false,
            checked: true,
            gpuName: null,
            vramEstimateMB: null,
            canRun1B: false,
            canRun3B: false,
            summary: 'WebGPU detection failed',
          });
        }
      }
    }

    detect();
    return () => {
      cancelled = true;
    };
  }, []);

  return capability;
}

export default useWebGPUCapability;
