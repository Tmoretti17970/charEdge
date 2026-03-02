// ═══════════════════════════════════════════════════════════════════
// charEdge v16 — Pipeline Health Monitor
//
// Centralized aggregator that collects health stats from ALL data
// engines into a single unified snapshot. Provides an overall
// pipeline health status (healthy/degraded/critical) for UI display.
//
// Usage:
//   import { pipelineHealth } from './PipelineHealthMonitor.js';
//   const health = pipelineHealth.getHealth();
//   pipelineHealth.onHealthChange((health) => { ... });
// ═══════════════════════════════════════════════════════════════════

import { orderFlowBridge } from '../orderflow/OrderFlowBridge.js';
import { depthEngine } from '../orderflow/DepthEngine.js';
import { tickPersistence } from '../streaming/TickPersistence.js';
import { streamingMetrics } from '../streaming/StreamingMetrics.js';
import { performanceMonitor } from './PerformanceMonitor.js';
import { pipelineLogger } from './DataPipelineLogger.js';

// ─── Constants ─────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5000;    // Update health every 5 seconds
const TICK_RATE_WINDOW_MS = 10000; // 10-second window for tick rate

// Health status thresholds
const THRESHOLDS = {
  tickRate: { degraded: 0, critical: 0 },       // 0 ticks/sec → issue (only if connected)
  fps: { degraded: 30, critical: 15 },
  jankRate: { degraded: 10, critical: 25 },      // Percentage
  errorRate: { degraded: 3, critical: 8 },        // Per minute
};

// ─── Pipeline Health Monitor ───────────────────────────────────

class _PipelineHealthMonitor {
  constructor() {
    this._pollTimer = null;
    this._callbacks = new Set();
    this._lastHealth = null;
    this._tickRateHistory = [];   // [{ ts, count }]
    this._started = false;
  }

  /**
   * Start periodic health monitoring.
   */
  start() {
    if (this._started) return;
    this._started = true;
    this._poll();
    this._pollTimer = setInterval(() => this._poll(), POLL_INTERVAL_MS);
  }

