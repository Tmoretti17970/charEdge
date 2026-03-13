// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Model
// All drawings are stored as price/time anchor points, NOT pixels.
// This means they survive zoom, scroll, resize, and serialization.
//
// Every drawing has:
//   - id: unique identifier
//   - type: tool type (trendline, fib, hray, etc.)
//   - points: array of {price, time} anchor points
//   - style: visual properties (color, width, etc.)
//   - state: interaction state (idle, creating, selected, dragging)
// ═══════════════════════════════════════════════════════════════════

let idCounter = 0;

/**
 * Generate a unique drawing ID.
 * BUG-13: Uses crypto.randomUUID for collision-free IDs, with a robust fallback.
 * @returns {string}
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `drw_${crypto.randomUUID().slice(0, 12)}`;
  }
  return `drw_${Date.now().toString(36)}_${(++idCounter).toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * @typedef {Object} AnchorPoint
 * @property {number} price - Price value
 * @property {number} time  - Unix timestamp (ms)
 */

/**
 * @typedef {Object} DrawingStyle
 * @property {string}  color           - Primary color
 * @property {number}  lineWidth       - Line width in CSS pixels
 * @property {number[]} [dash]         - Dash pattern (empty = solid)
 * @property {string}  [fillColor]     - Fill color (for shapes)
 * @property {number}  [opacity]       - Fill opacity (0-1)
 * @property {boolean} [showLabel]     - Show price/% labels
 * @property {string}  [font]          - Label font
 * @property {string}  [extend]        - 'none' | 'left' | 'right' | 'both'
 * @property {string}  [lineEndLeft]   - 'none' | 'arrow' | 'circle'
 * @property {string}  [lineEndRight]  - 'none' | 'arrow' | 'circle'
 * @property {boolean} [middlePoint]   - Show middle point on line
 * @property {boolean} [priceLabels]   - Show price labels at anchors
 * @property {string}  [stats]         - 'hidden' | 'values' | 'percent' | 'both'
 * @property {string}  [statsPosition] - 'left' | 'right'
 * @property {boolean} [alwaysShowStats] - Show stats even when not selected
 * @property {boolean} [compactStats]  - Compact stats mode (position tools)
 * @property {boolean} [middleLine]    - Show middle line (shapes)
 * @property {string}  [middleLineColor] - Middle line color
 * @property {number[]} [middleLineDash] - Middle line dash pattern
 * @property {string}  [borderColor]   - Border color (shapes)
 * @property {boolean} [showBackground] - Show background fill
 * @property {string}  [text]          - Text content
 * @property {string}  [textColor]     - Text color
 * @property {number}  [fontSize]      - Text font size
 * @property {boolean} [fontBold]      - Bold text
 * @property {boolean} [fontItalic]    - Italic text
 * @property {string}  [textAlignV]    - 'top' | 'center' | 'bottom'
 * @property {string}  [textAlignH]    - 'left' | 'center' | 'right'
 * @property {string}  [stopColor]     - Stop color (position tools)
 * @property {string}  [targetColor]   - Target color (position tools)
 * @property {number}  [accountSize]   - Account size (position tools)
 * @property {number}  [lotSize]       - Lot size (position tools)
 * @property {number}  [risk]          - Risk value (position tools)
 * @property {string}  [riskUnit]      - '%' | '$' (position tools)
 * @property {number}  [leverage]      - Leverage (position tools)
 */

/**
 * @typedef {Object} Drawing
 * @property {string}       id
 * @property {string}       type      - Tool type
 * @property {AnchorPoint[]} points   - Anchor points in price/time space
 * @property {DrawingStyle}  style    - Visual properties
 * @property {string}       state     - 'idle' | 'creating' | 'selected'
 * @property {boolean}      locked    - Prevent editing
 * @property {boolean}      visible   - Show/hide toggle
 * @property {Object}       [meta]    - Tool-specific metadata
 */

