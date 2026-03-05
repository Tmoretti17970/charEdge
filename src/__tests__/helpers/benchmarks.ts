// ═══════════════════════════════════════════════════════════════════
// charEdge — Performance Benchmark Harness
//
// Lightweight benchmark utility for CI-safe performance assertions.
// Uses P95 percentile to avoid flaky results in CI.
//
// Usage:
//   import { benchmark } from './benchmarks.ts';
//   benchmark('chart render', () => renderChart(), { maxP95Ms: 16 });
// ═══════════════════════════════════════════════════════════════════

export interface BenchmarkOptions {
    /** Number of iterations to run (default: 100) */
    iterations?: number;
    /** Maximum P95 latency in milliseconds — fails assertion if exceeded */
    maxP95Ms: number;
    /** Number of warmup iterations (default: 5) */
    warmup?: number;
}

export interface BenchmarkResult {
    name: string;
    iterations: number;
    minMs: number;
    maxMs: number;
    meanMs: number;
    medianMs: number;
    p95Ms: number;
    p99Ms: number;
    passed: boolean;
}

/**
 * Run a function N times and return performance statistics.
 */
export function benchmark(
    name: string,
    fn: () => void | Promise<void>,
    options: BenchmarkOptions
): BenchmarkResult {
    const { iterations = 100, maxP95Ms, warmup = 5 } = options;
    const times: number[] = [];

    // Warmup (sync only to avoid complexity)
    for (let i = 0; i < warmup; i++) {
        fn();
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        fn();
        times.push(performance.now() - start);
    }

    // Sort for percentile calculation
    times.sort((a, b) => a - b);

    const minMs = times[0]!;
    const maxMs = times[times.length - 1]!;
    const meanMs = times.reduce((s, t) => s + t, 0) / times.length;
    const medianMs = times[Math.floor(times.length / 2)]!;
    const p95Ms = times[Math.floor(times.length * 0.95)]!;
    const p99Ms = times[Math.floor(times.length * 0.99)]!;
    const passed = p95Ms <= maxP95Ms;

    return {
        name,
        iterations,
        minMs: +minMs.toFixed(3),
        maxMs: +maxMs.toFixed(3),
        meanMs: +meanMs.toFixed(3),
        medianMs: +medianMs.toFixed(3),
        p95Ms: +p95Ms.toFixed(3),
        p99Ms: +p99Ms.toFixed(3),
        passed,
    };
}

/**
 * Run an async function N times and return performance statistics.
 */
export async function benchmarkAsync(
    name: string,
    fn: () => Promise<void>,
    options: BenchmarkOptions
): Promise<BenchmarkResult> {
    const { iterations = 50, maxP95Ms, warmup = 3 } = options;
    const times: number[] = [];

    // Warmup
    for (let i = 0; i < warmup; i++) {
        await fn();
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await fn();
        times.push(performance.now() - start);
    }

    times.sort((a, b) => a - b);

    const minMs = times[0]!;
    const maxMs = times[times.length - 1]!;
    const meanMs = times.reduce((s, t) => s + t, 0) / times.length;
    const medianMs = times[Math.floor(times.length / 2)]!;
    const p95Ms = times[Math.floor(times.length * 0.95)]!;
    const p99Ms = times[Math.floor(times.length * 0.99)]!;
    const passed = p95Ms <= maxP95Ms;

    return {
        name,
        iterations,
        minMs: +minMs.toFixed(3),
        maxMs: +maxMs.toFixed(3),
        meanMs: +meanMs.toFixed(3),
        medianMs: +medianMs.toFixed(3),
        p95Ms: +p95Ms.toFixed(3),
        p99Ms: +p99Ms.toFixed(3),
        passed,
    };
}

/**
 * Format a benchmark result for console output.
 */
export function formatResult(result: BenchmarkResult): string {
    const status = result.passed ? '✅' : '❌';
    return [
        `${status} ${result.name}`,
        `   Iterations: ${result.iterations}`,
        `   Min: ${result.minMs}ms  Mean: ${result.meanMs}ms  Median: ${result.medianMs}ms`,
        `   P95: ${result.p95Ms}ms  P99: ${result.p99Ms}ms  Max: ${result.maxMs}ms`,
    ].join('\n');
}
