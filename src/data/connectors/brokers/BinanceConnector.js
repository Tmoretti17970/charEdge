// ═══════════════════════════════════════════════════════════════════
// charEdge — Binance Connector (Phase 7 Sprint 7.4)
//
// API connector for Binance. Uses API key + HMAC-SHA256 secret.
// ═══════════════════════════════════════════════════════════════════

import { BrokerConnector } from '../BrokerConnector.js';
import { registerConnector } from '../ConnectorRegistry.js';

class BinanceConnector extends BrokerConnector {
  constructor() {
    super({
      id: 'binance',
      name: 'Binance',
      logo: '🟡',
      requiredFields: ['apiKey', 'secret'],
      rateLimit: 20, // ~1200/min
      syncIntervalMs: 15 * 60 * 1000,
    });
    this._baseUrl = '/api/proxy/binance';
  }

  async _sign(queryString, secret) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(queryString));
    return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async _request(credentials, endpoint, params = {}) {
    const timestamp = Date.now();
    const qs = new URLSearchParams({ ...params, timestamp, recvWindow: 10000 }).toString();
    const signature = await this._sign(qs, credentials.secret);

    const url = `${this._baseUrl}${endpoint}?${qs}&signature=${signature}`;
    const response = await fetch(url, {
      headers: { 'X-MBX-APIKEY': credentials.apiKey },
    });

    if (!response.ok) {
      const err = new Error(`Binance API error: ${response.status}`);
      err.status = response.status;
      throw err;
    }

    return response.json();
  }

  async testConnection(credentials) {
    try {
      const data = await this._request(credentials, '/api/v3/account');
      return { ok: true, accountInfo: { balances: (data?.balances || []).filter((b) => parseFloat(b.free) > 0).length } };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async fetchTrades(credentials, options = {}) {
    const trades = [];
    // Fetch trades for common pairs
    const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'DOTUSDT'];

    for (const symbol of symbols) {
      try {
        await this._waitForRateLimit();
        const params = { symbol, limit: 500 };
        if (options.since) params.startTime = new Date(options.since).getTime();

        const data = await this._request(credentials, '/api/v3/myTrades', params);
        for (const trade of data || []) {
          trades.push({
            date: new Date(trade.time).toISOString(),
            symbol: trade.symbol.replace(/USDT$|BUSD$|USD$/, ''),
            side: trade.isBuyer ? 'BUY' : 'SELL',
            quantity: parseFloat(trade.qty),
            price: parseFloat(trade.price),
            pnl: 0,
            commission: parseFloat(trade.commission),
            notes: `Order: ${trade.orderId}`,
            _source: 'binance',
          });
        }
      } catch {
        // Skip symbols with no trades
      }
    }

    return trades;
  }

  getSetupGuide() {
    return {
      steps: [
        'Log in to binance.com',
        'Go to Account → API Management',
        'Create a new API key (enable "Read" only)',
        'Copy the API Key and Secret Key',
        'Paste into charEdge',
      ],
      tips: ['Enable IP restriction for maximum security', 'Disable all trading permissions'],
      url: 'https://www.binance.com/en/my/settings/api-management',
    };
  }
}

registerConnector('binance', BinanceConnector);
export default BinanceConnector;
