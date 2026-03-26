// ═══════════════════════════════════════════════════════════════════
// charEdge — Prediction Market Aggregator
//
// Orchestrates fetches across all prediction market adapters.
// Handles parallel loading, source prioritization, error isolation,
// deduplication, and market enrichment.
// ═══════════════════════════════════════════════════════════════════

import { fetchDriftMarkets } from '../adapters/DriftAdapter.js';
import { fetchKalshiEvents, fetchKalshiMarkets } from '../adapters/KalshiAdapter.js';
import { fetchManifoldMarkets } from '../adapters/ManifoldAdapter.js';
import { fetchMetaculusMarkets } from '../adapters/MetaculusAdapter.js';
import { fetchPolymarketEvents, fetchPolymarketMarkets } from '../adapters/PolymarketAdapter.js';
import { deduplicateMarkets } from './PredictionDeduplicator.js';
import { computeStats } from './PredictionStatsService.js';
import { classifyTimeframe } from './TimeClassifier.js';
import { generateTags } from './TopicTagGenerator.js';

// ─── Source registry ───────────────────────────────────────────────

const SOURCE_REGISTRY = new Map([
  ['kalshi', {
    id: 'kalshi',
    label: 'Kalshi',
    fetchEvents: fetchKalshiEvents,
    fetchMarkets: fetchKalshiMarkets,
    enabled: true,
    weight: 1.0,
    lastError: null,
    fetchCount: 0,
    lastFetch: null,
  }],
  ['polymarket', {
    id: 'polymarket',
    label: 'Polymarket',
    fetchEvents: fetchPolymarketEvents,
    fetchMarkets: fetchPolymarketMarkets,
    enabled: true,
    weight: 1.0,
    lastError: null,
    fetchCount: 0,
    lastFetch: null,
  }],
  ['metaculus', {
    id: 'metaculus',
    label: 'Metaculus',
    fetchEvents: null,
    fetchMarkets: fetchMetaculusMarkets,
    enabled: true,
    weight: 0.8,
    lastError: null,
    fetchCount: 0,
    lastFetch: null,
  }],
  ['manifold', {
    id: 'manifold',
    label: 'Manifold',
    fetchEvents: null,
    fetchMarkets: fetchManifoldMarkets,
    enabled: true,
    weight: 0.7,
    lastError: null,
    fetchCount: 0,
    lastFetch: null,
  }],
  ['drift', {
    id: 'drift',
    label: 'Drift',
    fetchEvents: null,
    fetchMarkets: fetchDriftMarkets,
    enabled: true,
    weight: 0.6,
    lastError: null,
    fetchCount: 0,
    lastFetch: null,
  }],
]);

// ═══════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetch and aggregate markets from all enabled sources.
 * @param {Object} opts
 * @param {string} [opts.category] - Filter by category
 * @param {number} [opts.limit=100] - Per-source limit
 * @param {boolean} [opts.useEvents=true] - Use events API (multi-outcome) when available
 * @returns {Promise<AggregatedResult>}
 */
export async function fetchAllMarkets({ category, limit = 100, useEvents = true } = {}) {
  const enabledSources = [...SOURCE_REGISTRY.values()].filter(s => s.enabled);
  const fetchStart = Date.now();

  // Parallel fetch from all sources
  const results = await Promise.allSettled(
    enabledSources.map(async (source) => {
      const fetchFn = useEvents && source.fetchEvents ? source.fetchEvents : source.fetchMarkets;
      try {
        const markets = await fetchFn({ category, limit });
        source.lastError = null;
        source.fetchCount++;
        source.lastFetch = Date.now();
        return { sourceId: source.id, markets, error: null };
      } catch (err) {
        source.lastError = err.message;
        return { sourceId: source.id, markets: [], error: err.message };
      }
    })
  );

  // Collect all markets and source statuses
  const allMarkets = [];
  const sourceStatus = {};

  for (const result of results) {
    const data = result.status === 'fulfilled' ? result.value : { sourceId: 'unknown', markets: [], error: result.reason?.message };
    sourceStatus[data.sourceId] = {
      count: data.markets.length,
      error: data.error,
      latency: Date.now() - fetchStart,
    };
    allMarkets.push(...data.markets);
  }

  // Deduplicate across sources
  const { markets: dedupedMarkets, duplicatesRemoved } = deduplicateMarkets(allMarkets);

  // Enrich with time classification
  const enrichedMarkets = dedupedMarkets.map(m => ({
    ...m,
    timeframe: classifyTimeframe(m.closeDate),
  }));

  // Sort by 24h volume descending (default)
  enrichedMarkets.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));

  // Generate topic tags across all markets
  const topicTags = generateTags(enrichedMarkets);

  // Compute aggregate stats
  const stats = computeStats(enrichedMarkets);

  return {
    markets: enrichedMarkets,
    totalCount: enrichedMarkets.length,
    sourceStatus,
    duplicatesRemoved,
    topicTags,
    stats,
    fetchDuration: Date.now() - fetchStart,
  };
}

/**
 * Get source registry status.
 */
export function getSourceStatus() {
  const status = {};
  for (const [id, source] of SOURCE_REGISTRY) {
    status[id] = {
      enabled: source.enabled,
      lastError: source.lastError,
      fetchCount: source.fetchCount,
      lastFetch: source.lastFetch,
    };
  }
  return status;
}

/**
 * Enable or disable a source.
 */
export function setSourceEnabled(sourceId, enabled) {
  const source = SOURCE_REGISTRY.get(sourceId);
  if (source) source.enabled = enabled;
}

/**
 * Register a new source adapter.
 */
export function registerSource(id, config) {
  SOURCE_REGISTRY.set(id, {
    id,
    label: config.label || id,
    fetchEvents: config.fetchEvents || null,
    fetchMarkets: config.fetchMarkets,
    enabled: config.enabled ?? true,
    weight: config.weight ?? 1.0,
    lastError: null,
    fetchCount: 0,
    lastFetch: null,
  });
}
