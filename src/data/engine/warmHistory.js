// ═══════════════════════════════════════════════════════════════════
// charEdge — History Cache Warmer (Task 2.10.6.1)
//
// Background multi-page fetch + OPFS write.
// warmHistory(sym, tfId) fills 1+ year of current TF on symbol change.
// Runs via requestIdleCallback to avoid blocking the UI.
// ═══════════════════════════════════════════════════════════════════

// @ts-nocheck
import { logger } from '@/observability/logger';

// ─── Constants ──────────────────────────────────────────────────

/**
 * Target history depths per timeframe (in bars).
 * These expand the existing ADJACENT warm map for deep prefetch.
 */
const WARM_TARGETS = {
    '1m': 2_000,    // ~1.4 days
    '5m': 6_000,    // ~21 days
    '15m': 10_000,  // ~104 days
    '30m': 8_000,   // ~167 days
    '1h': 6_000,    // ~250 days
    '4h': 4_000,    // ~667 days
    '1D': 5_000,    // ~14 years
    '1w': 2_000,    // ~38 years
};

/** Adjacent timeframes to pre-warm alongside the active one */
const ADJACENT_TFS = {
    '1m': ['5m'],
    '5m': ['1m', '15m'],
    '15m': ['5m', '30m'],
    '30m': ['15m', '1h'],
    '1h': ['30m', '4h'],
    '4h': ['1h', '1D'],
    '1D': ['4h', '1w'],
    '1w': ['1D'],
};

// ─── State ──────────────────────────────────────────────────────

/** Track in-progress warms to prevent duplicates */
const _warming = new Set();

/** Track completed warms to skip repeat work */
const _warmed = new Map(); // key → bar count

// ─── Warm History ───────────────────────────────────────────────

/**
 * Background multi-page fetch + OPFS write for a symbol + timeframe.
 * Fills deep history to enable smooth scroll-back without loading.
 *
 * @param {string} sym - Symbol to warm (e.g., 'BTCUSDT')
 * @param {string} tfId - Timeframe to warm (e.g., '15m')
 * @param {Object} opts
 * @param {Function} opts.fetchFn - (sym, tfId) => Promise<Array|null>
 * @param {Function} opts.cacheFn - (sym, tfId, bars) => Promise<void>
 * @param {Function} [opts.getCachedCount] - (sym, tfId) => Promise<number>
 * @param {boolean} [opts.warmAdjacent=true] - Also warm adjacent TFs
 */
export async function warmHistory(sym, tfId, opts = {}) {
    const { fetchFn, cacheFn, getCachedCount, warmAdjacent = true } = opts;
    if (!fetchFn || !cacheFn) return;

    const key = `${sym}:${tfId}`;

    // Skip if already warming or already warmed with sufficient bars
    if (_warming.has(key)) return;

    const target = WARM_TARGETS[tfId] || 5000;
    const alreadyCached = getCachedCount ? await getCachedCount(sym, tfId) : 0;

    if (alreadyCached >= target * 0.8) {
        _warmed.set(key, alreadyCached);
        return; // Already have 80%+ of target
    }

    _warming.add(key);

    // Run in idle callback to avoid blocking UI
    const doWarm = async () => {
        try {
            logger.data.info(
                `[warmHistory] Warming ${sym}@${tfId} — target: ${target} bars, cached: ${alreadyCached}`
            );

            const data = await fetchFn(sym, tfId);
            if (data?.length) {
                await cacheFn(sym, tfId, data);
                _warmed.set(key, data.length);

                logger.data.info(
                    `[warmHistory] Warmed ${sym}@${tfId} — ${data.length} bars written to cache`
                );
            }
        } catch (err) {
            logger.data.warn(`[warmHistory] Failed for ${sym}@${tfId}:`, err);
        } finally {
            _warming.delete(key);
        }
    };

    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(() => doWarm());
    } else {
        setTimeout(() => doWarm(), 100);
    }

    // Optionally warm adjacent timeframes
    if (warmAdjacent) {
        const adjacent = ADJACENT_TFS[tfId] || [];
        for (const adjTf of adjacent) {
            // Recursive call with warmAdjacent=false to prevent chain warming
            warmHistory(sym, adjTf, { ...opts, warmAdjacent: false });
        }
    }
}

/**
 * Check if a symbol + timeframe has been warmed.
 */
export function isWarmed(sym, tfId) {
    return _warmed.has(`${sym}:${tfId}`);
}

/**
 * Get the number of warmed bars for a symbol + timeframe.
 */
export function getWarmedCount(sym, tfId) {
    return _warmed.get(`${sym}:${tfId}`) || 0;
}

/**
 * Clear warm state (e.g., on cache clear).
 */
export function clearWarmState() {
    _warming.clear();
    _warmed.clear();
}

export default {
    warmHistory,
    isWarmed,
    getWarmedCount,
    clearWarmState,
};
