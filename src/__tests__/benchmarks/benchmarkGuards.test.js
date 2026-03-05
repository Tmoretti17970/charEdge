// ═══════════════════════════════════════════════════════════════════
// charEdge — Benchmark Guards (Task 4.3.3)
//
// Statistical benchmark assertions that replace exact timing checks.
// Uses warm-up iterations + p95 percentile to avoid CI flakiness.
//
// Strategy:
//   1. Warm up (3 iterations, discarded)
//   2. Sample (10 iterations)
//   3. Assert p95 < maxMs with 2x headroom for CI
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeAll } from 'vitest';

// ─── Statistical Helper ─────────────────────────────────────────

/**
 * Run a function multiple times and return timing statistics.
 * @param {Function} fn - sync function to benchmark
 * @param {object} opts
 * @param {number} opts.warmup - warm-up iterations (default: 3)
 * @param {number} opts.samples - measurement iterations (default: 10)
 * @returns {{ mean: number, p50: number, p95: number, min: number, max: number, samples: number[] }}
 */
function bench(fn, { warmup = 3, samples = 10 } = {}) {
    // Warm-up: discard
    for (let i = 0; i < warmup; i++) fn();

    const timings = [];
    for (let i = 0; i < samples; i++) {
        const start = performance.now();
        fn();
        timings.push(performance.now() - start);
    }

    timings.sort((a, b) => a - b);
    const mean = timings.reduce((s, t) => s + t, 0) / timings.length;
    const p50 = timings[Math.floor(timings.length * 0.5)];
    const p95 = timings[Math.floor(timings.length * 0.95)];

    return { mean, p50, p95, min: timings[0], max: timings[timings.length - 1], samples: timings };
}

/**
 * Same as bench() but for async functions.
 */
async function benchAsync(fn, { warmup = 3, samples = 10 } = {}) {
    for (let i = 0; i < warmup; i++) await fn();

    const timings = [];
    for (let i = 0; i < samples; i++) {
        const start = performance.now();
        await fn();
        timings.push(performance.now() - start);
    }

    timings.sort((a, b) => a - b);
    const mean = timings.reduce((s, t) => s + t, 0) / timings.length;
    const p50 = timings[Math.floor(timings.length * 0.5)];
    const p95 = timings[Math.floor(timings.length * 0.95)];

    return { mean, p50, p95, min: timings[0], max: timings[timings.length - 1], samples: timings };
}

// ─── Data Generators ────────────────────────────────────────────

function makeBars(count) {
    const bars = [];
    const now = Date.now();
    for (let i = 0; i < count; i++) {
        const open = 100 + Math.sin(i * 0.1) * 20;
        bars.push({
            t: now - (count - i) * 60000,
            o: open,
            h: open + Math.random() * 5,
            l: open - Math.random() * 5,
            c: open + (Math.random() - 0.5) * 4,
            v: Math.floor(Math.random() * 10000),
        });
    }
    return bars;
}

// ═══════════════════════════════════════════════════════════════════
// Benchmark: CacheManager
// ═══════════════════════════════════════════════════════════════════

describe('Benchmark Guard: CacheManager', () => {
    let cm;

    beforeAll(async () => {
        const mod = await import('../../data/engine/infra/CacheManager.js');
        cm = new mod._CacheManager();
    });

    it('write 1000 bars: p95 < 10ms', () => {
        const bars = makeBars(1000);
        const stats = bench(() => cm.write('BTC', '1m', bars, 'bench'));
        expect(stats.p95).toBeLessThan(10);
    });

    it('read after write: p95 < 5ms', async () => {
        cm.write('ETH', '1h', makeBars(1000), 'bench');
        const stats = await benchAsync(() => cm.read('ETH', '1h', 60000));
        expect(stats.p95).toBeLessThan(5);
    });

    it('hasFresh check (100 calls): p95 < 3ms', () => {
        cm.write('BTC', '5m', makeBars(100), 'bench');
        const stats = bench(() => {
            for (let i = 0; i < 100; i++) cm.hasFresh('BTC', '5m', 60000);
        });
        expect(stats.p95).toBeLessThan(3);
    });
});

// ═══════════════════════════════════════════════════════════════════
// Benchmark: buildCacheKey
// ═══════════════════════════════════════════════════════════════════

describe('Benchmark Guard: buildCacheKey', () => {
    it('10,000 key builds: p95 < 10ms', async () => {
        const { buildCacheKey } = await import('../../constants.js');
        const stats = bench(() => {
            for (let i = 0; i < 10000; i++) {
                buildCacheKey('BTC', '1m', Date.now() - i * 60000);
            }
        });
        expect(stats.p95).toBeLessThan(10);
    });
});

// ═══════════════════════════════════════════════════════════════════
// Benchmark: DataValidator
// ═══════════════════════════════════════════════════════════════════

describe('Benchmark Guard: DataValidator', () => {
    it('validate+dedupe 5000 bars: p95 < 100ms', async () => {
        const { deduplicateCandles } = await import('../../data/engine/infra/DataValidator.js');
        // Create bars with `time` field (DataValidator format)
        const bars = [];
        const now = Date.now();
        for (let i = 0; i < 5000; i++) {
            bars.push({ time: new Date(now - (5000 - i) * 60000).toISOString(), open: 100, high: 105, low: 95, close: 102, volume: 1000 });
        }
        const withDupes = [...bars, ...bars.slice(0, 500)]; // 10% duplicates

        const stats = bench(() => {
            deduplicateCandles(withDupes);
        });
        expect(stats.p95).toBeLessThan(100);
    });
});

// ═══════════════════════════════════════════════════════════════════
// Benchmark: SWR Decision
// ═══════════════════════════════════════════════════════════════════

describe('Benchmark Guard: SWR decision', () => {
    it('10,000 staleWhileRevalidate decisions: p95 < 20ms', async () => {
        const { staleWhileRevalidate } = await import('../../data/engine/swr.js');
        const cached = { data: makeBars(100), source: 'test', tier: 'memory' };
        const revalidateFn = () => Promise.resolve(cached.data);

        const stats = bench(() => {
            for (let i = 0; i < 10000; i++) {
                staleWhileRevalidate(cached, revalidateFn);
            }
        });
        expect(stats.p95).toBeLessThan(20);
    });
});
