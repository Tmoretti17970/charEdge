// ═══════════════════════════════════════════════════════════════════
// charEdge — Coinbase Connector (Phase 7 Sprint 7.3)
//
// API connector for Coinbase. Uses API key + secret + passphrase
// with HMAC-SHA256 request signing.
// ═══════════════════════════════════════════════════════════════════

import { BrokerConnector } from '../BrokerConnector.js';
import { registerConnector } from '../ConnectorRegistry.js';

class CoinbaseConnector extends BrokerConnector {
  constructor() {
    super({
      id: 'coinbase',
      name: 'Coinbase',
      logo: '🔵',
      requiredFields: ['apiKey', 'secret', 'passphrase'],
      rateLimit: 10, // 10 req/sec
      syncIntervalMs: 15 * 60 * 1000,
    });
    this._baseUrl = '/api/proxy/coinbase'; // Routed through CORS proxy
  }

  /**
   * Sign a Coinbase API request using HMAC-SHA256.
   * @param {string} timestamp
   * @param {string} method
   * @param {string} path
   * @param {string} body
   * @param {string} secret - Base64-encoded secret
   * @returns {Promise<string>}
   */
  async _sign(timestamp, method, path, body, secret) {
    const message = timestamp + method.toUpperCase() + path + (body || '');
    const keyData = Uint8Array.from(atob(secret), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
    return btoa(String.fromCharCode(...new Uint8Array(sig)));
  }

  /**
   * Make an authenticated Coinbase API request.
   */
  async _request(credentials, method, path, body = '') {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = await this._sign(timestamp, method, path, body, credentials.secret);

    const response = await fetch(this._baseUrl + path, {
      method,
      headers: {
        'CB-ACCESS-KEY': credentials.apiKey,
        'CB-ACCESS-SIGN': signature,
        'CB-ACCESS-TIMESTAMP': timestamp,
        'CB-ACCESS-PASSPHRASE': credentials.passphrase,
        'Content-Type': 'application/json',
      },
      body: body || undefined,
    });

    if (!response.ok) {
      const err = new Error(`Coinbase API error: ${response.status}`);
      err.status = response.status;
      throw err;
    }

    return response.json();
  }

  async testConnection(credentials) {
    try {
      const data = await this._request(credentials, 'GET', '/v2/user');
      return {
        ok: true,
        accountInfo: { name: data?.data?.name, email: data?.data?.email },
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async fetchTrades(credentials, options = {}) {
    const trades = [];

    try {
      // 1. Get accounts list
      const accounts = await this._request(credentials, 'GET', '/v2/accounts?limit=100');
      const accountList = accounts?.data || [];

      // 2. For each account, get transactions
      for (const account of accountList) {
        if (!account?.id || parseFloat(account.balance?.amount || '0') === 0) continue;

        let nextUri = `/v2/accounts/${account.id}/transactions?limit=100`;
        while (nextUri) {
          await this._waitForRateLimit();
          const txData = await this._request(credentials, 'GET', nextUri);

          for (const tx of txData?.data || []) {
            if (tx.type === 'buy' || tx.type === 'sell' || tx.type === 'trade') {
              trades.push({
                date: tx.created_at || tx.updated_at,
                symbol: (tx.amount?.currency || account.currency?.code || '').toUpperCase(),
                side: tx.type === 'sell' ? 'SELL' : 'BUY',
                quantity: Math.abs(parseFloat(tx.amount?.amount || '0')),
                price: parseFloat(tx.native_amount?.amount || '0') / Math.abs(parseFloat(tx.amount?.amount || '1')),
                pnl: 0,
                commission: parseFloat(tx.network?.transaction_fee?.amount || '0'),
                notes: tx.details?.title || '',
                _source: 'coinbase',
              });
            }
          }

          nextUri = txData?.pagination?.next_uri || null;
        }
      }
    } catch (err) {
      throw err;
    }

    return trades;
  }

  getSetupGuide() {
    return {
      steps: [
        'Go to coinbase.com → Settings → API',
        'Click "New API Key"',
        'Enable "Trade" and "View" permissions',
        'Copy the API Key, Secret, and Passphrase',
        'Paste them into charEdge',
      ],
      tips: ['Use read-only permissions for maximum security', 'Never share your API secret'],
      url: 'https://www.coinbase.com/settings/api',
    };
  }
}

registerConnector('coinbase', CoinbaseConnector);
export default CoinbaseConnector;
