// ═══════════════════════════════════════════════════════════════════
// sessionTagger — Infer trading session from trade time
// Auto-tags trades with market session (Pre-Market, Open, etc.)
// ═══════════════════════════════════════════════════════════════════

/**
 * Map a trade timestamp to a US market session label.
 * Uses local time (assumes user is in their trading timezone).
 *
 * @param {string} isoDate - Trade date in ISO format
 * @returns {string} Session label or empty string
 */
export function getSessionTag(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '';
  const h = d.getHours();
  const mins = h * 60 + d.getMinutes();

  if (mins < 240) return 'After Hours'; // 12:00 AM – 4:00 AM
  if (mins < 570) return 'Pre-Market'; // 4:00 AM – 9:30 AM
  if (mins < 600) return 'Open'; // 9:30 AM – 10:00 AM
  if (mins < 840) return 'Midday'; // 10:00 AM – 2:00 PM
  if (mins < 960) return 'Power Hour'; // 2:00 PM – 4:00 PM
  return 'After Hours'; // 4:00 PM – 12:00 AM
}
