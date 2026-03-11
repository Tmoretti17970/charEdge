// ═══════════════════════════════════════════════════════════════════
// charEdge — Bar Close Countdown Utilities
// ═══════════════════════════════════════════════════════════════════

import { temporalEngine } from './TemporalEngine.ts';

/**
 * Convert a timeframe string to milliseconds.
 * @param {string} tf - e.g. '1m', '5m', '15m', '30m', '1h', '2h', '4h', '1D', '1W', '1M'
 * @returns {number} milliseconds
 */
export function tfToMs(tf) {
  if (!tf || typeof tf !== 'string') return 0;
  const s = tf.trim().toUpperCase();
  const num = parseInt(s, 10) || 1;
  const unit = s.replace(/\d+/g, '');

  switch (unit) {
    case 'M':
    case 'MIN':
      return num * 60 * 1000;
    case 'H':
      return num * 3600 * 1000;
    case 'D':
      return num * 86400 * 1000;
    case 'W':
      return num * 7 * 86400 * 1000;
    case 'MO':
    case 'MON':
      return num * 30 * 86400 * 1000; // approximate
    default:
      // Fallback: if it ends with 'm' (lowercase was uppercased)
      return num * 60 * 1000;
  }
}

/**
 * Format a millisecond duration as a countdown string.
 * @param {number} ms - remaining milliseconds
 * @returns {string} e.g. '4m 32s', '12s', '2h 15m', '--:--'
 */
export function formatCountdown(ms) {
  if (ms <= 0 || !isFinite(ms)) return '00:00';

  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  }
  return `${seconds}s`;
}

/**
 * Format a timestamp for the time axis based on timeframe context.
 * Uses TradingView-style boundary detection: each label shows only
 * the most significant change from the previous label.
 *
 * Intraday: "14:00" normally, "25 Feb" on day boundary
 * Daily:    "25" normally, "Feb" on month boundary, "2026" on year boundary
 * Weekly+:  "Feb" normally, "2026" on year boundary
 *
 * @param {number} timestamp - Unix milliseconds
 * @param {string} tf - timeframe string
 * @param {number} [prevTimestamp] - Previous label's timestamp for boundary detection
 * @param {string|boolean} [timezone='UTC'] - IANA timezone string, or boolean for backward compat
 * @returns {string}
 */
// 8.1.3: Reusable Date objects to avoid per-call GC allocation
const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatTimeLabel(timestamp, tf, prevTimestamp, timezone = 'UTC') {
  if (!timestamp || !isFinite(timestamp)) return '';

  // Backward-compat: if boolean is passed, map to IANA zone
  let tz = timezone;
  if (typeof timezone === 'boolean') {
    tz = timezone ? 'UTC' : Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  const ts = typeof timestamp === 'number' ? timestamp : +new Date(timestamp);
  const tfMs = tfToMs(tf);
  const months = _months;

  // Get date parts via TemporalEngine (handles arbitrary IANA timezones)
  const parts = temporalEngine.getParts(ts, tz);
  const { year: dYear, month: dMon, day: dDay, hour: dHrs, minute: dMins } = parts;
  // month is 1-based from getParts, _months is 0-based
  const monthIdx = dMon - 1;

  let prevParts = null;
  if (prevTimestamp) {
    const pts = typeof prevTimestamp === 'number' ? prevTimestamp : +new Date(prevTimestamp);
    prevParts = temporalEngine.getParts(pts, tz);
  }

  // ─── Weekly / Monthly ─────────────────────────────────────────
  if (tfMs >= 86400000 * 7) {
    // Year boundary → show year
    if (prevParts && dYear !== prevParts.year) {
      return String(dYear);
    }
    // Default: "Feb '26"
    return `${months[monthIdx]} '${String(dYear).slice(2)}`;
  }

  // ─── Daily ────────────────────────────────────────────────────
  if (tfMs >= 86400000) {
    // Year boundary → show year
    if (prevParts && dYear !== prevParts.year) {
      return String(dYear);
    }
    // Month boundary → show month name
    if (prevParts && dMon !== prevParts.month) {
      return months[monthIdx];
    }
    // Default: "Feb 25"
    return `${months[monthIdx]} ${dDay}`;
  }

  // ─── Intraday (hours, minutes) ────────────────────────────────
  const hh = String(dHrs).padStart(2, '0');
  const mm = String(dMins).padStart(2, '0');

  // Year boundary → show year
  if (prevParts && dYear !== prevParts.year) {
    return String(dYear);
  }
  // Day boundary → show date (TradingView style: "25 Feb")
  if (prevParts && dDay !== prevParts.day) {
    return `${dDay} ${months[monthIdx]}`;
  }
  // Default: "14:00"
  return `${hh}:${mm}`;
}
