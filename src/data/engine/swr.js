// ═══════════════════════════════════════════════════════════════════
// charEdge — Stale-While-Revalidate Utility
//
// H1.3: Single SWR implementation used by FetchService and CacheManager.
// Replaces inline staleness checks scattered across the data layer.
//
// Pattern:
//   1. Fresh cache hit  → return data (no revalidation)
//   2. Stale cache hit  → return stale data + trigger background refresh
//   3. Cache miss       → return null (caller must network fetch)
// ═══════════════════════════════════════════════════════════════════

import { pipelineLogger } from './infra/DataPipelineLogger.js';

/**
 * Apply stale-while-revalidate logic to a cache result.
 *
 * @param {Object|null} cachedResult - Result from CacheManager.read():
 *   { data: Array, source: string, tier: string } or null
 * @param {Function} revalidateFn - Async function to call for background refresh
 *   when data is stale. Errors are logged but don't break the caller.
 * @returns {{ data: Array, source: string }|null}
 *   - Fresh hit: returns data immediately
 *   - Stale hit: returns stale data + triggers revalidateFn
 *   - Miss: returns null
 */
export function staleWhileRevalidate(cachedResult, revalidateFn) {
  // Cache miss — caller must do a full network fetch
  if (!cachedResult) return null;

  // Fresh hit — return immediately, no revalidation needed
  if (!cachedResult.tier?.includes('stale')) {
    return { data: cachedResult.data, source: cachedResult.source };
  }

  // Stale hit — return data now, revalidate in background
  if (typeof revalidateFn === 'function') {
    // Fire-and-forget: errors are logged but won't break the caller
    Promise.resolve().then(() => revalidateFn()).catch((err) => {
      pipelineLogger.warn('SWR', 'Background revalidation failed', err);
    });
  }

  return { data: cachedResult.data, source: cachedResult.source };
}

/**
 * Check if a cache result is stale.
 *
 * @param {Object|null} cachedResult - Result from CacheManager.read()
 * @returns {boolean}
 */
export function isStale(cachedResult) {
  if (!cachedResult) return false;
  return !!cachedResult.tier?.includes('stale');
}
