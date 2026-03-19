// ═══════════════════════════════════════════════════════════════════
// charEdge — Clipboard Parser (Phase 6 Sprint 6.9)
//
// Parses pasted clipboard content into trade data.
// Supports: plain text tables, HTML tables, TSV, CSV.
// ═══════════════════════════════════════════════════════════════════

import { parseCSV } from '../parseCSV.js';

/**
 * Detect clipboard content format and parse into rows.
 *
 * @param {string} text - Plain text from clipboard
 * @param {string} [html] - HTML content from clipboard (optional)
 * @returns {{ rows: Object[], format: string, headers: string[], error?: string }}
 */
export function parseClipboard(text, html) {
  // ─── Try HTML table first (from web copy) ──────────────
  if (html && html.includes('<table')) {
    try {
      const result = parseHTMLTable(html);
      if (result.rows.length > 0) {
        return { ...result, format: 'html_paste' };
      }
    } catch {
      // Fall through to text parsing
    }
  }

  // ─── Try tab-separated (from Excel/Sheets copy) ────────
  if (text && text.includes('\t')) {
    try {
      const result = parseTSV(text);
      if (result.rows.length > 0) {
        return { ...result, format: 'tsv_paste' };
      }
    } catch {
      // Fall through
    }
  }

  // ─── Try comma-separated ───────────────────────────────
  if (text && text.includes(',')) {
    try {
      const rows = parseCSV(text);
      if (rows.length > 0) {
        return {
          rows,
          headers: Object.keys(rows[0]),
          format: 'csv_paste',
        };
      }
    } catch {
      // Fall through
    }
  }

  return { rows: [], headers: [], format: 'unknown', error: 'Could not detect format from pasted content' };
}

/**
 * Parse HTML table from clipboard.
 */
function parseHTMLTable(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const table = doc.querySelector('table');

  if (!table) return { rows: [], headers: [] };

  const allRows = table.querySelectorAll('tr');
  if (allRows.length < 2) return { rows: [], headers: [] };

  // Extract headers
  const headerCells = allRows[0].querySelectorAll('th, td');
  const headers = Array.from(headerCells).map((c) => c.textContent.trim());

  // Extract data
  const rows = [];
  for (let i = 1; i < allRows.length; i++) {
    const cells = Array.from(allRows[i].querySelectorAll('td'));
    if (cells.length === 0) continue;

    const rowObj = {};
    cells.forEach((cell, idx) => {
      const key = idx < headers.length ? headers[idx] : `col${idx}`;
      rowObj[key] = cell.textContent.trim();
    });
    rows.push(rowObj);
  }

  return { rows, headers };
}

/**
 * Parse tab-separated values from clipboard.
 */
function parseTSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return { rows: [], headers: [] };

  const headers = lines[0].split('\t').map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split('\t');
    if (values.length === 0) continue;

    const rowObj = {};
    values.forEach((val, idx) => {
      const key = idx < headers.length ? headers[idx] : `col${idx}`;
      rowObj[key] = val.trim();
    });
    rows.push(rowObj);
  }

  return { rows, headers };
}

export default { parseClipboard };
