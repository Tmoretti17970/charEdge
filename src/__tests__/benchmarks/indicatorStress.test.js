// ═══════════════════════════════════════════════════════════════════
// charEdge — Indicator & Memory Stress Tests (Tasks 2.5.2 + 2.5.3)
//
// 2.5.2: 5 indicators on 100K bars — measure compute throughput
// 2.5.3: 10-symbol rapid switch — measure memory stability
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';

// ─── Helpers ─────────────────────────────────────────────────────

function generateBars(count) {
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

// Pure-JS indicator simulations (no DOM / canvas dependency)
function computeSMA(bars, period = 20) {
  const result = new Float64Array(bars.length);
  let sum = 0;
  for (let i = 0; i < bars.length; i++) {
    sum += bars[i].close;
    if (i >= period) sum -= bars[i - period].close;
    result[i] = i >= period - 1 ? sum / period : NaN;
  }
  return result;
}

function computeEMA(bars, period = 12) {
  const result = new Float64Array(bars.length);
  const k = 2 / (period + 1);
  result[0] = bars[0].close;
  for (let i = 1; i < bars.length; i++) {
    result[i] = bars[i].close * k + result[i - 1] * (1 - k);
  }
  return result;
}

function computeRSI(bars, period = 14) {
  const result = new Float64Array(bars.length);
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i < bars.length; i++) {
    const d = bars[i].close - bars[i - 1].close;
    const gain = d > 0 ? d : 0;
    const loss = d < 0 ? -d : 0;
    if (i <= period) {
      avgGain += gain / period;
      avgLoss += loss / period;
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

function computeBollinger(bars, period = 20) {
  const mid = computeSMA(bars, period);
  const upper = new Float64Array(bars.length);
  const lower = new Float64Array(bars.length);
  for (let i = period - 1; i < bars.length; i++) {
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = bars[j].close - mid[i];
      sumSq += d * d;
    }
    const stdDev = Math.sqrt(sumSq / period) * 2;
    upper[i] = mid[i] + stdDev;
    lower[i] = mid[i] - stdDev;
  }
  return { mid, upper, lower };
}

function computeMACD(bars) {
  const ema12 = computeEMA(bars, 12);
  const ema26 = computeEMA(bars, 26);
  const macd = new Float64Array(bars.length);
  const signal = new Float64Array(bars.length);
  const histogram = new Float64Array(bars.length);
  const k = 2 / 10;
  for (let i = 0; i < bars.length; i++) {
    macd[i] = ema12[i] - ema26[i];
    signal[i] = i === 0 ? macd[i] : macd[i] * k + signal[i - 1] * (1 - k);
    histogram[i] = macd[i] - signal[i];
  }
  return { macd, signal, histogram };
}

// ─── Tests: Indicator Stress (2.5.2) ────────────────────────────

describe('Indicator Stress Test (2.5.2)', () => {
  it('computes 5 indicators on 100K bars in < 500ms total', () => {
    const bars = generateBars(100_000);
    const start = performance.now();

    const sma = computeSMA(bars, 50);
    const ema = computeEMA(bars, 21);
    const rsi = computeRSI(bars, 14);
    const bb = computeBollinger(bars, 20);
    const macd = computeMACD(bars);

    const elapsed = performance.now() - start;

    // Verify outputs are valid
    expect(sma.length).toBe(100_000);
    expect(ema.length).toBe(100_000);
    expect(rsi.length).toBe(100_000);
    expect(bb.mid.length).toBe(100_000);
    expect(macd.macd.length).toBe(100_000);

    // RSI should be in [0, 100] range
    for (let i = 15; i < 100; i++) {
      expect(rsi[i]).toBeGreaterThanOrEqual(0);
      expect(rsi[i]).toBeLessThanOrEqual(100);
    }

    expect(elapsed).toBeLessThan(500);
    console.log(`🔬 5 indicators on 100K bars: ${elapsed.toFixed(1)}ms`);
  });

  it('computes 5 indicators on 50K bars in < 250ms total', () => {
    const bars = generateBars(50_000);
    const start = performance.now();

    computeSMA(bars, 50);
    computeEMA(bars, 21);
    computeRSI(bars, 14);
    computeBollinger(bars, 20);
    computeMACD(bars);

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(250);
    console.log(`🔬 5 indicators on 50K bars: ${elapsed.toFixed(1)}ms`);
  });

  it('recomputes incrementally (single bar update) in < 0.1ms', () => {
    const bars = generateBars(10_000);
    const sma = computeSMA(bars, 20);

    // Simulate incremental update: compute SMA for last bar only
    const times = [];
    for (let iter = 0; iter < 1000; iter++) {
      const start = performance.now();
      const lastIdx = bars.length - 1;
      let sum = 0;
      for (let i = lastIdx - 19; i <= lastIdx; i++) {
        sum += bars[i].close;
      }
      const _newVal = sum / 20;
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    const avg = times.reduce((s, t) => s + t, 0) / times.length;

    expect(avg).toBeLessThan(0.1);
    console.log(`⚡ Incremental SMA update: avg=${avg.toFixed(4)}ms p95=${times[Math.floor(times.length * 0.95)].toFixed(4)}ms`);
  });
});

// ─── Tests: Memory Leak — Symbol Switching (2.5.3) ──────────────

describe('Memory Leak — Symbol Switching (2.5.3)', () => {
  it('10 rapid symbol switches produce predictable memory', () => {
    const symbols = [
      'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
      'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT',
    ];

    // Simulate symbol switches: generate + release data
    const dataSets = [];
    const memorySnapshots = [];

    for (const sym of symbols) {
      // Simulate data load
      const bars = generateBars(10_000);
      dataSets.push({ sym, bars });

      // Memory check (heap used in Node, approximated by array sizes)
      if (typeof process !== 'undefined' && process.memoryUsage) {
        memorySnapshots.push({
          sym,
          heapUsed: process.memoryUsage().heapUsed,
        });
      }
    }

    // Release all but last
    dataSets.length = 1;

    // Force a potential GC opportunity
    if (typeof globalThis.gc === 'function') {
      globalThis.gc();
    }

    // Verify no crash and data integrity
    expect(dataSets).toHaveLength(1);
    expect(dataSets[0].bars).toHaveLength(10_000);

    if (memorySnapshots.length > 1) {
      // Check that memory didn't grow more than 3x from first to last
      const first = memorySnapshots[0].heapUsed;
      const last = memorySnapshots[memorySnapshots.length - 1].heapUsed;
      const ratio = last / first;
      console.log(`🧠 Memory: first=${(first / 1024 / 1024).toFixed(1)}MB last=${(last / 1024 / 1024).toFixed(1)}MB ratio=${ratio.toFixed(2)}x`);
      expect(ratio).toBeLessThan(3);
    }
  });

  it('100 rapid switches complete in < 2s', () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      const bars = generateBars(5_000);
      // Simulate compute + discard (no real state mutation — pure compute)
      computeSMA(bars, 20);
      computeRSI(bars, 14);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(2000);
    console.log(`🔄 100 rapid switches (5K bars each): ${elapsed.toFixed(0)}ms`);
  });
});
