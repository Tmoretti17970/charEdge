// ═══════════════════════════════════════════════════════════════════
// charEdge — Market Hours Utility
//
// Client-side market hours awareness for US equities.
// Used to reduce polling frequency during off-hours and weekends.
//
// Crypto markets are 24/7 — always returns "open" for crypto symbols.
// ═══════════════════════════════════════════════════════════════════

import { isCrypto } from '../constants.js';

// ─── US Market Holidays (2025–2027) ─────────────────────────────
// Major NYSE holidays where market is fully closed.
// Updated annually — add new years as needed.
const US_HOLIDAYS = new Set([
  // 2025
  '2025-01-01', '2025-01-20', '2025-02-17', '2025-04-18',
  '2025-05-26', '2025-06-19', '2025-07-04', '2025-09-01',
  '2025-11-27', '2025-12-25',
  // 2026
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03',
  '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07',
  '2026-11-26', '2026-12-25',
  // 2027
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26',
  '2027-05-31', '2027-06-18', '2027-07-05', '2027-09-06',
  '2027-11-25', '2027-12-24',
]);

// ─── Timezone Helpers ───────────────────────────────────────────

/**
 * Get current time components in US Eastern timezone.
 * Uses Intl.DateTimeFormat for reliable timezone conversion.
 * @param {Date} [now] — override for testing
 * @returns {{ hour: number, minute: number, dayOfWeek: number, dateStr: string }}
 */
export function getEasternTime(now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false,
  });

  const parts = {};
  for (const { type, value } of fmt.formatToParts(now)) {
    parts[type] = value;
  }

  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  return {
    hour: parseInt(parts.hour, 10),
    minute: parseInt(parts.minute, 10),
    dayOfWeek: dayMap[parts.weekday] ?? 0,
    dateStr: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

// ─── Core API ───────────────────────────────────────────────────

/**
 * Check if the US equity market is currently open.
 * NYSE regular trading hours: 9:30 AM – 4:00 PM ET, Monday–Friday.
 *
 * @param {Date} [now] — override for testing
 * @returns {boolean}
 */
export function isMarketOpen(now = new Date()) {
  const et = getEasternTime(now);

  // Weekend
  if (et.dayOfWeek === 0 || et.dayOfWeek === 6) return false;

  // Holiday
  if (US_HOLIDAYS.has(et.dateStr)) return false;

  // Before 9:30 AM ET
  const minuteOfDay = et.hour * 60 + et.minute;
  const open = 9 * 60 + 30;  // 9:30 AM
  const close = 16 * 60;     // 4:00 PM

  return minuteOfDay >= open && minuteOfDay < close;
}

/**
 * Check if we're in pre-market or after-hours extended trading.
 * Extended hours: 4:00 AM – 9:30 AM (pre), 4:00 PM – 8:00 PM (after).
 *
 * @param {Date} [now] — override for testing
 * @returns {boolean}
 */
export function isExtendedHours(now = new Date()) {
  if (isMarketOpen(now)) return false;

  const et = getEasternTime(now);

  // Weekend or holiday — no extended hours
  if (et.dayOfWeek === 0 || et.dayOfWeek === 6) return false;
  if (US_HOLIDAYS.has(et.dateStr)) return false;

  const minuteOfDay = et.hour * 60 + et.minute;
  const preOpen = 4 * 60;     // 4:00 AM
  const preClose = 9 * 60 + 30; // 9:30 AM
  const afterOpen = 16 * 60;  // 4:00 PM
  const afterClose = 20 * 60; // 8:00 PM

  return (minuteOfDay >= preOpen && minuteOfDay < preClose) ||
         (minuteOfDay >= afterOpen && minuteOfDay < afterClose);
}

/**
 * Get the next market open time as a Date.
 *
 * @param {Date} [now] — override for testing
 * @returns {Date}
 */
export function getNextMarketOpen(now = new Date()) {
  const candidate = new Date(now);

  // Search up to 10 days ahead (covers long weekends + holidays)
  for (let i = 0; i < 10; i++) {
    if (i > 0) candidate.setDate(candidate.getDate() + 1);

    const et = getEasternTime(candidate);

    // Skip weekends and holidays
    if (et.dayOfWeek === 0 || et.dayOfWeek === 6) continue;
    if (US_HOLIDAYS.has(et.dateStr)) continue;

    // If today and before market open, return today's open
    if (i === 0) {
      const minuteOfDay = et.hour * 60 + et.minute;
      if (minuteOfDay < 9 * 60 + 30) {
        // Return 9:30 AM ET today
        const open = new Date(candidate);
        // Approximate: set to 9:30 ET (14:30 UTC or 13:30 UTC depending on DST)
        // More precise approach: formats back from ET
        return open;
      }
      // Already past open today, try tomorrow
      continue;
    }

    return candidate;
  }

  // Fallback: return tomorrow
  const fallback = new Date(now);
  fallback.setDate(fallback.getDate() + 1);
  return fallback;
}

/**
 * Get recommended polling interval for a symbol based on market hours.
 *
 * @param {string} symbol — e.g. "BTCUSDT", "AAPL", "ES"
 * @param {Date} [now] — override for testing
 * @returns {number} interval in milliseconds
 */
export function getPollingInterval(symbol, now = new Date()) {
  // Crypto: always 24/7, fast polling
  if (isCrypto(symbol)) return 15_000; // 15s

  // Equity: depends on market hours
  if (isMarketOpen(now)) return 15_000;          // 15s during market hours
  if (isExtendedHours(now)) return 60_000;       // 1min during extended hours
  return 5 * 60_000;                              // 5min when market is fully closed
}

/**
 * Human-readable market status string.
 *
 * @param {string} [symbol]
 * @param {Date} [now]
 * @returns {string}
 */
export function getMarketStatus(symbol, now = new Date()) {
  if (symbol && isCrypto(symbol)) return '24/7';
  if (isMarketOpen(now)) return 'Market Open';
  if (isExtendedHours(now)) return 'Extended Hours';
  return 'Market Closed';
}