/** Default style for each tool type */
export const DEFAULT_STYLES = {
  trendline: {
    color: '#2962FF',
    lineWidth: 2,
    dash: [],
    showLabel: false,
    extend: 'none',
    lineEndLeft: 'none',
    lineEndRight: 'none',
    middlePoint: false,
    priceLabels: false,
    stats: 'hidden',
    statsPosition: 'right',
    alwaysShowStats: false,
  },
  hray: {
    color: '#787B86',
    lineWidth: 1,
    dash: [],
    showLabel: true,
  },
  hline: {
    color: '#787B86',
    lineWidth: 1,
    dash: [6, 4],
    showLabel: true,
  },
  ray: {
    color: '#2962FF',
    lineWidth: 2,
    dash: [],
    showLabel: false,
  },
  extendedline: {
    color: '#2962FF',
    lineWidth: 1,
    dash: [],
    showLabel: false,
  },
  fib: {
    color: '#787B86',
    lineWidth: 1,
    dash: [],
    showLabel: true,
    opacity: 0.08,
  },
  fibext: {
    color: '#787B86',
    lineWidth: 1,
    dash: [],
    showLabel: true,
    opacity: 0.08,
  },
  fibtimezone: {
    color: '#787B86',
    lineWidth: 1,
    dash: [4, 4],
    showLabel: true,
    opacity: 0.08,
  },
  gannfan: {
    color: '#2962FF',
    lineWidth: 1,
    dash: [],
    showLabel: true,
  },
  longposition: {
    color: '#2962FF',
    lineWidth: 1,
    dash: [],
    fillColor: '#089981',
    opacity: 0.2,
    font: '11px Arial',
    showLabel: true,
    stopColor: '#F23645',
    targetColor: '#089981',
    priceLabels: true,
    stats: 'hidden',
    compactStats: true,
    alwaysShowStats: false,
    accountSize: 1000,
    lotSize: 0.04,
    risk: 1,
    riskUnit: '%',
    leverage: 10000,
  },
  shortposition: {
    color: '#2962FF',
    lineWidth: 1,
    dash: [],
    fillColor: '#F23645',
    opacity: 0.2,
    font: '11px Arial',
    showLabel: true,
    stopColor: '#089981',
    targetColor: '#F23645',
    priceLabels: true,
    stats: 'hidden',
    compactStats: true,
    alwaysShowStats: false,
    accountSize: 1000,
    lotSize: 0.04,
    risk: 1,
    riskUnit: '%',
    leverage: 10000,
  },
  elliott: {
    color: '#2962FF',
    lineWidth: 2,
    dash: [],
    font: '14px Arial',
    showLabel: true,
  },
  rect: {
    color: '#2962FF',
    lineWidth: 1,
    dash: [],
    fillColor: 'rgba(41, 98, 255, 0.1)',
    opacity: 0.1,
    extend: 'none',
    borderColor: '#2962FF',
    middleLine: false,
    middleLineColor: '#787B86',
    middleLineDash: [4, 4],
    showBackground: true,
  },
  channel: {
    color: '#2962FF',
    lineWidth: 1,
    dash: [],
    fillColor: 'rgba(41, 98, 255, 0.05)',
  },
  crossline: {
    color: '#787B86',
    lineWidth: 1,
    dash: [4, 4],
    showLabel: true,
  },
  arrow: {
    color: '#2962FF',
    lineWidth: 2,
    dash: [],
    showLabel: false,
  },
  text: {
    color: '#D1D4DC',
    lineWidth: 1,
    dash: [],
    font: '14px Arial',
  },
  triangle: {
    color: '#2962FF',
    lineWidth: 1,
    dash: [],
    fillColor: 'rgba(41, 98, 255, 0.1)',
  },
  ellipse: {
    color: '#2962FF',
    lineWidth: 1,
    dash: [],
    fillColor: 'rgba(41, 98, 255, 0.1)',
  },
  pitchfork: {
    color: '#2962FF',
    lineWidth: 1,
    dash: [],
    fillColor: 'rgba(41, 98, 255, 0.05)',
  },
  callout: {
    color: '#D1D4DC',
    lineWidth: 1,
    dash: [],
    fillColor: '#2962FF',
    font: '12px Arial',
  },
  vline: {
    color: '#787B86',
    lineWidth: 1,
    dash: [6, 4],
    showLabel: true,
  },
  measure: {
    color: '#2962FF',
    lineWidth: 1,
    dash: [4, 3],
    fillColor: 'rgba(41, 98, 255, 0.06)',
    showLabel: true,
  },
  alertzone: {
    color: '#F59E0B',
    lineWidth: 1,
    dash: [],
    fillColor: 'rgba(245, 158, 11, 0.12)',
    showLabel: true,
    font: '12px Arial',
  },
  infoline: {
    color: '#2962FF',
    lineWidth: 1.5,
    dash: [],
    showLabel: true,
    font: '11px Arial',
  },
  parallelchannel: {
    color: '#2962FF',
    lineWidth: 1,
    dash: [],
    fillColor: 'rgba(41, 98, 255, 0.05)',
  },
  polyline: {
    color: '#2962FF',
    lineWidth: 2,
    dash: [],
    showLabel: false,
  },
  pricerange: {
    color: '#2962FF',
    lineWidth: 1,
    dash: [4, 3],
    fillColor: 'rgba(41, 98, 255, 0.06)',
    showLabel: true,
    font: '11px Arial',
  },
  daterange: {
    color: '#787B86',
    lineWidth: 1,
    dash: [4, 3],
    fillColor: 'rgba(120, 123, 134, 0.06)',
    showLabel: true,
    font: '11px Arial',
  },
  note: {
    color: '#F59E0B',
    lineWidth: 1,
    dash: [],
    fillColor: 'rgba(245, 158, 11, 0.08)',
    font: '12px Arial',
  },
  signpost: {
    color: '#26A69A',
    lineWidth: 1,
    dash: [],
    font: '11px Arial',
    showLabel: true,
  },
  fibarc: {
    color: '#787B86',
    lineWidth: 1,
    dash: [],
    showLabel: true,
    opacity: 0.06,
  },
  fibfan: {
    color: '#787B86',
    lineWidth: 1,
    dash: [],
    showLabel: true,
  },
  fibchannel: {
    color: '#787B86',
    lineWidth: 1,
    dash: [],
    fillColor: 'rgba(120, 123, 134, 0.04)',
    showLabel: true,
  },
  regressionchannel: {
    color: '#FF7043',
    lineWidth: 1,
    dash: [],
    fillColor: 'rgba(255, 112, 67, 0.08)',
    showLabel: true,
  },
  gannsquare: {
    color: '#2962FF',
    lineWidth: 1,
    dash: [],
    showLabel: true,
    opacity: 0.05,
  },
  xabcd: {
    color: '#E040FB',
    lineWidth: 1.5,
    dash: [],
    fillColor: 'rgba(224, 64, 251, 0.06)',
    showLabel: true,
    font: '11px Arial',
  },
  headshoulders: {
    color: '#FF9800',
    lineWidth: 1.5,
    dash: [],
    fillColor: 'rgba(255, 152, 0, 0.06)',
    showLabel: true,
    font: '11px Arial',
  },
  emoji: {
    color: '#FFD54F',
    lineWidth: 0,
    dash: [],
    font: '24px Arial',
  },
  flattop: {
    color: '#EF5350',
    lineWidth: 1.5,
    dash: [],
    fillColor: 'rgba(239, 83, 80, 0.08)',
    showLabel: true,
  },
  flatbottom: {
    color: '#26A69A',
    lineWidth: 1.5,
    dash: [],
    fillColor: 'rgba(38, 166, 154, 0.08)',
    showLabel: true,
  },
};

