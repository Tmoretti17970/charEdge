// ═══════════════════════════════════════════════════════════════════
// charEdge v17 — Session Manager
//
// Periodic engine state snapshots to IndexedDB for instant page
// resume. On refresh, restores critical engine state before warm-
// start and live WS connections kick in.
//
// Snapshot includes:
//   • OrderFlowEngine: CVD, delta candles, volume profile, last price
//   • StreamingMetrics: imbalance, TWAP, volatility, arrival rate
//   • StreamingIndicatorBridge: current EMA/RSI/MACD/Bollinger values
//
// Uses the unified charEdge-cache database (shared with DataCache).
// Snapshots are stored under rotating keys snapshot:0..snapshot:4.
//
// Usage:
//   import { sessionManager } from './SessionManager.js';
//   sessionManager.start();           // Begin periodic snapshots
//   await sessionManager.restore();   // Restore on page load
// ═══════════════════════════════════════════════════════════════════

import { openCacheDB } from '../../DataCache.js';
import { pipelineLogger } from '../infra/DataPipelineLogger.js';

// ─── Constants ─────────────────────────────────────────────────

const STORE_NAME = 'snapshots';
const SNAPSHOT_INTERVAL_MS = 30_000;  // Every 30 seconds
const MAX_SNAPSHOTS = 5;              // Keep last 5 snapshots
const SNAPSHOT_MAX_AGE_MS = 30 * 60_000; // Discard snapshots older than 30 min

// ─── Session Manager ───────────────────────────────────────────

class _SessionManager {
  constructor() {
    this._timer = null;
    this._started = false;
    this._db = null;
    this._snapshotIdx = 0;  // Rotating index 0..MAX_SNAPSHOTS-1
  }

  /**
   * Start periodic engine state snapshots.
   */
  start() {
    if (this._started) return;
    this._started = true;

    // Snapshot on visibility change (tab going hidden)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this._onVisibilityChange);
      window.addEventListener('beforeunload', this._onBeforeUnload);
    }

    // Periodic snapshots
    this._timer = setInterval(() => this._takeSnapshot(), SNAPSHOT_INTERVAL_MS);
    pipelineLogger.info('SessionManager', 'Started periodic snapshots');
  }

  /**
   * Stop periodic snapshots.
   */
  stop() {
    this._started = false;
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._onVisibilityChange);
      window.removeEventListener('beforeunload', this._onBeforeUnload);
    }
  }

  /**
   * Restore engine state from the latest valid snapshot.
   * Call this on page load BEFORE warm-start and WS connections.
   *
   * @returns {Promise<{ restored: boolean, age: number, symbols: string[] }>}
   */
  async restore() {
    try {
      const db = await this._getDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);

      // Read all snapshot slots and find the newest valid one
      const snapshots = await Promise.all(
        Array.from({ length: MAX_SNAPSHOTS }, (_, i) =>
          new Promise((resolve) => {
            const req = store.get(`snapshot:${i}`);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
          })
        )
      );

      // Find the most recent non-expired snapshot
      let latest = null;
      for (const snap of snapshots) {
        if (!snap?.data?.timestamp) continue;
        if (!latest || snap.data.timestamp > latest.data.timestamp) {
          latest = snap;
        }
      }

      if (!latest) {
        pipelineLogger.info('SessionManager', 'No snapshot found');
        return { restored: false, age: 0, symbols: [] };
      }

      const age = Date.now() - latest.data.timestamp;
      if (age > SNAPSHOT_MAX_AGE_MS) {
        pipelineLogger.info('SessionManager', `Snapshot too old (${Math.round(age / 60000)}min), skipping`);
        return { restored: false, age, symbols: [] };
      }

      const snap = latest.data;

      // Restore OrderFlowEngine state
      // Note: We only read the symbol list. Full state (CVD, VP, delta) will be
      // rebuilt by warmStart() which replays actual ticks from TickPersistence.
      const symbols = [];

      if (snap.orderFlow) {
        for (const symbol of Object.keys(snap.orderFlow)) {
          symbols.push(symbol);
        }
      }

      // Restore StreamingMetrics state
      if (snap.streamingMetrics) {
        try {
          const { streamingMetrics } = await import('./StreamingMetrics.js');
          if (streamingMetrics.restoreState) {
            streamingMetrics.restoreState(snap.streamingMetrics);
          }
        } catch { /* non-fatal */ }
      }

      // Restore StreamingIndicatorBridge state
      if (snap.indicators) {
        try {
          const { streamingIndicatorBridge } = await import('../indicators/StreamingIndicatorBridge.js');
          if (streamingIndicatorBridge.restoreState) {
            streamingIndicatorBridge.restoreState(snap.indicators);
          }
        } catch { /* non-fatal */ }
      }

      pipelineLogger.info('SessionManager',
        `Restored snapshot (age: ${Math.round(age / 1000)}s, symbols: ${symbols.join(', ')})`);

      return { restored: true, age, symbols };

    } catch (err) {
      pipelineLogger.warn('SessionManager', 'Restore failed', err);
      return { restored: false, age: 0, symbols: [] };
    }
  }

  // ─── Private ────────────────────────────────────────────────

  _onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      this._takeSnapshot();
    }
  };

  _onBeforeUnload = () => {
    this._takeSnapshot();
  };

  async _getDB() {
    if (!this._db) {
      this._db = await openCacheDB();
    }
    return this._db;
  }

  async _takeSnapshot() {
    try {
      // Collect state from engines
      const { orderFlowEngine } = await import('../orderflow/OrderFlowEngine.js');
      const { streamingMetrics } = await import('./StreamingMetrics.js');
      const { streamingIndicatorBridge } = await import('../indicators/StreamingIndicatorBridge.js');

      const orderFlow = {};
      for (const symbol of orderFlowEngine.getActiveSymbols()) {
        const stats = orderFlowEngine.getStats(symbol);
        const cvdData = orderFlowEngine.getCVD(symbol);
        const aggressor = orderFlowEngine.getAggressorRatio(symbol);
        orderFlow[symbol] = {
          cvd: cvdData.current,
          totalTicks: stats.totalTicks,
          totalBuyVol: aggressor.totalBuyVol,
          totalSellVol: aggressor.totalSellVol,
          lastPrice: stats.symbol ? stats.symbol : null,
        };
      }

      const metricsState = streamingMetrics.getState ? streamingMetrics.getState() : null;
      const indicatorState = streamingIndicatorBridge.getState ? streamingIndicatorBridge.getState() : null;

      const snapshotData = {
        timestamp: Date.now(),
        orderFlow,
        streamingMetrics: metricsState,
        indicators: indicatorState,
      };

      // Write to IDB using rotating key
      const key = `snapshot:${this._snapshotIdx % MAX_SNAPSHOTS}`;
      this._snapshotIdx++;

      const db = await this._getDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ key, data: snapshotData, timestamp: Date.now() });

      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });

    } catch (err) {
      pipelineLogger.warn('SessionManager', 'Snapshot failed', err);
    }
  }

  /**
   * Dispose: stop snapshots and close DB.
   */
  dispose() {
    this.stop();
    // Don't close the shared DB — it's used by other modules (DataCache, DrawingPersistence)
    this._db = null;
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const sessionManager = new _SessionManager();
export default sessionManager;
