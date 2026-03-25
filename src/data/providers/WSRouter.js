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
import { logger } from '@/observability/logger.js';

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
    this._activeProviderIndex = -1;

    // Phase 4.2: Failover state
    this._currentSymbol = null;
    this._currentTf = null;
    this._currentCallbacks = null;
    this._failoverTimer = null;
    this._failoverAttempts = 0;
    this._maxFailoverAttempts = 3;
    this._failoverCheckTimer = null;
  }

  registerProvider(provider) {
    this._providers.push(provider);
  }

  subscribe(symbol, tf, callbacks) {
    // Unsubscribe previous
    this.unsubscribe();

    // Phase 4.2: Store current subscription for failover
    this._currentSymbol = symbol;
    this._currentTf = tf;
    this._currentCallbacks = callbacks;
    this._failoverAttempts = 0;

    // Find first provider that supports this symbol
    for (let i = 0; i < this._providers.length; i++) {
      const p = this._providers[i];
      if (p.isSupported(symbol)) {
        this._activeProvider = p;
        this._activeProviderIndex = i;

        // Phase 4.2: Wrap onStatus to detect disconnection and trigger failover
        const wrappedCallbacks = {
          ...callbacks,
          onStatus: (status) => {
            if (callbacks.onStatus) callbacks.onStatus(status);

            // If provider disconnects, try next provider in chain
            if (status === 'disconnected' && this._failoverAttempts < this._maxFailoverAttempts) {
              this._scheduleFailover();
            }
          },
        };

        p.subscribe(symbol, tf, wrappedCallbacks);

        // Phase 4.2: Start periodic health check for proactive failover
        this._startFailoverCheck();
        return;
      }
    }

    // No provider found — notify as disconnected
    if (callbacks.onStatus) callbacks.onStatus('disconnected');
  }

  unsubscribe() {
    this._stopFailoverCheck();
    if (this._failoverTimer) {
      clearTimeout(this._failoverTimer);
      this._failoverTimer = null;
    }
    if (this._activeProvider) {
      this._activeProvider.unsubscribe();
      this._activeProvider = null;
      this._activeProviderIndex = -1;
    }
    this._currentSymbol = null;
    this._currentTf = null;
    this._currentCallbacks = null;
  }

  getStatus() {
    return this._activeProvider ? this._activeProvider.getStatus() : 'disconnected';
  }

  // Phase 4.2: Get info about which provider is active
  getActiveProviderInfo() {
    return {
      id: this._activeProvider?.id || null,
      index: this._activeProviderIndex,
      totalProviders: this._providers.length,
      failoverAttempts: this._failoverAttempts,
    };
  }

  /**
   * Phase 4.2: Schedule automatic failover to next provider.
   * Tries the next provider in the chain that supports the current symbol.
   * @private
   */
  _scheduleFailover() {
    if (this._failoverTimer) return; // Already scheduled
    if (!this._currentSymbol || !this._currentCallbacks) return;

    this._failoverTimer = setTimeout(() => {
      this._failoverTimer = null;
      this._failoverAttempts++;

      // Try next provider in chain
      const startIdx = this._activeProviderIndex + 1;
      for (let i = startIdx; i < this._providers.length; i++) {
        const p = this._providers[i];
        if (p.isSupported(this._currentSymbol)) {
          // Unsubscribe old provider
          if (this._activeProvider) {
            this._activeProvider.unsubscribe();
          }

          this._activeProvider = p;
          this._activeProviderIndex = i;

          logger.data.warn(`[WSRouter] Failover: switching to ${p.id || 'provider-' + i} for ${this._currentSymbol}`);

          p.subscribe(this._currentSymbol, this._currentTf, {
            ...this._currentCallbacks,
            onStatus: (status) => {
              if (this._currentCallbacks.onStatus) this._currentCallbacks.onStatus(status);
              if (status === 'disconnected' && this._failoverAttempts < this._maxFailoverAttempts) {
                this._scheduleFailover();
              }
            },
          });
          return;
        }
      }

      // Wrap around: try from beginning (skip current)
      for (let i = 0; i < startIdx && i < this._providers.length; i++) {
        const p = this._providers[i];
        if (p !== this._activeProvider && p.isSupported(this._currentSymbol)) {
          if (this._activeProvider) this._activeProvider.unsubscribe();
          this._activeProvider = p;
          this._activeProviderIndex = i;

          logger.data.warn(
            `[WSRouter] Failover (wrap): switching to ${p.id || 'provider-' + i} for ${this._currentSymbol}`,
          );

          p.subscribe(this._currentSymbol, this._currentTf, this._currentCallbacks);
          return;
        }
      }

      logger.data.warn('[WSRouter] All failover providers exhausted');
    }, 2000); // 2s delay before failover to avoid thrashing
  }

  /**
   * Phase 4.2: Periodic health check — proactively switch if active provider is stale.
   * @private
   */
  _startFailoverCheck() {
    this._stopFailoverCheck();
    this._failoverCheckTimer = setInterval(() => {
      if (!this._activeProvider) return;
      const status = this._activeProvider.getStatus();
      if (status === 'disconnected' && this._failoverAttempts < this._maxFailoverAttempts) {
        this._scheduleFailover();
      }
    }, 10_000); // Check every 10s
  }

  /** @private */
  _stopFailoverCheck() {
    if (this._failoverCheckTimer) {
      clearInterval(this._failoverCheckTimer);
      this._failoverCheckTimer = null;
    }
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
wsRouter.registerProvider(pythWSAdapter); // Pyth first — free, no key
wsRouter.registerProvider(krakenWSAdapter); // Kraken second — free crypto redundancy
wsRouter.registerProvider(bybitWSAdapter); // Bybit third — free crypto spot + derivatives
wsRouter.registerProvider(polygonWSAdapter); // Polygon fallback — needs key

export { wsRouter };
