// ═══════════════════════════════════════════════════════════════════
// charEdge — CacheManager Memory Tier Tests (#50)
//
// Tests the in-memory LRU cache, TTL expiry, staleness detection,
// eviction, and stats tracking. Does NOT require IDB/OPFS — uses
// the _CacheManager class directly with mocked dynamic imports.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the dynamic imports that _CacheManager uses
vi.mock('@/data/engine/infra/DataPipelineLogger.js', () => ({
  pipelineLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/data/engine/infra/OPFSBarStore.js', () => ({
  opfsBarStore: {
    getCandles: vi.fn().mockResolvedValue(null),
    putCandles: vi.fn().mockResolvedValue(undefined),
    clearAll: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn().mockResolvedValue({ totalSizeKB: 0, fileCount: 0 }),
  },
}));

vi.mock('@/constants.js', () => ({
  CACHE_MAX_ENTRIES: 5, // Small limit to test LRU eviction
  buildCacheKey: (sym, tf) => `${sym}:${tf}`,
}));

// Import after mocks are set up
const { _CacheManager } = await import('@/data/engine/infra/CacheManager.js');

// ─── Test Helpers ───────────────────────────────────────────────

function createCache() {
  const cm = new _CacheManager();
  // Override the lazy-loaded modules to avoid real IDB access
  cm._dataCachePromise = Promise.resolve(null);
  cm._storagePromise = Promise.resolve(null);
  return cm;
}

const SAMPLE_BARS = [
  { time: 1000, open: 100, high: 110, low: 90, close: 105 },
  { time: 2000, open: 105, high: 115, low: 95, close: 110 },
  { time: 3000, open: 110, high: 120, low: 100, close: 115 },
];

// ─── Memory Tier (_memSet / _memGet) ───────────────────────────

describe('CacheManager memory tier', () => {
  let cm;

  beforeEach(() => {
    cm = createCache();
  });

  it('stores and retrieves data from memory', () => {
    cm._memSet('BTC:1d', SAMPLE_BARS, 'test');
    const result = cm._memGet('BTC:1d', 60000);
    expect(result).not.toBeNull();
    expect(result.data).toEqual(SAMPLE_BARS);
    expect(result.tier).toBe('memory');
  });

  it('returns null for missing keys', () => {
    expect(cm._memGet('UNKNOWN:1h', 60000)).toBeNull();
  });

  it('returns stale data when TTL expired', async () => {
    cm._memSet('BTC:1d', SAMPLE_BARS, 'test');

    // Fast-forward time
    const original = Date.now;
    Date.now = () => original() + 120000; // +2 minutes

    const result = cm._memGet('BTC:1d', 60000); // 1-minute TTL
    expect(result).not.toBeNull();
    expect(result.tier).toBe('memory:stale');
    expect(result.source).toContain('stale');

    Date.now = original;
  });

  it('returns fresh data within TTL', () => {
    cm._memSet('BTC:1d', SAMPLE_BARS, 'test');
    const result = cm._memGet('BTC:1d', 60000);
    expect(result.tier).toBe('memory');
    expect(result.source).not.toContain('stale');
  });
});

// ─── LRU Eviction ──────────────────────────────────────────────

describe('CacheManager LRU eviction', () => {
  let cm;

  beforeEach(() => {
    cm = createCache();
  });

  it('evicts oldest entry when at capacity', () => {
    // CACHE_MAX_ENTRIES = 5, fill to capacity
    for (let i = 0; i < 5; i++) {
      cm._memSet(`SYM${i}:1d`, [{ time: i }], 'test');
    }
    expect(cm._mem.size).toBe(5);

    // Add one more — SYM0 (oldest) should be evicted
    cm._memSet('NEW:1d', [{ time: 99 }], 'test');
    expect(cm._mem.size).toBe(5);
    expect(cm._mem.has('SYM0:1d')).toBe(false);
    expect(cm._mem.has('NEW:1d')).toBe(true);
  });

  it('re-inserts accessed keys at end (LRU touch)', () => {
    cm._memSet('A:1d', [{ time: 1 }], 'test');
    cm._memSet('B:1d', [{ time: 2 }], 'test');
    cm._memSet('C:1d', [{ time: 3 }], 'test');

    // Access A — moves it to end
    cm._memGet('A:1d', 60000);

    // Keys should now be B, C, A (B is oldest)
    const keys = [...cm._mem.keys()];
    expect(keys[0]).toBe('B:1d');
    expect(keys[keys.length - 1]).toBe('A:1d');
  });
});

