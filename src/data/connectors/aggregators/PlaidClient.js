// ═══════════════════════════════════════════════════════════════════
// charEdge — Plaid Investments Client (Phase 8 Sprint 8.4)
//
// Fallback aggregator using Plaid Investments API for brokerages
// not supported by SnapTrade.
// ═══════════════════════════════════════════════════════════════════

import { BrokerConnector } from '../BrokerConnector.js';
import { registerConnector } from '../ConnectorRegistry.js';

const PLAID_BASE = '/api/proxy/plaid';

class PlaidClient extends BrokerConnector {
  constructor() {
    super({
      id: 'plaid',
      name: 'Plaid (Investments)',
      logo: '🏦',
      requiredFields: [], // Uses Plaid Link — no direct credentials
      rateLimit: 60,
      syncIntervalMs: 60 * 60 * 1000, // Hourly sync
    });
    this._accessToken = null;
    this._institutionName = null;
  }

  // ─── Plaid Link Flow ──────────────────────────────────────────

  async createLinkToken() {
    const response = await fetch(`${PLAID_BASE}/api/create_link_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'charEdge',
        products: ['investments'],
        country_codes: ['US', 'CA'],
        language: 'en',
      }),
    });

    if (!response.ok) {
      throw Object.assign(new Error(`Plaid Link token failed: ${response.status}`), { status: response.status });
    }

    const data = await response.json();
    return data.link_token;
  }

  async exchangePublicToken(publicToken) {
    const response = await fetch(`${PLAID_BASE}/api/set_access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_token: publicToken }),
    });

    if (!response.ok) {
      throw Object.assign(new Error(`Plaid token exchange failed: ${response.status}`), { status: response.status });
    }

    const data = await response.json();
    this._accessToken = data.access_token;
    return data;
  }

  // ─── Data Fetching ────────────────────────────────────────────

  async getHoldings() {
    if (!this._accessToken) throw new Error('Not connected — complete Plaid Link first');

    const response = await fetch(`${PLAID_BASE}/api/investments/holdings/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: this._accessToken }),
    });

    if (!response.ok) {
      throw Object.assign(new Error(`Plaid holdings: ${response.status}`), { status: response.status });
    }

    return response.json();
  }

  async getTransactions(startDate, endDate) {
    if (!this._accessToken) throw new Error('Not connected — complete Plaid Link first');

    const response = await fetch(`${PLAID_BASE}/api/investments/transactions/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: this._accessToken,
        start_date: startDate || new Date(Date.now() - 90 * 86_400_000).toISOString().split('T')[0],
        end_date: endDate || new Date().toISOString().split('T')[0],
      }),
    });

    if (!response.ok) {
      throw Object.assign(new Error(`Plaid transactions: ${response.status}`), { status: response.status });
    }

    return response.json();
  }

  async getAccounts() {
    if (!this._accessToken) throw new Error('Not connected — complete Plaid Link first');

    const response = await fetch(`${PLAID_BASE}/api/accounts/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: this._accessToken }),
    });

    if (!response.ok) {
      throw Object.assign(new Error(`Plaid accounts: ${response.status}`), { status: response.status });
    }

    return response.json();
  }

  // ─── BrokerConnector Interface ───────────────────────────────

  async testConnection(/* credentials */) {
    // Plaid uses Link UI — connection is tested via the Link flow itself
    if (this._accessToken) {
      try {
        const data = await this.getAccounts();
        this._institutionName = data?.item?.institution_id || 'Connected';
        return { ok: true, accountInfo: { accounts: data?.accounts?.length || 0 } };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Connection failed' };
      }
    }
    return { ok: true, accountInfo: { note: 'Complete Plaid Link to connect' } };
  }

  async fetchTrades(/* credentials, options */) {
    const trades = [];

    const data = await this.getTransactions();
    const securities = new Map();

    // Build security lookup
    for (const sec of data?.securities || []) {
      securities.set(sec.security_id, sec);
    }

    for (const tx of data?.investment_transactions || []) {
      const security = securities.get(tx.security_id);
      const symbol = security?.ticker_symbol || security?.name || 'UNKNOWN';
      const type = (tx.type || '').toLowerCase();

      if (!['buy', 'sell'].includes(type)) continue;

      trades.push({
        date: tx.date,
        symbol,
        side: type === 'sell' ? 'SELL' : 'BUY',
        quantity: Math.abs(tx.quantity || 0),
        price: tx.price || 0,
        pnl: 0,
        commission: Math.abs(tx.fees || 0),
        notes: `Plaid | ${tx.name || ''}`,
        _source: 'plaid',
        _accountId: tx.account_id,
      });
    }

    return trades;
  }

  disconnect() {
    this._accessToken = null;
    this._institutionName = null;
    super.disconnect();
  }

  getSetupGuide() {
    return {
      steps: [
        'Click "Connect" to open the Plaid Link window',
        'Search for your broker or bank',
        'Log in with your broker credentials',
        'Select the investment accounts to sync',
        'Trades will import automatically',
      ],
      tips: [
        'Plaid supports 10,000+ financial institutions',
        "Used as a fallback when SnapTrade doesn't cover your broker",
        'charEdge never stores your broker login — Plaid handles it securely',
      ],
      url: 'https://plaid.com',
    };
  }
}

registerConnector('plaid', PlaidClient);
export default PlaidClient;
