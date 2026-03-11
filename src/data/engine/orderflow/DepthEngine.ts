// ═══════════════════════════════════════════════════════════════════
// charEdge v17 — Order Book Depth Engine
//
// Real-time order book (Level 2) depth data from free WebSocket
// streams (Binance, Kraken). Provides:
//
//   • Real-time bid/ask depth display
//   • Depth imbalance ratio (buy vs sell wall detection)
//   • Cumulative depth curve
//   • Spoofing detection (order appear/disappear tracking)
//   • Significant level tracking (large resting orders)
//
// Decomposed: classes live in ./depth/.
// ═══════════════════════════════════════════════════════════════════

import { pipelineLogger } from '../infra/DataPipelineLogger.js';
import { logger } from '@/observability/logger';

import { DepthConnection } from './depth/DepthConnection.ts';
import {
  EXCHANGE_ADAPTERS, detectExchange, cleanSymbol,
  STATE, RECONNECT_BASE_MS, RECONNECT_MAX_MS,
  MAX_RECONNECT_ATTEMPTS, HEARTBEAT_INTERVAL_MS, SILENCE_THRESHOLD_MS,
} from './depth/depthConstants.ts';

// Re-export for external consumers
export { TypedOrderBookSide } from './depth/TypedOrderBookSide.ts';
export { DepthState } from './depth/DepthState.ts';

// ─── Depth Engine ──────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/naming-convention
class _DepthEngine {
  _connections: Map<string, DepthConnection>;
  _stateCallbacks: Set<Function>;

  constructor() {
    this._connections = new Map();
    this._stateCallbacks = new Set();
  }

  // ─── Public API ──────────────────────────────────────────────

  subscribe(symbol: string, callback: Function, opts: { levels?: number; updateMs?: number } = {}) {
    const upper = (symbol || '').toUpperCase();
    const levels = opts.levels || 20;
    const updateMs = opts.updateMs || 1000;

    let conn = this._connections.get(upper);
    if (!conn) {
      conn = new DepthConnection(upper);
      conn.levels = levels;
      conn.updateMs = updateMs;
      conn.exchange = detectExchange(upper);
      conn.cleanSymbol = cleanSymbol(upper);
      this._connections.set(upper, conn);
      this._connectWS(upper, conn);
    }

    conn.subscribers.add(callback);

    return () => {
      conn.subscribers.delete(callback);
      if (conn.subscribers.size === 0) {
        this._disconnectWS(upper);
      }
    };
  }

  getDepth(symbol: string) {
    const conn = this._connections.get((symbol || '').toUpperCase());
    return conn?.depthState?.getSnapshot() || null;
  }

  getConnectionState(symbol: string) {
    const conn = this._connections.get((symbol || '').toUpperCase());
    return conn?.state || STATE.DISCONNECTED;
  }

  onStateChange(callback: Function) {
    this._stateCallbacks.add(callback);
    return () => this._stateCallbacks.delete(callback);
  }

  getConnectedSymbols() {
    return [...this._connections.keys()];
  }

  getStats() {
    const stats: Record<string, unknown> = {};
    for (const [sym, conn] of this._connections) {
      const snap = conn.depthState.getSnapshot();
      stats[sym] = {
        connected: conn.state === STATE.CONNECTED,
        state: conn.state,
        subscribers: conn.subscribers.size,
        spread: snap.spread,
        spreadPct: snap.spreadPct,
        imbalance: snap.imbalanceLabel,
        spoofAlerts: snap.spoofAlerts.length,
        totalUpdates: conn.depthState.totalUpdates,
        reconnectAttempts: conn.reconnectAttempts,
        totalErrors: conn.totalErrors,
        parseErrors: conn.parseErrors,
        lastMessageAge: conn.lastMessageTime ? Date.now() - conn.lastMessageTime : null,
      };
    }
    return stats;
  }

  dispose() {
    for (const sym of [...this._connections.keys()]) {
      this._disconnectWS(sym);
    }
    this._stateCallbacks.clear();
  }

  // ─── Private: Connection Management ──────────────────────────

