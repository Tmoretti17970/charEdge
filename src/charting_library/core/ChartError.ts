// ═══════════════════════════════════════════════════════════════════
// charEdge — ChartError
//
// Custom error class for chart engine validation errors.
// Provides error codes and developer-friendly messages.
//
// Usage:
//   import { ChartError, ERROR_CODES } from './ChartError.js';
//   throw new ChartError(ERROR_CODES.INVALID_BAR_DATA, 'Bar at index 5 has NaN close');
// ═══════════════════════════════════════════════════════════════════

/** Error codes for chart engine validation. */
export const ERROR_CODES = {
  /** Bar data missing required OHLCV fields or contains NaN/non-numeric values */
  INVALID_BAR_DATA: 'INVALID_BAR_DATA',
  /** Bars are not in chronological order */
  UNORDERED_TIME: 'UNORDERED_TIME',
  /** Unknown prop key passed to setProps() */
  INVALID_PROP: 'INVALID_PROP',
  /** Indicator missing required fields (name, values) */
  INVALID_INDICATOR: 'INVALID_INDICATOR',
} as const;

/** Union type of all error codes */
export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

/** Developer-friendly fix suggestions per error code. */
const FIX_HINTS: Record<ErrorCode, string> = {
  [ERROR_CODES.INVALID_BAR_DATA]:
    'Each bar must have numeric { open, high, low, close, time } fields. ' +
    'Volume is optional but must be numeric if present.',
  [ERROR_CODES.UNORDERED_TIME]:
    'Sort bars by `time` in ascending order before calling setData().',
  [ERROR_CODES.INVALID_PROP]:
    'Check the charEdge API docs for supported prop keys.',
  [ERROR_CODES.INVALID_INDICATOR]:
    'Each indicator must have { name: string, values: number[] }. ' +
    'Optional: { color: string, lineWidth: number }.',
};

/** Custom error for chart engine validation issues. */
export class ChartError extends Error {
  code: ErrorCode;
  context: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, context: Record<string, unknown> = {}) {
    const hint = FIX_HINTS[code] || '';
    const fullMessage = hint
      ? `[charEdge] ${message}\n  Fix: ${hint}`
      : `[charEdge] ${message}`;

    super(fullMessage);
    this.name = 'ChartError';
    this.code = code;
    this.context = context;
  }
}

export default ChartError;
