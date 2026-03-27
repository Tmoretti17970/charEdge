import { describe, it, expect, beforeEach, vi } from 'vitest';

// Import RateLimiter class by resetting modules
let RateLimiterModule;

describe('RateLimiter', () => {
  let rateLimiter;

  beforeEach(async () => {
    vi.resetModules();
    RateLimiterModule = await import('../../data/services/RateLimiter.js');
    rateLimiter = RateLimiterModule.default;
    rateLimiter.clearCache();
  });

  describe('execute', () => {
    it('executes a fetch function', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
      const result = await rateLimiter.execute('kalshi', 'https://api.example.com/test', fetchFn);
      expect(result).toEqual({ data: 'test' });
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('deduplicates same-URL requests within TTL (sequential)', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
      // First call caches the result
      const r1 = await rateLimiter.execute('kalshi', 'https://api.example.com/dedup', fetchFn);
      // Second call should use cached result
      const r2 = await rateLimiter.execute('kalshi', 'https://api.example.com/dedup', fetchFn);
      expect(r1).toEqual(r2);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('re-fetches after dedup TTL expires', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
      await rateLimiter.execute('kalshi', 'https://api.example.com/ttl', fetchFn, { dedupTTL: 1 });
      await new Promise((resolve) => setTimeout(resolve, 5));
      await rateLimiter.execute('kalshi', 'https://api.example.com/ttl', fetchFn, { dedupTTL: 1 });
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    it('propagates errors', async () => {
      const fetchFn = vi.fn().mockRejectedValue(new Error('Network error'));
      await expect(rateLimiter.execute('kalshi', 'https://api.example.com/err', fetchFn)).rejects.toThrow(
        'Network error',
      );
    });

    it('sets backoff on 429 errors', async () => {
      const error = new Error('429 Too Many Requests');
      error.status = 429;
      const fetchFn = vi.fn().mockRejectedValue(error);

      await expect(
        rateLimiter.execute('metaculus', 'https://api.example.com/429', fetchFn, { dedupTTL: 0 }),
      ).rejects.toThrow();

      const state = rateLimiter.getState();
      expect(state.backoff.metaculus).toBeGreaterThan(0);
    });
  });

  describe('clearCache', () => {
    it('clears the dedup cache', async () => {
      const fetchFn = vi.fn().mockResolvedValue('cached');
      await rateLimiter.execute('kalshi', 'https://api.example.com/clear', fetchFn);
      rateLimiter.clearCache();

      await rateLimiter.execute('kalshi', 'https://api.example.com/clear', fetchFn);
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('getState', () => {
    it('returns internal state', () => {
      const state = rateLimiter.getState();
      expect(state).toHaveProperty('inflight');
      expect(state).toHaveProperty('backoff');
      expect(state).toHaveProperty('cacheSize');
    });
  });
});
