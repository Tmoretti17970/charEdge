import { logger } from './logger';

// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — SafeJSON
// Drop-in replacement for JSON.parse/stringify that never throws.
// Returns fallback values on failure and optionally logs errors.
// ═══════════════════════════════════════════════════════════════════

const TAG = '[SafeJSON]';

/**
 * Parse a JSON string safely. Returns `fallback` if parsing fails.
 * @param {string} raw - JSON string to parse
 * @param {*} [fallback=null] - Value to return on failure
 * @param {Object} [opts]
 * @param {boolean} [opts.silent=false] - Suppress console.warn
 * @param {string} [opts.context] - Label for the warning message
 * @returns {*} Parsed value or fallback
 */
interface SafeJSONOpts {
  silent?: boolean;
  context?: string;
}

export function safeParse<T = unknown>(raw: string | null | undefined, fallback: T | null = null, opts: SafeJSONOpts = {}): T | null {
  if (raw == null || raw === '') return fallback;
  try {
    return JSON.parse(raw);
  } catch (err) {
    if (!opts.silent) {
      logger.ui.warn(`${TAG} parse failed${opts.context ? ` (${opts.context})` : ''}:`, (err as Error).message);
    }
    return fallback;
  }
}

/**
 * Stringify a value safely. Returns `fallback` if serialization fails.
 * @param {*} value - Value to serialize
 * @param {string} [fallback='null'] - Value to return on failure
 * @param {Object} [opts]
 * @param {boolean} [opts.silent=false]
 * @param {string} [opts.context]
 * @returns {string}
 */
export function safeStringify(value: unknown, fallback: string = 'null', opts: SafeJSONOpts = {}): string {
  try {
    return JSON.stringify(value);
  } catch (err) {
    if (!opts.silent) {
      logger.ui.warn(`${TAG} stringify failed${opts.context ? ` (${opts.context})` : ''}:`, (err as Error).message);
    }
    return fallback;
  }
}

/**
 * Deep clone via JSON round-trip. Returns `fallback` on failure.
 * Useful for detaching reactive objects.
 * @param {*} value
 * @param {*} [fallback=null]
 * @returns {*}
 */
export function safeClone<T = unknown>(value: T, fallback: T | null = null): T | null {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_) {
    return fallback;
  }
}

export default { safeParse, safeStringify, safeClone };
