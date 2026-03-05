// ═══════════════════════════════════════════════════════════════════
// charEdge — Data Validator
//
// OHLCV data sanitization pipeline.
// Validates individual candles, detects gaps, and deduplicates.
//
// Usage:
//   import { validateCandleArray, detectGaps, deduplicateCandles } from './DataValidator.js';
//   const clean = validateCandleArray(rawBars);
// ═══════════════════════════════════════════════════════════════════

const ONE_DAY_MS = 86_400_000;

/**
 * Validate a single OHLCV candle.
 * @param {object} candle - { time, open, high, low, close, volume }
 * @returns {{ valid: boolean, candle: object, issues: string[] }}
 */
export function validateCandle(candle) {
  if (!candle || typeof candle !== 'object') {
    return { valid: false, candle, issues: ['not an object'] };
  }

  const issues = [];
  const fixed = { ...candle };

  // Time validation
  const t = typeof candle.time === 'string' ? new Date(candle.time).getTime() : candle.time;
  if (!t || isNaN(t)) {
    return { valid: false, candle, issues: ['invalid timestamp'] };
  }
  if (t > Date.now() + ONE_DAY_MS) {
    return { valid: false, candle, issues: ['timestamp in the future'] };
  }

  // Price validation — all must be numbers and non-negative
  for (const field of ['open', 'high', 'low', 'close']) {
    if (typeof candle[field] !== 'number' || isNaN(candle[field])) {
      return { valid: false, candle, issues: [`${field} is not a number`] };
    }
    if (candle[field] < 0) {
      return { valid: false, candle, issues: [`negative ${field}`] };
    }
  }

  // high < low → swap (fixable)
  if (fixed.high < fixed.low) {
    const tmp = fixed.high;
    fixed.high = fixed.low;
    fixed.low = tmp;
    issues.push('high < low (swapped)');
  }

  // Volume validation — negative → zero (fixable)
  if (typeof fixed.volume === 'number' && fixed.volume < 0) {
    fixed.volume = 0;
    issues.push('negative volume (zeroed)');
  }

  // Zero-close candles are likely filler data
  if (fixed.close === 0 && fixed.open === 0 && fixed.high === 0 && fixed.low === 0) {
    return { valid: false, candle, issues: ['all-zero candle'] };
  }

  return { valid: true, candle: fixed, issues };
}

/**
 * Validate and clean an array of OHLCV candles.
 * Removes invalid candles and fixes fixable issues.
 * @param {Array} bars - Array of OHLCV candle objects
 * @returns {Array} Cleaned array of valid candles
 */
export function validateCandleArray(bars) {
  if (!Array.isArray(bars)) return [];

  const result = [];
  for (const bar of bars) {
    const { valid, candle } = validateCandle(bar);
    if (valid) result.push(candle);
  }
  return result;
}

/**
 * Detect gaps in a candle array.
 * @param {Array} bars - Sorted OHLCV candles
 * @param {number} expectedIntervalMs - Expected interval between candles in ms
 * @returns {Array<{ afterIndex: number, afterTime: string, beforeTime: string, gapMs: number }>}
 */
export function detectGaps(bars, expectedIntervalMs) {
  if (!Array.isArray(bars) || bars.length < 2 || !expectedIntervalMs) return [];

  const gaps = [];
  // Allow 50% tolerance for interval variation (markets have gaps on weekends etc.)
  const threshold = expectedIntervalMs * 2;

  for (let i = 1; i < bars.length; i++) {
    const prevTime = typeof bars[i - 1].time === 'string' ? new Date(bars[i - 1].time).getTime() : bars[i - 1].time;
    const currTime = typeof bars[i].time === 'string' ? new Date(bars[i].time).getTime() : bars[i].time;
    const diff = currTime - prevTime;

    if (diff > threshold) {
      gaps.push({
        afterIndex: i - 1,
        afterTime: bars[i - 1].time,
        beforeTime: bars[i].time,
        gapMs: diff,
      });
    }
  }
  return gaps;
}

/**
 * Deduplicate candles by timestamp. Keeps the last occurrence.
 * @param {Array} bars - OHLCV candles (may contain duplicates)
 * @returns {Array} Deduplicated and sorted candles
 */
export function deduplicateCandles(bars) {
  if (!Array.isArray(bars) || bars.length === 0) return [];

  // Use a Map keyed by time string — last write wins
  const map = new Map();
  for (const bar of bars) {
    const key = typeof bar.time === 'string' ? bar.time : new Date(bar.time).toISOString();
    map.set(key, bar);
  }

  // Return sorted by time
  return [...map.values()].sort((a, b) => {
    const ta = typeof a.time === 'string' ? new Date(a.time).getTime() : a.time;
    const tb = typeof b.time === 'string' ? new Date(b.time).getTime() : b.time;
    return ta - tb;
  });
}

export default { validateCandle, validateCandleArray, detectGaps, deduplicateCandles };
