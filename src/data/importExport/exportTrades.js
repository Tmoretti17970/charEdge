// ═══════════════════════════════════════════════════════════════════
// charEdge — Export Functions
// ═══════════════════════════════════════════════════════════════════

export const TRADE_FIELDS = [
  'id', 'date', 'closeDate', 'symbol', 'side', 'entry', 'exit',
  'quantity', 'pnl', 'fees', 'stopLoss', 'takeProfit', 'rMultiple',
  'playbook', 'assetClass', 'emotion', 'notes', 'ruleBreak', 'tags',
];

/**
 * Export trades as CSV string.
 * @param {Object[]} trades
 * @param {Object} [opts] - { fields, dateFrom, dateTo }
 * @returns {string} CSV content
 */
export function exportCSV(trades, opts = {}) {
  const fields = opts.fields || TRADE_FIELDS;
  let data = [...trades];

  if (opts.dateFrom) data = data.filter((t) => t.date >= opts.dateFrom);
  if (opts.dateTo) data = data.filter((t) => t.date <= opts.dateTo);
  data.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const header = fields.join(',');
  const rows = data.map((t) =>
    fields
      .map((f) => {
        const val = t[f];
        if (val == null) return '';
        if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        if (Array.isArray(val)) return `"${val.join(';')}"`;
        return String(val);
      })
      .join(','),
  );

  return [header, ...rows].join('\n');
}

/**
 * Export trades as JSON string.
 * @param {Object[]} trades
 * @param {Object} [opts] - { dateFrom, dateTo, pretty }
 * @returns {string} JSON content
 */
export function exportJSON(trades, opts = {}) {
  let data = [...trades];
  if (opts.dateFrom) data = data.filter((t) => t.date >= opts.dateFrom);
  if (opts.dateTo) data = data.filter((t) => t.date <= opts.dateTo);
  data.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const exportObj = {
    version: 'charEdge-v10',
    exportedAt: new Date().toISOString(),
    tradeCount: data.length,
    trades: data,
  };

  return opts.pretty !== false ? JSON.stringify(exportObj, null, 2) : JSON.stringify(exportObj);
}

/**
 * Trigger browser file download.
 * @param {string} content - File content
 * @param {string} filename - Download filename
 * @param {string} [mime] - MIME type
 */
export function downloadFile(content, filename, mime = 'text/csv') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
