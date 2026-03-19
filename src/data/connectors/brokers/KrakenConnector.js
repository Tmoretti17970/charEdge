// ═══════════════════════════════════════════════════════════════════
// charEdge — Kraken Connector (Phase 7 Sprint 7.5)
//
// API connector for Kraken. Uses API key + HMAC-SHA512.
// ═══════════════════════════════════════════════════════════════════

import { BrokerConnector } from '../BrokerConnector.js';
import { registerConnector } from '../ConnectorRegistry.js';

class KrakenConnector extends BrokerConnector {
  constructor() {
    super({
      id: 'kraken',
      name: 'Kraken',
      logo: '🟣',
      requiredFields: ['apiKey', 'privateKey'],
      rateLimit: 15,
      syncIntervalMs: 15 * 60 * 1000,
    });
    this._baseUrl = '/api/proxy/kraken';
  }

  async _sign(path, nonce, postData, privateKey) {
    const message = nonce + postData;
    const msgHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
    const pathBytes = new TextEncoder().encode(path);
    const hmacInput = new Uint8Array([...pathBytes, ...new Uint8Array(msgHash)]);
    const keyBytes = Uint8Array.from(atob(privateKey), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, hmacInput);
    return btoa(String.fromCharCode(...new Uint8Array(sig)));
  }

  async _request(credentials, path, params = {}) {
    const nonce = Date.now() * 1000;
    const postData = new URLSearchParams({ nonce, ...params }).toString();
    const signature = await this._sign(path, nonce.toString(), postData, credentials.privateKey);

    const response = await fetch(this._baseUrl + path, {
      method: 'POST',
      headers: {
        'API-Key': credentials.apiKey,
        'API-Sign': signature,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: postData,
    });

    if (!response.ok) {
      const err = new Error(`Kraken API error: ${response.status}`);
      err.status = response.status;
      throw err;
    }

    const data = await response.json();
    if (data.error && data.error.length > 0) {
      throw new Error(`Kraken: ${data.error.join(', ')}`);
    }

    return data.result;
  }

  async testConnection(credentials) {
    try {
      await this._request(credentials, '/0/private/Balance');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async fetchTrades(credentials, options = {}) {
    const result = await this._request(credentials, '/0/private/TradesHistory', {
      start: options.since ? Math.floor(new Date(options.since).getTime() / 1000) : undefined,
    });

    const trades = [];
    const tradesObj = result?.trades || {};

    for (const [, trade] of Object.entries(tradesObj)) {
      const pair = (trade.pair || '').replace(/^X([A-Z]{3,4})Z([A-Z]{3,4})$/, '$1$2').replace(/^XBT/, 'BTC');
      trades.push({
        date: new Date(trade.time * 1000).toISOString(),
        symbol: pair,
        side: trade.type === 'buy' ? 'BUY' : 'SELL',
        quantity: parseFloat(trade.vol),
        price: parseFloat(trade.price),
        pnl: 0,
        commission: parseFloat(trade.fee),
        notes: `Order: ${trade.ordertxid}`,
        _source: 'kraken',
      });
    }

    return trades;
  }

  getSetupGuide() {
    return {
      steps: ['Go to kraken.com → Security → API', 'Create new API key', 'Set permissions to "Query" only', 'Copy Key and Private Key'],
      tips: ['Enable IP whitelisting for added security'],
      url: 'https://www.kraken.com/u/security/api',
    };
  }
}

registerConnector('kraken', KrakenConnector);
export default KrakenConnector;
