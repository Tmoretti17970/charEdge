// ═══════════════════════════════════════════════════════════════════
// charEdge v17 — Memory Budget System
//
// Global memory budget for data engines. Prevents unbounded growth
// when watching multiple symbols simultaneously.
//
// When total estimated memory exceeds the budget:
//   1. Shrink tick buffers for inactive symbols (50k → 10k)
//   2. Reduce CVD history resolution
//   3. Drop footprint data for non-visible timeframes
//   4. Evict TickPersistence hot cache for oldest symbols
//
// Integrates with PerformanceMonitor — memory pressure triggers
// quality downgrade.
//
// Usage:
//   import { memoryBudget } from './MemoryBudget.js';
//   memoryBudget.start();
//   memoryBudget.register('OrderFlowEngine', () => estimateBytes());
//   console.log(memoryBudget.getStatus());
// ═══════════════════════════════════════════════════════════════════

import { pipelineLogger } from './DataPipelineLogger.js';

// ─── Constants ─────────────────────────────────────────────────

const DEFAULT_BUDGET_MB = 200;          // 200 MB total for data engines
const POLL_INTERVAL_MS = 10_000;        // Check every 10 seconds
const WARNING_THRESHOLD = 0.75;         // 75% → start degrading
const CRITICAL_THRESHOLD = 0.90;        // 90% → aggressive eviction

const BYTES_PER_MB = 1024 * 1024;

// Memory estimation helpers
const FLOAT64_BYTES = 8;
const MAP_ENTRY_OVERHEAD = 80;  // Approximate per-entry overhead for Map
const OBJECT_OVERHEAD = 64;     // Approximate per-object overhead

// ─── Memory Budget Manager ────────────────────────────────────

class _MemoryBudget {
  constructor() {
    this._budgetBytes = DEFAULT_BUDGET_MB * BYTES_PER_MB;
    this._estimators = new Map();       // name → () => bytes
    this._pollTimer = null;
    this._started = false;
    this._lastStatus = null;
    this._callbacks = new Set();
    this._degradationLevel = 0;         // 0 = none, 1 = warning, 2 = critical
  }

  // ─── Public API ──────────────────────────────────────────────

  /**
   * Set the global memory budget.
   * @param {number} mb - Budget in megabytes
   */
  setBudget(mb) {
    this._budgetBytes = mb * BYTES_PER_MB;
    pipelineLogger.info('MemoryBudget', `Budget set to ${mb} MB`);
  }

  /**
   * Register a memory estimator function for an engine.
   * @param {string} name - Engine name
   * @param {Function} estimator - () => estimated bytes used
   */
  register(name, estimator) {
    this._estimators.set(name, estimator);
  }

  /**
   * Unregister an engine.
   * @param {string} name
   */
  unregister(name) {
    this._estimators.delete(name);
  }

