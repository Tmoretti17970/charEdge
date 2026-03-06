// ═══════════════════════════════════════════════════════════════════
// charEdge — DisplayHz (B1.4)
// Auto-detect display refresh rate via rAF delta measurement.
// Exports detected Hz and corresponding frame budget in ms.
// ═══════════════════════════════════════════════════════════════════

const STANDARD_HZ = [60, 72, 90, 120, 144, 165, 240] as const;
const SAMPLE_COUNT = 30;

/** Current detected refresh rate. Defaults to 60 until measured. */
export let detectedHz = 60;

/** Current frame budget in ms. Defaults to 16.67 (60fps). */
export let budgetMs = 16.67;

/**
 * Measure rAF deltas over `SAMPLE_COUNT` frames, take the median,
 * and classify to the nearest standard refresh rate.
 *
 * Call once at app startup (after first paint). Resolves in ~500ms.
 * Safe to call multiple times — subsequent calls return cached result.
 */
let _detected = false;
let _promise: Promise<{ hz: number; budgetMs: number }> | null = null;

export function detectDisplayHz(): Promise<{ hz: number; budgetMs: number }> {
    if (_detected) return Promise.resolve({ hz: detectedHz, budgetMs });
    if (_promise) return _promise;

    _promise = new Promise((resolve) => {
        const deltas: number[] = [];
        let prev = 0;
        let count = 0;

        const measure = (now: number): void => {
            if (prev > 0) {
                deltas.push(now - prev);
            }
            prev = now;
            count++;

            if (count <= SAMPLE_COUNT) {
                requestAnimationFrame(measure);
            } else {
                // Compute median delta
                deltas.sort((a, b) => a - b);
                const median = deltas[Math.floor(deltas.length / 2)] ?? 16.67;
                const rawHz = 1000 / median;

                // Classify to nearest standard Hz
                let bestHz = 60;
                let bestDist = Infinity;
                for (const hz of STANDARD_HZ) {
                    const dist = Math.abs(rawHz - hz);
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestHz = hz;
                    }
                }

                detectedHz = bestHz;
                budgetMs = 1000 / bestHz;
                _detected = true;

                resolve({ hz: detectedHz, budgetMs });
            }
        };

        requestAnimationFrame(measure);
    });

    return _promise;
}
