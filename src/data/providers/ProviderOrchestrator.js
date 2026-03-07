// ═══════════════════════════════════════════════════════════════════
// charEdge — Provider Orchestrator (Task 2.10.2.1 + C2.2 + C2.3)
//
// Budget-aware scheduler with API key round-robin integration.
// Tracks per-provider request counts vs known limits, routes to
// provider with most remaining headroom, and rotates API keys
// with race failover and Retry-After cooldowns.
//
// Known limits:
//   • Polygon:        5 req/min
//   • FMP:          250 req/day
//   • Alpha Vantage:  25 req/day
//   • Binance:     1200 req/min
//   • Tiingo:        50 req/hr
// ═══════════════════════════════════════════════════════════════════

import { logger } from '../../../utils/logger';
import {
    setRateBudget,
    getRemainingBudget,
    checkRateBudget,
} from '../../engine/infra/CircuitBreaker.ts';
import { apiKeyRoundRobin, ApiKeyRoundRobin } from './ApiKeyRoundRobin.js';

// ─── Provider Budget Definitions ────────────────────────────────

const PROVIDER_BUDGETS = {
    polygon: { maxRequests: 5, windowMs: 60_000 },        // 5 req/min
    fmp: { maxRequests: 250, windowMs: 86_400_000 },    // 250 req/day
    alphavantage: { maxRequests: 25, windowMs: 86_400_000 },    // 25 req/day
    tiingo: { maxRequests: 50, windowMs: 3_600_000 },     // 50 req/hr
    binance: { maxRequests: 1200, windowMs: 60_000 },        // 1200 req/min
};

// ─── Initialization ─────────────────────────────────────────────

let _initialized = false;

/**
 * Initialize rate budgets for all known providers.
 * Safe to call multiple times — only runs once.
 */
export function initProviderBudgets() {
    if (_initialized) return;
    _initialized = true;

    for (const [name, budget] of Object.entries(PROVIDER_BUDGETS)) {
        setRateBudget(name, budget.maxRequests, budget.windowMs);
    }

    logger.data.info('[ProviderOrchestrator] Rate budgets initialized for:', Object.keys(PROVIDER_BUDGETS).join(', '));
}

/**
 * Register API keys for round-robin rotation (C2.2).
 * Call this at app startup with keys from config/env.
 *
 * @param {string} providerId - Provider identifier
 * @param {string[]} keys - Array of API keys
 */
export function registerProviderKeys(providerId, keys) {
    if (keys?.length) {
        apiKeyRoundRobin.addProvider(providerId, keys);
    }
}

// ─── Orchestrator ───────────────────────────────────────────────

/**
 * @typedef {Object} ProviderEntry
 * @property {string} id - Provider identifier (must match PROVIDER_BUDGETS key)
 * @property {string} name - Display name
 * @property {Function} fetch - (sym, tfId) => Promise<Array|null>
 * @property {Function} [fetchWithKey] - (key, sym, tfId) => Promise<Array|null> (for round-robin)
 */

/**
 * Budget-aware fetch that routes to the provider with the most remaining
 * headroom. If the provider has round-robin keys registered, uses race
 * failover for maximum reliability.
 *
 * @param {Array<ProviderEntry>} providers - Ordered provider list
 * @param {string} sym - Symbol to fetch
 * @param {string} tfId - Timeframe ID
 * @returns {Promise<{data: Array|null, source: string|null}>}
 */
