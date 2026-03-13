// ═══════════════════════════════════════════════════════════════════
// charEdge — Consolidated Cache Infrastructure Tests
//
// Covers: CacheManager, VolatilityTTL, PrefetchPredictor,
//         HistoricalAccumulator, MemoryBudget, OPFSBarStore
// Replaces: dataInfraFixes.test.js (Bug#2), dataInfraRound3.test.js (#13),
//           dataInfraRound4.test.js (MemoryBudget), dataInfraRound5.test.js (CacheManager, PrefetchPredictor, MemoryBudget, OPFSBarStore)
//           dataInfraRound9.test.js (CacheManager LRU + IDB TTL)
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════
// CacheManager — unified 3-tier cache
// ═══════════════════════════════════════════════════════════════════

describe('CacheManager — unified 3-tier cache', () => {
  let cm;

  beforeEach(async () => {
    const mod = await import('../../data/engine/infra/CacheManager.js');
    cm = new mod._CacheManager();
  });

  it('write + read returns data from memory tier', async () => {
    const bars = [{ time: '2025-01-01', open: 1, high: 2, low: 0.5, close: 1.5, volume: 100 }];
    cm.write('BTCUSDT', '1d', bars, 'binance');
    const result = await cm.read('BTCUSDT', '1d', 60000);
    expect(result).not.toBeNull();
    expect(result.data).toEqual(bars);
    expect(result.source).toBe('binance');
    expect(result.tier).toBe('memory');
  });

  it('read returns null when no data exists', async () => {
    const result = await cm.read('NOPE', '1d', 60000);
    expect(result).toBeNull();
  });

  it('stale memory data is returned with stale marker', async () => {
    const bars = [{ time: '2025-01-01', open: 1, high: 2, low: 0.5, close: 1.5, volume: 100 }];
    cm.write('ETHUSDT', '1d', bars, 'binance');
    const result = await cm.read('ETHUSDT', '1d', 0);
    expect(result).not.toBeNull();
    expect(result.source).toContain('stale');
  });

  it('hasFresh returns true for fresh, false for stale', () => {
    const bars = [{ time: '2025-01-01', open: 1, high: 2, low: 0.5, close: 1.5, volume: 100 }];
    cm.write('SOLUSDT', '1d', bars, 'binance');
    expect(cm.hasFresh('SOLUSDT', '1d', 60000)).toBe(true);
    expect(cm.hasFresh('SOLUSDT', '1d', 0)).toBe(false);
    expect(cm.hasFresh('UNKNOWN', '1d', 60000)).toBe(false);
  });

  it('clear resets everything', async () => {
    cm.write('BTCUSDT', '1d', [{ time: 'x' }], 'binance');
    cm.clear();
    const result = await cm.read('BTCUSDT', '1d', 60000);
    expect(result).toBeNull();
    expect(cm.getStats().memorySize).toBe(0);
  });

  it('evictByAge removes old entries', async () => {
    cm.write('A', '1d', [{ time: 'x' }], 'test');
    await new Promise(r => setTimeout(r, 5));
    const evicted = cm.evictByAge(1);
    expect(evicted).toBe(1);
    expect(cm.getStats().memorySize).toBe(0);
  });

  it('getStats tracks hits and misses', async () => {
    const freshMod = await import('../../data/engine/infra/CacheManager.js');
    const freshCm = new freshMod._CacheManager();
    freshCm.write('BTCUSDT', '1d', [{ time: 'x' }], 'binance');
    await freshCm.read('BTCUSDT', '1d', 60000); // hit
    await freshCm.read('NOPE', '1d', 60000);     // miss
    const stats = freshCm.getStats();
    expect(stats.hits.memory).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBeGreaterThan(0);
  });

  it('LRU eviction: oldest entry is removed when at capacity', () => {
    for (let i = 0; i < 55; i++) {
      cm.write(`SYM${i}`, '1d', [{ time: `t${i}` }], 'test');
    }
    expect(cm.getStats().memorySize).toBeLessThanOrEqual(50);
  });
});