/** Fibonacci retracement levels (TradingView defaults) */
export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618];

/** Fibonacci level colors */
export const FIB_COLORS = {
  0: '#787B86',
  0.236: '#F44336',
  0.382: '#FF9800',
  0.5: '#FFEB3B',
  0.618: '#4CAF50',
  0.786: '#00BCD4',
  1: '#787B86',
  1.618: '#2196F3',
  2.618: '#9C27B0',
};

/** Tool configuration: how many anchor points each tool needs */
export const TOOL_POINT_COUNT = {
  trendline: 2,
  hray: 1, // 1 point (price only, extends infinitely)
  hline: 1, // 1 point (horizontal line across chart)
  ray: 2, // 2 points (extends from p1 through p2)
  extendedline: 2, // 2 points (extends both directions)
  fib: 2, // 2 points (start + end of range)
  fibext: 3, // 3 points (start, end, projection origin)
  fibtimezone: 2, // 2 points (distance between defines 1 unit)
  gannfan: 2, // 2 points (origin + angle guide)
  longposition: 2, // 2 points (entry + target, stop loss scales automatically)
  shortposition: 2, // 2 points (entry + target, stop loss scales automatically)
  rect: 2, // 2 points (opposite corners)
  channel: 3, // 3 points (2 for baseline + 1 for width)
  crossline: 1, // 1 point (vertical + horizontal cross)
  arrow: 2, // 2 points (start + end with arrowhead)
  text: 1, // 1 point (anchor)
  triangle: 3, // 3 points (vertices)
  ellipse: 2, // 2 points (bounding box corners)
  pitchfork: 3, // 3 points (origin, upper, lower)
  elliott: 5, // 5 points for standard impulse wave
  callout: 1, // 1 point (anchor for text bubble)
  vline: 1, // 1 point (time only, extends infinitely vertically)
  measure: 2, // 2 points (start + end of measured region)
  alertzone: 2, // 2 points (top + bottom of price zone)
  infoline: 2, // 2 points (start + end with info label)
  parallelchannel: 3, // 3 points (2 for baseline + 1 for width)
  polyline: Infinity, // N-click freeform connected lines
  pricerange: 2, // 2 points (top + bottom price levels)
  daterange: 2, // 2 points (start + end time)
  note: 1, // 1 point (anchor)
  signpost: 1, // 1 point (anchor)
  fibarc: 2, // 2 points (center + radius guide)
  fibfan: 2, // 2 points (origin + guide)
  fibchannel: 3, // 3 points (2 for baseline + 1 for width)
  regressionchannel: 2, // 2 points (start + end of regression range)
  gannsquare: 2,         // 2 points (origin + opposite corner)
  xabcd: 5,              // 5 points (X, A, B, C, D harmonic pattern)
  headshoulders: 7,      // 7 points (left shoulder valley, head, right shoulder, neckline)
  emoji: 1,              // 1 point (anchor)
  flattop: 2,            // 2 points (left + right defining resistance zone)
  flatbottom: 2,         // 2 points (left + right defining support zone)
};

