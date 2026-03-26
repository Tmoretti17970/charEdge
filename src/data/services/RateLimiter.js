// ═══════════════════════════════════════════════════════════════════
// charEdge — Rate Limiter + Request Queue
//
// Shared request queue with per-source rate limits, request dedup,
// priority queue, and exponential backoff on 429s.
// ═══════════════════════════════════════════════════════════════════

const DEFAULT_LIMITS = {
  kalshi: { maxPerSecond: 10, maxConcurrent: 3 },
  polymarket: { maxPerSecond: 5, maxConcurrent: 3 },
  metaculus: { maxPerSecond: 2, maxConcurrent: 1 },
  manifold: { maxPerSecond: 10, maxConcurrent: 3 },
  drift: { maxPerSecond: 5, maxConcurrent: 2 },
};

class RateLimiter {
  constructor() {
    this._queues = new Map(); // sourceId → request[]
    this._inflight = new Map(); // sourceId → count
    this._lastRequest = new Map(); // sourceId → timestamp
    this._backoff = new Map(); // sourceId → backoff ms
    this._dedupCache = new Map(); // url → { promise, expiresAt }
  }

  /**
   * Execute a fetch with rate limiting.
   * @param {string} sourceId - Source identifier (kalshi, polymarket, etc.)
   * @param {string} url - Request URL (used for dedup)
   * @param {Function} fetchFn - Async function to execute
   * @param {Object} opts - { priority: 'high'|'normal', dedupTTL: ms }
   * @returns {Promise<any>}
   */
  async execute(sourceId, url, fetchFn, { priority: _priority = 'normal', dedupTTL = 5000 } = {}) {
    // Dedup: Return cached result if same URL was fetched recently
    const cached = this._dedupCache.get(url);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.promise;
    }

    const limits = DEFAULT_LIMITS[sourceId] || { maxPerSecond: 5, maxConcurrent: 2 };

    // Wait for rate limit + backoff
    await this._waitForSlot(sourceId, limits);

    // Track inflight
    this._inflight.set(sourceId, (this._inflight.get(sourceId) || 0) + 1);
    this._lastRequest.set(sourceId, Date.now());

    const promise = fetchFn()
      .then((result) => {
        this._inflight.set(sourceId, Math.max(0, (this._inflight.get(sourceId) || 1) - 1));
        this._backoff.delete(sourceId); // Reset backoff on success
        return result;
      })
      .catch((err) => {
        this._inflight.set(sourceId, Math.max(0, (this._inflight.get(sourceId) || 1) - 1));

        // Handle 429 with exponential backoff
        if (err.status === 429 || err.message?.includes('429')) {
          const currentBackoff = this._backoff.get(sourceId) || 1000;
          this._backoff.set(sourceId, Math.min(currentBackoff * 2, 60000));
          // eslint-disable-next-line no-console
          console.warn(`[RateLimiter] ${sourceId} rate limited, backing off ${currentBackoff}ms`);
        }

        throw err;
      });

    // Cache for dedup
    if (dedupTTL > 0) {
      this._dedupCache.set(url, { promise, expiresAt: Date.now() + dedupTTL });
    }

    return promise;
  }

  /**
   * Wait until a request slot is available.
   */
  async _waitForSlot(sourceId, limits) {
    // Check backoff
    const backoff = this._backoff.get(sourceId);
    if (backoff) {
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }

    // Check concurrent limit
    const inflight = this._inflight.get(sourceId) || 0;
    if (inflight >= limits.maxConcurrent) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return this._waitForSlot(sourceId, limits);
    }

    // Check per-second rate
    const last = this._lastRequest.get(sourceId) || 0;
    const minInterval = 1000 / limits.maxPerSecond;
    const elapsed = Date.now() - last;
    if (elapsed < minInterval) {
      await new Promise((resolve) => setTimeout(resolve, minInterval - elapsed));
    }
  }

  /**
   * Clear dedup cache.
   */
  clearCache() {
    this._dedupCache.clear();
  }

  /**
   * Get current state for debugging.
   */
  getState() {
    return {
      inflight: Object.fromEntries(this._inflight),
      backoff: Object.fromEntries(this._backoff),
      cacheSize: this._dedupCache.size,
    };
  }
}

// Singleton instance
const rateLimiter = new RateLimiter();
export default rateLimiter;
