// ═══════════════════════════════════════════════════════════════════
// H2.2: R-Multiple Distribution histogram
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute R-multiple distribution histogram with summary stats.
 * @param {Object[]} trades
 * @returns {{ buckets: Object[], mean: number, median: number, stdDev: number, count: number }}
 */
export function computeRDistribution(trades) {
    const rValues = trades.map((t) => t.rMultiple).filter((r) => r != null && isFinite(r));

    if (rValues.length < 2) {
        return { buckets: [], mean: 0, median: 0, stdDev: 0, count: 0 };
    }

    const n = rValues.length;
    const sorted = [...rValues].sort((a, b) => a - b);

    // Stats
    const sum = rValues.reduce((s, r) => s + r, 0);
    const mean = sum / n;
    const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
    let variance = 0;
    for (let i = 0; i < n; i++) variance += (rValues[i] - mean) ** 2;
    const stdDev = n > 1 ? Math.sqrt(variance / (n - 1)) : 0;

    // Histogram: -4R to +4R in 0.5R steps
    const bucketSize = 0.5;
    const minR = -4;
    const maxR = 4;
    const buckets = [];

    for (let r = minR; r < maxR; r += bucketSize) {
        const label = r === 0 ? '0R' : `${r >= 0 ? '+' : ''}${r.toFixed(1)}R`;
        const count = rValues.filter((v) => v >= r && v < r + bucketSize).length;
        buckets.push({ label, r, count });
    }

    // Overflow buckets
    const belowCount = rValues.filter((v) => v < minR).length;
    const aboveCount = rValues.filter((v) => v >= maxR).length;
    if (belowCount > 0) buckets.unshift({ label: `<${minR}R`, r: minR - 1, count: belowCount });
    if (aboveCount > 0) buckets.push({ label: `>${maxR}R`, r: maxR, count: aboveCount });

    return { buckets, mean, median, stdDev, count: n };
}