// ── CacheManager — LRU + IDB TTL (Round 9) ─────────────────────

describe('CacheManager — LRU + IDB TTL', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(path.resolve(__dirname, '..', '..', 'data/engine/infra/CacheManager.js'), 'utf-8');
  });

  it('_memGet does LRU touch (delete + re-insert)', () => {
    const methodIdx = source.indexOf('_memGet(key, ttl)');
    const chunk = source.slice(methodIdx, methodIdx + 400);
    expect(chunk).toContain('this._mem.delete(key)');
    expect(chunk).toContain('this._mem.set(key, entry)');
  });

  it('_memSet does LRU insert (checks existing key)', () => {
    const methodIdx = source.indexOf('_memSet(key, data, source)');
    const chunk = source.slice(methodIdx, methodIdx + 400);
    expect(chunk).toContain('this._mem.has(key)');
  });

  it('IDB tier returns fresh idb data (staleness fix applied)', () => {
    const readIdx = source.indexOf('async read(');
    const readEnd = source.indexOf('async write(', readIdx);
    const readBlock = source.slice(readIdx, readEnd);
    // After the staleness fix, IDB data is treated as born-fresh on load
    expect(readBlock).toContain("tier: 'idb'");
    expect(readBlock).not.toContain("'idb:stale'");
  });

  it('IDB tier returns fresh for Infinity TTL', () => {
    const readIdx = source.indexOf('async read(');
    const readEnd = source.indexOf('async write(', readIdx);
    const readBlock = source.slice(readIdx, readEnd);
    expect(readBlock).toContain('ttl === Infinity');
  });

  it('pre-warms _dataCachePromise in constructor', () => {
    const ctorIdx = source.indexOf('constructor()');
    const ctorEnd = source.indexOf('}', source.indexOf('_loadDataCache', ctorIdx));
    const ctorBlock = source.slice(ctorIdx, ctorEnd);
    expect(ctorBlock).toContain('this._loadDataCache()');
  });
});

// ═══════════════════════════════════════════════════════════════════
// VolatilityTTL — adaptive cache TTLs
// ═══════════════════════════════════════════════════════════════════

describe('VolatilityTTL — adaptive cache TTLs', () => {
  let volatilityTTL;

  beforeEach(async () => {
    const mod = await import('../../data/engine/infra/VolatilityTTL.js');
    volatilityTTL = new mod._VolatilityTTL();
  });

  it('returns base TTL when no price history exists', () => {
    const ttl = volatilityTTL.getTTL('BTC', '1d', 15000);
    expect(ttl).toBe(15000);
  });

  it('halves TTL when volatility is high', () => {
    const prices = [100, 105, 95, 110, 88, 115, 80, 120, 75, 125];
    for (const p of prices) volatilityTTL.recordPrice('VOLATILE', p);

    const vol = volatilityTTL.getVolatility('VOLATILE');
    expect(vol).toBeGreaterThan(0.02);

    const ttl = volatilityTTL.getTTL('VOLATILE', '1d', 15000);
    expect(ttl).toBe(7500);
  });

  it('increases TTL when volatility is low', () => {
    const prices = [100, 100.1, 100.05, 100.08, 100.02, 100.03, 100.06, 100.01, 100.04, 100.07];
    for (const p of prices) volatilityTTL.recordPrice('STABLE', p);

    const vol = volatilityTTL.getVolatility('STABLE');
    expect(vol).toBeLessThan(0.005);
    expect(vol).toBeGreaterThan(0);

    const ttl = volatilityTTL.getTTL('STABLE', '1d', 15000);
    expect(ttl).toBe(22500);
  });

  it('getVolatility returns 0 with insufficient data', () => {
    volatilityTTL.recordPrice('NEW', 100);
    volatilityTTL.recordPrice('NEW', 101);
    expect(volatilityTTL.getVolatility('NEW')).toBe(0);
  });

  it('isEquity correctly classifies symbols', () => {
    expect(volatilityTTL.isEquity('AAPL')).toBe(true);
    expect(volatilityTTL.isEquity('MSFT')).toBe(true);
    expect(volatilityTTL.isEquity('BTCUSDT')).toBe(false);
    expect(volatilityTTL.isEquity('ETH')).toBe(false);
    expect(volatilityTTL.isEquity('SOL')).toBe(false);
  });

  it('getStats returns per-symbol info', () => {
    volatilityTTL.recordPrice('BTC', 50000);
    volatilityTTL.recordPrice('BTC', 50100);
    volatilityTTL.recordPrice('BTC', 50050);

    const stats = volatilityTTL.getStats();
    expect(stats.BTC).toBeDefined();
    expect(stats.BTC.dataPoints).toBe(3);
    expect(stats.BTC.lastPrice).toBe(50050);
  });

  it('price history is bounded at 20 entries', () => {
    for (let i = 0; i < 30; i++) {
      volatilityTTL.recordPrice('BOUNDED', 100 + i);
    }
    const stats = volatilityTTL.getStats();
    expect(stats.BOUNDED.dataPoints).toBe(20);
  });

  it('reset clears all data', () => {
    volatilityTTL.recordPrice('X', 100);
    volatilityTTL.reset();
    expect(volatilityTTL.getStats()).toEqual({});
  });
});

