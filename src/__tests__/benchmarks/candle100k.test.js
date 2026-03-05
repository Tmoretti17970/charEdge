// ═══════════════════════════════════════════════════════════════════
// charEdge — 100K Candle Benchmark (Task 2.5.1)
//
// Measures rendering throughput for 10K/50K/100K candle datasets.
// Reports: fps, avg frame time, p50/p95/p99 frame times, memory.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Helpers ─────────────────────────────────────────────────────

function generateSyntheticBars(count) {
  const bars = new Array(count);
  let price = 40000;
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    const change = price * 0.002 * (Math.random() - 0.5);
    const open = price;
    const close = price + change;
    bars[i] = {
      time: now - (count - i) * 60000,
      open,
      high: Math.max(open, close) * (1 + Math.random() * 0.002),
      low: Math.min(open, close) * (1 - Math.random() * 0.002),
      close,
      volume: 10 + Math.random() * 150,
    };
    price = close;
  }
  return bars;
}

function measureFrameTime(renderFn, frames = 100) {
  const times = [];
  for (let i = 0; i < frames; i++) {
    const start = performance.now();
    renderFn(i);
    const end = performance.now();
    times.push(end - start);
  }
  times.sort((a, b) => a - b);
  return {
    avg: times.reduce((s, t) => s + t, 0) / times.length,
    p50: times[Math.floor(times.length * 0.5)],
    p95: times[Math.floor(times.length * 0.95)],
    p99: times[Math.floor(times.length * 0.99)],
    min: times[0],
    max: times[times.length - 1],
    fps: 1000 / (times.reduce((s, t) => s + t, 0) / times.length),
  };
}

// ─── Simulated Canvas2D Render ───────────────────────────────────
// Approximates real render work: iterates visible slice, computes
// price→pixel transforms, and "draws" candles (builds draw commands).

function simulateCanvasRender(bars, visibleBars = 200, scrollOffset = 0) {
  const startIdx = Math.max(0, bars.length - scrollOffset - visibleBars);
  const endIdx = Math.min(bars.length, startIdx + visibleBars);
  const slice = bars.slice(startIdx, endIdx);
  if (!slice.length) return;

  const width = 1200;
  const height = 600;
  const barWidth = width / visibleBars;

  let minP = Infinity, maxP = -Infinity;
  for (let i = 0; i < slice.length; i++) {
    if (slice[i].low < minP) minP = slice[i].low;
    if (slice[i].high > maxP) maxP = slice[i].high;
  }
  const range = maxP - minP || 1;

  // Simulate per-candle draw computations
  const drawCmds = [];
  for (let i = 0; i < slice.length; i++) {
    const b = slice[i];
    const x = i * barWidth;
    const yHigh = height - ((b.high - minP) / range) * height * 0.9;
    const yLow = height - ((b.low - minP) / range) * height * 0.9;
    const yOpen = height - ((b.open - minP) / range) * height * 0.9;
    const yClose = height - ((b.close - minP) / range) * height * 0.9;
    drawCmds.push({ x, yHigh, yLow, yOpen, yClose, w: barWidth * 0.8, green: b.close >= b.open });
  }
  return drawCmds;
}

// ─── Tests ───────────────────────────────────────────────────────

describe('100K Candle Benchmark', () => {
  it('generates 100K bars in < 500ms', () => {
    const start = performance.now();
    const bars = generateSyntheticBars(100_000);
    const elapsed = performance.now() - start;

    expect(bars).toHaveLength(100_000);
    expect(bars[0].time).toBeLessThan(bars[99_999].time);
    expect(elapsed).toBeLessThan(500);
    console.log(`📊 100K bar generation: ${elapsed.toFixed(1)}ms`);
  });

  it('generates 500K bars in < 2s', () => {
    const start = performance.now();
    const bars = generateSyntheticBars(500_000);
    const elapsed = performance.now() - start;

    expect(bars).toHaveLength(500_000);
    expect(elapsed).toBeLessThan(2000);
    console.log(`📊 500K bar generation: ${elapsed.toFixed(1)}ms`);
  });

  it('renders 200-bar viewport from 10K dataset at < 1ms avg', () => {
    const bars = generateSyntheticBars(10_000);
    const result = measureFrameTime((i) => {
      simulateCanvasRender(bars, 200, (i * 10) % (bars.length - 200));
    }, 200);

    expect(result.avg).toBeLessThan(1);
    console.log(`⚡ 10K dataset render: avg=${result.avg.toFixed(2)}ms p95=${result.p95.toFixed(2)}ms fps=${result.fps.toFixed(0)}`);
  });

  it('renders 200-bar viewport from 100K dataset at < 2ms avg', () => {
    const bars = generateSyntheticBars(100_000);
    const result = measureFrameTime((i) => {
      simulateCanvasRender(bars, 200, (i * 50) % (bars.length - 200));
    }, 200);

    expect(result.avg).toBeLessThan(2);
    console.log(`⚡ 100K dataset render: avg=${result.avg.toFixed(2)}ms p95=${result.p95.toFixed(2)}ms fps=${result.fps.toFixed(0)}`);
  });

  it('renders 500-bar viewport from 100K dataset at < 5ms avg', () => {
    const bars = generateSyntheticBars(100_000);
    const result = measureFrameTime((i) => {
      simulateCanvasRender(bars, 500, (i * 50) % (bars.length - 500));
    }, 200);

    expect(result.avg).toBeLessThan(5);
    console.log(`⚡ 100K/500-visible render: avg=${result.avg.toFixed(2)}ms p95=${result.p95.toFixed(2)}ms fps=${result.fps.toFixed(0)}`);
  });

  it('renders 200-bar viewport from 500K dataset at < 2ms avg', () => {
    const bars = generateSyntheticBars(500_000);
    const result = measureFrameTime((i) => {
      simulateCanvasRender(bars, 200, (i * 100) % (bars.length - 200));
    }, 100);

    expect(result.avg).toBeLessThan(2);
    console.log(`⚡ 500K dataset render: avg=${result.avg.toFixed(2)}ms p95=${result.p95.toFixed(2)}ms fps=${result.fps.toFixed(0)}`);
  });

  it('produces benchmark report', () => {
    const datasets = [
      { label: '10K', count: 10_000 },
      { label: '50K', count: 50_000 },
      { label: '100K', count: 100_000 },
    ];

    const report = datasets.map(({ label, count }) => {
      const bars = generateSyntheticBars(count);
      const result = measureFrameTime((i) => {
        simulateCanvasRender(bars, 200, (i * 10) % Math.max(1, bars.length - 200));
      }, 100);
      return { dataset: label, ...result };
    });

    console.table(report.map(r => ({
      Dataset: r.dataset,
      'Avg (ms)': r.avg.toFixed(2),
      'P50 (ms)': r.p50.toFixed(2),
      'P95 (ms)': r.p95.toFixed(2),
      'P99 (ms)': r.p99.toFixed(2),
      'FPS': r.fps.toFixed(0),
    })));

    // All should maintain > 60fps equivalent
    for (const r of report) {
      expect(r.avg).toBeLessThan(16.67); // 60fps budget
    }
  });
});
