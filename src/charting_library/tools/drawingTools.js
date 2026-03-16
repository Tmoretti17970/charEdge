// ═══════════════════════════════════════════════════════════════════
// charEdge v11 — drawingTools.js (Backward Compatibility Shim)
// Drawing tools are now in src/chartEngine/tools/
// This shim provides the old API surface for existing consumers.
// ═══════════════════════════════════════════════════════════════════

// Tool configuration — re-exported from central registry
import { TOOL_CONFIG as _TOOL_CONFIG } from '../../shared/drawingToolRegistry';

// Add legacy 'select' entry that the registry doesn't include
export const TOOL_CONFIG = { select: { label: 'Select', points: 0, icon: '⬚' }, ..._TOOL_CONFIG };

/**
 * Magnet snap to nearest OHLC price within threshold.
 */
export function magnetSnap(price, barIdx, data, threshold = 0.002) {
  if (!data || !data[barIdx]) return { price, barIdx };
  const bar = data[barIdx];
  const prices = [bar.open, bar.high, bar.low, bar.close];
  let closest = price;
  let minDist = Infinity;
  for (const p of prices) {
    const dist = Math.abs(p - price);
    if (dist < minDist) {
      minDist = dist;
      closest = p;
    }
  }
  const relThreshold = Math.abs(price) * threshold;
  return {
    price: minDist <= relThreshold ? closest : price,
    barIdx,
  };
}

// Drawing rendering is now handled by ChartEngineWidget
export function drawAllDrawings() { }
export function drawPendingPreview() { }
