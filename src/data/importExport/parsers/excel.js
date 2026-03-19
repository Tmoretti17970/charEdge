// ═══════════════════════════════════════════════════════════════════
// charEdge — Excel Parser (Phase 6 Sprint 6.7)
//
// Parses .xlsx/.xls files using SheetJS (lazy-loaded).
// Converts spreadsheet rows into charEdge trade objects.
// ═══════════════════════════════════════════════════════════════════

let XLSX = null;

/**
 * Lazy-load SheetJS library.
 * Only loaded on first Excel import to keep bundle size minimal.
 */
async function loadSheetJS() {
  if (XLSX) return XLSX;
  try {
    XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs');
    return XLSX;
  } catch {
    // Fallback: try npm package if CDN fails
    try {
      XLSX = await import('xlsx');
      return XLSX;
    } catch {
      throw new Error('SheetJS library could not be loaded. Excel import requires an internet connection on first use.');
    }
  }
}

/**
 * Parse an Excel file (ArrayBuffer) into an array of row objects.
 *
 * @param {ArrayBuffer} buffer - The Excel file as ArrayBuffer
 * @param {Object} options - Parsing options
 * @param {string} [options.sheetName] - Specific sheet to parse (defaults to first)
 * @returns {Promise<{ rows: Object[], sheets: string[], errors: string[] }>}
 */
export async function parseExcel(buffer, options = {}) {
  const errors = [];

  try {
    const xlsx = await loadSheetJS();
    const workbook = xlsx.read(buffer, { type: 'array', cellDates: true });
    const sheets = workbook.SheetNames;

    if (sheets.length === 0) {
      return { rows: [], sheets: [], errors: ['No sheets found in workbook'] };
    }

    const targetSheet = options.sheetName || sheets[0];
    const worksheet = workbook.Sheets[targetSheet];

    if (!worksheet) {
      return { rows: [], sheets, errors: [`Sheet "${targetSheet}" not found`] };
    }

    // Convert to array of objects (header row = keys)
    const rows = xlsx.utils.sheet_to_json(worksheet, {
      defval: '',
      raw: false, // convert everything to strings for consistent parsing
      dateNF: 'yyyy-mm-dd',
    });

    return { rows, sheets, errors };
  } catch (e) {
    errors.push(`Excel parse error: ${e.message}`);
    return { rows: [], sheets: [], errors };
  }
}

/**
 * Get sheet names from an Excel file.
 *
 * @param {ArrayBuffer} buffer
 * @returns {Promise<string[]>}
 */
export async function getSheetNames(buffer) {
  try {
    const xlsx = await loadSheetJS();
    const workbook = xlsx.read(buffer, { type: 'array' });
    return workbook.SheetNames;
  } catch {
    return [];
  }
}

export default { parseExcel, getSheetNames };