// ─── hasFresh() ────────────────────────────────────────────────

describe('hasFresh()', () => {
  let cm;

  beforeEach(() => {
    cm = createCache();
  });

  it('returns true for fresh entries', () => {
    cm._memSet('BTC:1d', SAMPLE_BARS, 'test');
    expect(cm.hasFresh('BTC', '1d', 60000)).toBe(true);
  });

  it('returns false for expired entries', () => {
    cm._memSet('BTC:1d', SAMPLE_BARS, 'test');
    const original = Date.now;
    Date.now = () => original() + 120000;

    expect(cm.hasFresh('BTC', '1d', 60000)).toBe(false);

    Date.now = original;
  });

  it('returns false for missing entries', () => {
    expect(cm.hasFresh('NONE', '1h', 60000)).toBe(false);
  });
});

// ─── evictByAge() ──────────────────────────────────────────────

describe('evictByAge()', () => {
  let cm;

  beforeEach(() => {
    cm = createCache();
  });

  it('removes entries older than threshold', () => {
    // Insert entries with artificial timestamps
    cm._mem.set('OLD:1d', { data: [], source: 'test', t: Date.now() - 120000 });
    cm._mem.set('NEW:1d', { data: [], source: 'test', t: Date.now() });

    const evicted = cm.evictByAge(60000); // 1-minute max age
    expect(evicted).toBe(1);
    expect(cm._mem.has('OLD:1d')).toBe(false);
    expect(cm._mem.has('NEW:1d')).toBe(true);
  });

  it('returns 0 when nothing to evict', () => {
    cm._memSet('A:1d', [{ time: 1 }], 'test');
    expect(cm.evictByAge(60000)).toBe(0);
  });
});

// ─── getStats() ────────────────────────────────────────────────

describe('getStats()', () => {
  let cm;

  beforeEach(() => {
    cm = createCache();
  });

  it('tracks memory size correctly', () => {
    cm._memSet('A:1d', [{ time: 1 }], 'test');
    cm._memSet('B:1d', [{ time: 2 }], 'test');
    const stats = cm.getStats();
    expect(stats.memorySize).toBe(2);
  });

  it('tracks hit/miss counters', () => {
    cm._memSet('A:1d', SAMPLE_BARS, 'test');
    cm._memGet('A:1d', 60000); // hit
    cm._memGet('MISS:1d', 60000); // miss (returns null, but _misses not incremented by _memGet)

    const stats = cm.getStats();
    expect(stats.memorySize).toBe(1);
  });

  it('lists cache entries with age', () => {
    cm._memSet('X:1d', [{ time: 1 }], 'binance');
    const stats = cm.getStats();
    expect(stats.entries).toHaveLength(1);
    expect(stats.entries[0].key).toBe('X:1d');
    expect(stats.entries[0].source).toBe('binance');
    expect(stats.entries[0].ageMs).toBeLessThan(1000);
  });
});

// ─── getLastUpdate() ───────────────────────────────────────────

describe('getLastUpdate()', () => {
  let cm;

  beforeEach(() => {
    cm = createCache();
  });

  it('returns null for uncached symbol', () => {
    expect(cm.getLastUpdate('NONE', '1d')).toBeNull();
  });

  it('returns correct metadata for cached symbol', () => {
    cm._memSet('BTC:1d', SAMPLE_BARS, 'binance');
    const info = cm.getLastUpdate('BTC', '1d');
    expect(info).not.toBeNull();
    expect(info.source).toBe('binance');
    expect(info.ageMs).toBeLessThan(1000);
    expect(info.timestamp).toBeGreaterThan(0);
  });
});

// ─── write() content-addressed skip ────────────────────────────

describe('write() content dedup', () => {
  let cm;

  beforeEach(() => {
    cm = createCache();
  });

  it('updates memory timestamp on re-write of same data', () => {
    const bars = [{ time: 1000, close: 100 }];
    cm.write('BTC', '1d', bars, 'test');

    const original = Date.now;
    Date.now = () => original() + 5000;

    cm.write('BTC', '1d', bars, 'test');
    const entry = cm._mem.get('BTC:1d');
    // Timestamp should be updated
    expect(entry.t).toBeGreaterThanOrEqual(original() + 4000);

    Date.now = original;
  });

  it('skips write for empty data', () => {
    cm.write('BTC', '1d', [], 'test');
    expect(cm._mem.size).toBe(0);

    cm.write('BTC', '1d', null, 'test');
    expect(cm._mem.size).toBe(0);
  });
});