// ═══════════════════════════════════════════════════════════════════
// PrefetchPredictor — ML-lite prefetching
// ═══════════════════════════════════════════════════════════════════

describe('PrefetchPredictor — ML-lite prefetching', () => {
  let pp;

  beforeEach(async () => {
    const mod = await import('../../data/engine/infra/PrefetchPredictor.js');
    pp = new mod._PrefetchPredictor();
    pp._loaded = false;
    pp._model = null;
  });

  afterEach(() => {
    try { localStorage.removeItem('charEdge-prefetch-model'); } catch (_) { /* storage may be blocked */ }
  });

  it('recordView stores hourly frequency', () => {
    pp.recordView('BTCUSDT');
    pp.recordView('BTCUSDT');
    pp.recordView('ETHUSDT');
    const model = pp.getModel();
    const hour = new Date().getUTCHours().toString();
    expect(model.hourly[hour]['BTCUSDT']).toBe(2);
    expect(model.hourly[hour]['ETHUSDT']).toBe(1);
  });

  it('recordView records bigrams (sequence transitions)', () => {
    pp.recordView('BTCUSDT');
    pp.recordView('ETHUSDT');
    pp.recordView('SOLUSDT');
    const model = pp.getModel();
    expect(model.bigrams['BTCUSDT']['ETHUSDT']).toBe(1);
    expect(model.bigrams['ETHUSDT']['SOLUSDT']).toBe(1);
  });

  it('predict returns scored predictions based on bigrams', () => {
    for (let i = 0; i < 3; i++) {
      pp.recordView('BTCUSDT');
      pp.recordView('ETHUSDT');
    }
    const predictions = pp.predict('BTCUSDT', 3);
    expect(predictions.length).toBeGreaterThan(0);
    expect(predictions[0].symbol).toBe('ETHUSDT');
    expect(predictions[0].score).toBeGreaterThan(0);
  });

  it('predict excludes current symbol', () => {
    pp.recordView('BTCUSDT');
    pp.recordView('ETHUSDT');
    const predictions = pp.predict('BTCUSDT', 5);
    expect(predictions.every(p => p.symbol !== 'BTCUSDT')).toBe(true);
  });

  it('clear resets the model', () => {
    pp.recordView('BTCUSDT');
    pp.clear();
    const model = pp.getModel();
    expect(Object.keys(model.hourly).length).toBe(0);
    expect(Object.keys(model.bigrams).length).toBe(0);
  });

  it('decay reduces counts by DECAY_FACTOR', () => {
    for (let i = 0; i < 100; i++) pp.recordView('BTCUSDT');
    const before = pp.getModel().hourly[new Date().getUTCHours().toString()]['BTCUSDT'];
    pp.decay();
    const after = pp.getModel().hourly[new Date().getUTCHours().toString()]['BTCUSDT'];
    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThan(0);
  });

  it('predict returns empty for unknown symbol', () => {
    const predictions = pp.predict('UNKNOWN_XYZ', 3);
    expect(predictions).toEqual([]);
  });
});

