// ═══════════════════════════════════════════════════════════════════
// charEdge — Bar & Input Validation
//
// Pure validation functions for ChartEngine inputs.
// Returns { valid, errors } objects — never throws.
// Designed to be called in dev mode for developer warnings.
//
// Usage:
//   import { validateBars, validateProps, validateIndicators } from './validateBars.js';
//   const result = validateBars(bars);
//   if (!result.valid) result.errors.forEach(e => console.warn(e.message));
// ═══════════════════════════════════════════════════════════════════

import { ChartError, ERROR_CODES } from './ChartError.js';

/** Validation result returned by all validators. */
export interface ValidationResult {
  valid: boolean;
  errors: ChartError[];
}

/** Shape of a single OHLCV bar. */
export interface Bar {
  open: number;
  high: number;
  low: number;
  close: number;
  time: number;
  volume?: number;
}

/** Shape of a chart indicator. */
export interface Indicator {
  name: string;
  values: number[] | Float32Array;
  color?: string;
  lineWidth?: number;
  dash?: number[];
}

const REQUIRED_BAR_FIELDS: readonly string[] = ['open', 'high', 'low', 'close', 'time'];

/**
 * Validate an array of OHLCV bar objects.
 * Checks: array type, required fields, numeric values, time ordering.
 */
export function validateBars(bars: unknown): ValidationResult {
  const errors: ChartError[] = [];

  // Empty array is valid (no data = no error)
  if (!Array.isArray(bars)) {
    errors.push(new ChartError(
      ERROR_CODES.INVALID_BAR_DATA,
      'setData() expects an array of bar objects, received ' + typeof bars,
      { received: typeof bars }
    ));
    return { valid: false, errors };
  }

  if (bars.length === 0) {
    return { valid: true, errors: [] };
  }

  // Check first 10 bars for shape + NaN (sampling for performance on large datasets)
  const sampleSize = Math.min(bars.length, 10);
  const checkIndices: number[] = [
    ...Array.from({ length: Math.min(sampleSize, 5) }, (_, i) => i), // first 5
    bars.length - 1, // last bar (always check)
  ];
  // Deduplicate indices
  const uniqueIndices = [...new Set(checkIndices)];

  for (const i of uniqueIndices) {
    const bar = bars[i] as Record<string, unknown>;
    if (!bar || typeof bar !== 'object') {
      errors.push(new ChartError(
        ERROR_CODES.INVALID_BAR_DATA,
        `Bar at index ${i} is not an object (got ${typeof bar})`,
        { index: i, value: bar }
      ));
      continue;
    }

    for (const field of REQUIRED_BAR_FIELDS) {
      if (!(field in bar)) {
        errors.push(new ChartError(
          ERROR_CODES.INVALID_BAR_DATA,
          `Bar at index ${i} is missing required field "${field}"`,
          { index: i, field }
        ));
      } else if (typeof bar[field] !== 'number' || Number.isNaN(bar[field])) {
        errors.push(new ChartError(
          ERROR_CODES.INVALID_BAR_DATA,
          `Bar at index ${i} has invalid "${field}": ${bar[field]} (must be a finite number)`,
          { index: i, field, value: bar[field] }
        ));
      }
    }

    // Volume is optional but must be numeric if present
    if ('volume' in bar && bar.volume !== undefined && bar.volume !== null) {
      if (typeof bar.volume !== 'number' || Number.isNaN(bar.volume)) {
        errors.push(new ChartError(
          ERROR_CODES.INVALID_BAR_DATA,
          `Bar at index ${i} has invalid "volume": ${bar.volume} (must be a number)`,
          { index: i, field: 'volume', value: bar.volume }
        ));
      }
    }
  }

  // Check time ordering (sample: first→second, last two)
  if (bars.length >= 2 && errors.length === 0) {
    const typedBars = bars as Bar[];
    if (typedBars[1].time <= typedBars[0].time) {
      errors.push(new ChartError(
        ERROR_CODES.UNORDERED_TIME,
        `Bars are not in chronological order: bar[0].time=${typedBars[0].time}, bar[1].time=${typedBars[1].time}`,
        { index: 1 }
      ));
    }
    if (typedBars.length > 2) {
      const last = typedBars.length - 1;
      if (typedBars[last].time <= typedBars[last - 1].time) {
        errors.push(new ChartError(
          ERROR_CODES.UNORDERED_TIME,
          `Bars are not in chronological order near end: bar[${last - 1}].time=${typedBars[last - 1].time}, bar[${last}].time=${typedBars[last].time}`,
          { index: last }
        ));
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Known props for ChartEngine.setProps().
 */
const KNOWN_PROPS: Set<string> = new Set([
  'chartType', 'theme', 'showVolume', 'showGrid', 'showCrosshair',
  'showPriceScale', 'showTimeScale', 'showWatermark', 'barSpacing',
  'rightMargin', 'leftMargin', 'scaleMode', 'autoScale', 'logScale',
  'percentScale', 'indexedScale', 'bullColor', 'bearColor', 'wickColor',
  'gridColor', 'backgroundColor', 'textColor', 'crosshairColor',
  'lineWidth', 'candleWidth', 'volumeOpacity', 'overlays',
  'showDrawings', 'showTradeMarkers', 'showAlerts', 'showOrderFlow',
]);

/**
 * Validate props object for ChartEngine.setProps().
 * Warns on unknown keys.
 */
export function validateProps(props: unknown): ValidationResult {
  const errors: ChartError[] = [];

  if (!props || typeof props !== 'object' || Array.isArray(props)) {
    errors.push(new ChartError(
      ERROR_CODES.INVALID_PROP,
      'setProps() expects a plain object',
      { received: typeof props }
    ));
    return { valid: false, errors };
  }

  for (const key of Object.keys(props)) {
    if (!KNOWN_PROPS.has(key)) {
      errors.push(new ChartError(
        ERROR_CODES.INVALID_PROP,
        `Unknown prop "${key}" passed to setProps(). Known props: ${[...KNOWN_PROPS].slice(0, 8).join(', ')}...`,
        { key }
      ));
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate an array of indicator objects.
 * Each must have { name: string, values: Array }.
 */
export function validateIndicators(indicators: unknown): ValidationResult {
  const errors: ChartError[] = [];

  if (!Array.isArray(indicators)) {
    errors.push(new ChartError(
      ERROR_CODES.INVALID_INDICATOR,
      'setIndicators() expects an array, received ' + typeof indicators,
      { received: typeof indicators }
    ));
    return { valid: false, errors };
  }

  for (let i = 0; i < indicators.length; i++) {
    const ind = indicators[i] as Record<string, unknown>;
    if (!ind || typeof ind !== 'object') {
      errors.push(new ChartError(
        ERROR_CODES.INVALID_INDICATOR,
        `Indicator at index ${i} is not an object`,
        { index: i }
      ));
      continue;
    }

    if (!ind.name || typeof ind.name !== 'string') {
      errors.push(new ChartError(
        ERROR_CODES.INVALID_INDICATOR,
        `Indicator at index ${i} is missing required "name" (string)`,
        { index: i }
      ));
    }

    if (!Array.isArray(ind.values)) {
      errors.push(new ChartError(
        ERROR_CODES.INVALID_INDICATOR,
        `Indicator "${ind.name || i}" is missing required "values" array`,
        { index: i, name: ind.name }
      ));
    }
  }

  return { valid: errors.length === 0, errors };
}
