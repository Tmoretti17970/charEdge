// ═══════════════════════════════════════════════════════════════════
// charEdge — Renko Brick Count (Phase 6)
// Measures momentum in discrete brick units
// ═══════════════════════════════════════════════════════════════════

/**
 * Renko Brick Count — counts bricks of a given size.
 *
 * Renko bricks are fixed-size price-movement units that filter noise.
 * A new brick is drawn only when price moves `brickSize` from the
 * last brick's close. The output is a cumulative brick count
 * and a direction signal.
 *
 * @param src       - Source price array (typically closes)
 * @param brickSize - Size of each brick in price units
 */
export function renkoBrickCount(
    src: number[],
    brickSize: number = 1,
): {
    bricks: number[];      // Cumulative net brick count (positive = up, negative = down)
    direction: number[];   // Current brick direction: +1 up, -1 down, 0 neutral
    brickCount: number[];  // Absolute total bricks formed
} {
    const n = src.length;
    const bricks = new Array<number>(n).fill(0);
    const direction = new Array<number>(n).fill(0);
    const brickCount = new Array<number>(n).fill(0);

    if (n === 0 || brickSize <= 0) return { bricks, direction, brickCount };

    // Anchor to first price, rounded to brick boundary
    let anchor = Math.floor(src[0]! / brickSize) * brickSize;
    let netBricks = 0;
    let totalBricks = 0;
    let dir = 0;

    for (let i = 0; i < n; i++) {
        const price = src[i]!;
        const diff = price - anchor;

        // How many bricks can we form?
        const newBricks = Math.floor(Math.abs(diff) / brickSize);

        if (newBricks > 0) {
            const brickDir = diff > 0 ? 1 : -1;
            dir = brickDir;
            netBricks += brickDir * newBricks;
            totalBricks += newBricks;

            // Move anchor by the bricks formed
            anchor += brickDir * newBricks * brickSize;
        }

        bricks[i] = netBricks;
        direction[i] = dir;
        brickCount[i] = totalBricks;
    }

    return { bricks, direction, brickCount };
}
