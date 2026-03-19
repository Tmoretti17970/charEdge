// ═══════════════════════════════════════════════════════════════════
// charEdge — HTML Report Parser (Phase 6 Sprint 6.8)
//
// Parses HTML trade reports from MT5 and cTrader.
// Extracts table data from HTML statements.
// ═══════════════════════════════════════════════════════════════════

/**
 * Parse an HTML trade report into trade objects.
 * Supports MT5 Detailed Statements and cTrader History reports.
 *
 * @param {string} html - Raw HTML content
 * @returns {{ trades: Object[], broker: string, errors: string[] }}
 */
export function parseHTML(html) {
  const trades = [];
  const errors = [];
  let broker = 'unknown';

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // ─── MT5 Detection ──────────────────────────────────
    const titleEl = doc.querySelector('title');
    const title = (titleEl?.textContent || '').toLowerCase();
    const bodyText = (doc.body?.textContent || '').slice(0, 2000).toLowerCase();

    if (title.includes('metatrader') || bodyText.includes('metatrader') || bodyText.includes('mt5')) {
      broker = 'mt5';
      return { trades: parseMT5Report(doc), broker, errors };
    }

    if (title.includes('ctrader') || bodyText.includes('ctrader')) {
      broker = 'ctrader';
      return { trades: parseCTraderReport(doc), broker, errors };
    }

    // ─── Generic HTML Table Extraction ──────────────────
    broker = 'generic_html';
    const tables = doc.querySelectorAll('table');
    let bestTable = null;
    let bestRowCount = 0;

    // Find the table with the most rows (likely the trade table)
    tables.forEach((table) => {
      const rows = table.querySelectorAll('tr');
      if (rows.length > bestRowCount) {
        bestRowCount = rows.length;
        bestTable = table;
      }
    });

    if (!bestTable) {
      errors.push('No tables found in HTML file');
      return { trades, broker, errors };
    }

    const rows = bestTable.querySelectorAll('tr');
    if (rows.length < 2) {
      errors.push('Table has insufficient rows');
      return { trades, broker, errors };
    }

    // Extract headers from first row
    const headerRow = rows[0];
    const headers = Array.from(headerRow.querySelectorAll('th, td')).map(
      (cell) => cell.textContent.trim().toLowerCase()
    );

    // Extract data rows
    for (let i = 1; i < rows.length; i++) {
      const cells = Array.from(rows[i].querySelectorAll('td'));
      if (cells.length === 0) continue;

      const rowObj = {};
      cells.forEach((cell, idx) => {
        if (idx < headers.length) {
          rowObj[headers[idx]] = cell.textContent.trim();
        }
      });
      trades.push(rowObj);
    }
  } catch (e) {
    errors.push(`HTML parse error: ${e.message}`);
  }

  return { trades, broker, errors };
}

/**
 * Parse MT5 Detailed Statement HTML.
 */
function parseMT5Report(doc) {
  const trades = [];
  const tables = doc.querySelectorAll('table');

  for (const table of tables) {
    const caption = table.querySelector('caption, .title, tr:first-child td');
    const captionText = (caption?.textContent || '').toLowerCase();

    // Look for "Deals" or "Positions" table
    if (!captionText.includes('deal') && !captionText.includes('position') && !captionText.includes('order')) {
      continue;
    }

    const rows = table.querySelectorAll('tr');
    const headerCells = rows[0]?.querySelectorAll('th, td');
    if (!headerCells) continue;

    const headers = Array.from(headerCells).map((c) => c.textContent.trim().toLowerCase());

    for (let i = 1; i < rows.length; i++) {
      const cells = Array.from(rows[i].querySelectorAll('td'));
      if (cells.length < 4) continue;

      const rowObj = {};
      cells.forEach((cell, idx) => {
        if (idx < headers.length) rowObj[headers[idx]] = cell.textContent.trim();
      });

      // Map MT5 fields to charEdge fields
      const trade = {
        date: rowObj.time || rowObj.date || rowObj['open time'] || '',
        symbol: rowObj.symbol || rowObj.instrument || '',
        side: (rowObj.type || rowObj.direction || '').toUpperCase().includes('SELL') ? 'SELL' : 'BUY',
        quantity: parseFloat(rowObj.volume || rowObj.lots || rowObj.size || '0'),
        price: parseFloat(rowObj.price || rowObj['open price'] || '0'),
        pnl: parseFloat(rowObj.profit || rowObj.pnl || rowObj['p/l'] || '0'),
        commission: Math.abs(parseFloat(rowObj.commission || rowObj.fee || '0')),
        notes: rowObj.comment || '',
      };

      if (trade.date && trade.symbol) trades.push(trade);
    }
  }

  return trades;
}

/**
 * Parse cTrader History HTML report.
 */
function parseCTraderReport(doc) {
  const trades = [];
  const tables = doc.querySelectorAll('table');

  // cTrader typically uses the largest table for trade history
  let tradeTable = null;
  let maxRows = 0;
  tables.forEach((table) => {
    const rowCount = table.querySelectorAll('tr').length;
    if (rowCount > maxRows) {
      maxRows = rowCount;
      tradeTable = table;
    }
  });

  if (!tradeTable) return trades;

  const rows = tradeTable.querySelectorAll('tr');
  const headerCells = rows[0]?.querySelectorAll('th, td');
  if (!headerCells) return trades;

  const headers = Array.from(headerCells).map((c) => c.textContent.trim().toLowerCase());

  for (let i = 1; i < rows.length; i++) {
    const cells = Array.from(rows[i].querySelectorAll('td'));
    if (cells.length < 3) continue;

    const rowObj = {};
    cells.forEach((cell, idx) => {
      if (idx < headers.length) rowObj[headers[idx]] = cell.textContent.trim();
    });

    const trade = {
      date: rowObj['opening time'] || rowObj.date || rowObj.time || '',
      symbol: rowObj.symbol || rowObj.instrument || '',
      side: (rowObj.direction || rowObj.type || '').toUpperCase().includes('SELL') ? 'SELL' : 'BUY',
      quantity: parseFloat(rowObj.volume || rowObj.lots || rowObj.quantity || '0'),
      price: parseFloat(rowObj['entry price'] || rowObj.price || '0'),
      pnl: parseFloat(rowObj['net profit'] || rowObj.profit || rowObj.pnl || '0'),
      commission: Math.abs(parseFloat(rowObj.commission || '0')),
    };

    if (trade.date && trade.symbol) trades.push(trade);
  }

  return trades;
}

export default { parseHTML };
