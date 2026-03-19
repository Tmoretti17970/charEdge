// ═══════════════════════════════════════════════════════════════════
// charEdge — Error Budget Monitor (Sprint 4, Task 4.4)
//
// Rolling-window error rate tracker per subsystem with configurable
// thresholds. When a budget is breached, dispatches a custom event
// that the ErrorBudgetBanner listens for.
//
// Usage:
//   import { errorBudget } from './ErrorBudget';
//   errorBudget.record('fetch');
//   errorBudget.getStatus(); // { fetch: { errors, total, rate, threshold, breached } }
// ═══════════════════════════════════════════════════════════════════

import { logger } from './logger';

// ─── Types ───────────────────────────────────────────────────────

interface CategoryConfig {
  /** Max acceptable error rate (0..1), e.g. 0.01 = 1% */
  threshold: number;
  /** Friendly label for the category */
  label: string;
}

interface RollingWindow {
  /** Circular buffer of timestamps of successes and failures */
  events: Array<{ ts: number; isError: boolean }>;
  /** Last time the budget was checked as breached */
  lastBreached: number;
}

export interface BudgetStatus {
  errors: number;
  total: number;
  rate: number;
  threshold: number;
  breached: boolean;
  label: string;
}

// ─── Config ──────────────────────────────────────────────────────

const CATEGORIES: Record<string, CategoryConfig> = {
  fetch: { threshold: 0.01, label: 'Data Fetch' },    // <1% failure
  ws:    { threshold: 0.001, label: 'WebSocket' },     // <0.1% disconnects
  cache: { threshold: 0.0001, label: 'Cache' },        // <0.01% corruption
  ai:    { threshold: 0.05, label: 'AI Copilot' },     // <5% failures
};

const WINDOW_MS = 5 * 60_000; // 5-minute rolling window
const MAX_EVENTS = 500;       // Max events per category in window
const BREACH_DEBOUNCE_MS = 30_000; // Only fire breach event every 30s

// ─── Error Budget Class ─────────────────────────────────────────

class _ErrorBudget {
  private _windows: Map<string, RollingWindow> = new Map();
  private _lastGlobalBreach = 0;

  /**
   * Record a success (isError=false) or failure (isError=true) for a subsystem.
   */
  record(category: string, isError = true): void {
    const key = category.toLowerCase();
    if (!CATEGORIES[key]) return; // Unknown category — ignore

    let win = this._windows.get(key);
    if (!win) {
      win = { events: [], lastBreached: 0 };
      this._windows.set(key, win);
    }

    win.events.push({ ts: Date.now(), isError });

    // Trim to max size
    if (win.events.length > MAX_EVENTS) {
      win.events = win.events.slice(-MAX_EVENTS);
    }

    // Check breach after recording errors
    if (isError) {
      this._checkBreach(key, win);
    }
  }

  /**
   * Record a success for a subsystem (convenience wrapper).
   */
  recordSuccess(category: string): void {
    this.record(category, false);
  }

  /**
   * Get budget status for all categories.
   */
  getStatus(): Record<string, BudgetStatus> {
    const now = Date.now();
    const result: Record<string, BudgetStatus> = {};

    for (const [key, config] of Object.entries(CATEGORIES)) {
      const win = this._windows.get(key);
      if (!win || win.events.length === 0) {
        result[key] = {
          errors: 0,
          total: 0,
          rate: 0,
          threshold: config.threshold,
          breached: false,
          label: config.label,
        };
        continue;
      }

      // Filter to rolling window
      const cutoff = now - WINDOW_MS;
      const recent = win.events.filter(e => e.ts > cutoff);
      const errors = recent.filter(e => e.isError).length;
      const total = recent.length;
      const rate = total > 0 ? errors / total : 0;

      result[key] = {
        errors,
        total,
        rate,
        threshold: config.threshold,
        breached: rate > config.threshold && total >= 5, // Need at least 5 events
        label: config.label,
      };
    }

    return result;
  }

  /**
   * Check if any budget is currently breached.
   */
  isBreached(): boolean {
    const status = this.getStatus();
    return Object.values(status).some(s => s.breached);
  }

  /**
   * Get breached categories.
   */
  getBreachedCategories(): string[] {
    const status = this.getStatus();
    return Object.entries(status)
      .filter(([, s]) => s.breached)
      .map(([key]) => CATEGORIES[key]?.label || key);
  }

  /**
   * Reset all windows.
   */
  reset(): void {
    this._windows.clear();
    this._lastGlobalBreach = 0;
  }

  // ─── Internal ──────────────────────────────────────────────

  private _checkBreach(key: string, win: RollingWindow): void {
    const now = Date.now();
    const config = CATEGORIES[key];
    if (!config) return;

    // Debounce breach events
    if (now - win.lastBreached < BREACH_DEBOUNCE_MS) return;

    const cutoff = now - WINDOW_MS;
    const recent = win.events.filter(e => e.ts > cutoff);
    if (recent.length < 5) return; // Need minimum sample size

    const errors = recent.filter(e => e.isError).length;
    const rate = errors / recent.length;

    if (rate > config.threshold) {
      win.lastBreached = now;

      logger.data.warn(
        `[ErrorBudget] ${config.label} budget breached: ${(rate * 100).toFixed(2)}% > ${(config.threshold * 100).toFixed(2)}% (${errors}/${recent.length} events)`
      );

      // Dispatch custom event for the banner UI (debounced globally)
      if (typeof window !== 'undefined' && now - this._lastGlobalBreach > BREACH_DEBOUNCE_MS) {
        this._lastGlobalBreach = now;
        window.dispatchEvent(
          new CustomEvent('charEdge:error-budget-breached', {
            detail: {
              category: key,
              label: config.label,
              rate,
              threshold: config.threshold,
              breachedCategories: this.getBreachedCategories(),
            },
          })
        );
      }
    }
  }
}

export const errorBudget = new _ErrorBudget();

// Expose on window for dev-mode console access
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__charEdge_errorBudget = errorBudget;
}

export default errorBudget;
