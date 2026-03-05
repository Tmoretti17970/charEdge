// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — Color Utilities
// Replaces fragile hex concatenation (C.b + '18') with proper
// rgba() conversion. Works with hex colors (#rgb, #rrggbb, #rrggbbaa).
// ═══════════════════════════════════════════════════════════════════

/**
 * Convert a hex color to rgba with a given opacity.
 * @param {string} color — Color string (hex '#e8642c', '#fff' or rgb 'rgb(232,100,44)')
 * @param {number} opacity — Opacity from 0 to 1
 * @returns {string} — CSS rgba() value
 *
 * @example
 *   alpha('#e8642c', 0.1)  => 'rgba(232, 100, 44, 0.1)'
 *   alpha(C.b, 0.15)       => 'rgba(232, 100, 44, 0.15)'
 */
export function alpha(color: string, opacity: number): string {
  if (!color || typeof color !== 'string') return `rgba(0,0,0,${opacity})`;

  // Handle rgb() / rgba() strings (e.g. from getComputedStyle)
  const rgbMatch = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    return `rgba(${rgbMatch[1]},${rgbMatch[2]},${rgbMatch[3]},${opacity})`;
  }

  // Handle hex colors
  let h = color.replace(/^#/, '');

  // Expand shorthand (#rgb → #rrggbb)
  if (h.length === 3) {
    h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
  }

  // Take only the first 6 characters (ignore existing alpha)
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);

  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(0,0,0,${opacity})`;

  return `rgba(${r},${g},${b},${opacity})`;
}

/**
 * Map of common hex opacity suffixes to decimal values.
 * For reference when migrating old code.
 *
 *   '04' → 0.016    '08' → 0.031    '0c' → 0.047
 *   '10' → 0.063    '12' → 0.071    '15' → 0.082
 *   '18' → 0.094    '20' → 0.125    '25' → 0.145
 *   '30' → 0.188    '40' → 0.251    '50' → 0.314
 *   '60' → 0.376    '80' → 0.502    'aa' → 0.667
 *   'cc' → 0.800    'DD' → 0.867
 */
export const HEX_TO_OPACITY: Record<string, number> = {
  '04': 0.02,
  '06': 0.024,
  '08': 0.03,
  '0c': 0.05,
  10: 0.06,
  12: 0.07,
  15: 0.08,
  18: 0.09,
  20: 0.13,
  25: 0.15,
  30: 0.19,
  40: 0.25,
  50: 0.31,
  60: 0.38,
  80: 0.5,
  aa: 0.67,
  cc: 0.8,
  DD: 0.87,
};
