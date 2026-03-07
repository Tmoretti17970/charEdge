// ═══════════════════════════════════════════════════════════════════
// charEdge — Label Collision Resolver (Task 2.7.6)
//
// Greedy algorithm for resolving overlapping price-axis labels.
// Labels are sorted by priority, then nudged vertically to avoid
// overlap. Lowest-priority labels are hidden if nudge cap exceeded.
// ═══════════════════════════════════════════════════════════════════

export interface LabelRect {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    /** Lower = higher priority. Price axis > indicator > drawing. */
    priority: number;
    /** Set to true if label should be hidden after collision resolution */
    hidden?: boolean;
    /** Vertical offset applied by the resolver */
    nudgeY?: number;
}

/** Label priority tiers */
export const LABEL_PRIORITY = {
    PRICE_AXIS: 0,
    CROSSHAIR: 1,
    INDICATOR: 2,
    DRAWING: 3,
    ALERT: 4,
} as const;

/** Max vertical nudge before hiding a label */
const MAX_NUDGE = 30;

/** Padding between labels after nudge */
const LABEL_GAP = 2;

/**
 * Check if two label rects overlap vertically (assuming same x-axis zone).
 */
function labelsOverlap(a: LabelRect, b: LabelRect): boolean {
    const aTop = a.y + (a.nudgeY || 0);
    const aBottom = aTop + a.height;
    const bTop = b.y + (b.nudgeY || 0);
    const bBottom = bTop + b.height;
    return aTop < bBottom + LABEL_GAP && aBottom + LABEL_GAP > bTop;
}

/**
 * Compute the minimum vertical shift to resolve overlap.
 */
function computeNudge(placed: LabelRect, incoming: LabelRect): number {
    const placedTop = placed.y + (placed.nudgeY || 0);
    const placedBottom = placedTop + placed.height;
    const incomingTop = incoming.y + (incoming.nudgeY || 0);

    // Push incoming below the placed label
    const nudgeDown = placedBottom + LABEL_GAP - incomingTop;
    // Or push incoming above the placed label
    const nudgeUp = incomingTop + incoming.height + LABEL_GAP - placedTop;

    // Choose the smaller nudge
    return Math.abs(nudgeDown) <= Math.abs(nudgeUp) ? nudgeDown : -nudgeUp;
}

/**
 * Resolve label collisions using a greedy priority-based algorithm.
 *
 * 1. Sort labels by priority (lowest number = highest priority), then by y.
 * 2. Place labels one by one. For each new label, check against all placed.
 * 3. If overlap, nudge the incoming label vertically by min amount.
 * 4. If total nudge exceeds MAX_NUDGE, hide the label.
 *
 * @param labels Array of LabelRect objects. Modified in-place AND returned.
 * @returns The same array, with `nudgeY` and `hidden` fields set.
 */
export function resolveCollisions(labels: LabelRect[]): LabelRect[] {
    if (labels.length <= 1) return labels;

    // Reset previous nudge state
    for (const label of labels) {
        label.nudgeY = 0;
        label.hidden = false;
    }

    // Sort by priority (asc), then by y-position (asc)
    const sorted = [...labels].sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.y - b.y;
    });

    const placed: LabelRect[] = [];

    for (const label of sorted) {
        let totalNudge = 0;
        let resolved = false;

        // Try to find a non-overlapping position
        for (let attempt = 0; attempt < placed.length + 1; attempt++) {
            let hasOverlap = false;

            for (const placedLabel of placed) {
                if (labelsOverlap(placedLabel, label)) {
                    const nudge = computeNudge(placedLabel, label);
                    label.nudgeY = (label.nudgeY || 0) + nudge;
                    totalNudge += Math.abs(nudge);
                    hasOverlap = true;
                    break;
                }
            }

            if (!hasOverlap) {
                resolved = true;
                break;
            }

            // Check if we've exceeded the nudge cap
            if (totalNudge > MAX_NUDGE) {
                break;
            }
        }

        if (!resolved && totalNudge > MAX_NUDGE) {
            label.hidden = true;
            label.nudgeY = 0;
        }

        if (!label.hidden) {
            placed.push(label);
        }
    }

    // Apply results back to original labels by id
    const resultMap = new Map(sorted.map(l => [l.id, l]));
    for (const label of labels) {
        const result = resultMap.get(label.id);
        if (result) {
            label.nudgeY = result.nudgeY;
            label.hidden = result.hidden;
        }
    }

    return labels;
}
