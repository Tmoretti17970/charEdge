// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — Formatting Utilities
//
// Number formatting, dollar display, and unique ID generation.
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate a unique ID
 * @returns {string} Unique string ID
 */
export const uid = (): string => 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);

/**
 * Format a number with crypto-friendly context-aware precision.
 * - Zero → "0.00"
 * - ≥ 1M  → "1.23M"
 * - ≥ 10K → "12.3K"
 * - ≥ 1K  → "1,234.56" (with commas)
 * - ≥ 1   → "123.45" (2 decimals)
 * - ≥ 0.01 → "0.0542" (4 decimals, crypto-friendly)
 * - < 0.01 → "0.000042" (6 decimals, sub-penny crypto)
 * @param {number} n
 * @returns {string}
 */
export const fmt = (n: number | null | undefined): string => {
  if (n == null || isNaN(n)) return '0.00';
  if (n === 0) return '0.00';
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1e6) return sign + (a / 1e6).toFixed(2) + 'M';
  if (a >= 1e4) return sign + (a / 1e3).toFixed(1) + 'K';
  if (a >= 1000) return sign + a.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (a >= 1) return sign + a.toFixed(2);
  if (a >= 0.01) return sign + a.toFixed(4);
  return sign + a.toFixed(6);
};

/**
 * Format a dollar P&L with sign prefix and comma grouping.
 * - "+$5,370.42", "-$23.50", "+$0.0542"
 * @param {number} v
 * @returns {string} e.g. "+$5,370.42" or "-$0.42"
 */
export const fmtD = (v: number | null | undefined): string => {
  if (v == null || isNaN(v) || v === 0) return '+$0.00';
  return (v >= 0 ? '+$' : '-$') + fmt(Math.abs(v));
};
