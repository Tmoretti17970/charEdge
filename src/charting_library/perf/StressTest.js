// ═══════════════════════════════════════════════════════════════════
// charEdge — StressTest
//
// Automated rendering stress tests. Generates synthetic OHLCV data
// at various bar counts and measures rendering performance metrics.
//
// Usage:
//   const st = new StressTest();
//   const data = StressTest.generateBars(10000);
//   const result = st.measure(data, simulateFn, { durationMs: 2000 });
//   console.log(StressTest.generateReport([result]));
// ═══════════════════════════════════════════════════════════════════

/**
 * Automated rendering stress test framework.
 * Generates synthetic bar data and measures rendering performance.
 */
export class StressTest {
  constructor() {
    /** @type {StressResult[]} */
    this._results = [];
  }

  // ─── Synthetic Data Generation ────────────────────────────

  /**
   * Generate synthetic OHLCV bar data.
   *
   * @param {number} count - Number of bars to generate
   * @param {Object} [opts]
   * @param {number} [opts.startPrice=100] - Starting price
   * @param {number} [opts.volatility=0.02] - Per-bar volatility
   * @param {number} [opts.baseVolume=1000] - Base volume
   * @param {number} [opts.startTime] - Start timestamp (ms)
   * @param {number} [opts.intervalMs=60000] - Bar interval (ms)
   * @returns {Array<{time: number, open: number, high: number, low: number, close: number, volume: number}>}
   */
  static generateBars(count, opts = {}) {
    if (count <= 0) return [];

    const startPrice = opts.startPrice ?? 100;
    const volatility = opts.volatility ?? 0.02;
    const baseVolume = opts.baseVolume ?? 1000;
    const startTime = opts.startTime ?? Date.now() - count * (opts.intervalMs ?? 60000);
    const intervalMs = opts.intervalMs ?? 60000;

    const bars = new Array(count);
    let price = startPrice;

    // Simple seeded pseudo-random for reproducibility
    let seed = 42;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    for (let i = 0; i < count; i++) {
      const change = (rand() - 0.5) * 2 * volatility * price;
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + rand() * volatility * price * 0.5;
      const low = Math.min(open, close) - rand() * volatility * price * 0.5;
      const volume = baseVolume * (0.5 + rand() * 1.5);

      bars[i] = {
        time: startTime + i * intervalMs,
        open: Math.round(open * 100) / 100,
        high: Math.round(high * 100) / 100,
        low: Math.round(low * 100) / 100,
        close: Math.round(close * 100) / 100,
        volume: Math.round(volume),
      };

      price = close;
    }

    return bars;
  }

  // ─── Measurement ──────────────────────────────────────────

  /**
   * Measure rendering performance with given data.
   *
   * @param {Array} bars - OHLCV bar data
   * @param {Function} renderFn - Function to simulate a render frame: (bars, viewport) => void
   * @param {Object} [opts]
   * @param {number} [opts.durationMs=2000] - How long to run the scroll/zoom tests
   * @param {number} [opts.viewportBars=200] - Visible bars per viewport
   * @returns {StressResult}
   */
  measure(bars, renderFn, opts = {}) {
    const durationMs = opts.durationMs ?? 2000;
    const viewportBars = opts.viewportBars ?? 200;

    // 1. Time to first paint
    const t0 = performance.now();
    const viewport = { startIdx: 0, endIdx: Math.min(viewportBars, bars.length) };
    renderFn(bars, viewport);
    const ttfp = Math.round((performance.now() - t0) * 100) / 100;

    // 2. Scroll FPS — slide viewport across data
    const scrollResult = this._measureFps(bars, renderFn, viewportBars, durationMs, 'scroll');

    // 3. Zoom FPS — vary viewport size
    const zoomResult = this._measureFps(bars, renderFn, viewportBars, durationMs, 'zoom');

    // 4. Indicator compute latency (simple moving average simulation)
    const computeMs = this._measureCompute(bars);

    const result = {
      barCount: bars.length,
      ttfpMs: ttfp,
      scrollFps: scrollResult.fps,
      scrollFrameMs: scrollResult.avgFrameMs,
      zoomFps: zoomResult.fps,
      zoomFrameMs: zoomResult.avgFrameMs,
      computeMs,
      timestamp: Date.now(),
    };

    this._results.push(result);
    return result;
  }

  /**
   * Measure FPS for a given interaction type.
   * @private
   */
  _measureFps(bars, renderFn, viewportBars, durationMs, mode) {
    const frameTimes = [];
    const maxStart = Math.max(0, bars.length - viewportBars);
    let offset = 0;

    const deadline = performance.now() + durationMs;
    while (performance.now() < deadline) {
      const t0 = performance.now();

      let viewport;
      if (mode === 'scroll') {
        // Scroll through data
        const startIdx = Math.min(offset % (maxStart + 1), maxStart);
        viewport = { startIdx, endIdx: startIdx + viewportBars };
        offset += 5; // scroll speed
      } else {
        // Zoom: vary viewport size
        const zoomFactor = 0.5 + Math.abs(Math.sin(offset * 0.05)) * 1.5;
        const visibleBars = Math.max(20, Math.round(viewportBars * zoomFactor));
        viewport = { startIdx: 0, endIdx: Math.min(visibleBars, bars.length) };
        offset++;
      }

      renderFn(bars, viewport);
      frameTimes.push(performance.now() - t0);
    }

    if (frameTimes.length === 0) {
      return { fps: 0, avgFrameMs: 0 };
    }

    const avgFrameMs = frameTimes.reduce((s, t) => s + t, 0) / frameTimes.length;
    const fps = avgFrameMs > 0 ? Math.round(1000 / avgFrameMs) : 0;

    return {
      fps,
      avgFrameMs: Math.round(avgFrameMs * 100) / 100,
    };
  }

