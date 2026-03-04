// ═══════════════════════════════════════════════════════════════════
// charEdge — GPUComputeStage
//
// Render pipeline stage that dispatches indicator computations to
// WebGPU compute shaders when available. Runs before IndicatorStage
// so GPU-computed results are ready for rendering.
//
// Supported GPU indicators: EMA, RSI, MACD, Bollinger Bands
// Fallback: no-op (IndicatorStage uses CPU-computed data from registry)
//
// Phase 1 Task 1.2.2: Connect WebGPU compute to render pipeline
// ═══════════════════════════════════════════════════════════════════

/**
 * GPU-accelerated indicator pre-computation stage.
 *
 * When WebGPU is available, this stage intercepts active indicators
 * that have GPU shader equivalents and replaces their computed data
 * with GPU-computed results. The IndicatorStage then renders these
 * results without knowing the difference.
 *
 * GPU-eligible indicators:
 *   - ema  → WebGPUCompute.computeEMA()
 *   - rsi  → WebGPUCompute.computeRSI()
 *   - macd → WebGPUCompute.computeMACD()
 *   - bb   → WebGPUCompute.computeBollinger()
 *
 * @param {import('../FrameState.js').FrameState} fs
 * @param {Object} ctx - Render contexts
 * @param {Object} engine - ChartEngine instance
 */
export function executeGPUComputeStage(fs, ctx, engine) {
  const gpuCompute = engine._gpuCompute;
  if (!gpuCompute?.available) return; // No WebGPU → no-op, CPU fallback is used

  const { bars, overlayInds, paneInds } = fs;
  if (!bars?.length) return;

  // Collect all indicators that have GPU shader equivalents
  const allInds = [...(overlayInds || []), ...(paneInds || [])].filter(Boolean);
  const gpuEligible = allInds.filter(ind => {
    if (!ind.visible || !ind.indicatorId) return false;
    return GPU_INDICATOR_MAP[ind.indicatorId];
  });

  if (gpuEligible.length === 0) return;

  // Extract close prices once (shared across GPU shaders)
  const closes = new Float32Array(bars.length);
  for (let i = 0; i < bars.length; i++) {
    closes[i] = bars[i].close;
  }

  // Dispatch GPU computations asynchronously
  // Results will be available on the next frame (async pipeline)
  for (const ind of gpuEligible) {
    const dispatchFn = GPU_INDICATOR_MAP[ind.indicatorId];
    if (dispatchFn && !ind._gpuPending) {
      ind._gpuPending = true;
      dispatchFn(gpuCompute, closes, ind.params, bars).then(result => {
        if (result) {
          ind.computed = result;
          ind._gpuComputed = true;
          // Mark indicators dirty so IndicatorStage re-renders
          if (ctx.layers) ctx.layers.markDirty?.('INDICATORS');
          engine.markDirty?.();
        }
        ind._gpuPending = false;
      }).catch(() => {
        ind._gpuPending = false;
        // Silently fall back to CPU computation (already in ind.computed)
      });
    }
  }
}

// ─── GPU Indicator Dispatch Map ───────────────────────────────

const GPU_INDICATOR_MAP = {
  ema: async (gpu, closes, params) => {
    const result = await gpu.computeEMA(closes, params.period || 20);
    return result ? { ema: Array.from(result) } : null;
  },

  sma: async (gpu, closes, params) => {
    // SMA can be approximated via EMA with a large multiplier,
    // but for accuracy we skip GPU for SMA (no dedicated shader)
    return null;
  },

  rsi: async (gpu, closes, params) => {
    const result = await gpu.computeRSI(closes, params.period || 14);
    return result ? { rsi: Array.from(result) } : null;
  },

  macd: async (gpu, closes, params) => {
    const result = await gpu.computeMACD(
      closes,
      params.fast || 12,
      params.slow || 26,
      params.signal || 9
    );
    return result ? {
      macd: Array.from(result.macd),
      signal: Array.from(result.signal),
      histogram: Array.from(result.histogram),
    } : null;
  },

  bb: async (gpu, closes, params) => {
    const result = await gpu.computeBollinger(
      closes,
      params.period || 20,
      params.stdDev || 2
    );
    return result ? {
      middle: Array.from(result.middle),
      upper: Array.from(result.upper),
      lower: Array.from(result.lower),
    } : null;
  },
};