/**
 * Create a new drawing object.
 *
 * @param {string} type - Tool type
 * @param {AnchorPoint} [firstPoint] - Optional first anchor point
 * @param {Partial<DrawingStyle>} [styleOverrides] - Custom style
 * @returns {Drawing}
 */
export function createDrawing(type, firstPoint, styleOverrides = {}) {
  const defaultStyle = DEFAULT_STYLES[type] || DEFAULT_STYLES.trendline;

  return {
    id: generateId(),
    type,
    points: firstPoint ? [{ ...firstPoint }] : [],
    style: { ...defaultStyle, ...styleOverrides },
    state: 'creating',
    locked: false,
    visible: true,
    syncAcrossTimeframes: true, // Visible on all timeframes by default
    meta: {},
  };
}

/**
 * Serialize drawings for persistence (IndexedDB / localStorage).
 *
 * @param {Drawing[]} drawings
 * @returns {string} JSON string
 */
export function serializeDrawings(drawings) {
  return JSON.stringify(
    drawings.map((d) => ({
      id: d.id,
      type: d.type,
      points: d.points,
      style: d.style,
      locked: d.locked,
      visible: d.visible,
      meta: d.meta,
      _groupId: d._groupId || null, // BUG-07: persist group membership
    })),
  );
}

/**
 * Deserialize drawings from storage.
 *
 * @param {string} json
 * @returns {Drawing[]}
 */
export function deserializeDrawings(json) {
  try {
    const arr = JSON.parse(json);
    return arr.map((d) => ({
      ...d,
      state: 'idle',
    }));
  // eslint-disable-next-line unused-imports/no-unused-vars
  } catch (_) {
    return [];
  }
}
