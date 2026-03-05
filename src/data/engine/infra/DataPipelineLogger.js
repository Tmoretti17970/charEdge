import { logger } from '../../../utils/logger';

// ═══════════════════════════════════════════════════════════════════
// charEdge v16 — Data Pipeline Logger
//
// Centralized structured logging for the entire data pipeline.
// Replaces scattered console.warn / catch (_) {} patterns with a
// unified logger that tracks error budgets and surfaces issues.
//
// Features:
//   • Structured log entries: { level, source, message, err, ts }
//   • Rolling buffer of recent entries (last 500)
//   • Error budget: if >N errors in 60s, fires alert callback
//   • Subscribe to log events for UI display
//   • Queryable: getRecentErrors(), getBySource()
//
// Usage:
//   import { pipelineLogger } from './DataPipelineLogger.js';
//   pipelineLogger.info('OrderFlowBridge', 'Connected: BTCUSDT');
//   pipelineLogger.warn('TickPersistence', 'Flush failed', error);
//   pipelineLogger.error('StreamingMetrics', 'NaN in computation', error);
//   pipelineLogger.onAlert((entry) => showToast(entry.message));
// ═══════════════════════════════════════════════════════════════════

// ─── Constants ─────────────────────────────────────────────────

const MAX_LOG_ENTRIES = 500;
const ERROR_BUDGET_WINDOW_MS = 60000;  // 60 second window
const ERROR_BUDGET_THRESHOLD = 10;     // >10 errors in window → alert

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

// ─── Pipeline Logger ───────────────────────────────────────────

class _DataPipelineLogger {
  constructor() {
    this._entries = [];                    // Rolling buffer
    this._subscribers = new Set();         // (entry) => void
    this._alertCallbacks = new Set();      // (entry) => void — error budget breaches
    this._errorTimestamps = [];            // For error budget tracking
    this._minLevel = LEVELS.info;          // Don't log debug by default
    this._errorBudgetBreached = false;
    this._totalByLevel = { debug: 0, info: 0, warn: 0, error: 0 };
    this._metricSamples = [];              // 1Hz metric samples for telemetry
  }

  // ─── Logging Methods ────────────────────────────────────────

  debug(source, message, err = null) {
    this._log('debug', source, message, err);
  }

  info(source, message, err = null) {
    this._log('info', source, message, err);
  }

  warn(source, message, err = null) {
    this._log('warn', source, message, err);
  }

  error(source, message, err = null) {
    this._log('error', source, message, err);
  }

  // ─── Query Methods ──────────────────────────────────────────

  /**
   * Get recent log entries.
   * @param {number} [count=50]
   * @param {string} [level] - Filter by level ('error', 'warn', etc.)
   * @returns {Array}
   */
  getRecent(count = 50, level = null) {
    let entries = this._entries;
    if (level) {
      entries = entries.filter(e => e.level === level);
    }
    return entries.slice(-count);
  }

  /**
   * Get recent errors.
   * @param {number} [count=20]
   * @returns {Array}
   */
  getRecentErrors(count = 20) {
    return this.getRecent(count, 'error');
  }

  /**
   * Get entries by source.
   * @param {string} source
   * @param {number} [count=50]
   * @returns {Array}
   */
  getBySource(source, count = 50) {
    return this._entries.filter(e => e.source === source).slice(-count);
  }

  /**
   * Get log statistics.
   */
  getStats() {
    const now = Date.now();
    const recentErrors = this._errorTimestamps.filter(t => now - t < ERROR_BUDGET_WINDOW_MS).length;

    return {
      totalEntries: this._entries.length,
      byLevel: { ...this._totalByLevel },
      recentErrorRate: recentErrors,
      errorBudgetBreached: this._errorBudgetBreached,
      errorBudgetThreshold: ERROR_BUDGET_THRESHOLD,
    };
  }

  // ─── Subscription ───────────────────────────────────────────

  /**
   * Subscribe to all log entries.
   * @param {Function} callback - (entry) => void
   * @returns {Function} unsubscribe
   */
  subscribe(callback) {
    this._subscribers.add(callback);
    return () => this._subscribers.delete(callback);
  }

  /**
   * Subscribe to error budget breach alerts.
   * @param {Function} callback - (entry) => void
   * @returns {Function} unsubscribe
   */
  onAlert(callback) {
    this._alertCallbacks.add(callback);
    return () => this._alertCallbacks.delete(callback);
  }

