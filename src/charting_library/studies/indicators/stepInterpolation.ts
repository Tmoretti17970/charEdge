// ═══════════════════════════════════════════════════════════════════
// charEdge — Step Interpolation (Phase 4)
// Converts higher-TF indicator values to lower-TF display
// ═══════════════════════════════════════════════════════════════════

/**
 * Step-interpolate higher-TF values onto lower-TF timestamps.
 * Each HTF value holds constant until the next HTF bar boundary.
 *
 * @param htfValues - Indicator values computed on aggregated bars
 * @param htfTimes  - Timestamps of aggregated bars (ms)
 * @param ltfTimes  - Target (chart) timestamps (ms)
 * @returns Array aligned to ltfTimes with step-interpolated values
 */
export function stepInterpolate(
    htfValues: number[],
    htfTimes: number[],
    ltfTimes: number[],
): number[] {
    const n = ltfTimes.length;
    const result = new Array<number>(n).fill(NaN);
    if (htfValues.length === 0 || htfTimes.length === 0) return result;

    let htfIdx = 0;

    for (let i = 0; i < n; i++) {
        const t = ltfTimes[i]!;

        // Advance htfIdx to the last HTF bar that starts at or before this LTF time
        while (htfIdx < htfTimes.length - 1 && htfTimes[htfIdx + 1]! <= t) {
            htfIdx++;
        }

        // Only assign if the HTF bar has started
        if (htfTimes[htfIdx]! <= t) {
            result[i] = htfValues[htfIdx]!;
        }
    }

    return result;
}

/**
 * Render a step-interpolated line (flat segments with vertical jumps).
 *
 * @param ctx    - Canvas rendering context
 * @param values - Step-interpolated values (one per bar)
 * @param params - Rendering parameters
 */
export function renderStepLine(
    ctx: CanvasRenderingContext2D,
    values: number[],
    params: {
        startIdx: number;
        endIdx: number;
        barSpacing: number;
        priceToY: (p: number) => number;
        pixelRatio: number;
        color: string;
        width: number;
    },
): void {
    const { startIdx, endIdx, barSpacing, priceToY, pixelRatio: pr, color, width } = params;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width * pr;
    ctx.setLineDash([]);
    ctx.beginPath();

    let started = false;
    let prevY = 0;

    for (let i = startIdx; i <= endIdx && i < values.length; i++) {
        const val = values[i];
        if (val === undefined || isNaN(val)) continue;

        const x = Math.round((i - startIdx + 0.5) * barSpacing * pr);
        const y = Math.round(priceToY(val) * pr);

        if (!started) {
            ctx.moveTo(x, y);
            started = true;
        } else {
            // Horizontal line at previous Y, then vertical jump
            ctx.lineTo(x, prevY);
            ctx.lineTo(x, y);
        }
        prevY = y;
    }

    // Extend last value to the right edge
    if (started) {
        const lastX = Math.round((endIdx - startIdx + 1) * barSpacing * pr);
        ctx.lineTo(lastX, prevY);
    }

    ctx.stroke();
    ctx.restore();
}
