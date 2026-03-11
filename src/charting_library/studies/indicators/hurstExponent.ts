// ═══════════════════════════════════════════════════════════════════
// charEdge — Hurst Exponent (Phase 6)
// Rescaled Range (R/S) analysis for trend/mean-reversion detection
//
// H > 0.5 → persistent (trending)
// H ≈ 0.5 → random walk (brownian motion)
// H < 0.5 → anti-persistent (mean-reverting)
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute the Hurst exponent using Rescaled Range (R/S) analysis.
 *
 * For each bar, calculates H over a rolling window of log-returns.
 * Uses multiple sub-period sizes and linear regression of log(R/S) vs log(n).
 *
 * @param src        - Source price array (typically closes)
 * @param windowSize - Rolling window for R/S calculation (default 100)
 */
export function hurstExponent(
    src: number[],
    windowSize: number = 100,
): { hurst: number[] } {
    const n = src.length;
    const hurst = new Array<number>(n).fill(NaN);

    if (n < windowSize + 1) return { hurst };

    // Compute log-returns
    const returns = new Array<number>(n).fill(0);
    for (let i = 1; i < n; i++) {
        returns[i] = src[i]! > 0 && src[i - 1]! > 0
            ? Math.log(src[i]! / src[i - 1]!)
            : 0;
    }

    // Sub-period sizes for R/S regression
    // Use sizes that divide the window reasonably
    const subSizes: number[] = [];
    for (let s = 8; s <= Math.floor(windowSize / 2); s = Math.floor(s * 1.5)) {
        subSizes.push(s);
    }

    if (subSizes.length < 2) {
        subSizes.length = 0;
        subSizes.push(8, 16, 32);
    }

    // Rolling Hurst calculation
    for (let i = windowSize; i < n; i++) {
        const windowReturns = returns.slice(i - windowSize + 1, i + 1);

        // Compute R/S for each sub-period size
        const logN: number[] = [];
        const logRS: number[] = [];

        for (const subSize of subSizes) {
            if (subSize > windowReturns.length) continue;

            const numSubs = Math.floor(windowReturns.length / subSize);
            if (numSubs === 0) continue;

            let totalRS = 0;

            for (let s = 0; s < numSubs; s++) {
                const sub = windowReturns.slice(s * subSize, (s + 1) * subSize);

                // Mean of sub-period
                let mean = 0;
                for (let j = 0; j < sub.length; j++) mean += sub[j]!;
                mean /= sub.length;

                // Cumulative deviation from mean
                let maxCum = -Infinity;
                let minCum = Infinity;
                let cum = 0;
                let sumSq = 0;

                for (let j = 0; j < sub.length; j++) {
                    const dev = sub[j]! - mean;
                    cum += dev;
                    sumSq += dev * dev;
                    if (cum > maxCum) maxCum = cum;
                    if (cum < minCum) minCum = cum;
                }

                // Range and standard deviation
                const range = maxCum - minCum;
                const stdDev = Math.sqrt(sumSq / sub.length);

                if (stdDev > 0) {
                    totalRS += range / stdDev;
                }
            }

            const avgRS = totalRS / numSubs;
            if (avgRS > 0) {
                logN.push(Math.log(subSize));
                logRS.push(Math.log(avgRS));
            }
        }

        // Linear regression: log(R/S) = H * log(n) + c
        if (logN.length >= 2) {
            hurst[i] = linearRegressionSlope(logN, logRS);
            // Clamp to [0, 1]
            if (hurst[i]! < 0) hurst[i] = 0;
            if (hurst[i]! > 1) hurst[i] = 1;
        }
    }

    return { hurst };
}

/** Simple linear regression slope (OLS). */
function linearRegressionSlope(x: number[], y: number[]): number {
    const n = x.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    for (let i = 0; i < n; i++) {
        sumX += x[i]!;
        sumY += y[i]!;
        sumXY += x[i]! * y[i]!;
        sumX2 += x[i]! * x[i]!;
    }

    const denom = n * sumX2 - sumX * sumX;
    if (Math.abs(denom) < 1e-12) return 0.5; // fallback
    return (n * sumXY - sumX * sumY) / denom;
}
