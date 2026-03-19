// ═══════════════════════════════════════════════════════════════════
// charEdge — Tax Report Exporter (Phase 8 Sprint 8.13)
//
// Export tax reports as CSV compatible with TurboTax/H&R Block.
// ═══════════════════════════════════════════════════════════════════

import { calculateTaxLots, generateTaxSummary } from './TaxLotEngine.js';

/**
 * Export tax lots as a CSV string.
 *
 * @param {Object[]} trades - All journal trades
 * @param {Object} [options]
 * @param {'fifo'|'lifo'|'avgcost'} [options.method='fifo']
 * @param {number} [options.year] - Tax year filter
 * @returns {string} CSV content
 */
export function exportTaxCSV(trades, options = {}) {
  const method = options.method || 'fifo';
  const lots = calculateTaxLots(trades, method);
  const filtered = options.year
    ? lots.filter((l) => new Date(l.soldDate).getFullYear() === options.year)
    : lots;

  const headers = [
    'Symbol',
    'Date Acquired',
    'Date Sold',
    'Quantity',
    'Cost Basis',
    'Proceeds',
    'Gain/Loss',
    'Holding Period',
    'Wash Sale',
    'Wash Sale Disallowed',
  ];

  const rows = filtered.map((lot) => [
    lot.symbol,
    lot.acquiredDate instanceof Date ? lot.acquiredDate.toISOString().split('T')[0] : '',
    lot.soldDate instanceof Date ? lot.soldDate.toISOString().split('T')[0] : '',
    lot.quantity.toFixed(4),
    lot.costBasis.toFixed(2),
    lot.proceeds.toFixed(2),
    lot.gainLoss.toFixed(2),
    lot.holdingPeriod,
    lot.washSale ? 'Yes' : 'No',
    lot.washSaleDisallowed.toFixed(2),
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  return csv;
}

/**
 * Export tax summary as a CSV string.
 *
 * @param {Object[]} trades
 * @param {Object} [options]
 * @returns {string} CSV content
 */
export function exportTaxSummaryCSV(trades, options = {}) {
  const method = options.method || 'fifo';
  const lots = calculateTaxLots(trades, method);
  const summary = generateTaxSummary(lots, options.year);

  const lines = [
    `Tax Year,${summary.year}`,
    `Cost Basis Method,${method.toUpperCase()}`,
    '',
    'Category,Lots,Proceeds,Cost Basis,Gain/Loss',
    `Short-Term,${summary.shortTerm.count},${summary.shortTerm.proceeds.toFixed(2)},${summary.shortTerm.costBasis.toFixed(2)},${summary.shortTerm.gainLoss.toFixed(2)}`,
    `Long-Term,${summary.longTerm.count},${summary.longTerm.proceeds.toFixed(2)},${summary.longTerm.costBasis.toFixed(2)},${summary.longTerm.gainLoss.toFixed(2)}`,
    `Total,${summary.totalLots},${summary.total.proceeds.toFixed(2)},${summary.total.costBasis.toFixed(2)},${summary.total.gainLoss.toFixed(2)}`,
    '',
    `Wash Sales,${summary.washSales.count}`,
    `Wash Sale Disallowed,$${summary.washSales.disallowed.toFixed(2)}`,
    `Net Gain/Loss (after wash sale adjustment),$${summary.netGainLoss.toFixed(2)}`,
  ];

  return lines.join('\n');
}

/**
 * Download a CSV file in the browser.
 *
 * @param {string} csvContent
 * @param {string} fileName
 */
export function downloadCSV(csvContent, fileName) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export default { exportTaxCSV, exportTaxSummaryCSV, downloadCSV };
