// ═══════════════════════════════════════════════════════════════════
// charEdge — NiceTicks
//
// Label collision avoidance for chart axes. Filters overlapping
// tick labels using a greedy algorithm that preserves visual
// spacing and readability.
//
// Task 8.3.2: Label collision avoidance (niceTicks algorithm)
//
// Usage:
//   const filtered = filterOverlappingLabels(priceLabels, 22);
//   const timeFiltered = filterOverlappingTimeLabels(timeLabels, 16);
// ═══════════════════════════════════════════════════════════════════

// ─── Type Definitions ────────────────────────────────────────────

/** A positioned price-axis tick label. */
export interface PriceTickLabel {
    value?: number;
    x: number;       // pixel position (bitmap coords)
    y: number;       // pixel position (bitmap coords)
    text: string;
    fontSize: number;
}

/** A positioned time-axis tick label. */
export interface TimeTickLabel {
    x: number;       // pixel position (bitmap coords)
    y: number;
    text: string;
    fontSize: number;
}

/** Exclusion zone — labels must not overlap this region. */
export interface ExclusionZone {
    center: number;  // center position (Y for price, X for time)
    halfSize: number; // half-height or half-width
}

// ─── Price Label Collision Filter ────────────────────────────────

/**
 * Filter price tick labels to eliminate overlaps.
 *
 * Uses a greedy algorithm: scans top-to-bottom, keeping a label
 * only if it's far enough from the last kept label AND not inside
 * any exclusion zone (e.g., the current price badge).
 *
 * @param labels - Labels sorted by Y position (top to bottom)
 * @param minGap - Minimum pixel gap between label centers
 * @param exclusions - Optional zones where labels must not appear
 * @returns Filtered non-overlapping labels
 */
export function filterOverlappingLabels(
    labels: PriceTickLabel[],
    minGap: number = 20,
    exclusions: ExclusionZone[] = [],
): PriceTickLabel[] {
    if (labels.length <= 1) return labels;

    // Sort by Y ascending (top of chart to bottom)
    const sorted = [...labels].sort((a, b) => a.y - b.y);

    const result: PriceTickLabel[] = [];
    let lastKeptY = -Infinity;

    for (const label of sorted) {
        // Check minimum gap from last kept label
        if (label.y - lastKeptY < minGap) continue;

        // Check exclusion zones (e.g., price badge)
        let excluded = false;
        for (const zone of exclusions) {
            if (Math.abs(label.y - zone.center) < zone.halfSize + minGap * 0.5) {
                excluded = true;
                break;
            }
        }
        if (excluded) continue;

        result.push(label);
        lastKeptY = label.y;
    }

    return result;
}

// ─── Time Label Collision Filter ─────────────────────────────────

/**
 * Filter time tick labels to eliminate overlaps.
 *
 * Uses a greedy algorithm: scans left-to-right, keeping a label
 * only if it's far enough from the last kept label.
 *
 * @param labels - Labels sorted by X position (left to right)
 * @param minGap - Minimum pixel gap between label edges
 * @returns Filtered non-overlapping labels
 */
export function filterOverlappingTimeLabels(
    labels: TimeTickLabel[],
    minGap: number = 12,
): TimeTickLabel[] {
    if (labels.length <= 1) return labels;

    // Sort by X ascending (left to right)
    const sorted = [...labels].sort((a, b) => a.x - b.x);

    const result: TimeTickLabel[] = [];
    let lastKeptX = -Infinity;

    // Estimate label width from text length * character width
    const charWidth = (fontSize: number) => fontSize * 0.6;

    for (const label of sorted) {
        const estWidth = label.text.length * charWidth(label.fontSize);
        const leftEdge = label.x - estWidth / 2;

        // Check minimum gap from last kept label's right edge
        if (leftEdge - lastKeptX < minGap) continue;

        result.push(label);
        lastKeptX = label.x + estWidth / 2;
    }

    return result;
}
