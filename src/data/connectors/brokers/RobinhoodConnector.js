// ═══════════════════════════════════════════════════════════════════
// charEdge — Robinhood Connector (Phase 7 Sprint 7.5)
//
// Robinhood connector for crypto trades via API.
// Equities require CSV import (guided fallback).
// ═══════════════════════════════════════════════════════════════════

import { BrokerConnector } from '../BrokerConnector.js';
import { registerConnector } from '../ConnectorRegistry.js';

class RobinhoodConnector extends BrokerConnector {
  constructor() {
    super({
      id: 'robinhood',
      name: 'Robinhood',
      logo: '🪶',
      requiredFields: ['apiKey', 'secret'],
      rateLimit: 30, // Conservative — Robinhood rate-limits aggressively
      syncIntervalMs: 30 * 60 * 1000,
    });
    this._baseUrl = '/api/proxy/robinhood';
  }

  /**
   * Generate HMAC-SHA256 signature for Robinhood API.
   */
  async _sign(timestamp, method, path, body, secret) {
    const message = `${timestamp}${method.toUpperCase()}${path}${body || ''}`;
    const keyData = new TextEncoder().encode(secret);
    const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
    return btoa(String.fromCharCode(...new Uint8Array(sig)));
  }

  /**
   * Make an authenticated Robinhood API request.
   */
  async _request(credentials, method, path, body = '') {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = await this._sign(timestamp, method, path, body, credentials.secret);

    const response = await fetch(`${this._baseUrl}${path}`, {
      method,
      headers: {
        'x-api-key': credentials.apiKey,
        'x-signature': signature,
        'x-timestamp': timestamp,
        'Content-Type': 'application/json',
      },
      body: body || undefined,
    });

    if (!response.ok) {
      const err = new Error(`Robinhood API error: ${response.status}`);
      err.status = response.status;
      throw err;
    }

    return response.json();
  }

  async testConnection(credentials) {
    try {
      const data = await this._request(credentials, 'GET', '/api/v1/crypto/trading/accounts/');
      return {
        ok: true,
        accountInfo: {
          id: data?.results?.[0]?.id || data?.id,
          status: data?.results?.[0]?.status || 'active',
        },
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async fetchTrades(credentials, options = {}) {
    const trades = [];

    // Fetch crypto order executions
    let path = '/api/v1/crypto/trading/orders/?status=filled&page_size=100';
    if (options.since) {
      path += `&updated_at[gte]=${new Date(options.since).toISOString()}`;
    }

    let hasMore = true;
    while (hasMore) {
      await this._waitForRateLimit();
      const data = await this._request(credentials, 'GET', path);

      for (const order of data?.results || []) {
        if (order.state !== 'filled') continue;

        const symbol = (order.symbol || '').toUpperCase();
        const side = (order.side || '').toUpperCase();

        trades.push({
          date: order.updated_at || order.created_at,
          symbol,
          side: side === 'SELL' ? 'SELL' : 'BUY',
          quantity: parseFloat(order.filled_asset_quantity || order.quantity || '0'),
          price: parseFloat(order.average_price || order.price || '0'),
          pnl: 0, // Robinhood doesn't provide per-trade P&L
          commission: 0, // Commission-free
          notes: `Robinhood Crypto | ${order.type || 'market'} order`,
          _source: 'robinhood',
          assetClass: 'crypto',
        });
      }

      // Pagination
      if (data?.next) {
        const nextUrl = new URL(data.next, 'https://placeholder.com');
        path = nextUrl.pathname + nextUrl.search;
      } else {
        hasMore = false;
      }
    }

    return trades;
  }

  getSetupGuide() {
    return {
      steps: [
        'Open the Robinhood app → Account → Settings',
        'Navigate to "API Trading" (requires Robinhood Gold)',
        'Generate a new API key pair',
        'Copy the API Key and Secret',
        'Paste them into charEdge',
      ],
      tips: [
        'Robinhood API currently supports crypto trades only',
        'For stock/options trades, use the CSV import instead',
        'API trading requires Robinhood Gold membership',
        'Use read-only permissions for journaling',
      ],
      url: 'https://robinhood.com/account/settings',
      csvFallback: true, // Signals the wizard to show CSV import option
    };
  }
}

registerConnector('robinhood', RobinhoodConnector);
export default RobinhoodConnector;
