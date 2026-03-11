// ═══════════════════════════════════════════════════════════════════
// charEdge — Sigma Bands (Phase 2)
// Z-score overlay with 2σ and 3σ standard deviation bands
// ═══════════════════════════════════════════════════════════════════

/**
 * Sigma Bands — z-score + 2σ/3σ statistical bands overlay.
 *
 * @param src    - Source values (typically closes)
 * @param period - Rolling window for mean/stddev (default 20)
 */
export function sigmaBands(
    src: number[],
    period: number = 20,
): {
    zscore: number[];
    upper2: number[];
    lower2: number[];
    upper3: number[];
    lower3: number[];
    mean: number[];
} {
    const n = src.length;
    const zscore = new Array(n).fill(NaN);
    const upper2 = new Array(n).fill(NaN);
    const lower2 = new Array(n).fill(NaN);
    const upper3 = new Array(n).fill(NaN);
    const lower3 = new Array(n).fill(NaN);
    const mean = new Array(n).fill(NaN);

    if (n < period) return { zscore, upper2, lower2, upper3, lower3, mean };

    // Two-pass algorithm: numerically stable for high-priced instruments.
    // The naive sumSq/n - m² formula suffers from catastrophic cancellation
    // when values are large (e.g., BTC at $100k), causing bands to collapse.
    for (let i = period - 1; i < n; i++) {
        // Pass 1: mean
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += src[j]!;
        const m = sum / period;

        // Pass 2: variance (sum of squared deviations from mean)
        let ssq = 0;
        for (let j = i - period + 1; j <= i; j++) {
            const d = src[j]! - m;
            ssq += d * d;
        }
        const sd = Math.sqrt(ssq / period);

        mean[i] = m;
        upper2[i] = m + 2 * sd;
        lower2[i] = m - 2 * sd;
        upper3[i] = m + 3 * sd;
        lower3[i] = m - 3 * sd;
        zscore[i] = sd === 0 ? 0 : (src[i]! - m) / sd;
    }

    return { zscore, upper2, lower2, upper3, lower3, mean };
}
