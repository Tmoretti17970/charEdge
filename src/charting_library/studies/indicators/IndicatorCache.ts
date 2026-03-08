// ═══════════════════════════════════════════════════════════════════
// charEdge — IndicatorCache (Strategy Item #10)
//
// Pre-renders complex indicator output to an OffscreenCanvas.
// On cache hits, the cached bitmap is composited via drawImage()
// instead of re-executing all the per-bar Canvas2D draw calls.
//
// Cache invalidation is based on:
//   - Viewport geometry (start, end, barSpacing)
//   - Canvas dimensions (width, height, pixelRatio)
//   - Indicator identity (indicatorId + params hash + computed ref)
//
// This is most beneficial for:
//   - Bollinger Bands (fill + 3 line outputs)
//   - Ichimoku Cloud (fill + 5 outputs)
//   - VRVP (histogram computation)
//   - Multi-output pane indicators
// ═══════════════════════════════════════════════════════════════════

/**
 * Cache entry for a single indicator's rendered output.
 */
interface CacheEntry {
    canvas: OffscreenCanvas | HTMLCanvasElement;
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    key: string;
    age: number;         // Frame counter since last access
    indicatorId: string; // For debugging
}

/**
 * Build a cache key from the rendering inputs that affect appearance.
 */
function buildCacheKey(
    indicatorId: string,
    startIdx: number,
    endIdx: number,
    barSpacing: number,
    width: number,
    height: number,
    pixelRatio: number,
    paramsHash: string,
    computedRef: number, // We use a numeric stamp to detect data changes
): string {
    return `${indicatorId}:${startIdx}:${endIdx}:${barSpacing.toFixed(3)}:${width}:${height}:${pixelRatio}:${paramsHash}:${computedRef}`;
}

/**
 * Compute a simple hash of indicator params for cache key differentiation.
 */
function hashParams(params: Record<string, unknown>): string {
    if (!params) return '()';
    return Object.entries(params)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join(',');
}

// ─── IndicatorCache ─────────────────────────────────────────────

const MAX_ENTRIES = 8;       // Max cached indicators
const MAX_AGE = 120;         // Evict after 120 frames without access (~2s at 60fps)

const _entries = new Map<string, CacheEntry>();
let _frameCounter = 0;

/**
 * Get a cached rendering of an indicator, or null if cache miss.
 *
 * @param indicatorId - Unique indicator identifier
 * @param startIdx - First visible bar index
 * @param endIdx - Last visible bar index
 * @param barSpacing - Pixels per bar
 * @param width - Canvas width in bitmap pixels
 * @param height - Canvas height in bitmap pixels
 * @param pixelRatio - Device pixel ratio
 * @param params - Indicator parameters (for hash)
 * @param computedStamp - Numeric stamp that changes when computed data changes
 * @returns Cached canvas to drawImage() from, or null on miss
 */
export function getCachedIndicator(
    indicatorId: string,
    startIdx: number,
    endIdx: number,
    barSpacing: number,
    width: number,
    height: number,
    pixelRatio: number,
    params: Record<string, unknown>,
    computedStamp: number,
): (OffscreenCanvas | HTMLCanvasElement) | null {
    const key = buildCacheKey(
        indicatorId, startIdx, endIdx, barSpacing,
        width, height, pixelRatio, hashParams(params), computedStamp,
    );

    const entry = _entries.get(indicatorId);
    if (entry && entry.key === key) {
        entry.age = 0; // Reset age on access
        return entry.canvas;
    }
    return null;
}

/**
 * Store a rendered indicator bitmap in the cache.
 *
 * @param indicatorId - Unique indicator identifier
 * @param startIdx - First visible bar index
 * @param endIdx - Last visible bar index
 * @param barSpacing - Pixels per bar
 * @param width - Canvas width in bitmap pixels
 * @param height - Canvas height in bitmap pixels
 * @param pixelRatio - Device pixel ratio
 * @param params - Indicator parameters (for hash)
 * @param computedStamp - Numeric stamp
 * @param renderFn - Function that draws the indicator onto the provided context
 * @returns The cached canvas (for immediate compositing)
 */
export function renderAndCache(
    indicatorId: string,
    startIdx: number,
    endIdx: number,
    barSpacing: number,
    width: number,
    height: number,
    pixelRatio: number,
    params: Record<string, unknown>,
    computedStamp: number,
    renderFn: (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | any) => void,
): OffscreenCanvas | HTMLCanvasElement {
    const key = buildCacheKey(
        indicatorId, startIdx, endIdx, barSpacing,
        width, height, pixelRatio, hashParams(params), computedStamp,
    );

    let entry = _entries.get(indicatorId);

    // Reuse existing entry if dimensions match, otherwise create new
    if (!entry || entry.canvas.width !== width || entry.canvas.height !== height) {
        let canvas: OffscreenCanvas | HTMLCanvasElement;
        if (typeof OffscreenCanvas !== 'undefined') {
            canvas = new OffscreenCanvas(width, height);
        } else {
            canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
        }
        const ctx = canvas.getContext('2d')!;
        entry = { canvas, ctx: ctx as any, key: '', age: 0, indicatorId };
        _entries.set(indicatorId, entry);
    }

    // Clear and re-render
    entry.ctx.clearRect(0, 0, width, height);
    renderFn(entry.ctx);
    entry.key = key;
    entry.age = 0;

    // Evict stale entries
    _evictStale();

    return entry.canvas;
}

/**
 * Convenience: get cached or render-and-cache in one call.
 */
export function cachedIndicatorRender(
    indicatorId: string,
    startIdx: number,
    endIdx: number,
    barSpacing: number,
    width: number,
    height: number,
    pixelRatio: number,
    params: Record<string, unknown>,
    computedStamp: number,
    renderFn: (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | any) => void,
): OffscreenCanvas | HTMLCanvasElement {
    const cached = getCachedIndicator(
        indicatorId, startIdx, endIdx, barSpacing,
        width, height, pixelRatio, params, computedStamp,
    );
    if (cached) return cached;

    return renderAndCache(
        indicatorId, startIdx, endIdx, barSpacing,
        width, height, pixelRatio, params, computedStamp, renderFn,
    );
}

/**
 * Advance the frame counter and age all entries.
 * Call this once per frame from the render pipeline.
 */
export function tickIndicatorCache(): void {
    _frameCounter++;
    for (const entry of _entries.values()) {
        entry.age++;
    }
}

/**
 * Invalidate all cached indicators.
 * Call on theme change, data reset, etc.
 */
export function invalidateIndicatorCache(): void {
    _entries.clear();
}

/**
 * Get cache statistics for profiling.
 */
export function getIndicatorCacheStats(): { size: number; maxSize: number; entries: string[] } {
    return {
        size: _entries.size,
        maxSize: MAX_ENTRIES,
        entries: Array.from(_entries.keys()),
    };
}

// ─── Internal ───────────────────────────────────────────────────

function _evictStale(): void {
    if (_entries.size <= MAX_ENTRIES) return;

    // Evict oldest entries exceeding MAX_AGE
    for (const [id, entry] of _entries) {
        if (entry.age > MAX_AGE) {
            _entries.delete(id);
        }
    }

    // If still over limit, evict least-recently-used
    if (_entries.size > MAX_ENTRIES) {
        let oldestId = '';
        let oldestAge = -1;
        for (const [id, entry] of _entries) {
            if (entry.age > oldestAge) {
                oldestAge = entry.age;
                oldestId = id;
            }
        }
        if (oldestId) _entries.delete(oldestId);
    }
}

// Re-export internals for testing
export { _entries, buildCacheKey, hashParams };