  /**
   * Measure indicator compute latency (simple SMA).
   * @private
   */
  _measureCompute(bars) {
    const period = 20;
    if (bars.length < period) return 0;

    const t0 = performance.now();
    const sma = new Array(bars.length);
    for (let i = 0; i < bars.length; i++) {
      if (i < period - 1) {
        sma[i] = null;
        continue;
      }
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += bars[j].close;
      }
      sma[i] = sum / period;
    }
    return Math.round((performance.now() - t0) * 100) / 100;
  }

  // ─── Reporting ────────────────────────────────────────────

  /**
   * Generate a comparison report from multiple results.
   *
   * @param {StressResult[]} [results] - Results to include (defaults to all)
   * @returns {Object}
   */
  static generateReport(results) {
    if (!results || results.length === 0) {
      return { generated: new Date().toISOString(), results: [], summary: null };
    }

    const sorted = [...results].sort((a, b) => a.barCount - b.barCount);

    return {
      generated: new Date().toISOString(),
      results: sorted.map(r => ({
        barCount: r.barCount,
        ttfpMs: r.ttfpMs,
        scrollFps: r.scrollFps,
        scrollFrameMs: r.scrollFrameMs,
        zoomFps: r.zoomFps,
        zoomFrameMs: r.zoomFrameMs,
        computeMs: r.computeMs,
      })),
      summary: {
        fastest: sorted[0].barCount,
        slowest: sorted[sorted.length - 1].barCount,
        avgTtfp: Math.round(
          sorted.reduce((s, r) => s + r.ttfpMs, 0) / sorted.length * 100
        ) / 100,
        avgScrollFps: Math.round(
          sorted.reduce((s, r) => s + r.scrollFps, 0) / sorted.length
        ),
      },
    };
  }

  /**
   * Get all accumulated results.
   * @returns {StressResult[]}
   */
  getResults() {
    return [...this._results];
  }

  /**
   * Clear all results.
   */
  reset() {
    this._results = [];
  }

  // ─── Phase 3.1.1: Automated Full Benchmark Suite ──────────

  /**
   * Performance gates — frame time thresholds for each tier.
   * A tier passes if its average scroll frame time is under the gate.
   */
  static PERFORMANCE_GATES = {
    1000:   { maxFrameMs: 5,  label: '1K bars'   },
    10000:  { maxFrameMs: 8,  label: '10K bars'  },
    100000: { maxFrameMs: 12, label: '100K bars' },
  };

  /**
   * Run the full 3-tier benchmark (1K → 10K → 100K bars).
   *
   * @param {Function} renderFn - `(bars, viewport) => void` render simulation
   * @param {Object} [opts]
   * @param {number} [opts.durationMs=1500] - Duration per tier measurement
   * @param {number} [opts.viewportBars=200] - Visible bars per viewport
   * @param {number[]} [opts.tiers] - Bar counts to test (default: [1000, 10000, 100000])
   * @returns {{ report: Object, passed: boolean, results: StressResult[] }}
   */
  static runFullBenchmark(renderFn, opts = {}) {
    const tiers = opts.tiers ?? [1000, 10000, 100000];
    const durationMs = opts.durationMs ?? 1500;
    const viewportBars = opts.viewportBars ?? 200;
    const gates = StressTest.PERFORMANCE_GATES;

    const st = new StressTest();
    const tierResults = [];

    for (const barCount of tiers) {
      const bars = StressTest.generateBars(barCount);
      const result = st.measure(bars, renderFn, { durationMs, viewportBars });

      const gate = gates[barCount];
      const gateResult = gate
        ? { passed: result.scrollFrameMs <= gate.maxFrameMs, maxFrameMs: gate.maxFrameMs, label: gate.label }
        : { passed: true, maxFrameMs: Infinity, label: `${barCount} bars` };

      tierResults.push({
        ...result,
        gate: gateResult,
      });
    }

    const allPassed = tierResults.every(r => r.gate.passed);
    const report = StressTest.generateReport(tierResults);

    return {
      passed: allPassed,
      report: {
        ...report,
        gates: tierResults.map(r => ({
          barCount: r.barCount,
          label: r.gate.label,
          scrollFrameMs: r.scrollFrameMs,
          maxFrameMs: r.gate.maxFrameMs,
          passed: r.gate.passed,
          verdict: r.gate.passed ? '✅ PASS' : '❌ FAIL',
        })),
        verdict: allPassed ? '✅ ALL GATES PASSED' : '❌ SOME GATES FAILED',
      },
      results: tierResults,
    };
  }
}