  _connectWS(symbol: string, conn: DepthConnection) {
    if (!conn.active) return;
    conn.reconnectScheduled = false;

    if (conn.heartbeatTimer) {
      clearInterval(conn.heartbeatTimer);
      conn.heartbeatTimer = null;
    }

    if (conn.ws) {
      conn.ws.onopen = null;
      conn.ws.onmessage = null;
      conn.ws.onclose = null;
      conn.ws.onerror = null;
      try {
        if (conn.ws.readyState === WebSocket.OPEN) conn.ws.close();
      } catch (e) { logger.data.warn('Operation failed', e); }
      conn.ws = null;
    }

    this._setConnectionState(symbol, STATE.CONNECTING);

    const exchange = conn.exchange || 'binance';
    const adapter = EXCHANGE_ADAPTERS[exchange];
    const cleanSym = conn.cleanSymbol || symbol;

    try {
      const wsUrl = adapter.buildUrl(cleanSym, conn.levels, conn.updateMs);
      conn.ws = new WebSocket(wsUrl);

      conn.ws.onopen = () => {
        conn.reconnectAttempts = 0;
        this._setConnectionState(symbol, STATE.CONNECTED);
        pipelineLogger.info('DepthEngine', `WS connected: ${symbol} (${exchange})`);
        if (adapter.subscribeMsg && conn.ws.readyState === WebSocket.OPEN) {
          conn.ws.send(adapter.subscribeMsg(cleanSym));
        }
      };

      conn.ws.onmessage = (evt: MessageEvent) => {
        try {
          const data = JSON.parse(evt.data);
          conn.lastMessageTime = Date.now();
          const { bids, asks } = adapter.parseMessage(data);
          if (bids.length > 0 || asks.length > 0) {
            conn.depthState.update(bids, asks);
          }

          const now = Date.now();
          if (now - conn.lastEmit >= conn.updateMs) {
            conn.lastEmit = now;
            const snapshot = conn.depthState.getSnapshot();
            for (const cb of conn.subscribers) {
              try { cb(snapshot); }
              catch (err) {
                pipelineLogger.warn('DepthEngine', `Subscriber callback error for ${symbol}`, err);
              }
            }
          }
        } catch (err) {
          conn.parseErrors++;
          pipelineLogger.warn('DepthEngine', `Parse error for ${symbol}`, err);
        }
      };

      conn.ws.onclose = (event: CloseEvent) => {
        pipelineLogger.warn('DepthEngine',
          `WS closed: ${symbol} (code=${event.code}, reason=${event.reason || 'none'})`);
        conn.ws = null;
        if (conn.active && conn.subscribers.size > 0) {
          this._scheduleReconnect(symbol, conn);
        }
      };

      conn.ws.onerror = (err: Event) => {
        conn.totalErrors++;
        pipelineLogger.error('DepthEngine', `WS error: ${symbol}`, err);
      };

      this._startHeartbeat(symbol, conn);
    } catch (err) {
      conn.totalErrors++;
      pipelineLogger.error('DepthEngine', `WS create failed: ${symbol}`, err);
      conn.ws = null;
      if (conn.active) this._scheduleReconnect(symbol, conn);
    }
  }

  _scheduleReconnect(symbol: string, conn: DepthConnection) {
    if (!conn.active) return;
    if (conn.reconnectScheduled) return;
    if (conn.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      pipelineLogger.error('DepthEngine',
        `Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached for ${symbol}. Giving up.`);
      this._setConnectionState(symbol, STATE.DISCONNECTED);
      return;
    }

    if (conn.reconnectTimer) {
      clearTimeout(conn.reconnectTimer);
      conn.reconnectTimer = null;
    }

    conn.reconnectScheduled = true;
    conn.reconnectAttempts++;
    const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, conn.reconnectAttempts - 1), RECONNECT_MAX_MS);
    const jitter = delay * (0.75 + Math.random() * 0.5);

    this._setConnectionState(symbol, STATE.RECONNECTING);
    pipelineLogger.info('DepthEngine',
      `Reconnecting ${symbol} in ${Math.round(jitter)}ms (attempt ${conn.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

    conn.reconnectTimer = setTimeout(() => {
      conn.reconnectTimer = null;
      conn.reconnectScheduled = false;
      if (conn.active) this._connectWS(symbol, conn);
    }, jitter);
  }

  _startHeartbeat(symbol: string, conn: DepthConnection) {
    if (conn.heartbeatTimer) clearInterval(conn.heartbeatTimer);

    conn.heartbeatTimer = setInterval(() => {
      if (!conn.active) { clearInterval(conn.heartbeatTimer!); return; }
      if (conn.lastMessageTime === 0) return;

      const silenceDuration = Date.now() - conn.lastMessageTime;
      if (silenceDuration > SILENCE_THRESHOLD_MS) {
        pipelineLogger.warn('DepthEngine',
          `Silence detected for ${symbol}: ${Math.round(silenceDuration / 1000)}s without data. Forcing reconnect.`);
        if (conn.ws) {
          conn.ws.onopen = null;
          conn.ws.onmessage = null;
          conn.ws.onclose = null;
          conn.ws.onerror = null;
          if (conn.ws.readyState === WebSocket.OPEN) conn.ws.close();
          conn.ws = null;
        }
        this._scheduleReconnect(symbol, conn);
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  _disconnectWS(symbol: string) {
    const conn = this._connections.get(symbol);
    if (!conn) return;

    conn.dispose();
    if (conn.ws) {
      conn.ws.onopen = null;
      conn.ws.onmessage = null;
      conn.ws.onclose = null;
      conn.ws.onerror = null;
      if (conn.ws.readyState === WebSocket.OPEN) conn.ws.close();
      conn.ws = null;
    }

    this._connections.delete(symbol);
    this._setConnectionState(symbol, STATE.DISCONNECTED);
    pipelineLogger.info('DepthEngine', `Disconnected: ${symbol}`);
  }

  _setConnectionState(symbol: string, newState: string) {
    const conn = this._connections.get(symbol);
    const oldState = conn?.state;
    if (conn) conn.state = newState;

    if (oldState !== newState) {
      for (const cb of this._stateCallbacks) {
        try { cb(symbol, newState, oldState); }
        catch (err) {
          pipelineLogger.warn('DepthEngine', 'State change callback error', err);
        }
      }
    }
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const depthEngine = new _DepthEngine();
export default depthEngine;
