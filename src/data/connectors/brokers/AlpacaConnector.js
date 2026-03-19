// ═══════════════════════════════════════════════════════════════════
// charEdge — Alpaca Connector (Phase 7 Sprint 7.7)
//
// API connector for Alpaca. Clean REST API with paper/live modes.
// ═══════════════════════════════════════════════════════════════════

import { BrokerConnector } from '../BrokerConnector.js';
import { registerConnector } from '../ConnectorRegistry.js';

class AlpacaConnector extends BrokerConnector {
  constructor() {
    super({
      id: 'alpaca',
      name: 'Alpaca',
      logo: '🦙',
      requiredFields: ['apiKey', 'secretKey'],
      rateLimit: 200,
      syncIntervalMs: 30 * 60 * 1000,
    });
    this._baseUrl = '/api/proxy/alpaca';
  }

  async _request(credentials, path) {
    const response = await fetch(`${this._baseUrl}${path}`, {
      headers: {
        'APCA-API-KEY-ID': credentials.apiKey,
        'APCA-API-SECRET-KEY': credentials.secretKey,
      },
    });
    if (!response.ok) throw Object.assign(new Error(`Alpaca: ${response.status}`), { status: response.status });
    return response.json();
  }

  async testConnection(credentials) {
    try {
      const data = await this._request(credentials, '/v2/account');
      return { ok: true, accountInfo: { id: data.id, status: data.status, equity: data.equity } };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async fetchTrades(credentials, options = {}) {
    let path = '/v2/account/activities/FILL?page_size=100&direction=desc';
    if (options.since) path += `&after=${new Date(options.since).toISOString()}`;

    const data = await this._request(credentials, path);
    return (data || []).map((fill) => ({
      date: fill.transaction_time || fill.timestamp,
      symbol: fill.symbol,
      side: fill.side === 'sell' ? 'SELL' : 'BUY',
      quantity: parseFloat(fill.qty),
      price: parseFloat(fill.price),
      pnl: 0,
      commission: 0, // Alpaca is commission-free
      notes: `Order: ${fill.order_id}`,
      _source: 'alpaca',
    }));
  }

  getSetupGuide() {
    return {
      steps: ['Go to app.alpaca.markets → Paper or Live account', 'Navigate to API Keys', 'Generate new key pair', 'Copy API Key ID and Secret Key'],
      tips: ['Use paper trading keys for testing first', 'Alpaca is commission-free'],
      url: 'https://app.alpaca.markets/paper/dashboard/overview',
    };
  }
}

registerConnector('alpaca', AlpacaConnector);
export default AlpacaConnector;
