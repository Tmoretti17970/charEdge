// ═══════════════════════════════════════════════════════════════════
// charEdge — Shared Coordinate Scales (Sprint 13–14, Task #102)
//
// Extracted from ChartTypes.js: canonical barX, priceY, and color
// utilities used across all chart type renderers, DataStage, and
// overlay renderers.
// ═══════════════════════════════════════════════════════════════════

/**
 * Parameters required for coordinate conversion.
 */
export interface ScaleParams {
    startIdx: number;
    firstVisibleIdx?: number;
    barSpacing: number;
    pixelRatio: number;
    timeTransform?: { indexToPixel: (idx: number) => number } | null;
    priceToY: (price: number) => number;
    chartWidth?: number;
    mainH?: number;
    bitmapHeight?: number;
}

// ─── Coordinate Conversions ──────────────────────────────────────

/**
 * Get the x-coordinate for a bar index in bitmap (physical pixel) space.
 * Uses timeTransform if available (ChartEngine path), falls back to barSpacing math.
 */
export function barX(i: number, params: ScaleParams): number {
    const { startIdx, firstVisibleIdx, barSpacing, pixelRatio, timeTransform } = params;
    if (timeTransform) {
        return Math.round(timeTransform.indexToPixel(startIdx + i) * pixelRatio);
    }
    return Math.round(
        (startIdx + i - (firstVisibleIdx ?? startIdx) + 0.5) * barSpacing * pixelRatio,
    );
}

/**
 * Convert a price to bitmap y-coordinate.
 */
export function priceY(price: number, params: ScaleParams): number {
    return Math.round(params.priceToY(price) * params.pixelRatio);
}

// ─── Color Utilities ────────────────────────────────────────────

/**
 * Safely apply alpha to any CSS color string (hex or rgba).
 * Returns a properly formatted rgba() string.
 */
export function withAlpha(color: string | undefined, alpha: number): string {
    if (!color) return `rgba(0,0,0,${alpha})`;
    // If already rgba, replace the alpha
    const rgbaMatch = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbaMatch) {
        return `rgba(${rgbaMatch[1]},${rgbaMatch[2]},${rgbaMatch[3]},${alpha})`;
    }
    // Hex color → extract RGB and apply alpha
    let hex = color.replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    if (hex.length >= 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }
    return color; // fallback
}
