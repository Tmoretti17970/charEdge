// ═══════════════════════════════════════════════════════════════════
// charEdge — Memory Pressure Monitor (Task 2.3.5)
//
// Polls browser memory usage and triggers auto-decimation when
// approaching the memory budget. Uses the Performance Memory API
// when available, with a fallback estimation based on tracked objects.
//
// Thresholds:
// - 80% → evict old LRU blocks
// - 90% → evict non-visible timeframes
// - 95% → force emergency cleanup
// ═══════════════════════════════════════════════════════════════════

import { logger } from '../../utils/logger.js';

// ─── Types ───────────────────────────────────────────────────────

export interface MemorySnapshot {
  usedMB: number;
  budgetMB: number;
  usagePercent: number;
  timestamp: number;
}

export type PressureLevel = 'normal' | 'warning' | 'critical' | 'emergency';

export interface MemoryPressureConfig {
  /** Memory budget in MB. Default: 512 (conservative for mobile) */
  budgetMB: number;
  /** Poll interval in ms. Default: 10000 (10s) */
  pollIntervalMs: number;
  /** Warning threshold (0-1). Default: 0.8 */
  warningThreshold: number;
  /** Critical threshold (0-1). Default: 0.9 */
  criticalThreshold: number;
  /** Emergency threshold (0-1). Default: 0.95 */
  emergencyThreshold: number;
}

export type PressureCallback = (level: PressureLevel, snapshot: MemorySnapshot) => void;

// ─── Monitor ─────────────────────────────────────────────────────

const DEFAULT_CONFIG: MemoryPressureConfig = {
  budgetMB: 512,
  pollIntervalMs: 10_000,
  warningThreshold: 0.80,
  criticalThreshold: 0.90,
  emergencyThreshold: 0.95,
};

export class MemoryPressureMonitor {
  private _config: MemoryPressureConfig;
  private _listeners: Set<PressureCallback> = new Set();
  private _timer: ReturnType<typeof setInterval> | null = null;
  private _lastLevel: PressureLevel = 'normal';
  private _history: MemorySnapshot[] = [];
  private _maxHistory = 30; // last 5 minutes at 10s interval

  constructor(config: Partial<MemoryPressureConfig> = {}) {
    this._config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Start polling memory usage */
  start(): void {
    if (this._timer) return;
    this._poll(); // immediate first check
    this._timer = setInterval(() => this._poll(), this._config.pollIntervalMs);
  }

  /** Stop polling */
  stop(): void {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  /** Subscribe to pressure level changes */
  onPressure(cb: PressureCallback): () => void {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }

  /** Get current snapshot */
  getSnapshot(): MemorySnapshot {
    return this._getMemoryUsage();
  }

  /** Get pressure level for a given usage ratio */
  getPressureLevel(usagePercent: number): PressureLevel {
    if (usagePercent >= this._config.emergencyThreshold) return 'emergency';
    if (usagePercent >= this._config.criticalThreshold) return 'critical';
    if (usagePercent >= this._config.warningThreshold) return 'warning';
    return 'normal';
  }

  /** Get recent memory snapshots */
  getHistory(): MemorySnapshot[] {
    return [...this._history];
  }

  /** Check whether the Performance Memory API is available */
  get isNativeMemoryAvailable(): boolean {
    return typeof performance !== 'undefined'
      && 'memory' in performance
      && typeof (performance as any).memory?.usedJSHeapSize === 'number';
  }

  // ─── Internal ────────────────────────────────────────

  private _getMemoryUsage(): MemorySnapshot {
    let usedMB = 0;
    let budgetMB = this._config.budgetMB;

    if (this.isNativeMemoryAvailable) {
      const mem = (performance as any).memory;
      usedMB = mem.usedJSHeapSize / (1024 * 1024);
      budgetMB = mem.jsHeapSizeLimit / (1024 * 1024);
    } else if (typeof process !== 'undefined' && process.memoryUsage) {
      // Node.js fallback (for tests)
      const mem = process.memoryUsage();
      usedMB = mem.heapUsed / (1024 * 1024);
      budgetMB = mem.heapTotal / (1024 * 1024);
    }

    return {
      usedMB: Math.round(usedMB * 10) / 10,
      budgetMB: Math.round(budgetMB * 10) / 10,
      usagePercent: budgetMB > 0 ? usedMB / budgetMB : 0,
      timestamp: Date.now(),
    };
  }

  private _poll(): void {
    const snapshot = this._getMemoryUsage();
    const level = this.getPressureLevel(snapshot.usagePercent);

    // Store history
    this._history.push(snapshot);
    if (this._history.length > this._maxHistory) {
      this._history.shift();
    }

    // Only notify on level change or if in danger zone
    if (level !== this._lastLevel || level !== 'normal') {
      if (level !== this._lastLevel) {
        const logFn = level === 'normal' ? 'info' : 'warn';
        (logger.engine as any)?.[logFn]?.(
          `[MemoryPressure] ${this._lastLevel} → ${level}: ${snapshot.usedMB}MB / ${snapshot.budgetMB}MB (${(snapshot.usagePercent * 100).toFixed(1)}%)`
        );
      }
      this._lastLevel = level;
      for (const cb of this._listeners) {
        try {
          cb(level, snapshot);
        } catch (err) {
          // Don't let a bad listener crash the monitor
        }
      }
    }
  }
}

// Singleton export
export const memoryMonitor = new MemoryPressureMonitor();