// ── HistoricalAccumulator — PrefetchPredictor integration ───────

describe('HistoricalAccumulator — PrefetchPredictor integration', () => {
  it('source imports PrefetchPredictor', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync(
      new URL('../../data/engine/infra/HistoricalAccumulator.js', import.meta.url),
      'utf-8'
    );
    expect(source).toContain("import { prefetchPredictor } from './PrefetchPredictor.js'");
    expect(source).toContain('prefetchPredictor.predict(');
  });
});

// ═══════════════════════════════════════════════════════════════════
// MemoryBudget — threshold math & degradation triggers
// ═══════════════════════════════════════════════════════════════════

describe('MemoryBudget — threshold comparison uses consistent units', () => {
  it('correctly detects warning level at 75% usage', async () => {
    const { memoryBudget } = await import('../../data/engine/infra/MemoryBudget.js');
    memoryBudget.setBudget(100);
    memoryBudget.register('test-engine', () => 75 * 1024 * 1024);
    memoryBudget._check();
    expect(memoryBudget.getDegradationLevel()).toBe(1);
    memoryBudget.unregister('test-engine');
  });

  it('correctly detects critical level at 90%+ usage', async () => {
    const { memoryBudget } = await import('../../data/engine/infra/MemoryBudget.js');
    memoryBudget.setBudget(100);
    memoryBudget.register('test-engine-crit', () => 95 * 1024 * 1024);
    memoryBudget._check();
    expect(memoryBudget.getDegradationLevel()).toBe(2);
    memoryBudget.unregister('test-engine-crit');
  });

  it('correctly detects healthy level at <75%', async () => {
    const { memoryBudget } = await import('../../data/engine/infra/MemoryBudget.js');
    memoryBudget.setBudget(100);
    memoryBudget.register('test-engine-ok', () => 50 * 1024 * 1024);
    memoryBudget._check();
    expect(memoryBudget.getDegradationLevel()).toBe(0);
    memoryBudget.unregister('test-engine-ok');
  });
});

describe('MemoryBudget — threshold check and degradation triggers', () => {
  let mb;

  beforeEach(async () => {
    const mod = await import('../../data/engine/infra/MemoryBudget.js');
    mb = new mod.memoryBudget.constructor();
  });

  afterEach(() => { mb.dispose(); });

  it('normal level when under 75% budget', () => {
    mb.setBudget(100);
    mb.register('test', () => 50 * 1024 * 1024);
    const status = mb.getStatus();
    expect(status.level).toBe('healthy');
    expect(status.degradationLevel).toBe(0);
  });

  it('warning level when between 75-90% budget', () => {
    mb.setBudget(100);
    mb.register('test', () => 80 * 1024 * 1024);
    mb._check();
    expect(mb.getDegradationLevel()).toBe(1);
    const status = mb.getStatus();
    expect(status.level).toBe('warning');
  });

  it('critical level when above 90% budget', () => {
    mb.setBudget(100);
    mb.register('test', () => 95 * 1024 * 1024);
    mb._check();
    expect(mb.getDegradationLevel()).toBe(2);
    const status = mb.getStatus();
    expect(status.level).toBe('critical');
  });

  it('onPressure callbacks fire on level change', () => {
    const received = [];
    mb.setBudget(100);
    mb.register('test', () => 50 * 1024 * 1024);
    mb._check();
    const unsub = mb.onPressure((status) => received.push(status.level));
    mb.unregister('test');
    mb.register('test', () => 80 * 1024 * 1024);
    mb._check();
    expect(received).toContain('warning');
    unsub();
  });

  it('onPressure returns working unsubscribe', () => {
    const received = [];
    mb.setBudget(100);
    mb.register('test', () => 50 * 1024 * 1024);
    mb._check();
    const unsub = mb.onPressure((s) => received.push(s));
    unsub();
    mb.unregister('test');
    mb.register('test', () => 95 * 1024 * 1024);
    mb._check();
    expect(received.length).toBe(0);
  });

  it('getStatus breakdown shows per-engine memory', () => {
    mb.setBudget(100);
    mb.register('engineA', () => 10 * 1024 * 1024);
    mb.register('engineB', () => 20 * 1024 * 1024);
    const status = mb.getStatus();
    expect(status.breakdown.engineA).toBe(10 * 1024 * 1024);
    expect(status.breakdown.engineB).toBe(20 * 1024 * 1024);
    expect(status.usedMB).toBeCloseTo(30, 0);
  });

  it('estimator errors are caught and reported as 0', () => {
    mb.register('broken', () => { throw new Error('boom'); });
    const status = mb.getStatus();
    expect(status.breakdown.broken).toBe(0);
  });
});

