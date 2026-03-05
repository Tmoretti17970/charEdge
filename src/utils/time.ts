// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — Time Utilities
//
// Date formatting and relative time display.
// ═══════════════════════════════════════════════════════════════════

/**
 * Today's date as YYYY-MM-DD string
 * @returns {string}
 */
export const todayStr = (): string => new Date().toISOString().slice(0, 10);

/**
 * Relative time string ("2h ago", "yesterday", "Mon", etc.)
 * @param {string|Date} date
 * @returns {string}
 */
export const timeAgo = (date: string | Date): string => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return d.toLocaleDateString(undefined, { weekday: 'short' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