  /**
   * Set the minimum log level.
   * @param {string} level - 'debug', 'info', 'warn', 'error'
   */
  setMinLevel(level) {
    if (LEVELS[level] !== undefined) {
      this._minLevel = LEVELS[level];
    }
  }

  /**
   * Clear all entries.
   */
  clear() {
    this._entries = [];
    this._errorTimestamps = [];
    this._errorBudgetBreached = false;
    this._totalByLevel = { debug: 0, info: 0, warn: 0, error: 0 };
  }

  // ─── Private ────────────────────────────────────────────────

  /** @private */
  _log(level, source, message, err) {
    if (LEVELS[level] < this._minLevel) return;

    const entry = {
      level,
      source,
      message,
      error: err ? (err.message || String(err)) : null,
      stack: err?.stack || null,
      ts: Date.now(),
      time: new Date().toISOString(),
    };

    // Add to rolling buffer
    this._entries.push(entry);
    if (this._entries.length > MAX_LOG_ENTRIES) {
      this._entries.shift();
    }

    // Track level counts
    this._totalByLevel[level] = (this._totalByLevel[level] || 0) + 1;

    // Console output
    const prefix = `[${source}]`;
    if (level === 'error') {
      logger.data.error(prefix, message, err || '');
    } else if (level === 'warn') {
      logger.data.warn(prefix, message, err || '');
    } else {
      logger.data.info(prefix, message);
    }

    // Notify subscribers
    for (const cb of this._subscribers) {
      try { cb(entry); } catch (e) { logger.data.warn('Operation failed', e); }
    }

    // Error budget tracking
    if (level === 'error') {
      this._errorTimestamps.push(entry.ts);
      this._checkErrorBudget(entry);
    }
  }

  /** @private */
  _checkErrorBudget(latestEntry) {
    const now = Date.now();
    // Clean old timestamps
    this._errorTimestamps = this._errorTimestamps.filter(t => now - t < ERROR_BUDGET_WINDOW_MS);

    if (this._errorTimestamps.length > ERROR_BUDGET_THRESHOLD && !this._errorBudgetBreached) {
      this._errorBudgetBreached = true;

      for (const cb of this._alertCallbacks) {
        try { cb(latestEntry); } catch (e) { logger.data.warn('Operation failed', e); }
      }

      // Auto-reset after the window passes
      setTimeout(() => { this._errorBudgetBreached = false; }, ERROR_BUDGET_WINDOW_MS);
    }
  }

  // ─── Telemetry Export ────────────────────────────────────────

  /**
   * Export a structured telemetry report as JSON.
   * Includes all log entries, engine stats, and performance timeline.
   *
   * @param {Object} [opts]
   * @param {boolean} [opts.download=false] - Trigger browser download
   * @param {Function} [opts.getEngineStats] - () => Object — custom engine stats
   * @param {Function} [opts.getPerfStats] - () => Object — custom perf stats
   * @returns {Object} Telemetry report
   */
  exportTelemetry(opts = {}) {
    const report = {
      version: 'charEdge-telemetry-v1',
      timestamp: Date.now(),
      isoTime: new Date().toISOString(),
      session: {
        duration: this._entries.length > 0
          ? Date.now() - this._entries[0].ts
          : 0,
        totalEntries: this._entries.length,
        byLevel: { ...this._totalByLevel },
        errorBudgetBreaches: this._errorBudgetBreached ? 1 : 0,
      },
      logs: this._entries.map(e => ({
        level: e.level,
        source: e.source,
        message: e.message,
        error: e.error,
        ts: e.ts,
      })),
      metrics: this._metricSamples.slice(),
    };

    // Add custom engine stats if provided
    if (opts.getEngineStats) {
      try { report.engineStats = opts.getEngineStats(); } catch (e) { logger.data.warn('Operation failed', e); }
    }

    // Add custom perf stats if provided
    if (opts.getPerfStats) {
      try { report.perfStats = opts.getPerfStats(); } catch (e) { logger.data.warn('Operation failed', e); }
    }

    // Trigger download if requested
    if (opts.download && typeof document !== 'undefined') {
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `charEdge-telemetry-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }

    return report;
  }

  /**
   * Record a metric sample (call at 1Hz from external polling).
   * @param {Object} sample - { tickRate, fps, memoryMB, errorRate, ... }
   */
  recordMetricSample(sample) {
    this._metricSamples.push({ ...sample, ts: Date.now() });
    // Keep last 10 minutes at 1Hz = 600 samples
    if (this._metricSamples.length > 600) {
      this._metricSamples.shift();
    }
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const pipelineLogger = new _DataPipelineLogger();
export default pipelineLogger;

