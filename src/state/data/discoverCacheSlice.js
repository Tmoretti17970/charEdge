// ═══════════════════════════════════════════════════════════════════
// charEdge — Discover Cache Slice
//
// Multi-layer caching with stale-while-revalidate,
// request deduplication, and TTL-based invalidation.
// Extracted from useDiscoverCache for useDataStore composition.
// ═══════════════════════════════════════════════════════════════════

export const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
export const STALE_TTL = 30 * 60 * 1000;  // 30 minutes (serve stale while fetching)

export const createDiscoverCacheSlice = (set, get) => ({
  // ─── Cache Storage ─────────────────────────────────────────────
  // Shape: { [key]: { data, fetchedAt, ttl, status: 'fresh'|'stale'|'expired' } }
  entries: {},

  // ─── In-flight deduplication ───────────────────────────────────
  // Shape: { [key]: Promise }
  inflight: {},

  // ─── Actions ───────────────────────────────────────────────────

  /**
   * Get cached data for a key. Returns { data, status } or null.
   * status: 'fresh' | 'stale' | 'expired' | null
   */
  get: (key) => {
    const entry = get().entries[key];
    if (!entry) return null;

    const age = Date.now() - entry.fetchedAt;
    const ttl = entry.ttl || DEFAULT_TTL;

    if (age < ttl) {
      return { data: entry.data, status: 'fresh' };
    }
    if (age < STALE_TTL) {
      return { data: entry.data, status: 'stale' };
    }
    return { data: entry.data, status: 'expired' };
  },

  /**
   * Store data in cache with optional TTL override.
   */
  put: (key, data, ttl = DEFAULT_TTL) =>
    set((s) => ({
      entries: {
        ...s.entries,
        [key]: { data, fetchedAt: Date.now(), ttl },
      },
    })),

  /**
   * Fetch with deduplication + stale-while-revalidate.
   * If data exists and is fresh, returns immediately.
   * If stale, returns stale data and triggers background refetch.
   * If expired or missing, fetches fresh.
   *
   * @param {string} key - Cache key
   * @param {Function} fetcher - Async function that returns data
   * @param {number} ttl - Optional TTL in ms
   * @returns {Promise<any>} - Resolved data
   */
  fetchWithCache: async (key, fetcher, ttl = DEFAULT_TTL) => {
    const { get: cacheGet, put, inflight } = get();
    const cached = cacheGet(key);

    // Fresh — return immediately
    if (cached && cached.status === 'fresh') {
      return cached.data;
    }

    // Deduplicate in-flight requests
    if (inflight[key]) {
      return inflight[key];
    }

    // Create fetch promise
    const fetchPromise = (async () => {
      try {
        const data = await fetcher();
        put(key, data, ttl);
        return data;
      } finally {
        // Remove from inflight
        set((s) => {
          const next = { ...s.inflight };
          delete next[key];
          return { inflight: next };
        });
      }
    })();

    // Register as inflight
    set((s) => ({ inflight: { ...s.inflight, [key]: fetchPromise } }));

    // Stale — return stale data, let fetch run in background
    if (cached && cached.status === 'stale') {
      fetchPromise.catch((err) => console.warn('[DiscoverCache] Background refetch failed:', err?.message));
      return cached.data;
    }

    // Expired or missing — wait for fetch
    return fetchPromise;
  },

  /**
   * Invalidate a specific cache entry.
   */
  invalidate: (key) =>
    set((s) => {
      const next = { ...s.entries };
      delete next[key];
      return { entries: next };
    }),

  /**
   * Invalidate all entries matching a prefix.
   */
  invalidateByPrefix: (prefix) =>
    set((s) => {
      const next = {};
      for (const key in s.entries) {
        if (!key.startsWith(prefix)) {
          next[key] = s.entries[key];
        }
      }
      return { entries: next };
    }),

  /**
   * Clear all cached data.
   */
  clearAll: () => set({ entries: {}, inflight: {} }),

  /**
   * Get cache statistics.
   */
  getStats: () => {
    const { entries } = get();
    const keys = Object.keys(entries);
    let fresh = 0, stale = 0, expired = 0;
    const now = Date.now();

    for (const key of keys) {
      const entry = entries[key];
      const age = now - entry.fetchedAt;
      const ttl = entry.ttl || DEFAULT_TTL;

      if (age < ttl) fresh++;
      else if (age < STALE_TTL) stale++;
      else expired++;
    }

    return { total: keys.length, fresh, stale, expired };
  },
});
