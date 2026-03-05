// ═══════════════════════════════════════════════════════════════════
// charEdge — IDB Consolidation Tests
//
// Verifies that all IndexedDB consumers use the unified database
// instead of opening their own standalone databases.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';

// ─── UnifiedDB Module ───────────────────────────────────────────

describe('UnifiedDB — unified database module', () => {
  it('exports openUnifiedDB function', async () => {
    const mod = await import('../../data/UnifiedDB.js');
    expect(typeof mod.openUnifiedDB).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('defines UNIFIED_DB_NAME as charEdge-unified', async () => {
    const mod = await import('../../data/UnifiedDB.js');
    expect(mod.UNIFIED_DB_NAME).toBe('charEdge-unified');
  });
});

// ─── DataCache uses UnifiedDB ───────────────────────────────────

describe('DataCache — uses UnifiedDB', () => {
  it('imports openUnifiedDB from UnifiedDB.js', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/DataCache.ts', 'utf8');
    expect(source).toContain("import { openUnifiedDB } from './UnifiedDB.js'");
  });

  it('does NOT call indexedDB.open directly', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/DataCache.ts', 'utf8');
    expect(source).not.toContain('indexedDB.open');
  });

  it('references charEdge-unified as DB_NAME', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/DataCache.ts', 'utf8');
    expect(source).toContain("'charEdge-unified'");
    expect(source).not.toContain("'charEdge-cache'");
  });
});

// ─── TickPersistence uses UnifiedDB ─────────────────────────────

describe('TickPersistence — uses UnifiedDB', () => {
  it('imports openUnifiedDB from UnifiedDB.js', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/engine/streaming/TickPersistence.js', 'utf8');
    expect(source).toContain("import { openUnifiedDB } from '../../UnifiedDB.js'");
  });

  it('does NOT call indexedDB.open directly', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/engine/streaming/TickPersistence.js', 'utf8');
    expect(source).not.toContain('indexedDB.open');
  });

  it('uses tickMeta store name (renamed from meta)', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/engine/streaming/TickPersistence.js', 'utf8');
    expect(source).toContain("META_STORE = 'tickMeta'");
  });
});

// ─── StorageService uses UnifiedDB ──────────────────────────────

describe('StorageService — uses UnifiedDB', () => {
  it('imports openUnifiedDB from UnifiedDB.js', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/StorageService.ts', 'utf8');
    expect(source).toContain("from './UnifiedDB.js'");
  });

  it('does NOT call indexedDB.open directly', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/StorageService.ts', 'utf8');
    expect(source).not.toContain('indexedDB.open');
  });
});

// ─── Migration Logic ────────────────────────────────────────────

describe('UnifiedDB — migration logic', () => {
  it('defines OLD_DBS list for migration', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/UnifiedDB.js', 'utf8');
    expect(source).toContain("'charEdge-cache'");
    expect(source).toContain("'charEdge-ticks'");
    expect(source).toContain("'charEdge-os-v10'");
  });

  it('has migration flag to prevent re-running', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/UnifiedDB.js', 'utf8');
    expect(source).toContain('charEdge-unified-migrated');
  });

  it('deletes old databases after migration', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/UnifiedDB.js', 'utf8');
    expect(source).toContain('indexedDB.deleteDatabase');
  });
});

// ─── CacheManager — unified public API ──────────────────────────

describe('CacheManager — proxies StorageService CRUD', () => {
  let source;
  beforeAll(async () => {
    const fs = await import('fs');
    source = await fs.promises.readFile('src/data/engine/infra/CacheManager.js', 'utf8');
  });

  it('has _loadStorage() method for lazy StorageService import', () => {
    expect(source).toContain('_loadStorage()');
    expect(source).toContain("import('../../StorageService.ts')");
  });

  it('exposes trades CRUD proxy with all methods', () => {
    expect(source).toContain("this.trades = this._makeCRUDProxy('trades'");
    expect(source).toContain('bulkPut');
    expect(source).toContain('count');
  });

  it('exposes playbooks, notes, tradePlans CRUD proxies', () => {
    expect(source).toContain("this.playbooks");
    expect(source).toContain("this.notes");
    expect(source).toContain("this.tradePlans");
  });

  it('exposes settings proxy with get/set/getAll', () => {
    expect(source).toContain('this.settings');
    expect(source).toContain('settings.get');
    expect(source).toContain('settings.set');
    expect(source).toContain('settings.getAll');
  });

  it('exposes indexed query methods', () => {
    expect(source).toContain('getTradesBySymbol');
    expect(source).toContain('getTradesByDateRange');
  });

  it('exposes quota management methods', () => {
    expect(source).toContain('checkQuota');
    expect(source).toContain('quotaRecovery');
  });

  it('exposes clearAllUserData()', () => {
    expect(source).toContain('clearAllUserData');
  });
});

describe('CacheManager — proxies DataCache domain methods', () => {
  let source;
  beforeAll(async () => {
    const fs = await import('fs');
    source = await fs.promises.readFile('src/data/engine/infra/CacheManager.js', 'utf8');
  });

  it('proxies quote methods', () => {
    expect(source).toContain('getQuote(');
    expect(source).toContain('putQuote(');
  });

  it('proxies fundamentals methods', () => {
    expect(source).toContain('getFundamentals(');
    expect(source).toContain('putFundamentals(');
  });

  it('proxies economic methods', () => {
    expect(source).toContain('getEconomic(');
    expect(source).toContain('putEconomic(');
  });

  it('proxies news methods', () => {
    expect(source).toContain('getNews(');
    expect(source).toContain('putNews(');
  });

  it('proxies sentiment methods', () => {
    expect(source).toContain('getSentiment(');
    expect(source).toContain('putSentiment(');
  });

  it('proxies indicator methods', () => {
    expect(source).toContain('getIndicator(');
    expect(source).toContain('putIndicator(');
  });

  it('proxies derived data methods', () => {
    expect(source).toContain('getDerived(');
    expect(source).toContain('putDerived(');
  });

  it('proxies volume profile methods', () => {
    expect(source).toContain('getVolumeProfile(');
    expect(source).toContain('putVolumeProfile(');
  });

  it('proxies filings methods', () => {
    expect(source).toContain('getFilings(');
    expect(source).toContain('putFilings(');
  });

  it('proxies getOrFetch (stale-while-revalidate)', () => {
    expect(source).toContain('getOrFetch(');
  });

  it('proxies cache eviction methods', () => {
    expect(source).toContain('evictStaleRecords');
    expect(source).toContain('evictIfOverBudget');
    expect(source).toContain('getCacheStats');
  });
});

// ─── Deprecation Notices ────────────────────────────────────────

describe('DataCache — deprecation notice', () => {
  it('has @deprecated comment pointing to CacheManager', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/DataCache.ts', 'utf8');
    expect(source).toContain('@deprecated');
    expect(source).toContain('CacheManager');
  });
});

describe('StorageService — deprecation notice', () => {
  it('has @deprecated comment pointing to CacheManager', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/StorageService.ts', 'utf8');
    expect(source).toContain('@deprecated');
    expect(source).toContain('CacheManager');
  });
});

// ─── DataProvider barrel re-exports CacheManager ────────────────

describe('DataProvider — exports cacheManager', () => {
  it('re-exports cacheManager from CacheManager.js', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/DataProvider.js', 'utf8');
    expect(source).toContain("cacheManager");
    expect(source).toContain("CacheManager.js");
  });
});

