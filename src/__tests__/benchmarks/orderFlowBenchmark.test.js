// ═══════════════════════════════════════════════════════════════════
// charEdge — OrderFlowEngine Benchmark Guard
//
// Ensures ingestTick throughput doesn't regress below target.
// Uses warm-up + p95 percentile to avoid CI flakiness.
//
// Strategy:
//   1. Warm up (3 iterations, discarded)
//   2. Sample (10 iterations of 10,000 ticks each)
//   3. Assert p95 throughput >= 100,000 ticks/second
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';

// ─── Helpers ────────────────────────────────────────────────────

function bench(fn, { warmup = 3, samples = 10 } = {}) {
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

/** Generate random ticks for benchmarking */
function makeTicks(count) {
    const ticks = [];
    const now = Date.now();
    const basePrice = 97000; // BTC-like price
    for (let i = 0; i < count; i++) {
        ticks.push({
            price: basePrice + (Math.random() - 0.5) * 200,
            volume: 0.001 + Math.random() * 2,
            time: now + i * 10, // 10ms apart (~100 t/s)
            side: Math.random() > 0.5 ? 'buy' : 'sell',
            source: 'bench',
        });
    }
    return ticks;
}

// ═══════════════════════════════════════════════════════════════════
// Benchmark: ingestTick throughput
// ═══════════════════════════════════════════════════════════════════

describe('Benchmark Guard: OrderFlowEngine.ingestTick', () => {
    let engine;

    beforeEach(async () => {
        // Import fresh engine — use the JS version (production runtime)
        const mod = await import('../../data/engine/orderflow/OrderFlowEngine');
        // Create a fresh engine instance to avoid cross-test pollution
        engine = new mod._OrderFlowEngine();
    });

    it('10,000 ticks ingest: throughput >= 100,000 ticks/sec (p95)', () => {
        const TICK_COUNT = 10_000;
        const ticks = makeTicks(TICK_COUNT);

        const stats = bench(() => {
            // Reset state between samples so map sizes don't grow unbounded
            engine.reset?.('BTCUSDT');
            for (let i = 0; i < TICK_COUNT; i++) {
                engine.ingestTick('BTCUSDT', ticks[i]);
            }
        });

        const throughputP95 = Math.round(TICK_COUNT / (stats.p95 / 1000));
        const throughputMean = Math.round(TICK_COUNT / (stats.mean / 1000));

        // Log for CI visibility
        console.log(`  ingestTick throughput:  p95=${throughputP95.toLocaleString()} t/s  mean=${throughputMean.toLocaleString()} t/s`);
        console.log(`  Timings (ms): p95=${stats.p95.toFixed(2)}  mean=${stats.mean.toFixed(2)}  min=${stats.min.toFixed(2)}  max=${stats.max.toFixed(2)}`);

        // 100k ticks/sec => 10,000 ticks should take < 100ms
        // With 2x CI headroom: 200ms
        expect(stats.p95).toBeLessThan(200);
    });

    it('sustained ingestion: 50,000 ticks without degradation', () => {
        const TICK_COUNT = 50_000;
        const ticks = makeTicks(TICK_COUNT);

        // Ingest first half
        const startFirst = performance.now();
        for (let i = 0; i < TICK_COUNT / 2; i++) {
            engine.ingestTick('BTCUSDT', ticks[i]);
        }
        const firstHalf = performance.now() - startFirst;

        // Ingest second half (with accumulated state)
        const startSecond = performance.now();
        for (let i = TICK_COUNT / 2; i < TICK_COUNT; i++) {
            engine.ingestTick('BTCUSDT', ticks[i]);
        }
        const secondHalf = performance.now() - startSecond;

        console.log(`  First 25k: ${firstHalf.toFixed(2)}ms  Second 25k: ${secondHalf.toFixed(2)}ms  Ratio: ${(secondHalf / firstHalf).toFixed(2)}x`);

        // Second half should not be more than 3x slower than first half
        // (some slowdown is expected due to larger maps, but it shouldn't be dramatic)
        expect(secondHalf / firstHalf).toBeLessThan(3);
    });
});
