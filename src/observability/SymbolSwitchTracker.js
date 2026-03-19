// ═══════════════════════════════════════════════════════════════════
// charEdge — Symbol Switch Latency Tracker (Sprint 4, Task 4.3)
//
// Maintains a ring buffer of recent symbol-switch latencies and
// computes P50/P95 percentiles on demand.
//
// Usage:
//   import { symbolSwitchTracker } from './SymbolSwitchTracker';
//   symbolSwitchTracker.record(180, { symbol: 'AAPL', source: 'cache:memory' });
//   symbolSwitchTracker.getPercentiles(); // { p50: 120, p95: 800, avg: 250, count: 42 }
// ═══════════════════════════════════════════════════════════════════

class _SymbolSwitchTracker {
  constructor(maxSamples = 100) {
    this._maxSamples = maxSamples;
    /** @type {Array<{ durationMs: number, symbol: string, source: string, ts: number }>} */
    this._samples = [];
  }

  /**
   * Record a symbol switch latency measurement.
   * @param {number} durationMs
   * @param {{ symbol?: string, source?: string }} [meta]
   */
  record(durationMs, meta = {}) {
    this._samples.push({
      durationMs,
      symbol: meta.symbol || '',
      source: meta.source || '',
      ts: Date.now(),
    });

    // Ring buffer: drop oldest when at capacity
    if (this._samples.length > this._maxSamples) {
      this._samples.shift();
    }
  }

  /**
   * Compute P50/P95 percentiles from recorded samples.
   * @returns {{ p50: number, p95: number, avg: number, count: number, samples: Array }}
   */
  getPercentiles() {
    const n = this._samples.length;
    if (n === 0) return { p50: 0, p95: 0, avg: 0, count: 0, samples: [] };

    const sorted = this._samples.map(s => s.durationMs).sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      p50: sorted[Math.floor(n * 0.5)] || 0,
      p95: sorted[Math.floor(n * 0.95)] || 0,
      avg: Math.round(sum / n),
      count: n,
      samples: this._samples.slice(-10), // last 10 for display
    };
  }

  /** Reset all recorded samples. */
  reset() {
    this._samples = [];
  }
}

export const symbolSwitchTracker = new _SymbolSwitchTracker();

// Expose on window for dev-mode console inspection
if (typeof window !== 'undefined') {
  window.__charEdge_switchLatency = symbolSwitchTracker;
}

export default symbolSwitchTracker;