export async function fetchWithBudget(providers, sym, tfId) {
    initProviderBudgets();

    // Sort providers by remaining budget (most headroom first)
    const ranked = [...providers]
        .map((p) => ({
            ...p,
            remaining: getRemainingBudget(p.id),
        }))
        .filter((p) => p.remaining > 0) // Skip exhausted providers
        .sort((a, b) => b.remaining - a.remaining);

    if (ranked.length === 0) {
        logger.data.warn('[ProviderOrchestrator] All providers exhausted for', sym, tfId);
        return { data: null, source: null };
    }

    for (const provider of ranked) {
        // Double-check budget (may have changed since sort)
        if (!checkRateBudget(provider.id)) continue;

        try {
            let data;

            // C2.2: If round-robin keys are registered, use race failover
            if (apiKeyRoundRobin.hasProvider(provider.id) && provider.fetchWithKey) {
                const result = await apiKeyRoundRobin.race(
                    provider.id,
                    (key) => provider.fetchWithKey(key, sym, tfId),
                );
                data = result?.data;
            } else {
                // Fallback: direct fetch without key rotation
                data = await provider.fetch(sym, tfId);
            }

            if (data?.length > 1) {
                logger.data.info(
                    `[ProviderOrchestrator] ${provider.name} returned ${data.length} bars for ${sym}@${tfId} (${provider.remaining - 1} budget remaining)`
                );
                return { data, source: provider.id };
            }
        } catch (err) {
            // C2.3: Parse Retry-After from 429 errors for cooldown tracking
            if (err?.status === 429 || err?.response?.status === 429) {
                const retryAfter = err?.response?.headers?.get?.('Retry-After');
                const retryMs = ApiKeyRoundRobin.parseRetryAfter(retryAfter);
                logger.data.warn(
                    `[ProviderOrchestrator] ${provider.name} rate-limited (429), cooldown: ${retryMs || 'default'}ms`
                );
            }
            logger.data.warn(`[ProviderOrchestrator] ${provider.name} failed for ${sym}:`, err);
        }
    }

    return { data: null, source: null };
}

/**
 * Fetch a specific page/range from a provider.
 * Uses round-robin keys when available (C2.2).
 *
 * @param {string} providerId - Provider to use (e.g., 'binance')
 * @param {Function} fetchFn - (sym, tfId, fromMs, toMs) => Promise<Array|null>
 * @param {string} sym - Symbol
 * @param {string} tfId - Timeframe ID
 * @param {number} fromMs - Start timestamp (ms)
 * @param {number} toMs - End timestamp (ms)
 * @param {Function} [fetchWithKeyFn] - (key, sym, tfId, fromMs, toMs) => Promise<Array|null>
 * @returns {Promise<Array|null>}
 */
export async function fetchPage(providerId, fetchFn, sym, tfId, fromMs, toMs, fetchWithKeyFn) {
    initProviderBudgets();

    const remaining = getRemainingBudget(providerId);
    if (remaining <= 0) {
        logger.data.warn(`[ProviderOrchestrator] ${providerId} budget exhausted, cannot fetch page`);
        return null;
    }

    if (!checkRateBudget(providerId)) return null;

    try {
        // C2.2: Use round-robin when keys are available
        if (apiKeyRoundRobin.hasProvider(providerId) && fetchWithKeyFn) {
            const result = await apiKeyRoundRobin.race(
                providerId,
                (key) => fetchWithKeyFn(key, sym, tfId, fromMs, toMs),
            );
            return result?.data || null;
        }

        return await fetchFn(sym, tfId, fromMs, toMs);
    } catch (err) {
        logger.data.warn(`[ProviderOrchestrator] fetchPage failed for ${providerId}:`, err);
        return null;
    }
}

/**
 * Get remaining budget for all providers.
 * Useful for UI display (e.g., adapter health dashboard).
 */
export function getProviderBudgets() {
    initProviderBudgets();

    const result = {};
    for (const id of Object.keys(PROVIDER_BUDGETS)) {
        const remaining = getRemainingBudget(id);
        result[id] = {
            remaining,
            max: PROVIDER_BUDGETS[id].maxRequests,
            windowMs: PROVIDER_BUDGETS[id].windowMs,
            exhausted: remaining <= 0,
            // C2.2: Include round-robin key status
            roundRobin: apiKeyRoundRobin.hasProvider(id)
                ? apiKeyRoundRobin.getStatus()[id]
                : null,
        };
    }
    return result;
}

export default {
    fetchWithBudget,
    fetchPage,
    getProviderBudgets,
    initProviderBudgets,
    registerProviderKeys,
};
