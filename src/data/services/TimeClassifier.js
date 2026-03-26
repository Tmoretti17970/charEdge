// ═══════════════════════════════════════════════════════════════════
// charEdge — Time-Based Market Classifier
//
// Classifies prediction markets by resolution timeframe.
// Matches CoinMarketCap's time filter buckets.
// ═══════════════════════════════════════════════════════════════════

const MS_MINUTE = 60_000;
const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;
const MS_WEEK = 7 * MS_DAY;
const MS_MONTH = 31 * MS_DAY;
const MS_YEAR = 365 * MS_DAY;

/**
 * Classify a market's resolution timeframe based on its close date.
 * @param {string|null} closeDate - ISO timestamp
 * @returns {string} Time bucket ID
 */
export function classifyTimeframe(closeDate) {
  if (!closeDate) return 'oneOff';

  const ms = new Date(closeDate).getTime() - Date.now();
  if (ms <= 0) return 'oneOff';

  if (ms <= 5 * MS_MINUTE) return '5min';
  if (ms <= 15 * MS_MINUTE) return '15min';
  if (ms <= MS_HOUR) return 'hourly';
  if (ms <= MS_DAY) return 'daily';
  if (ms <= MS_WEEK) return 'weekly';
  if (ms <= MS_MONTH) return 'monthly';
  if (ms <= MS_YEAR) return 'yearly';
  return 'oneOff';
}

/**
 * Get time remaining as a human-readable countdown.
 * @param {string|null} closeDate
 * @returns {string|null}
 */
export function getTimeRemaining(closeDate) {
  if (!closeDate) return null;
  const ms = new Date(closeDate).getTime() - Date.now();
  if (ms <= 0) return 'Closed';

  const minutes = Math.floor(ms / MS_MINUTE);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(ms / MS_HOUR);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;

  const days = Math.floor(ms / MS_DAY);
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

/**
 * Filter markets by time bucket.
 * @param {Array} markets
 * @param {string} bucketId - 'all', '5min', '15min', 'hourly', 'daily', etc.
 * @returns {Array}
 */
export function filterByTimeframe(markets, bucketId) {
  if (bucketId === 'all') return markets;
  return markets.filter((m) => m.timeframe === bucketId);
}

/**
 * Count markets per time bucket.
 * @param {Array} markets
 * @returns {Object} { '5min': 12, 'daily': 45, ... }
 */
export function countByTimeframe(markets) {
  const counts = { all: markets.length };
  for (const m of markets) {
    const tf = m.timeframe || 'oneOff';
    counts[tf] = (counts[tf] || 0) + 1;
  }
  return counts;
}
