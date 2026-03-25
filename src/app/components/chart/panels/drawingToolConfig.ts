// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Tool Configuration (Phase 5: Extracted)
//
// Pure data and logic — no React dependencies.
// Declares which features each tool type supports.
// ═══════════════════════════════════════════════════════════════════

export const LINE_TOOLS = new Set([
  'trendline',
  'ray',
  'hray',
  'extendedline',
  'arrow',
  'crossline',
  'infoline',
  'polyline',
]);

export const SHAPE_TOOLS = new Set(['rect', 'ellipse', 'triangle', 'alertzone', 'parallelchannel']);

export const FIB_TOOLS = new Set(['fib', 'fibext', 'fibtimezone', 'fibarc', 'fibfan', 'fibchannel']);

export const CHANNEL_TOOLS = new Set(['channel', 'parallelchannel', 'regressionchannel', 'pitchfork']);

export const TRADE_TOOLS = new Set(['longposition', 'shortposition']);

export const ANNOTATION_TOOLS = new Set(['text', 'callout', 'note', 'signpost', 'emoji']);

export const MEASUREMENT_TOOLS = new Set(['measure', 'pricerange', 'daterange']);

export function getToolConfig(type: string) {
  if (TRADE_TOOLS.has(type)) {
    return {
      tabs: ['inputs', 'style', 'visibility'],
      hasInputs: true,
      hasExtend: false,
      hasLineEnds: false,
      hasMiddlePoint: false,
      hasPriceLabels: true,
      hasStats: true,
      hasCompactStats: true,
      hasBackground: false,
      hasMiddleLine: false,
      hasBorder: false,
      hasStopTargetColors: true,
      hasFibLevels: false,
      hasText: false,
      hasLineCompound: true,
    };
  }
  if (FIB_TOOLS.has(type)) {
    return {
      tabs: ['style', 'text', 'coordinates', 'visibility'],
      hasExtend: true,
      hasLineEnds: false,
      hasMiddlePoint: false,
      hasPriceLabels: true,
      hasStats: false,
      hasBackground: true,
      hasMiddleLine: false,
      hasBorder: false,
      hasFibLevels: true,
      hasText: true,
      hasLineCompound: true,
    };
  }
  if (SHAPE_TOOLS.has(type)) {
    return {
      tabs: ['style', 'text', 'coordinates', 'visibility'],
      hasExtend: type === 'rect' || type === 'parallelchannel',
      hasLineEnds: false,
      hasMiddlePoint: false,
      hasPriceLabels: false,
      hasStats: false,
      hasBackground: true,
      hasMiddleLine: type === 'rect',
      hasBorder: true,
      hasFibLevels: false,
      hasText: true,
      hasLineCompound: true,
    };
  }
  if (LINE_TOOLS.has(type)) {
    return {
      tabs: ['style', 'text', 'coordinates', 'visibility'],
      hasExtend: type !== 'extendedline',
      hasLineEnds: type === 'trendline' || type === 'ray' || type === 'extendedline',
      hasMiddlePoint: type === 'trendline' || type === 'ray',
      hasPriceLabels: true,
      hasStats: true,
      hasBackground: false,
      hasMiddleLine: false,
      hasBorder: false,
      hasFibLevels: false,
      hasText: true,
      hasLineCompound: true,
    };
  }
  if (CHANNEL_TOOLS.has(type)) {
    return {
      tabs: ['style', 'text', 'coordinates', 'visibility'],
      hasExtend: true,
      hasLineEnds: false,
      hasMiddlePoint: true,
      hasPriceLabels: false,
      hasStats: false,
      hasBackground: true,
      hasMiddleLine: true,
      hasBorder: true,
      hasFibLevels: false,
      hasText: true,
      hasLineCompound: true,
    };
  }
  if (ANNOTATION_TOOLS.has(type)) {
    return {
      tabs: ['style', 'text', 'coordinates', 'visibility'],
      hasExtend: false,
      hasLineEnds: false,
      hasMiddlePoint: false,
      hasPriceLabels: false,
      hasStats: false,
      hasBackground: type === 'callout' || type === 'note',
      hasMiddleLine: false,
      hasBorder: type === 'callout',
      hasFibLevels: false,
      hasText: true,
      hasLineCompound: type === 'callout',
    };
  }
  if (MEASUREMENT_TOOLS.has(type)) {
    return {
      tabs: ['style', 'text', 'coordinates', 'visibility'],
      hasExtend: type === 'pricerange',
      hasLineEnds: false,
      hasMiddlePoint: false,
      hasPriceLabels: true,
      hasStats: true,
      hasBackground: true,
      hasMiddleLine: false,
      hasBorder: false,
      hasFibLevels: false,
      hasText: true,
      hasLineCompound: true,
    };
  }
  // Default fallback
  return {
    tabs: ['style', 'text', 'coordinates', 'visibility'],
    hasExtend: false,
    hasLineEnds: false,
    hasMiddlePoint: false,
    hasPriceLabels: false,
    hasStats: false,
    hasBackground: false,
    hasMiddleLine: false,
    hasBorder: false,
    hasFibLevels: false,
    hasText: true,
    hasLineCompound: true,
  };
}

// ─── Constants ──────────────────────────────────────────────────

export const EXTEND_OPTIONS = [
  { id: 'none', label: "Don't extend" },
  { id: 'left', label: 'Extend left' },
  { id: 'right', label: 'Extend right' },
  { id: 'both', label: 'Extend both' },
];

export const STATS_OPTIONS = [
  { id: 'hidden', label: 'Hidden' },
  { id: 'values', label: 'Values' },
  { id: 'percent', label: 'Percent' },
  { id: 'both', label: 'Values & Percent' },
];

export const STATS_POSITION_OPTIONS = [
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
];

export const LABEL_POSITION_OPTIONS = [
  { id: 'left', label: 'Left' },
  { id: 'center', label: 'Center' },
  { id: 'right', label: 'Right' },
];

export const DEFAULT_FIB_LEVELS = [
  { value: 0, color: '#787B86', visible: true },
  { value: 0.236, color: '#F44336', visible: true },
  { value: 0.382, color: '#FF9800', visible: true },
  { value: 0.5, color: '#2196F3', visible: true },
  { value: 0.618, color: '#4CAF50', visible: true },
  { value: 0.786, color: '#9C27B0', visible: true },
  { value: 1.0, color: '#787B86', visible: true },
  { value: 1.618, color: '#E91E63', visible: false },
  { value: 2.618, color: '#00BCD4', visible: false },
  { value: 4.236, color: '#FF5722', visible: false },
];

export const TIMEFRAME_ROWS = [
  { id: 'seconds', label: 'Seconds', min: 1, max: 59 },
  { id: 'minutes', label: 'Minutes', min: 1, max: 59 },
  { id: 'hours', label: 'Hours', min: 1, max: 24 },
  { id: 'days', label: 'Days', min: 1, max: 366 },
  { id: 'weeks', label: 'Weeks', min: 1, max: 52 },
  { id: 'months', label: 'Months', min: 1, max: 12 },
];

export const RISK_UNIT_OPTIONS = [
  { id: '%', label: '%' },
  { id: '$', label: '$' },
];

export const QTY_PRECISION_OPTIONS = [
  { id: 'default', label: 'Default' },
  { id: '0', label: '0' },
  { id: '1', label: '0.0' },
  { id: '2', label: '0.00' },
  { id: '3', label: '0.000' },
];

// ─── Helpers ────────────────────────────────────────────────────

export function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function parseTimeInput(str: string): number | null {
  const d = new Date(str.replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d.getTime();
}
