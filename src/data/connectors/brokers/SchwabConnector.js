// ═══════════════════════════════════════════════════════════════════
// charEdge — Schwab / ThinkorSwim Connector (Phase 7 Sprint 7.8)
//
// OAuth 2.0 connector for Charles Schwab Individual Trader API.
// Supports trade history fetch, account info, and token refresh.
// ═══════════════════════════════════════════════════════════════════

import { BrokerConnector } from '../BrokerConnector.js';
import { registerConnector } from '../ConnectorRegistry.js';

const SCHWAB_AUTH_URL = 'https://api.schwabapi.com/v1/oauth/authorize';
const SCHWAB_TOKEN_URL = '/api/proxy/schwab/v1/oauth/token';
const SCHWAB_API_BASE = '/api/proxy/schwab';

class SchwabConnector extends BrokerConnector {
  constructor() {
    super({
      id: 'schwab',
      name: 'Schwab / ThinkorSwim',
      logo: '💎',
      requiredFields: ['clientId', 'clientSecret'],
      rateLimit: 120,
      syncIntervalMs: 30 * 60 * 1000,
    });
    this._accessToken = null;
    this._refreshToken = null;
    this._tokenExpiry = null;
    this._accountNumbers = [];
  }

  // ─── OAuth Flow ──────────────────────────────────────────────

