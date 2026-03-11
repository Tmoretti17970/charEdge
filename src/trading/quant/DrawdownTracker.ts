// ═══════════════════════════════════════════════════════════════════
// charEdge — Max Drawdown Tracker (4.4.4)
//
// Running max-drawdown calculator with configurable alert thresholds.
// Tracks peak equity, current drawdown, and max historical drawdown.
// ═══════════════════════════════════════════════════════════════════

export interface DrawdownState {
  /** Current equity value */
  equity: number;
  /** Peak equity (high water mark) */
  peak: number;
  /** Current drawdown as fraction (0-1) */
  currentDrawdown: number;
  /** Current drawdown in absolute terms */
  currentDrawdownAbs: number;
  /** Maximum historical drawdown as fraction */
  maxDrawdown: number;
  /** Maximum historical drawdown in absolute terms */
  maxDrawdownAbs: number;
  /** Timestamp of max drawdown trough */
  maxDrawdownTimestamp: number;
  /** Whether any alert threshold is breached */
  isAlert: boolean;
  /** Which alert level is active */
  alertLevel: 'none' | 'caution' | 'warning' | 'critical';
  /** Recovery progress from max drawdown (0-1) */
  recoveryProgress: number;
}

export interface DrawdownThresholds {
  caution: number;  // e.g. 0.05 = 5%
  warning: number;  // e.g. 0.10 = 10%
  critical: number; // e.g. 0.20 = 20%
}

const DEFAULT_THRESHOLDS: DrawdownThresholds = {
  caution: 0.05,
  warning: 0.10,
  critical: 0.20,
};

export class DrawdownTracker {
  private peak: number;
  private maxDD: number;
  private maxDDAbs: number;
  private maxDDTimestamp: number;
  private troughEquity: number;
  private thresholds: DrawdownThresholds;
  private listeners: Array<(state: DrawdownState) => void> = [];

  constructor(
    initialEquity: number = 0,
    thresholds: DrawdownThresholds = DEFAULT_THRESHOLDS,
  ) {
    this.peak = initialEquity;
    this.maxDD = 0;
    this.maxDDAbs = 0;
    this.maxDDTimestamp = 0;
    this.troughEquity = initialEquity;
    this.thresholds = thresholds;
  }

  /**
   * Update with new equity value (e.g., after each trade or tick).
   */
  update(equity: number, timestamp: number = Date.now()): DrawdownState {
    // Update peak (high water mark)
    if (equity > this.peak) {
      this.peak = equity;
    }

    // Compute current drawdown
    const currentDrawdownAbs = this.peak - equity;
    const currentDrawdown = this.peak > 0 ? currentDrawdownAbs / this.peak : 0;

    // Update max drawdown
    if (currentDrawdown > this.maxDD) {
      this.maxDD = currentDrawdown;
      this.maxDDAbs = currentDrawdownAbs;
      this.maxDDTimestamp = timestamp;
      this.troughEquity = equity;
    }

    // Recovery progress
    const recoveryProgress = this.maxDD > 0 && equity > this.troughEquity
      ? Math.min(1, (equity - this.troughEquity) / this.maxDDAbs)
      : 0;

    // Alert level
    const alertLevel = this.getAlertLevel(currentDrawdown);

    const state: DrawdownState = {
      equity,
      peak: this.peak,
      currentDrawdown,
      currentDrawdownAbs,
      maxDrawdown: this.maxDD,
      maxDrawdownAbs: this.maxDDAbs,
      maxDrawdownTimestamp: this.maxDDTimestamp,
      isAlert: alertLevel !== 'none',
      alertLevel,
      recoveryProgress,
    };

    // Notify listeners
    this.listeners.forEach((fn) => fn(state));
    return state;
  }

  private getAlertLevel(drawdown: number): DrawdownState['alertLevel'] {
    if (drawdown >= this.thresholds.critical) return 'critical';
    if (drawdown >= this.thresholds.warning) return 'warning';
    if (drawdown >= this.thresholds.caution) return 'caution';
    return 'none';
  }

  /**
   * Subscribe to drawdown state changes.
   */
  onUpdate(listener: (state: DrawdownState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Reset tracker (e.g., new trading period).
   */
  reset(initialEquity: number = 0): void {
    this.peak = initialEquity;
    this.maxDD = 0;
    this.maxDDAbs = 0;
    this.maxDDTimestamp = 0;
    this.troughEquity = initialEquity;
  }

  /**
   * Update alert thresholds.
   */
  setThresholds(thresholds: Partial<DrawdownThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Compute drawdown from an equity curve array.
   */
  static fromEquityCurve(
    curve: Array<{ equity: number; timestamp: number }>,
    thresholds?: DrawdownThresholds,
  ): DrawdownState {
    const tracker = new DrawdownTracker(
      curve[0]?.equity || 0,
      thresholds,
    );
    let lastState: DrawdownState | null = null;
    for (const point of curve) {
      lastState = tracker.update(point.equity, point.timestamp);
    }
    return lastState || tracker.update(0);
  }
}

export default DrawdownTracker;
