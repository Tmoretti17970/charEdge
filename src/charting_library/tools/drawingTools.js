// ═══════════════════════════════════════════════════════════════════
// charEdge v11 — drawingTools.js (Backward Compatibility Shim)
// Drawing tools are now in src/chartEngine/tools/
// This shim provides the old API surface for existing consumers.
// ═══════════════════════════════════════════════════════════════════

// Tool configuration — full catalog matching DrawingModel.js (42 tools)
export const TOOL_CONFIG = {
  // ── Selection ──
  select: { label: 'Select', points: 0, icon: '⬚' },

  // ── Lines ──
  trendline: { label: 'Trend Line', points: 2, icon: '📈' },
  ray: { label: 'Ray', points: 2, icon: '→' },
  extendedline: { label: 'Extended Line', points: 2, icon: '↔' },
  hline: { label: 'Horizontal Line', points: 1, icon: '┄' },
  hray: { label: 'Horizontal Ray', points: 1, icon: '─' },
  vline: { label: 'Vertical Line', points: 1, icon: '│' },
  crossline: { label: 'Crossline', points: 1, icon: '✚' },
  arrow: { label: 'Arrow', points: 2, icon: '➤' },
  infoline: { label: 'Info Line', points: 2, icon: 'ℹ' },
  polyline: { label: 'Polyline', points: Infinity, icon: '⌇' },

  // ── Fibonacci ──
  fib: { label: 'Fib Retracement', points: 2, icon: '≡' },
  fibext: { label: 'Fib Extension', points: 3, icon: '⟹' },
  fibtimezone: { label: 'Fib Time Zone', points: 2, icon: '⏱' },
  fibarc: { label: 'Fib Arc', points: 2, icon: '◠' },
  fibfan: { label: 'Fib Fan', points: 2, icon: '⌗' },
  fibchannel: { label: 'Fib Channel', points: 3, icon: '⊟' },

  // ── Channels ──
  channel: { label: 'Channel', points: 3, icon: '⊏' },
  parallelchannel: { label: 'Parallel Channel', points: 3, icon: '⊏' },
  regressionchannel: { label: 'Regression Channel', points: 2, icon: '📊' },
  pitchfork: { label: 'Pitchfork', points: 3, icon: '⌥' },

  // ── Gann ──
  gannfan: { label: 'Gann Fan', points: 2, icon: '🌀' },
  gannsquare: { label: 'Gann Square', points: 2, icon: '⊞' },

  // ── Shapes ──
  rect: { label: 'Rectangle', points: 2, icon: '□' },
  triangle: { label: 'Triangle', points: 3, icon: '△' },
  ellipse: { label: 'Ellipse', points: 2, icon: '⬭' },

  // ── Text & Annotations ──
  text: { label: 'Text', points: 1, icon: 'T' },
  callout: { label: 'Callout', points: 1, icon: '💬' },
  note: { label: 'Note', points: 1, icon: '📝' },
  signpost: { label: 'Signpost', points: 1, icon: '🏷' },
  emoji: { label: 'Emoji', points: 1, icon: '😊' },

  // ── Measurement ──
  measure: { label: 'Measure', points: 2, icon: '📐' },
  pricerange: { label: 'Price Range', points: 2, icon: '↕' },
  daterange: { label: 'Date Range', points: 2, icon: '↔' },

  // ── Trading ──
  longposition: { label: 'Long Position', points: 2, icon: '🟢' },
  shortposition: { label: 'Short Position', points: 2, icon: '🔴' },
  alertzone: { label: 'Alert Zone', points: 2, icon: '⚠' },
  flattop: { label: 'Flat Top', points: 2, icon: '⊤' },
  flatbottom: { label: 'Flat Bottom', points: 2, icon: '⊥' },

  // ── Patterns ──
  elliott: { label: 'Elliott Wave', points: 5, icon: '🌊' },
  xabcd: { label: 'XABCD Harmonic', points: 5, icon: '🦋' },
  headshoulders: { label: 'Head & Shoulders', points: 7, icon: '👤' },
};

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
