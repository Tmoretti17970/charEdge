// ═══════════════════════════════════════════════════════════════════
// charEdge — Tradovate Connector (Phase 7 Sprint 7.7)
//
// API connector for Tradovate. Uses token-based authentication.
// Supports futures trading platforms.
// ═══════════════════════════════════════════════════════════════════

import { BrokerConnector } from '../BrokerConnector.js';
import { registerConnector } from '../ConnectorRegistry.js';

class TradovateConnector extends BrokerConnector {
  constructor() {
    super({
      id: 'tradovate',
      name: 'Tradovate',
      logo: '📈',
      requiredFields: ['username', 'password'],
      rateLimit: 30,
      syncIntervalMs: 30 * 60 * 1000,
    });
    this._baseUrl = '/api/proxy/tradovate';
    this._accessToken = null;
  }

  async _authenticate(credentials) {
    const response = await fetch(`${this._baseUrl}/auth/accesstokenrequest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: credentials.username,
        password: credentials.password,
        appId: 'charEdge',
        appVersion: '1.0.0',
      }),
    });

    if (!response.ok) throw Object.assign(new Error('Tradovate auth failed'), { status: response.status });
    const data = await response.json();
    if (!data.accessToken) throw new Error('No access token returned');
    this._accessToken = data.accessToken;
    return data;
  }

  async _request(path) {
    if (!this._accessToken) throw new Error('Not authenticated');
    const response = await fetch(`${this._baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${this._accessToken}` },
    });
    if (!response.ok) throw Object.assign(new Error(`Tradovate: ${response.status}`), { status: response.status });
    return response.json();
  }

  async testConnection(credentials) {
    try {
      const auth = await this._authenticate(credentials);
      return { ok: true, accountInfo: { userId: auth.userId, name: auth.name } };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async fetchTrades(credentials, options = {}) {
    if (!this._accessToken) await this._authenticate(credentials);

    const accounts = await this._request('/account/list');
    const trades = [];

    for (const account of accounts || []) {
      const fills = await this._request(`/fill/ldeps?masterid=${account.id}`);
      for (const fill of fills || []) {
        trades.push({
          date: fill.timestamp || fill.fillTime,
          symbol: (fill.contractId || '').toString(),
          side: fill.action === 'Sell' ? 'SELL' : 'BUY',
          quantity: Math.abs(fill.qty || 0),
          price: fill.price || 0,
          pnl: fill.pnl || 0,
          commission: fill.commission || 0,
          notes: `Fill #${fill.id}`,
          _source: 'tradovate',
        });
      }
    }

    return trades;
  }

  getSetupGuide() {
    return {
      steps: ['Log in to trader.tradovate.com', 'Use your Tradovate username and password', 'charEdge connects via authenticated API'],
      tips: ['Consider using a demo account for testing first'],
      url: 'https://trader.tradovate.com',
    };
  }
}

registerConnector('tradovate', TradovateConnector);
export default TradovateConnector;
