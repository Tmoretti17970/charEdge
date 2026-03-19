// ═══════════════════════════════════════════════════════════════════
// charEdge — Bybit Connector (Phase 7 Sprint 7.5)
//
// API connector for Bybit. Uses API key + HMAC-SHA256 secret.
// ═══════════════════════════════════════════════════════════════════

import { BrokerConnector } from '../BrokerConnector.js';
import { registerConnector } from '../ConnectorRegistry.js';

class BybitConnector extends BrokerConnector {
  constructor() {
    super({
      id: 'bybit',
      name: 'Bybit',
      logo: '🟠',
      requiredFields: ['apiKey', 'secret'],
      rateLimit: 20,
      syncIntervalMs: 15 * 60 * 1000,
    });
    this._baseUrl = '/api/proxy/bybit';
  }

  async _sign(timestamp, apiKey, params, secret) {
    const message = timestamp + apiKey + '5000' + params;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
    return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async _request(credentials, endpoint, params = {}) {
    const timestamp = Date.now().toString();
    const qs = new URLSearchParams(params).toString();
    const signature = await this._sign(timestamp, credentials.apiKey, qs, credentials.secret);

    const url = `${this._baseUrl}${endpoint}${qs ? '?' + qs : ''}`;
    const response = await fetch(url, {
      headers: {
        'X-BAPI-API-KEY': credentials.apiKey,
        'X-BAPI-SIGN': signature,
        'X-BAPI-SIGN-TYPE': '2',
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': '5000',
      },
    });

    if (!response.ok) throw Object.assign(new Error(`Bybit API error: ${response.status}`), { status: response.status });
    const data = await response.json();
    if (data.retCode !== 0) throw new Error(`Bybit: ${data.retMsg}`);
    return data.result;
  }

  async testConnection(credentials) {
    try {
      await this._request(credentials, '/v5/account/wallet-balance', { accountType: 'UNIFIED' });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async fetchTrades(credentials, options = {}) {
    const params = { category: 'spot', limit: 100 };
    if (options.since) params.startTime = new Date(options.since).getTime();

    const result = await this._request(credentials, '/v5/execution/list', params);
    return (result?.list || []).map((t) => ({
      date: new Date(parseInt(t.execTime)).toISOString(),
      symbol: (t.symbol || '').replace(/USDT$/, ''),
      side: t.side === 'Sell' ? 'SELL' : 'BUY',
      quantity: parseFloat(t.execQty),
      price: parseFloat(t.execPrice),
      pnl: parseFloat(t.closedPnl || '0'),
      commission: parseFloat(t.execFee || '0'),
      _source: 'bybit',
    }));
  }

  getSetupGuide() {
    return {
      steps: ['Go to bybit.com → Account → API Management', 'Create new API key (Read-Only)', 'Copy API Key and Secret'],
      tips: ['Enable IP restriction for security'],
      url: 'https://www.bybit.com/user/api-management',
    };
  }
}

registerConnector('bybit', BybitConnector);
export default BybitConnector;
