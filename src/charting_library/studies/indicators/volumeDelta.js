// ═══════════════════════════════════════════════════════════════════
// charEdge — Volume Delta Computation
//
// Simple heuristic: delta = (close >= open) ? +volume : -volume
// Provides per-bar delta and cumulative delta for pressure analysis.
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute volume delta for each bar.
 * @param {Array<{open: number, close: number, volume: number}>} bars
 * @returns {{ delta: number[], cumDelta: number[] }}
 */
export function computeVolumeDelta(bars) {
  if (!bars?.length) return { delta: [], cumDelta: [] };

  const delta = new Array(bars.length);
  const cumDelta = new Array(bars.length);
  let cum = 0;

  for (let i = 0; i < bars.length; i++) {
    const vol = bars[i].volume || 0;
    const d = bars[i].close >= bars[i].open ? vol : -vol;
    delta[i] = d;
    cum += d;
    cumDelta[i] = cum;
  }

  return { delta, cumDelta };
}