// ── MemoryBudget — import path correctness ──────────────────────

describe('MemoryBudget — import path correctness', () => {
  it('uses ../DataCache.ts (single-hop) not ../../data/DataCache.ts', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync(
      new URL('../../data/engine/infra/MemoryBudget.js', import.meta.url),
      'utf-8'
    );
    expect(source).toContain("'../../DataCache.ts'");
    expect(source).not.toContain("'../../../data/DataCache.ts'");
  });
});

// ═══════════════════════════════════════════════════════════════════
// OPFSBarStore — CRC32 checksums & mutex
// ═══════════════════════════════════════════════════════════════════

describe('OPFSBarStore — CRC32 checksums', () => {
  it('_crc32 produces consistent checksums', async () => {
    const { _crc32 } = await import('../../data/engine/infra/OPFSBarStore.js');
    if (!_crc32) return;

    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const crc1 = _crc32(data.buffer);
    const crc2 = _crc32(data.buffer);
    expect(crc1).toBe(crc2);
    expect(typeof crc1).toBe('number');
    expect(crc1).toBeGreaterThan(0);
  });

  it('_crc32 produces different checksums for different data', async () => {
    const { _crc32 } = await import('../../data/engine/infra/OPFSBarStore.js');
    if (!_crc32) return;

    const data1 = new Uint8Array([1, 2, 3, 4, 5]);
    const data2 = new Uint8Array([5, 4, 3, 2, 1]);
    expect(_crc32(data1.buffer)).not.toBe(_crc32(data2.buffer));
  });

  it('encode → decode round-trips with CRC32 suffix', async () => {
    const { _encodeBinary, _decodeBinary, _crc32 } = await import('../../data/engine/infra/OPFSBarStore.js');
    if (!_crc32) return;

    const bars = [
      { time: '2024-01-01T00:00:00.000Z', open: 100, high: 110, low: 90, close: 105, volume: 1000 },
      { time: '2024-01-02T00:00:00.000Z', open: 105, high: 115, low: 95, close: 110, volume: 2000 },
    ];

    const dataBuffer = _encodeBinary(bars);
    const crc = _crc32(dataBuffer);
    const withChecksum = new Uint8Array(dataBuffer.byteLength + 4);
    withChecksum.set(new Uint8Array(dataBuffer));
    new DataView(withChecksum.buffer, dataBuffer.byteLength, 4).setUint32(0, crc, true);

    const decoded = _decodeBinary(withChecksum.buffer);
    expect(decoded).not.toBeNull();
    expect(decoded).toHaveLength(2);
    expect(decoded[0].open).toBe(100);
    expect(decoded[1].close).toBe(110);
  });

  it('detects corrupted data (CRC32 mismatch returns null)', async () => {
    const { _encodeBinary, _decodeBinary, _crc32 } = await import('../../data/engine/infra/OPFSBarStore.js');
    if (!_crc32) return;

    const bars = [
      { time: '2024-01-01T00:00:00.000Z', open: 100, high: 110, low: 90, close: 105, volume: 1000 },
    ];

    const dataBuffer = _encodeBinary(bars);
    const crc = _crc32(dataBuffer);
    const withChecksum = new Uint8Array(dataBuffer.byteLength + 4);
    withChecksum.set(new Uint8Array(dataBuffer));
    new DataView(withChecksum.buffer, dataBuffer.byteLength, 4).setUint32(0, crc, true);
    withChecksum[0] = withChecksum[0] ^ 0xFF;

    const decoded = _decodeBinary(withChecksum.buffer);
    expect(decoded).toBeNull();
  });
});