  /**
   * Stop monitoring.
   */
  stop() {
    this._started = false;
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  /**
   * Get a comprehensive health snapshot.
   * @returns {Object}
   */
  getHealth() {
    const connStats = orderFlowBridge.getStats();
    const perfStats = performanceMonitor.getStats();
    const logStats = pipelineLogger.getStats();
    const persistenceStats = tickPersistence.getStats();

    // Compute tick rate (ticks per second over the window)
    const connectedSymbols = orderFlowBridge.getConnectedSymbols();
    let totalTicksPerSec = 0;
    for (const sym of connectedSymbols) {
      const st = connStats[sym];
      if (st) {
        totalTicksPerSec += this._computeTickRate(sym, st.ticksReceived);
      }
    }

    // Connection states
    const connectionStates = {};
    for (const sym of connectedSymbols) {
      connectionStates[sym] = orderFlowBridge.getConnectionState(sym);
    }

    // Streaming metrics active
    const activeMetrics = streamingMetrics.getActiveSymbols();

    // Depth engine stats
    const depthStats = depthEngine.getStats();
    const depthSymbols = depthEngine.getConnectedSymbols();
    const depthStates = {};
    for (const sym of depthSymbols) {
      depthStates[sym] = depthEngine.getConnectionState(sym);
    }

    // Determine overall health
    const issues = [];
    let overall = 'healthy';

    // Check trade connections
    const reconnectingCount = Object.values(connectionStates).filter(s => s === 'reconnecting').length;
    const disconnectedCount = Object.values(connectionStates).filter(s => s === 'disconnected').length;
    if (disconnectedCount > 0) {
      issues.push(`${disconnectedCount} trade WS disconnected`);
      overall = 'critical';
    } else if (reconnectingCount > 0) {
      issues.push(`${reconnectingCount} trade WS reconnecting`);
      if (overall !== 'critical') overall = 'degraded';
    }

    // Check depth connections
    const depthReconnecting = Object.values(depthStates).filter(s => s === 'reconnecting').length;
    const depthDisconnected = Object.values(depthStates).filter(s => s === 'disconnected').length;
    if (depthDisconnected > 0) {
      issues.push(`${depthDisconnected} depth WS disconnected`);
      if (overall !== 'critical') overall = 'degraded';
    } else if (depthReconnecting > 0) {
      issues.push(`${depthReconnecting} depth WS reconnecting`);
      if (overall !== 'critical') overall = 'degraded';
    }

    // Check FPS
    if (perfStats.fps > 0 && perfStats.fps < THRESHOLDS.fps.critical) {
      issues.push(`FPS: ${perfStats.fps}`);
      overall = 'critical';
    } else if (perfStats.fps > 0 && perfStats.fps < THRESHOLDS.fps.degraded) {
      issues.push(`FPS: ${perfStats.fps}`);
      if (overall !== 'critical') overall = 'degraded';
    }

    // Check error rate
    if (logStats.recentErrorRate > THRESHOLDS.errorRate.critical) {
      issues.push(`${logStats.recentErrorRate} errors/min`);
      overall = 'critical';
    } else if (logStats.recentErrorRate > THRESHOLDS.errorRate.degraded) {
      issues.push(`${logStats.recentErrorRate} errors/min`);
      if (overall !== 'critical') overall = 'degraded';
    }

    return {
      overall,
      issues,
      connections: {
        total: connectedSymbols.length,
        states: connectionStates,
        reconnecting: reconnectingCount,
        disconnected: disconnectedCount,
      },
      tickRate: Math.round(totalTicksPerSec * 10) / 10,
      performance: {
        fps: perfStats.fps || 0,
        avgFrameTime: perfStats.avgFrameTime || 0,
        jankRate: perfStats.jankRate || 0,
        qualityLevel: perfStats.currentLevel || 'high',
      },
      persistence: {
        enabled: persistenceStats.enabled,
        totalFlushed: persistenceStats.totalFlushed,
        pendingFlush: persistenceStats.pendingFlush,
        symbols: persistenceStats.symbols?.length || 0,
      },
      errors: {
        total: logStats.byLevel?.error || 0,
        warnings: logStats.byLevel?.warn || 0,
        recentRate: logStats.recentErrorRate,
        budgetBreached: logStats.errorBudgetBreached,
      },
      depth: {
        total: depthSymbols.length,
        states: depthStates,
        reconnecting: depthReconnecting,
        disconnected: depthDisconnected,
        stats: depthStats,
      },
      activeMetrics: activeMetrics.length,
      timestamp: Date.now(),
    };
  }

  /**
   * Subscribe to health status changes.
   * @param {Function} callback - (health) => void
   * @returns {Function} unsubscribe
   */
  onHealthChange(callback) {
    this._callbacks.add(callback);
    return () => this._callbacks.delete(callback);
  }

  /**
   * Dispose.
   */
  dispose() {
    this.stop();
    this._callbacks.clear();
    this._tickRateHistory = [];
  }

  // ─── Private ────────────────────────────────────────────────

  /** @private */
  _poll() {
    try {
      const health = this.getHealth();
      const prevOverall = this._lastHealth?.overall;
      this._lastHealth = health;

      // Notify on change (or always on first poll)
      if (!prevOverall || prevOverall !== health.overall) {
        for (const cb of this._callbacks) {
          try { cb(health); } catch { /* silent */ }
        }
      }
    } catch {
      // Monitor itself must never crash
    }
  }

  /** @private — Compute tick rate per second for a symbol */
  _computeTickRate(symbol, currentCount) {
    const now = Date.now();
    const key = `${symbol}`;

    // Store data point
    if (!this._tickRateHistory[key]) {
      this._tickRateHistory[key] = [];
    }
    const history = this._tickRateHistory[key];
    history.push({ ts: now, count: currentCount });

    // Clean old entries
    while (history.length > 0 && now - history[0].ts > TICK_RATE_WINDOW_MS) {
      history.shift();
    }

    if (history.length < 2) return 0;

    const oldest = history[0];
    const newest = history[history.length - 1];
    const elapsed = (newest.ts - oldest.ts) / 1000;
    if (elapsed <= 0) return 0;

    return (newest.count - oldest.count) / elapsed;
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const pipelineHealth = new _PipelineHealthMonitor();
export default pipelineHealth;
