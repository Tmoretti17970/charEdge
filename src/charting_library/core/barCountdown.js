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
 * @returns {string}
 */
export function formatTimeLabel(timestamp, tf, prevTimestamp) {
  if (!timestamp || !isFinite(timestamp)) return '';
  const d = new Date(timestamp);
  const tfMs = tfToMs(tf);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const prev = prevTimestamp ? new Date(prevTimestamp) : null;

  // ─── Weekly / Monthly ─────────────────────────────────────────
  if (tfMs >= 86400000 * 7) {
    // Year boundary → show year
    if (prev && d.getUTCFullYear() !== prev.getUTCFullYear()) {
      return String(d.getUTCFullYear());
    }
    // Default: "Feb '26"
    return `${months[d.getUTCMonth()]} '${String(d.getUTCFullYear()).slice(2)}`;
  }

  // ─── Daily ────────────────────────────────────────────────────
  if (tfMs >= 86400000) {
    // Year boundary → show year
    if (prev && d.getUTCFullYear() !== prev.getUTCFullYear()) {
      return String(d.getUTCFullYear());
    }
    // Month boundary → show month name
    if (prev && d.getUTCMonth() !== prev.getUTCMonth()) {
      return months[d.getUTCMonth()];
    }
    // Default: "Feb 25"
    return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
  }

  // ─── Intraday (hours, minutes) ────────────────────────────────
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');

  // Year boundary → show year
  if (prev && d.getUTCFullYear() !== prev.getUTCFullYear()) {
    return String(d.getUTCFullYear());
  }
  // Day boundary → show date (TradingView style: "25 Feb")
  if (prev && d.getUTCDate() !== prev.getUTCDate()) {
    return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
  }
  // Default: "14:00"
  return `${hh}:${mm}`;
}

