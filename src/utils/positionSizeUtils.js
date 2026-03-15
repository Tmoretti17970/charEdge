// ═══════════════════════════════════════════════════════════════════
// charEdge — Smart Position Size Utilities
//
// Pure conversion functions for the toolbar position sizer.
// Given asset class + live price, converts between $ and qty.
// ═══════════════════════════════════════════════════════════════════

/**
 * Precision digits for each asset class.
 * Crypto allows fractional (8), stocks are whole shares (0),
 * forex uses lot precision (2), etc.
 */
const PRECISION = {
  crypto: 8,
  stock: 0,
  etf: 0,
  forex: 2,
  futures: 0,
  commodity: 2,
  index: 0,
  options: 0,
};

/**
 * Step sizes for the +/− buttons in USD mode.
 */
const USD_STEPS = [
  { threshold: 10000, step: 500 },
  { threshold: 1000, step: 100 },
  { threshold: 100, step: 25 },
  { threshold: 10, step: 5 },
  { threshold: 0, step: 1 },
];

/**
 * Step sizes for the +/− buttons in QTY mode, per asset class.
 */
const QTY_STEPS = {
  crypto: (qty) => (qty >= 10 ? 1 : qty >= 1 ? 0.5 : qty >= 0.1 ? 0.01 : 0.001),
  stock: () => 1,
  etf: () => 1,
  forex: (qty) => (qty >= 1 ? 0.1 : 0.01),
  futures: () => 1,
  commodity: (qty) => (qty >= 10 ? 1 : 0.1),
  index: () => 1,
  options: () => 1,
};

/**
 * Convert a dollar amount to asset quantity.
 * @param {number} dollarAmount
 * @param {number} price - current live price per unit
 * @param {string} assetClass - from SymbolRegistry
 * @returns {number}
 */
export function dollarToQty(dollarAmount, price, assetClass = 'crypto') {
  if (!price || price <= 0 || !dollarAmount) return 0;
  const raw = dollarAmount / price;
  const precision = PRECISION[assetClass] ?? 2;
  if (precision === 0) return Math.floor(raw);
  return +raw.toFixed(precision);
}

/**
 * Convert a quantity to dollar amount.
 * @param {number} qty
 * @param {number} price
 * @returns {number}
 */
export function qtyToDollar(qty, price) {
  if (!price || !qty) return 0;
  return +(qty * price).toFixed(2);
}

/**
 * Get decimal precision for an asset class.
 * @param {string} assetClass
 * @returns {number}
 */
export function getQtyPrecision(assetClass) {
  return PRECISION[assetClass] ?? 2;
}

/**
 * Get a human label for the quantity unit.
 * @param {string} assetClass
 * @param {string} [symbol]
 * @returns {string}
 */
export function getQtyLabel(assetClass, symbol) {
  switch (assetClass) {
    case 'crypto': {
      // Strip trailing "USDT"/"USD" from crypto symbols for a cleaner label
      const base = (symbol || '').replace(/(USDT|USD|BUSD|USDC)$/i, '');
      return base || 'units';
    }
    case 'stock':
    case 'etf':
      return 'shares';
    case 'forex':
      return 'lots';
    case 'futures':
      return 'contracts';
    case 'commodity':
      return 'oz';
    default:
      return 'units';
  }
}

/**
 * Format a qty value with appropriate precision.
 * @param {number} qty
 * @param {string} assetClass
 * @returns {string}
 */
export function formatQty(qty, assetClass) {
  if (qty == null || isNaN(qty)) return '—';
  const precision = PRECISION[assetClass] ?? 2;
  if (precision === 0) return Math.floor(qty).toLocaleString();
  // Trim trailing zeros but keep at least 1 decimal for readability
  return +qty.toFixed(precision) + '';
}

/**
 * Format a dollar amount for display.
 * @param {number} dollars
 * @returns {string}
 */
export function formatDollar(dollars) {
  if (dollars == null || isNaN(dollars)) return '$—';
  if (Math.abs(dollars) >= 1000) {
    return '$' + dollars.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  return '$' + dollars.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Get the appropriate step for +/− in USD mode.
 * @param {number} currentVal
 * @returns {number}
 */
export function getUsdStep(currentVal) {
  const abs = Math.abs(currentVal || 0);
  for (const { threshold, step } of USD_STEPS) {
    if (abs >= threshold) return step;
  }
  return 1;
}

/**
 * Get the appropriate step for +/− in QTY mode.
 * @param {number} currentVal
 * @param {string} assetClass
 * @returns {number}
 */
export function getQtyStep(currentVal, assetClass) {
  const fn = QTY_STEPS[assetClass] || QTY_STEPS.stock;
  return fn(currentVal || 0);
}
