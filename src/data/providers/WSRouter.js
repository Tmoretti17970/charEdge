// ═══════════════════════════════════════════════════════════════════
// charEdge — Multi-Provider WebSocket Router
//
// Routes WebSocket subscriptions to the correct provider
// based on asset class (crypto → Binance, equities → Pyth/Polygon).
// ═══════════════════════════════════════════════════════════════════

import { bybitAdapter } from '../adapters/BybitAdapter.js';
import { krakenAdapter } from '../adapters/KrakenAdapter.js';
import { pythAdapter } from '../adapters/PythAdapter.js';
import { createPolygonWSAdapter } from './PolygonProvider.js';

// ─── WSRouter Class ─────────────────────────────────────────────

/**
 * Routes WebSocket subscriptions to the correct provider
 * based on asset class.
 *
 * Usage:
 *   import { wsRouter } from './WSRouter.js';
 *   wsRouter.subscribe('AAPL', '1d', { onCandle, onTick, onStatus });
 *   wsRouter.subscribe('BTC', '1d', { onCandle, onTick, onStatus });
 *
 * Crypto → Binance WS (existing WebSocketService)
 * Equities → Pyth SSE → Polygon WS adapter (polling fallback)
 */
export class WSRouter {
  constructor() {
    this._providers = [];
    this._activeProvider = null;
  }

  registerProvider(provider) {
    this._providers.push(provider);
  }

  subscribe(symbol, tf, callbacks) {
    // Unsubscribe previous
    this.unsubscribe();

    // Find first provider that supports this symbol
    for (const p of this._providers) {
      if (p.isSupported(symbol)) {
        this._activeProvider = p;
        p.subscribe(symbol, tf, callbacks);
        return;
      }
    }

    // No provider found — notify as disconnected
    if (callbacks.onStatus) callbacks.onStatus('disconnected');
  }

  unsubscribe() {
    if (this._activeProvider) {
      this._activeProvider.unsubscribe();
      this._activeProvider = null;
    }
  }

  getStatus() {
    return this._activeProvider ? this._activeProvider.getStatus() : 'disconnected';
  }
}

// ─── Pyth WebSocket Adapter ─────────────────────────────────────
// Wraps PythAdapter's SSE streaming as a WSRouter-compatible provider.

export function createPythWSAdapter() {
  let _status = 'disconnected';
  let _unsubscribe = null;

  return {
    id: 'pyth-ws',

    isSupported(symbol) {
      return pythAdapter.supports(symbol);
    },

    subscribe(symbol, tf, { _onCandle, onTick, onStatus } = {}) {
      _status = 'connecting';
      if (onStatus) onStatus(_status);

      _unsubscribe = pythAdapter.subscribe(symbol, (data) => {
        _status = 'connected';
        if (onStatus) onStatus(_status);
        if (onTick) {
          onTick({
            price: data.price,
            volume: data.volume || 0,
            time: data.time,
            confidence: data.confidence,
            source: 'pyth',
          });
        }
      });
    },

    unsubscribe() {
      if (_unsubscribe) {
        _unsubscribe();
        _unsubscribe = null;
      }
      _status = 'disconnected';
    },

    getStatus() {
      return _status;
    },
  };
}

// ─── Kraken WebSocket Adapter ───────────────────────────────────
// Free, no API key, for crypto redundancy.

export function createKrakenWSAdapter() {
  let _status = 'disconnected';
  let _unsubscribe = null;

  return {
    id: 'kraken-ws',

    isSupported(symbol) {
      return krakenAdapter.supports(symbol);
    },

    subscribe(symbol, tf, { _onCandle, onTick, onStatus } = {}) {
      _status = 'connecting';
      if (onStatus) onStatus(_status);

      _unsubscribe = krakenAdapter.subscribe(symbol, (data) => {
        _status = 'connected';
        if (onStatus) onStatus(_status);
        if (onTick) {
          onTick({
            price: data.price,
            volume: data.volume || 0,
            time: data.time,
            source: 'kraken',
            side: data.side,
          });
        }
      });
    },

    unsubscribe() {
      if (_unsubscribe) {
        _unsubscribe();
        _unsubscribe = null;
      }
      _status = 'disconnected';
    },

    getStatus() {
      return _status;
    },
  };
}

// ─── Bybit WebSocket Adapter ────────────────────────────────────
// Free, no API key, for crypto. Spot + derivatives.

export function createBybitWSAdapter() {
  let _status = 'disconnected';
  let _unsubscribe = null;

  return {
    id: 'bybit-ws',

    isSupported(symbol) {
      return bybitAdapter.supports(symbol);
    },

    subscribe(symbol, tf, { _onCandle, onTick, onStatus } = {}) {
      _status = 'connecting';
      if (onStatus) onStatus(_status);

      _unsubscribe = bybitAdapter.subscribe(symbol, (data) => {
        _status = 'connected';
        if (onStatus) onStatus(_status);
        if (onTick) {
          onTick({
            price: data.price,
            volume: data.volume || 0,
            time: data.time,
            source: 'bybit',
            side: data.side,
          });
        }
      });
    },

    unsubscribe() {
      if (_unsubscribe) {
        _unsubscribe();
        _unsubscribe = null;
      }
      _status = 'disconnected';
    },

    getStatus() {
      return _status;
    },
  };
}

// ─── Singleton Router ───────────────────────────────────────────
// Create singleton router with Pyth + Kraken + Bybit + Polygon adapters
// Binance adapter will be registered from WebSocketService on import

const wsRouter = new WSRouter();
const pythWSAdapter = createPythWSAdapter();
const krakenWSAdapter = createKrakenWSAdapter();
const bybitWSAdapter = createBybitWSAdapter();
const polygonWSAdapter = createPolygonWSAdapter();
wsRouter.registerProvider(pythWSAdapter);      // Pyth first — free, no key
wsRouter.registerProvider(krakenWSAdapter);    // Kraken second — free crypto redundancy
wsRouter.registerProvider(bybitWSAdapter);     // Bybit third — free crypto spot + derivatives
wsRouter.registerProvider(polygonWSAdapter);   // Polygon fallback — needs key

export { wsRouter };
