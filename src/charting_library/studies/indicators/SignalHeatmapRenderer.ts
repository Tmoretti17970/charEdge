// ═══════════════════════════════════════════════════════════════════
// charEdge — Signal Heatmap Renderer (Phase 3)
// Renders a thin horizontal heat strip showing confluence sentiment
// ═══════════════════════════════════════════════════════════════════

/**
 * Render a signal confluence heatmap strip.
 * Green = bullish, Red = bearish, Gray = neutral.
 * Uses HSL interpolation for smooth color transitions.
 *
 * @param ctx       - Canvas rendering context
 * @param heatStrip - Array of values from -1 (bearish) to +1 (bullish) per bar
 * @param params    - Rendering parameters
 */
export function renderSignalHeatmap(
    ctx: CanvasRenderingContext2D,
    heatStrip: number[],
    params: {
        startIdx: number;
        endIdx: number;
        barSpacing: number;
        pixelRatio: number;
        stripY: number;      // Bitmap Y position
        stripHeight: number; // Bitmap height
    },
): void {
    const { startIdx, endIdx, barSpacing, pixelRatio: pr, stripY, stripHeight } = params;

    if (!heatStrip || heatStrip.length === 0 || stripHeight <= 0) return;

    const barW = Math.max(1, Math.round(barSpacing * pr));

    for (let i = startIdx; i <= endIdx && i < heatStrip.length; i++) {
        const value = heatStrip[i]!;
        if (isNaN(value)) continue;

        const x = Math.round((i - startIdx) * barSpacing * pr);

        // HSL interpolation: +1 → green (hue 145), -1 → red (hue 0)
        const clamped = Math.max(-1, Math.min(1, value));
        const hue = clamped >= 0 ? 145 : 0;
        const saturation = 75;
        const lightness = 45;
        const opacity = Math.abs(clamped) * 0.7 + 0.1; // Min 0.1, max 0.8

        ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${opacity})`;
        ctx.fillRect(x, stripY, barW, stripHeight);
    }

    // Top/bottom border lines
    ctx.fillStyle = 'rgba(54, 58, 69, 0.5)';
    ctx.fillRect(0, stripY, Math.round((endIdx - startIdx + 1) * barSpacing * pr), Math.max(1, pr));
    ctx.fillRect(0, stripY + stripHeight - Math.max(1, pr), Math.round((endIdx - startIdx + 1) * barSpacing * pr), Math.max(1, pr));
}
