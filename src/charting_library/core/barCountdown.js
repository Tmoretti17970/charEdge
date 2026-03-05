// ═══════════════════════════════════════════════════════════════════
// charEdge — Bar Close Countdown Utilities
// ═══════════════════════════════════════════════════════════════════

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
 * @param {boolean} [useUTC=true] - Sprint 9: Use UTC (true) or local time (false)
 * @returns {string}
 */
// 8.1.3: Reusable Date objects to avoid per-call GC allocation
const _sharedDate = new Date(0);
const _sharedPrevDate = new Date(0);
const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatTimeLabel(timestamp, tf, prevTimestamp, useUTC = true) {
  if (!timestamp || !isFinite(timestamp)) return '';
  // 8.1.3: Reuse shared Date object — avoid allocating new Date() per label
  const ts = typeof timestamp === 'number' ? timestamp : +new Date(timestamp);
  _sharedDate.setTime(ts);
  const d = _sharedDate;
  const tfMs = tfToMs(tf);
  const months = _months;

  let prev = null;
  if (prevTimestamp) {
    const pts = typeof prevTimestamp === 'number' ? prevTimestamp : +new Date(prevTimestamp);
    _sharedPrevDate.setTime(pts);
    prev = _sharedPrevDate;
  }

  // Sprint 9: UTC/local time accessor helpers
  const getYear = useUTC ? (dt) => dt.getUTCFullYear() : (dt) => dt.getFullYear();
  const getMon = useUTC ? (dt) => dt.getUTCMonth() : (dt) => dt.getMonth();
  const getDate = useUTC ? (dt) => dt.getUTCDate() : (dt) => dt.getDate();
  const getHrs = useUTC ? (dt) => dt.getUTCHours() : (dt) => dt.getHours();
  const getMins = useUTC ? (dt) => dt.getUTCMinutes() : (dt) => dt.getMinutes();

  // ─── Weekly / Monthly ─────────────────────────────────────────
  if (tfMs >= 86400000 * 7) {
    // Year boundary → show year
    if (prev && getYear(d) !== getYear(prev)) {
      return String(getYear(d));
    }
    // Default: "Feb '26"
    return `${months[getMon(d)]} '${String(getYear(d)).slice(2)}`;
  }

  // ─── Daily ────────────────────────────────────────────────────
  if (tfMs >= 86400000) {
    // Year boundary → show year
    if (prev && getYear(d) !== getYear(prev)) {
      return String(getYear(d));
    }
    // Month boundary → show month name
    if (prev && getMon(d) !== getMon(prev)) {
      return months[getMon(d)];
    }
    // Default: "Feb 25"
    return `${months[getMon(d)]} ${getDate(d)}`;
  }

  // ─── Intraday (hours, minutes) ────────────────────────────────
  const hh = String(getHrs(d)).padStart(2, '0');
  const mm = String(getMins(d)).padStart(2, '0');

  // Year boundary → show year
  if (prev && getYear(d) !== getYear(prev)) {
    return String(getYear(d));
  }
  // Day boundary → show date (TradingView style: "25 Feb")
  if (prev && getDate(d) !== getDate(prev)) {
    return `${getDate(d)} ${months[getMon(d)]}`;
  }
  // Default: "14:00"
  return `${hh}:${mm}`;
}