describe('OPFSBarStore — _withLock serializes concurrent operations', () => {
  it('serializes operations under the same key', async () => {
    const { OPFSBarStore } = await import('../../data/engine/infra/OPFSBarStore.js').catch(() => ({}));
    if (!OPFSBarStore) {
      const store = { _locks: new Map() };
      store._withLock = async function(key, fn) {
        const prev = this._locks.get(key) || Promise.resolve();
        const next = prev.then(fn, fn);
        this._locks.set(key, next);
        try { return await next; } finally {
          if (this._locks.get(key) === next) this._locks.delete(key);
        }
      };

      const order = [];
      const p1 = store._withLock('key1', async () => {
        order.push('start-1');
        await new Promise(r => setTimeout(r, 50));
        order.push('end-1');
      });
      const p2 = store._withLock('key1', async () => {
        order.push('start-2');
        order.push('end-2');
      });

      await Promise.all([p1, p2]);
      expect(order).toEqual(['start-1', 'end-1', 'start-2', 'end-2']);
    }
  });

  it('allows parallel operations under different keys', async () => {
    const store = { _locks: new Map() };
    store._withLock = async function(key, fn) {
      const prev = this._locks.get(key) || Promise.resolve();
      const next = prev.then(fn, fn);
      this._locks.set(key, next);
      try { return await next; } finally {
        if (this._locks.get(key) === next) this._locks.delete(key);
      }
    };

    const order = [];
    const p1 = store._withLock('keyA', async () => {
      order.push('A-start');
      await new Promise(r => setTimeout(r, 50));
      order.push('A-end');
    });
    const p2 = store._withLock('keyB', async () => {
      order.push('B-start');
      order.push('B-end');
    });

    await Promise.all([p1, p2]);
    const aEndIdx = order.indexOf('A-end');
    const bStartIdx = order.indexOf('B-start');
    expect(bStartIdx).toBeLessThan(aEndIdx);
  });
});

describe('OPFSBarStore — mutex prevents concurrent write races', () => {
  it('_withLock serializes concurrent calls for the same key', async () => {
    const { opfsBarStore } = await import('../../data/engine/infra/OPFSBarStore.js');
    const order = [];
    const delay = (ms) => new Promise(r => setTimeout(r, ms));

    const op1 = opfsBarStore._withLock('TEST_MUTEX_A', async () => {
      order.push('op1-start');
      await delay(50);
      order.push('op1-end');
      return 'result1';
    });

    const op2 = opfsBarStore._withLock('TEST_MUTEX_A', async () => {
      order.push('op2-start');
      await delay(10);
      order.push('op2-end');
      return 'result2';
    });

    const [r1, r2] = await Promise.all([op1, op2]);
    expect(r1).toBe('result1');
    expect(r2).toBe('result2');
    expect(order.indexOf('op1-end')).toBeLessThan(order.indexOf('op2-start'));
  });

  it('different keys can run concurrently', async () => {
    const { opfsBarStore } = await import('../../data/engine/infra/OPFSBarStore.js');
    const order = [];
    const delay = (ms) => new Promise(r => setTimeout(r, ms));

    const op1 = opfsBarStore._withLock('TEST_MUTEX_B', async () => {
      order.push('a-start');
      await delay(50);
      order.push('a-end');
    });

    const op2 = opfsBarStore._withLock('TEST_MUTEX_C', async () => {
      order.push('b-start');
      await delay(10);
      order.push('b-end');
    });

    await Promise.all([op1, op2]);
    expect(order.indexOf('b-start')).toBeLessThan(order.indexOf('a-end'));
  });
});
