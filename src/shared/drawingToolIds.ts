// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Tool ID Constants
//
// Shared enum for drawing tool IDs used in keyboard shortcuts and
// the DrawingSidebar/chart tools store.
// ═══════════════════════════════════════════════════════════════════

export const DRAWING_TOOLS = /** @type {const} */ ({
  LINE: 'line',
  RECTANGLE: 'rectangle',
  TRENDLINE: 'trendline',
  HORIZONTAL: 'horizontal',
});

/** Map keyboard shortcut keys to drawing tool IDs */
export const DRAWING_TOOL_SHORTCUTS = /** @type {const} */ ({
  l: DRAWING_TOOLS.LINE,
  r: DRAWING_TOOLS.RECTANGLE,
  t: DRAWING_TOOLS.TRENDLINE,
  h: DRAWING_TOOLS.HORIZONTAL,
});

/** Map number keys to timeframes */
export const TIMEFRAME_SHORTCUTS = /** @type {const} */ ({
  '1': '1m',
  '2': '5m',
  '3': '15m',
  '4': '1h',
  '5': '4h',
  '6': '1D',
});