  /**
   * Start periodic memory monitoring.
   */
  start() {
    if (this._started) return;
    this._started = true;
    this._check();
    this._pollTimer = setInterval(() => this._check(), POLL_INTERVAL_MS);
    pipelineLogger.info('MemoryBudget', `Started (budget: ${Math.round(this._budgetBytes / BYTES_PER_MB)} MB)`);
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
   * Get current memory status.
   * @returns {{ used: number, budget: number, pct: number, level: string, breakdown: Object }}
   */
  getStatus() {
    const breakdown = {};
    let totalUsed = 0;

    for (const [name, estimator] of this._estimators) {
      try {
        const bytes = estimator();
        breakdown[name] = bytes;
        totalUsed += bytes;
      } catch {
        breakdown[name] = 0;
      }
    }

    const pct = this._budgetBytes > 0 ? totalUsed / this._budgetBytes : 0;

    return {
      used: totalUsed,
      usedMB: Math.round(totalUsed / BYTES_PER_MB * 100) / 100,
      budget: this._budgetBytes,
      budgetMB: Math.round(this._budgetBytes / BYTES_PER_MB),
      pct: Math.round(pct * 1000) / 10,
      level: pct >= CRITICAL_THRESHOLD ? 'critical'
           : pct >= WARNING_THRESHOLD ? 'warning' : 'healthy',
      degradationLevel: this._degradationLevel,
      breakdown,
    };
  }

  /**
   * Subscribe to memory pressure events.
   * @param {Function} callback - (status) => void
   * @returns {Function} unsubscribe
   */
  onPressure(callback) {
    this._callbacks.add(callback);
    return () => this._callbacks.delete(callback);
  }

  /**
   * Get the current degradation level.
   * Engines can query this to adjust their buffer sizes.
   * @returns {number} 0 = normal, 1 = warning, 2 = critical
   */
  getDegradationLevel() {
    return this._degradationLevel;
  }

  /**
   * Estimate memory for a TypedArray.
   */
  static estimateTypedArray(length, bytesPerElement = FLOAT64_BYTES) {
    return length * bytesPerElement + 64; // 64 bytes overhead
  }

  /**
   * Estimate memory for a Map with object values.
   */
  static estimateMap(size, avgValueBytes = OBJECT_OVERHEAD) {
    return size * (MAP_ENTRY_OVERHEAD + avgValueBytes);
  }

  /**
   * Estimate memory for an array of objects.
   */
  static estimateObjectArray(length, avgObjectBytes = OBJECT_OVERHEAD) {
    return length * avgObjectBytes + 32; // Array header
  }

  /**
   * Dispose.
   */
  dispose() {
    this.stop();
    this._estimators.clear();
    this._callbacks.clear();
  }

  // ─── Private ────────────────────────────────────────────────

  _check() {
    const status = this.getStatus();
    const prevLevel = this._degradationLevel;

    // Compare using consistent 0-1 ratio (status.pct is 0-100, thresholds are 0-1)
    const rawRatio = status.pct / 100;
    if (rawRatio >= CRITICAL_THRESHOLD) {
      this._degradationLevel = 2;
    } else if (rawRatio >= WARNING_THRESHOLD) {
      this._degradationLevel = 1;
    } else {
      this._degradationLevel = 0;
    }

    // Only notify on level change
    if (this._degradationLevel !== prevLevel) {
      const levelName = ['normal', 'warning', 'critical'][this._degradationLevel];
      pipelineLogger.warn('MemoryBudget',
        `Memory pressure: ${levelName} (${status.usedMB} MB / ${status.budgetMB} MB = ${status.pct}%)`);

      // Trigger degradation actions
      if (this._degradationLevel >= 1) {
        this._triggerDegradation(status);
      }

      for (const cb of this._callbacks) {
        try { cb(status); } catch { /* silent */ }
      }
    }

    this._lastStatus = status;
  }

  async _triggerDegradation(status) {
    pipelineLogger.info('MemoryBudget', `Triggering degradation (level ${this._degradationLevel})`);

    try {
      // 1. Shrink OrderFlowEngine buffers for inactive symbols
      const { orderFlowEngine } = await import('../orderflow/OrderFlowEngine.js');
      const activeSymbols = orderFlowEngine.getActiveSymbols();
      // For now, just log — actual buffer shrinking requires engine cooperation
      if (this._degradationLevel >= 2 && activeSymbols.length > 3) {
        pipelineLogger.info('MemoryBudget',
          `Consider reducing buffers for ${activeSymbols.length} active symbols`);
      }

      // 2. Evict TickPersistence hot cache
      if (this._degradationLevel >= 2) {
        try {
          const { dataCache } = await import('../../DataCache.js');
          if (dataCache?.evictIfOverBudget) {
            await dataCache.evictIfOverBudget();
            pipelineLogger.info('MemoryBudget', 'Triggered DataCache eviction');
          }
        } catch { /* non-fatal */ }
      }
    } catch (err) {
      pipelineLogger.warn('MemoryBudget', 'Degradation action failed', err);
    }
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const memoryBudget = new _MemoryBudget();
export default memoryBudget;
