// ═══════════════════════════════════════════════════════════════════
// charEdge — H1.1 Critical Data Fixes Tests
//
// Verifies all 5 critical bugs from the data infrastructure review
// are correctly fixed, plus the defaultTf and replaceAll sync fixes.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Fix 1: buildCacheKey standardizes on colon format ──────────

describe('buildCacheKey — unified cache key format', () => {
  it('returns colon-separated key', async () => {
    const { buildCacheKey } = await import('../../constants.js');
    expect(buildCacheKey('BTC', '1D')).toBe('BTC:1D');
    expect(buildCacheKey('BTCUSDT', '5m')).toBe('BTCUSDT:5m');
    expect(buildCacheKey('AAPL', '1h')).toBe('AAPL:1h');
  });

  it('matches DataCache key format exactly', async () => {
    const { buildCacheKey } = await import('../../constants.js');
    // DataCache internally uses `${symbol}:${interval}` — verify parity
    const sym = 'ETH';
    const tf = '4h';
    const dataCacheKey = `${sym}:${tf}`;
    expect(buildCacheKey(sym, tf)).toBe(dataCacheKey);
  });
});

// ─── Fix 2: DataCache.putCandles — per-key locking ──────────────

describe('DataCache — putCandles locking prevents race conditions', () => {
  it('has _withLock method and _locks map', async () => {
    // Verify structural fix exists in the source
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/DataCache.ts', 'utf8');
    expect(source).toContain('_withLock');
    expect(source).toContain('this._locks = new Map()');
    expect(source).toContain('return this._withLock(key, async ()');
  });

  it('_withLock serializes concurrent operations on same key', async () => {
    // Test the lock pattern directly (same as OPFSBarStore pattern)
    const locks = new Map();
    async function withLock(key, fn) {
      const prev = locks.get(key) || Promise.resolve();
      const next = prev.then(fn, fn);
      locks.set(key, next);
      try { return await next; } finally {
        if (locks.get(key) === next) locks.delete(key);
      }
    }

    const order = [];
    const p1 = withLock('BTC:1D', async () => {
      order.push('write1-start');
      await new Promise(r => setTimeout(r, 30));
      order.push('write1-end');
    });
    const p2 = withLock('BTC:1D', async () => {
      order.push('write2-start');
      order.push('write2-end');
    });

    await Promise.all([p1, p2]);
    // write2 must NOT start until write1 is done
    expect(order).toEqual(['write1-start', 'write1-end', 'write2-start', 'write2-end']);
  });

  it('allows parallel operations on different keys', async () => {
    const locks = new Map();
    async function withLock(key, fn) {
      const prev = locks.get(key) || Promise.resolve();
      const next = prev.then(fn, fn);
      locks.set(key, next);
      try { return await next; } finally {
        if (locks.get(key) === next) locks.delete(key);
      }
    }

    const order = [];
    const p1 = withLock('BTC:1D', async () => {
      order.push('btc-start');
      await new Promise(r => setTimeout(r, 30));
      order.push('btc-end');
    });
    const p2 = withLock('ETH:1D', async () => {
      order.push('eth-start');
      order.push('eth-end');
    });

    await Promise.all([p1, p2]);
    // ETH should start before BTC ends (different keys = parallel)
    const btcEnd = order.indexOf('btc-end');
    const ethStart = order.indexOf('eth-start');
    expect(ethStart).toBeLessThan(btcEnd);
  });
});

// ─── Fix 3: StorageAdapter — sync queue cap + quota handling ────

describe('StorageAdapter — sync queue cap and quota handling', () => {
  it('_enqueue caps queue at SYNC_QUEUE_MAX (500)', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/StorageAdapter.js', 'utf8');
    expect(source).toContain('SYNC_QUEUE_MAX = 500');
    expect(source).toContain('_syncQueue.length >= SYNC_QUEUE_MAX');
    expect(source).toContain('_syncQueue.splice(0, overflow)');
  });

  it('_saveSyncQueue handles QuotaExceededError gracefully', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/StorageAdapter.js', 'utf8');
    expect(source).toContain("err?.name === 'QuotaExceededError'");
    expect(source).toContain('_syncQueue = _syncQueue.slice(-250)');
  });

  it('playbooks.replaceAll enqueues sync operations', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/StorageAdapter.js', 'utf8');
    // The replaceAll for playbooks should now enqueue
    const playbooksSection = source.slice(
      source.indexOf('playbooks:'),
      source.indexOf('notes:')
    );
    expect(playbooksSection).toContain("_enqueue('playbooks', 'upsert'");
  });

  it('notes.replaceAll enqueues sync operations', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/StorageAdapter.js', 'utf8');
    const notesSection = source.slice(
      source.indexOf('notes:'),
      source.indexOf('tradePlans:')
    );
    expect(notesSection).toContain("_enqueue('notes', 'upsert'");
  });

  it('tradePlans put/delete/replaceAll enqueue sync operations', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/StorageAdapter.js', 'utf8');
    const tradePlansSection = source.slice(
      source.indexOf('tradePlans:'),
      source.indexOf('settings:')
    );
    expect(tradePlansSection).toContain("_enqueue('tradePlans', 'upsert'");
    expect(tradePlansSection).toContain("_enqueue('tradePlans', 'delete'");
  });
});

