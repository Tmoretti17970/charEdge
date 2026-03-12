// ═══════════════════════════════════════════════════════════════════
// charEdge — Safe Array Math Utilities
//
// Replacements for Math.max(...array) / Math.min(...array) which
// stack overflow for arrays with >~100K elements.
// Uses reduce() — O(n) time, O(1) stack.
// ═══════════════════════════════════════════════════════════════════

/**
 * Safe maximum of a numeric array (no stack overflow).
 * Returns -Infinity for empty arrays.
 */
export function safeMax(values: number[]): number {
  if (values.length === 0) return -Infinity;
  let max = values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i] > max) max = values[i];
  }
  return max;
}

/**
 * Safe minimum of a numeric array.
 * Returns Infinity for empty arrays.
 */
export function safeMin(values: number[]): number {
  if (values.length === 0) return Infinity;
  let min = values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i] < min) min = values[i];
  }
  return min;
}

/**
 * Safe max of a mapped array: safeMaxBy(items, item => item.price).
 * Returns -Infinity for empty arrays.
 */
export function safeMaxBy<T>(items: T[], fn: (item: T) => number): number {
  if (items.length === 0) return -Infinity;
  let max = fn(items[0]);
  for (let i = 1; i < items.length; i++) {
    const v = fn(items[i]);
    if (v > max) max = v;
  }
  return max;
}

/**
 * Safe min of a mapped array: safeMinBy(items, item => item.price).
 * Returns Infinity for empty arrays.
 */
export function safeMinBy<T>(items: T[], fn: (item: T) => number): number {
  if (items.length === 0) return Infinity;
  let min = fn(items[0]);
  for (let i = 1; i < items.length; i++) {
    const v = fn(items[i]);
    if (v < min) min = v;
  }
  return min;
}
