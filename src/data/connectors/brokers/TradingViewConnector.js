// ═══════════════════════════════════════════════════════════════════
// charEdge — TradingView Webhook Receiver (Phase 7 Sprint 7.8)
//
// Local webhook receiver for TradingView alerts.
// Uses a BroadcastChannel to receive alerts from a tiny
// companion tab/window that acts as the webhook endpoint.
//
// How it works:
// 1. User sets up a TradingView alert with webhook URL
// 2. A companion page (or SW) receives the POST
// 3. It broadcasts the data via BroadcastChannel
// 4. This connector listens for broadcasts and imports trades
// ═══════════════════════════════════════════════════════════════════

import { BrokerConnector } from '../BrokerConnector.js';
import { registerConnector } from '../ConnectorRegistry.js';

const CHANNEL_NAME = 'charEdge-tradingview-webhook';

class TradingViewConnector extends BrokerConnector {
  constructor() {
    super({
      id: 'tradingview',
      name: 'TradingView',
      logo: '📺',
      requiredFields: ['webhookSecret'],
      rateLimit: 100,
      syncIntervalMs: 0, // No periodic sync — event-driven
    });
    this._channel = null;
    this._receivedAlerts = [];
  }

  async testConnection(credentials) {
    // Verify the webhook secret is reasonable
    if (!credentials.webhookSecret || credentials.webhookSecret.length < 8) {
      return { ok: false, error: 'Webhook secret must be at least 8 characters' };
    }

    // Set up the BroadcastChannel listener
    this._setupChannel(credentials.webhookSecret);
    return { ok: true };
  }

  _setupChannel(secret) {
    if (this._channel) {
      this._channel.close();
    }

    this._channel = new BroadcastChannel(CHANNEL_NAME);
    this._channel.onmessage = (event) => {
      const data = event.data;
      if (!data || data.secret !== secret) {
        // Ignore messages with wrong secret
        return;
      }

      const alert = this._parseAlert(data.payload);
      if (alert) {
        this._receivedAlerts.push(alert);
        // Notify listeners
        this._setStatus('syncing');
        setTimeout(() => this._setStatus('connected'), 1000);
      }
    };
  }

  _parseAlert(payload) {
    if (!payload) return null;

    // TradingView alert JSON format:
    // { "ticker": "BTCUSD", "action": "buy", "price": 50000, "qty": 0.1, "time": "2024-01-01T..." }
    try {
      const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
      return {
        date: data.time || data.timestamp || new Date().toISOString(),
        symbol: (data.ticker || data.symbol || '').toUpperCase(),
        side: (data.action || data.side || '').toUpperCase() === 'SELL' ? 'SELL' : 'BUY',
        quantity: parseFloat(data.qty || data.quantity || data.contracts || '1'),
        price: parseFloat(data.price || data.close || '0'),
        pnl: parseFloat(data.pnl || '0'),
        commission: 0,
        notes: data.message || data.comment || `TV Alert: ${data.ticker || ''}`,
        _source: 'tradingview',
      };
    } catch {
      return null;
    }
  }

  async fetchTrades(/* credentials, options */) {
    // Return accumulated alerts and clear the buffer
    const trades = [...this._receivedAlerts];
    this._receivedAlerts = [];
    return trades;
  }

  disconnect() {
    if (this._channel) {
      this._channel.close();
      this._channel = null;
    }
    this._receivedAlerts = [];
    super.disconnect();
  }

  getSetupGuide() {
    return {
      steps: [
        'Set a unique webhook secret in charEdge',
        'In TradingView, create an alert on any chart',
        'Set the webhook URL to your charEdge companion endpoint',
        'Use JSON format: {"ticker":"{{ticker}}","action":"{{strategy.order.action}}","price":{{close}},"qty":{{strategy.order.contracts}}}',
        'Alerts will automatically appear in charEdge',
      ],
      tips: [
        'Use Pine Script strategy alerts for automated trade logging',
        'The webhook secret prevents unauthorized alert injection',
      ],
      url: 'https://www.tradingview.com/support/solutions/43000529348/',
    };
  }
}

registerConnector('tradingview', TradingViewConnector);
export default TradingViewConnector;