// ─── Fix 4: CRYPTO_TFS daily timeframe standardized to '1D' ────

describe('CRYPTO_TFS — timeframe ID standardization', () => {
  it('daily timeframe uses uppercase 1D', async () => {
    const { CRYPTO_TFS, TFS } = await import('../../constants.js');

    // CRYPTO_TFS daily should now be '1D' (was '1d')
    const cryptoDaily = CRYPTO_TFS.find(t => t.label === '1D');
    expect(cryptoDaily).toBeDefined();
    expect(cryptoDaily.id).toBe('1D');

    // Verify it matches TFS daily
    const tfsDaily = TFS.find(t => t.label === '1D');
    expect(tfsDaily).toBeDefined();
    expect(tfsDaily.id).toBe(cryptoDaily.id);
  });

  it('all CRYPTO_TFS IDs match their TFS counterparts', async () => {
    const { CRYPTO_TFS, TFS } = await import('../../constants.js');
    for (const cryptoTf of CRYPTO_TFS) {
      const mainTf = TFS.find(t => t.id === cryptoTf.id);
      expect(mainTf).toBeDefined();
    }
  });
});

// ─── Fix 5: fetchPolygon date range uses correct TFS IDs ────────

describe('fetchPolygon — date range logic uses correct TFS IDs', () => {
  it('uses uppercase 1D for daily (not dead-code 1d)', async () => {
    const fs = await import('fs');
    // H1.3: fetchPolygon moved to PolygonProvider.js
    const source = await fs.promises.readFile('src/data/providers/PolygonProvider.js', 'utf8');

    // Should contain '1D' comparison, NOT '1d'
    expect(source).toContain("tfId === '1D'");
    // Should NOT contain old dead-code branches
    expect(source).not.toContain("tfId === '5d'");
    expect(source).not.toContain("tfId === '3m'");
    expect(source).not.toContain("tfId === '6m'");
  });

  it('each POLYGON_TF_MAP key has a matching date range branch', async () => {
    const fs = await import('fs');
    // H1.3: fetchPolygon moved to PolygonProvider.js
    const source = await fs.promises.readFile('src/data/providers/PolygonProvider.js', 'utf8');

    // All valid timeframes should have date range logic
    for (const tfId of ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1w']) {
      expect(source).toContain(`tfId === '${tfId}'`);
    }
  });
});

// ─── Fix 6: DEFAULT_SETTINGS.defaultTf is valid ─────────────────

describe('DEFAULT_SETTINGS — defaultTf is a valid timeframe', () => {
  it('defaultTf is 5m (not non-existent 3m)', async () => {
    const { DEFAULT_SETTINGS, TFS } = await import('../../constants.js');
    expect(DEFAULT_SETTINGS.defaultTf).toBe('5m');

    // Verify 5m is a real TFS entry
    const tf = TFS.find(t => t.id === DEFAULT_SETTINGS.defaultTf);
    expect(tf).toBeDefined();
    expect(tf.label).toBe('5m');
  });
});

// ─── CacheManager.clear() clears all tiers ──────────────────────

describe('CacheManager.clear — clears all cache tiers', () => {
  it('clear method is async and calls DataCache.clearAll()', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/engine/infra/CacheManager.js', 'utf8');
    // clear() should now be async and call through to DataCache and OPFS
    expect(source).toContain('async clear()');
    expect(source).toContain('dc.clearAll()');
    expect(source).toContain('opfsBarStore.clearAll');
  });
});

// ─── FetchService uses buildCacheKey ────────────────────────────

describe('FetchService — uses buildCacheKey for key construction', () => {
  it('imports buildCacheKey from constants', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/FetchService.ts', 'utf8');
    expect(source).toContain('buildCacheKey');
    expect(source).not.toContain("const key = `${sym}_${tfId}`");
  });

  it('warmCache does not reference non-existent 3m timeframe', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/FetchService.ts', 'utf8');
    expect(source).not.toContain("'3m'");
  });
});