  /**
   * Start OAuth redirect flow.
   * Opens popup to Schwab authorization page.
   * @param {string} clientId
   * @param {string} redirectUri
   * @returns {Promise<string>} Authorization code
   */
  async _getAuthCode(clientId, redirectUri) {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'readonly',
    });

    const authUrl = `${SCHWAB_AUTH_URL}?${params}`;

    return new Promise((resolve, reject) => {
      const popup = window.open(authUrl, 'schwab_auth', 'width=600,height=700');
      if (!popup) {
        reject(new Error('Popup blocked — please allow popups for charEdge'));
        return;
      }

      const interval = setInterval(() => {
        try {
          if (popup.closed) {
            clearInterval(interval);
            reject(new Error('Authorization cancelled'));
            return;
          }
          const url = popup.location.href;
          if (url.includes('code=')) {
            const code = new URL(url).searchParams.get('code');
            popup.close();
            clearInterval(interval);
            resolve(code);
          }
        } catch {
          // Cross-origin — expected until redirect
        }
      }, 500);

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(interval);
        if (!popup.closed) popup.close();
        reject(new Error('Authorization timed out'));
      }, 300_000);
    });
  }

  /**
   * Exchange auth code for access + refresh tokens.
   */
  async _exchangeCode(credentials, code) {
    const redirectUri = `${window.location.origin}/auth/schwab/callback`;
    const basicAuth = btoa(`${credentials.clientId}:${credentials.clientSecret}`);

    const response = await fetch(SCHWAB_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const err = new Error(`Schwab token exchange failed: ${response.status}`);
      err.status = response.status;
      throw err;
    }

    const data = await response.json();
    this._accessToken = data.access_token;
    this._refreshToken = data.refresh_token;
    this._tokenExpiry = Date.now() + (data.expires_in || 1800) * 1000;
    return data;
  }

  /**
   * Refresh the access token using the refresh token.
   */
  async _refreshAccessToken(credentials) {
    if (!this._refreshToken) throw new Error('No refresh token available');

    const basicAuth = btoa(`${credentials.clientId}:${credentials.clientSecret}`);

    const response = await fetch(SCHWAB_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this._refreshToken,
      }),
    });

    if (!response.ok) {
      this._accessToken = null;
      this._refreshToken = null;
      const err = new Error('Token refresh failed — please reconnect');
      err.status = response.status;
      throw err;
    }

    const data = await response.json();
    this._accessToken = data.access_token;
    if (data.refresh_token) this._refreshToken = data.refresh_token;
    this._tokenExpiry = Date.now() + (data.expires_in || 1800) * 1000;
  }

  /**
   * Ensure we have a valid access token.
   */
  async _ensureToken(credentials) {
    if (this._accessToken && this._tokenExpiry && Date.now() < this._tokenExpiry - 60_000) {
      return; // Token still valid
    }

    if (this._refreshToken) {
      await this._refreshAccessToken(credentials);
    } else {
      throw new Error('Not authenticated — please reconnect');
    }
  }

  /**
   * Make an authenticated Schwab API request.
   */
  async _request(credentials, path) {
    await this._ensureToken(credentials);

    const response = await fetch(`${SCHWAB_API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${this._accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const err = new Error(`Schwab API error: ${response.status}`);
      err.status = response.status;
      throw err;
    }

    return response.json();
  }

  // ─── BrokerConnector Interface ───────────────────────────────

  async testConnection(credentials) {
    try {
      const redirectUri = `${window.location.origin}/auth/schwab/callback`;
      const code = await this._getAuthCode(credentials.clientId, redirectUri);
      await this._exchangeCode(credentials, code);

      // Fetch account numbers
      const accounts = await this._request(credentials, '/trader/v1/accounts/accountNumbers');
      this._accountNumbers = (accounts || []).map((a) => a.accountNumber || a.hashValue);

      return {
        ok: true,
        accountInfo: {
          accountCount: this._accountNumbers.length,
          accounts: this._accountNumbers,
        },
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async fetchTrades(credentials, options = {}) {
    const trades = [];

    for (const accountNum of this._accountNumbers) {
      let path = `/trader/v1/accounts/${accountNum}/orders?maxResults=100&status=FILLED`;

      if (options.since) {
        const fromDate = new Date(options.since).toISOString();
        path += `&fromEnteredTime=${fromDate}`;
      }

      // Default to last 60 days if no since date
      if (!options.since) {
        const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000).toISOString();
        path += `&fromEnteredTime=${sixtyDaysAgo}`;
      }

      const toDate = new Date().toISOString();
      path += `&toEnteredTime=${toDate}`;

      await this._waitForRateLimit();
      const orders = await this._request(credentials, path);

      for (const order of orders || []) {
        if (order.status !== 'FILLED') continue;

        // Extract fills from order legs
        for (const leg of order.orderLegCollection || []) {
          const symbol = leg.instrument?.symbol || '';
          const instruction = (leg.instruction || '').toUpperCase();
          const isBuy = instruction.includes('BUY');

          trades.push({
            date: order.closeTime || order.enteredTime,
            symbol,
            side: isBuy ? 'BUY' : 'SELL',
            quantity: parseFloat(leg.quantity || '0'),
            price: parseFloat(order.price || order.stopPrice || '0'),
            pnl: 0,
            commission: parseFloat(order.commission?.commissionLegs?.[0]?.commissionAmount || '0'),
            notes: `Schwab | ${order.orderType || 'market'} | ${leg.instrument?.assetType || ''}`,
            _source: 'schwab',
            assetClass: (leg.instrument?.assetType || '').toLowerCase() === 'option' ? 'options' : 'equities',
          });
        }
      }
    }

    return trades;
  }

  disconnect() {
    this._accessToken = null;
    this._refreshToken = null;
    this._tokenExpiry = null;
    this._accountNumbers = [];
    super.disconnect();
  }

  getSetupGuide() {
    return {
      steps: [
        'Go to developer.schwab.com and create an app',
        'Set the redirect URI to your charEdge URL + /auth/schwab/callback',
        'Copy the Client ID (App Key) and Client Secret',
        'Paste them into charEdge',
        'Authorize via Schwab login popup',
      ],
      tips: [
        'Works with both Schwab and ThinkorSwim accounts',
        'Uses read-only access — charEdge cannot place trades',
        'Token refreshes automatically every 30 minutes',
        'Refresh tokens expire after 7 days — reconnect if needed',
      ],
      url: 'https://developer.schwab.com/',
    };
  }
}

registerConnector('schwab', SchwabConnector);
export default SchwabConnector;
