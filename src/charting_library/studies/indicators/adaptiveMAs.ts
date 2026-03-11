// ═══════════════════════════════════════════════════════════════════
// charEdge — Adaptive Moving Averages (Phase 2)
// KAMA (Kaufman), VIDYA (Variable Index Dynamic Average), FRAMA (Fractal)
// ═══════════════════════════════════════════════════════════════════


// ─── KAMA ────────────────────────────────────────────────────────

/**
 * Kaufman Adaptive Moving Average.
 * Uses Efficiency Ratio (direction / volatility) to adjust smoothing.
 *
 * @param src        - Source values (typically closes)
 * @param period     - Lookback for ER calculation (default 10)
 * @param fastPeriod - Fast EMA period when trending (default 2)
 * @param slowPeriod - Slow EMA period when ranging (default 30)
 */
export function kama(
    src: number[],
    period: number = 10,
    fastPeriod: number = 2,
    slowPeriod: number = 30,
): number[] {
    const n = src.length;
    const out = new Array(n).fill(NaN);
    if (n < period) return out;

    const fastSC = 2 / (fastPeriod + 1);
    const slowSC = 2 / (slowPeriod + 1);

    // Seed with first period SMA
    let sum = 0;
    for (let i = 0; i < period; i++) sum += src[i]!;
    out[period - 1] = sum / period;

    for (let i = period; i < n; i++) {
        // Efficiency Ratio = |direction| / volatility
        const direction = Math.abs(src[i]! - src[i - period]!);
        let volatility = 0;
        for (let j = i - period + 1; j <= i; j++) {
            volatility += Math.abs(src[j]! - src[j - 1]!);
        }

        const er = volatility === 0 ? 0 : direction / volatility;

        // Smoothing constant: maps ER [0,1] → α between slowSC and fastSC
        const sc = er * (fastSC - slowSC) + slowSC;
        const alpha = sc * sc; // Squared for sharper cutoff

        const prev = out[i - 1]!;
        out[i] = prev + alpha * (src[i]! - prev);
    }

    return out;
}

// ─── VIDYA ───────────────────────────────────────────────────────

/**
 * Variable Index Dynamic Average (Chande).
 * Uses CMO (Chande Momentum Oscillator) as volatility index.
 *
 * @param src       - Source values
 * @param period    - EMA-like period (default 14)
 * @param cmoPeriod - CMO lookback (default 9)
 */
export function vidya(
    src: number[],
    period: number = 14,
    cmoPeriod: number = 9,
): number[] {
    const n = src.length;
    const out = new Array(n).fill(NaN);
    if (n < cmoPeriod + 1) return out;

    const baseAlpha = 2 / (period + 1);

    // Compute CMO inline
    const gains = new Array(n).fill(0);
    const losses = new Array(n).fill(0);
    for (let i = 1; i < n; i++) {
        const diff = src[i]! - src[i - 1]!;
        if (diff > 0) gains[i] = diff;
        else losses[i] = -diff;
    }

    // Seed VIDYA at start of valid CMO
    const seedIdx = cmoPeriod;
    out[seedIdx] = src[seedIdx]!;

    for (let i = seedIdx + 1; i < n; i++) {
        // Rolling CMO over cmoPeriod
        let sumGain = 0, sumLoss = 0;
        for (let j = i - cmoPeriod + 1; j <= i; j++) {
            sumGain += gains[j]!;
            sumLoss += losses[j]!;
        }
        const cmo = (sumGain + sumLoss) === 0 ? 0 : (sumGain - sumLoss) / (sumGain + sumLoss);
        const alpha = baseAlpha * Math.abs(cmo);

        const prev = isNaN(out[i - 1]) ? src[i]! : out[i - 1]!;
        out[i] = alpha * src[i]! + (1 - alpha) * prev;
    }

    return out;
}

// ─── FRAMA ───────────────────────────────────────────────────────

/**
 * Fractal Adaptive Moving Average (Ehlers).
 * Uses fractal dimension of price to determine smoothing.
 *
 * @param src    - Source values
 * @param period - Lookback period, must be even (default 16)
 */
export function frama(src: number[], period: number = 16): number[] {
    const n = src.length;
    const out = new Array(n).fill(NaN);
    // Period must be even
    const p = period % 2 === 0 ? period : period + 1;
    const half = p / 2;

    if (n < p) return out;

    // Seed
    out[p - 1] = src[p - 1]!;

    for (let i = p; i < n; i++) {
        // N1: (High - Low) of first half
        let h1 = -Infinity, l1 = Infinity;
        for (let j = i - p + 1; j <= i - half; j++) {
            if (src[j]! > h1) h1 = src[j]!;
            if (src[j]! < l1) l1 = src[j]!;
        }
        const n1 = (h1 - l1) / half;

        // N2: (High - Low) of second half
        let h2 = -Infinity, l2 = Infinity;
        for (let j = i - half + 1; j <= i; j++) {
            if (src[j]! > h2) h2 = src[j]!;
            if (src[j]! < l2) l2 = src[j]!;
        }
        const n2 = (h2 - l2) / half;

        // N3: (High - Low) of full period
        let h3 = -Infinity, l3 = Infinity;
        for (let j = i - p + 1; j <= i; j++) {
            if (src[j]! > h3) h3 = src[j]!;
            if (src[j]! < l3) l3 = src[j]!;
        }
        const n3 = (h3 - l3) / p;

        // Fractal dimension
        let d = 1;
        if (n1 > 0 && n2 > 0 && n3 > 0) {
            d = (Math.log(n1 + n2) - Math.log(n3)) / Math.log(2);
        }

        // Alpha from fractal dimension: α = exp(-4.6 (D - 1))
        let alpha = Math.exp(-4.6 * (d - 1));
        alpha = Math.max(0.01, Math.min(1, alpha)); // Clamp

        const prev = isNaN(out[i - 1]) ? src[i]! : out[i - 1]!;
        out[i] = alpha * src[i]! + (1 - alpha) * prev;
    }

    return out;
}
