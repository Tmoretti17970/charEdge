// ═══════════════════════════════════════════════════════════════════
// charEdge — IBKR Flex Query Connector (Phase 7 Sprint 7.6)
//
// Interactive Brokers Flex Query connector.
// Uses token-based auth (no trading access needed).
// Two-step flow: Request report → Poll for completion → Download.
// ═══════════════════════════════════════════════════════════════════

import { BrokerConnector } from '../BrokerConnector.js';
import { registerConnector } from '../ConnectorRegistry.js';

class IBKRConnector extends BrokerConnector {
  constructor() {
    super({
      id: 'ibkr',
      name: 'IBKR Flex Query',
      logo: '🟢',
      requiredFields: ['flexToken', 'queryId'],
      rateLimit: 5, // IBKR is strict
      syncIntervalMs: 60 * 60 * 1000, // 1 hour
    });
    this._baseUrl = '/api/proxy/ibkr';
  }

  async testConnection(credentials) {
    try {
      // Request a flex query to test credentials
      const response = await fetch(
        `${this._baseUrl}/FlexStatementService.SendRequest?t=${credentials.flexToken}&q=${credentials.queryId}&v=3`,
      );
      if (!response.ok) throw Object.assign(new Error('IBKR API error'), { status: response.status });

      const text = await response.text();
      if (text.includes('<Status>Success</Status>') || text.includes('ReferenceCode')) {
        return { ok: true };
      }
      return { ok: false, error: 'Invalid Flex Query token or ID' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async fetchTrades(credentials) {
    // 1. Send request
    const reqResponse = await fetch(
      `${this._baseUrl}/FlexStatementService.SendRequest?t=${credentials.flexToken}&q=${credentials.queryId}&v=3`,
    );
    const reqText = await reqResponse.text();
    const refMatch = reqText.match(/<ReferenceCode>(\w+)<\/ReferenceCode>/);
    if (!refMatch) throw new Error('Could not request IBKR Flex report');
    const refCode = refMatch[1];

    // 2. Poll for completion (max 30 seconds)
    let reportXml = null;
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const getResponse = await fetch(
        `${this._baseUrl}/FlexStatementService.GetStatement?q=${refCode}&t=${credentials.flexToken}&v=3`,
      );
      const getText = await getResponse.text();
      if (!getText.includes('Statement is being generated')) {
        reportXml = getText;
        break;
      }
    }

    if (!reportXml) throw new Error('IBKR report generation timed out');

    // 3. Parse XML trades
    return this._parseFlexXml(reportXml);
  }

  _parseFlexXml(xml) {
    const trades = [];
    const tradeMatches = xml.match(/<Trade[\s\S]*?\/>/gi) || [];

    for (const tradeTag of tradeMatches) {
      const attr = (name) => {
        const m = tradeTag.match(new RegExp(`${name}="([^"]*)"`, 'i'));
        return m ? m[1] : '';
      };

      const dateTime = attr('dateTime') || attr('tradeDate');
      const symbol = attr('symbol');
      if (!dateTime || !symbol) continue;

      trades.push({
        date: dateTime.includes('T') ? dateTime : `${dateTime.slice(0, 4)}-${dateTime.slice(4, 6)}-${dateTime.slice(6, 8)}`,
        symbol,
        side: attr('buySell') === 'SELL' || attr('buySell') === 'SLD' ? 'SELL' : 'BUY',
        quantity: Math.abs(parseFloat(attr('quantity') || '0')),
        price: parseFloat(attr('tradePrice') || '0'),
        pnl: parseFloat(attr('fifoPnlRealized') || attr('realizedPnl') || '0'),
        commission: Math.abs(parseFloat(attr('ibCommission') || attr('commission') || '0')),
        notes: `ConId: ${attr('conid')}`,
        _source: 'ibkr',
      });
    }

    return trades;
  }

  getSetupGuide() {
    return {
      steps: [
        'Log in to IBKR Client Portal',
        'Go to Performance & Reports → Flex Queries',
        'Create a new Flex Query (select Trade Confirmations)',
        'Note the Query ID',
        "Get a Flex Web Service token from Settings → API → Flex Web Service",
      ],
      tips: ['Flex Queries are read-only — no trading access needed', 'Tokens expire annually — remember to renew'],
      url: 'https://www.interactivebrokers.com/en/index.php?f=5503',
    };
  }
}

registerConnector('ibkr', IBKRConnector);
export default IBKRConnector;
