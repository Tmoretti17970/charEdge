// ═══════════════════════════════════════════════════════════════════
// charEdge — MT4/MT5 Enhanced Connector (Phase 7 Sprint 7.12)
//
// Enhanced MetaTrader connector with investor password support
// and automated statement parsing. Since MT5 has no public REST
// API, this connector bridges manual statement uploads with
// encrypted credential storage for account correlation.
// ═══════════════════════════════════════════════════════════════════

import { BrokerConnector } from '../BrokerConnector.js';
import { registerConnector } from '../ConnectorRegistry.js';
import { parseMT5 } from '../../importExport/parsers/mt5.js';

class MT5Connector extends BrokerConnector {
  constructor() {
    super({
      id: 'mt5',
      name: 'MetaTrader 4/5',
      logo: '📊',
      requiredFields: ['server', 'login', 'investorPassword'],
      rateLimit: 0, // No API rate limit — statement-based
      syncIntervalMs: 0, // Manual sync only
    });
    this._accountInfo = null;
    this._lastStatementData = null;
  }

  // ─── Statement Parsing ────────────────────────────────────────

  /**
   * Parse an MT5 HTML statement report.
   * @param {string} html - Raw HTML content
   * @returns {Object[]} Parsed trades
   */
  parseHTMLStatement(html) {
    const trades = [];

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Find trade table — MT5 statements have a specific structure
      const tables = doc.querySelectorAll('table');
      let tradeTable = null;

      for (const table of tables) {
        const headerRow = table.querySelector('tr');
        if (!headerRow) continue;
        const headerText = headerRow.textContent.toLowerCase();
        if (headerText.includes('deal') || headerText.includes('order') || headerText.includes('symbol')) {
          tradeTable = table;
          break;
        }
      }

      if (!tradeTable) return trades;

      // Extract headers
      const headerCells = tradeTable.querySelectorAll('tr:first-child td, tr:first-child th');
      const headers = Array.from(headerCells).map((c) => c.textContent.trim());

      // Extract rows
      const rows = tradeTable.querySelectorAll('tr');
      for (let i = 1; i < rows.length; i++) {
        const cells = rows[i].querySelectorAll('td');
        if (cells.length < headers.length) continue;

        const rowObj = {};
        headers.forEach((h, idx) => {
          rowObj[h] = cells[idx]?.textContent?.trim() || '';
        });

        trades.push(rowObj);
      }

      // Run through the existing MT5 CSV parser for normalization
      return parseMT5(trades);
    } catch {
      return trades;
    }
  }

  /**
   * Parse an MT5 CSV statement.
   * @param {string} csvContent - Raw CSV text
   * @returns {Object[]} Parsed trades
   */
  parseCSVStatement(csvContent) {
    const lines = csvContent.split('\n').filter((l) => l.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split('\t').length > 1
      ? lines[0].split('\t')
      : lines[0].split(',');

    const cleanHeaders = headers.map((h) => h.trim().replace(/^"|"$/g, ''));

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split('\t').length > 1
        ? lines[i].split('\t')
        : lines[i].split(',');

      const row = {};
      cleanHeaders.forEach((h, idx) => {
        row[h] = (values[idx] || '').trim().replace(/^"|"$/g, '');
      });
      rows.push(row);
    }

    return parseMT5(rows);
  }

  /**
   * Import trades from a statement file (HTML or CSV).
   * @param {File} file - Statement file
   * @returns {Promise<Object[]>} Parsed and normalized trades
   */
  async importStatement(file) {
    const content = await file.text();
    const isHTML = file.name.endsWith('.html') || file.name.endsWith('.htm') || content.trim().startsWith('<');

    const trades = isHTML
      ? this.parseHTMLStatement(content)
      : this.parseCSVStatement(content);

    // Stamp source metadata
    trades.forEach((t) => {
      t._source = 'mt5';
      t._accountLogin = this._credentials?.login;
      t._accountServer = this._credentials?.server;
    });

    this._lastStatementData = {
      fileName: file.name,
      tradeCount: trades.length,
      importedAt: Date.now(),
    };

    return trades;
  }

  // ─── BrokerConnector Interface ───────────────────────────────

  async testConnection(credentials) {
    // Validate credential format
    if (!credentials.server || !credentials.login) {
      return { ok: false, error: 'Server and login number are required' };
    }

    const loginNum = parseInt(credentials.login, 10);
    if (isNaN(loginNum) || loginNum < 1000) {
      return { ok: false, error: 'Invalid login number — must be numeric (e.g., 12345678)' };
    }

    if (!credentials.investorPassword || credentials.investorPassword.length < 4) {
      return { ok: false, error: 'Investor password is required (read-only password from your broker)' };
    }

    // Store account info for correlation
    this._accountInfo = {
      server: credentials.server,
      login: credentials.login,
      connectedAt: Date.now(),
    };

    return {
      ok: true,
      accountInfo: {
        server: credentials.server,
        login: credentials.login,
        note: 'MT5 uses statement import — upload your trade history to sync',
      },
    };
  }

  async fetchTrades(/* credentials, options */) {
    // MT5 doesn't have a REST API — trades come from statement imports
    // Return empty array; users can call importStatement() directly
    return [];
  }

  disconnect() {
    this._accountInfo = null;
    this._lastStatementData = null;
    super.disconnect();
  }

  getSetupGuide() {
    return {
      steps: [
        'Open MetaTrader 4 or 5',
        'Note your server name (e.g., "ICMarkets-Demo")',
        'Note your login number (e.g., 12345678)',
        'Find your investor (read-only) password in your broker email',
        'Enter the details in charEdge',
        'Export a statement: History tab → Right-click → Save as Detailed Report',
        'Upload the HTML or CSV file to import trades',
      ],
      tips: [
        'Use the investor (read-only) password, NOT your master password',
        'charEdge stores credentials encrypted — never transmitted externally',
        'Export "Detailed Report" for the most complete trade data',
        'Works with both MT4 and MT5 statement formats',
        'Re-import statements periodically to stay up-to-date',
      ],
      url: 'https://www.metatrader5.com/en/terminal/help/trading/history',
      statementImport: true, // Signals the wizard to show file upload
    };
  }
}

registerConnector('mt5', MT5Connector);
export default MT5Connector;
