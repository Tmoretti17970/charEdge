// ═══════════════════════════════════════════════════════════════════
// charEdge — MAMA (Mesa Adaptive Moving Average) (Phase 5)
// Ehlers' Hilbert Transform–based cycle detection + adaptive MA
// ═══════════════════════════════════════════════════════════════════

/**
 * MAMA — Mesa Adaptive Moving Average (John Ehlers)
 *
 * Uses Hilbert Transform to estimate dominant cycle period,
 * then adapts the MA speed to the current cycle.
 * Outputs two lines: MAMA (fast adaptive) and FAMA (following).
 *
 * @param src       - Source values (typically closes)
 * @param fastLimit - Max smoothing factor (default 0.5)
 * @param slowLimit - Min smoothing factor (default 0.05)
 */
export function mama(
    src: number[],
    fastLimit: number = 0.5,
    slowLimit: number = 0.05,
): { mama: number[]; fama: number[] } {
    const n = src.length;
    const mamaOut = new Array<number>(n).fill(NaN);
    const famaOut = new Array<number>(n).fill(NaN);

    if (n < 6) return { mama: mamaOut, fama: famaOut };

    // Hilbert Transform state
    const smooth = new Array<number>(n).fill(0);
    const detrender = new Array<number>(n).fill(0);
    const i1 = new Array<number>(n).fill(0);
    const q1 = new Array<number>(n).fill(0);
    const ji = new Array<number>(n).fill(0);
    const jq = new Array<number>(n).fill(0);
    const i2 = new Array<number>(n).fill(0);
    const q2 = new Array<number>(n).fill(0);
    const re = new Array<number>(n).fill(0);
    const im = new Array<number>(n).fill(0);
    const period = new Array<number>(n).fill(0);
    const smoothPeriod = new Array<number>(n).fill(0);
    const phase = new Array<number>(n).fill(0);

    let prevMama = src[0]!;
    let prevFama = src[0]!;

    for (let idx = 0; idx < n; idx++) {
        if (idx < 5) {
            mamaOut[idx] = src[idx]!;
            famaOut[idx] = src[idx]!;
            prevMama = src[idx]!;
            prevFama = src[idx]!;
            continue;
        }

        // Smooth price (4-bar WMA)
        smooth[idx] = (4 * src[idx]! + 3 * src[idx - 1]! + 2 * src[idx - 2]! + src[idx - 3]!) / 10;

        // Hilbert Transform — Detrender
        const adj = 0.0962 * smooth[idx]! + 0.5769 * (smooth[idx - 2] || 0)
            - 0.5769 * (smooth[idx - 4] || 0) - 0.0962 * (smooth[idx - 5] || 0);
        detrender[idx] = adj * (0.075 * (period[idx - 1] || 6) + 0.54);

        // In-phase and Quadrature components
        q1[idx] = (0.0962 * detrender[idx]! + 0.5769 * (detrender[idx - 2] || 0)
            - 0.5769 * (detrender[idx - 4] || 0) - 0.0962 * (detrender[idx - 5] || 0))
            * (0.075 * (period[idx - 1] || 6) + 0.54);
        i1[idx] = detrender[idx - 3] || 0;

        // Advance phase by 90°
        ji[idx] = (0.0962 * i1[idx]! + 0.5769 * (i1[idx - 2] || 0)
            - 0.5769 * (i1[idx - 4] || 0) - 0.0962 * (i1[idx - 5] || 0))
            * (0.075 * (period[idx - 1] || 6) + 0.54);
        jq[idx] = (0.0962 * q1[idx]! + 0.5769 * (q1[idx - 2] || 0)
            - 0.5769 * (q1[idx - 4] || 0) - 0.0962 * (q1[idx - 5] || 0))
            * (0.075 * (period[idx - 1] || 6) + 0.54);

        // Phasor addition for coherence
        i2[idx] = i1[idx]! - jq[idx]!;
        q2[idx] = q1[idx]! + ji[idx]!;

        // Smooth the I and Q components
        i2[idx] = 0.2 * i2[idx]! + 0.8 * (i2[idx - 1] || 0);
        q2[idx] = 0.2 * q2[idx]! + 0.8 * (q2[idx - 1] || 0);

        // Compute period from homodyne discriminator
        re[idx] = i2[idx]! * (i2[idx - 1] || 0) + q2[idx]! * (q2[idx - 1] || 0);
        im[idx] = i2[idx]! * (q2[idx - 1] || 0) - q2[idx]! * (i2[idx - 1] || 0);

        re[idx] = 0.2 * re[idx]! + 0.8 * (re[idx - 1] || 0);
        im[idx] = 0.2 * im[idx]! + 0.8 * (im[idx - 1] || 0);

        if (im[idx]! !== 0 && re[idx]! !== 0) {
            period[idx] = (2 * Math.PI) / Math.atan(im[idx]! / re[idx]!);
        } else {
            period[idx] = period[idx - 1] || 6;
        }

        // Clamp period
        period[idx] = Math.max(6, Math.min(50,
            period[idx]! > 1.5 * (period[idx - 1] || 6)
                ? 1.5 * (period[idx - 1] || 6)
                : period[idx]! < 0.67 * (period[idx - 1] || 6)
                    ? 0.67 * (period[idx - 1] || 6)
                    : period[idx]!
        ));

        smoothPeriod[idx] = 0.33 * period[idx]! + 0.67 * (smoothPeriod[idx - 1] || 6);

        // Compute phase
        if (i1[idx]! !== 0) {
            phase[idx] = Math.atan(q1[idx]! / i1[idx]!) * (180 / Math.PI);
        } else {
            phase[idx] = phase[idx - 1] || 0;
        }

        // Compute adaptive alpha from phase change
        const deltaPhase = Math.max(1, (phase[idx - 1] || 0) - phase[idx]!);
        const alpha = Math.max(slowLimit, Math.min(fastLimit, fastLimit / deltaPhase));

        // MAMA and FAMA
        const m = alpha * src[idx]! + (1 - alpha) * prevMama;
        const f = 0.5 * alpha * m + (1 - 0.5 * alpha) * prevFama;

        mamaOut[idx] = m;
        famaOut[idx] = f;
        prevMama = m;
        prevFama = f;
    }

    return { mama: mamaOut, fama: famaOut };
}
