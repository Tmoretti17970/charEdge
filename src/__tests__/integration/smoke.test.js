// ═══════════════════════════════════════════════════════════════════
// charEdge — E2E Smoke Test (#52)
//
// Lightweight integration tests that verify critical modules can
// be imported and produce valid output without a browser.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';

// ─── QuantMetrics Import + Basic Computation ────────────────────

describe('QuantMetrics smoke', () => {
  it('imports and computes a valid summary', async () => {
    const { computeQuantSummary } = await import('@/trading/QuantMetrics');
    const summary = computeQuantSummary([100, -50, 200, -30, 150]);
    expect(summary).toHaveProperty('sharpe');
    expect(summary).toHaveProperty('sortino');
    expect(summary).toHaveProperty('totalReturn');
    expect(summary).toHaveProperty('maxDrawdown');
    expect(summary.tradeCount).toBe(5);
    expect(typeof summary.sharpe).toBe('number');
    expect(Number.isFinite(summary.sharpe)).toBe(true);
  });
});

// ─── navigateToTrade Import + Valid Result ──────────────────────

describe('navigateToTrade smoke', () => {
  it('imports and returns a result object for valid trade', async () => {
    const { navigateToTrade } = await import('@/trading/navigateToTrade');
    const result = navigateToTrade({
      date: '2025-06-15T14:30:00Z',
      symbol: 'AAPL',
      id: 'smoke-test',
    });
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('symbol');
    expect(result).toHaveProperty('timestamp');
  });

  it('returns failure for null trade', async () => {
    const { navigateToTrade } = await import('@/trading/navigateToTrade');
    const result = navigateToTrade(null);
    expect(result.success).toBe(false);
  });
});

// ─── Critical Store Imports ─────────────────────────────────────

describe('Store imports smoke', () => {
  it('useJournalStore imports without error', async () => {
    const mod = await import('@/state/useJournalStore');
    expect(mod).toBeDefined();
    expect(mod.useJournalStore).toBeDefined();
  });

  it('useWatchlistStore imports without error', async () => {
    const mod = await import('@/state/useWatchlistStore');
    expect(mod).toBeDefined();
    expect(mod.useWatchlistStore).toBeDefined();
  });

  it('useGamificationStore imports without error', async () => {
    const mod = await import('@/state/useGamificationStore');
    expect(mod).toBeDefined();
    expect(mod.useGamificationStore || mod.default).toBeDefined();
  });
});

// ─── CacheManager Instantiation ─────────────────────────────────

describe('CacheManager smoke', () => {
  it('memory write + hasFresh cycle works', async () => {
    const { _CacheManager } = await import('@/data/engine/infra/CacheManager.js');
    const cm = new _CacheManager();
    // Override IDB/OPFS to avoid real DB access
    cm._dataCachePromise = Promise.resolve(null);
    cm._storagePromise = Promise.resolve(null);

    const bars = [{ time: 1000, close: 42 }];
    cm.write('TEST', '1d', bars, 'smoke');
    expect(cm.hasFresh('TEST', '1d', 60000)).toBe(true);

    const stats = cm.getStats();
    expect(stats.memorySize).toBeGreaterThanOrEqual(1);
  });
});

// ─── useHotkeys Export ─────────────────────────────────────────

describe('useHotkeys smoke', () => {
  it('exports getRegisteredHotkeys', async () => {
    const mod = await import('@/hooks/useHotkeys');
    expect(mod.getRegisteredHotkeys).toBeDefined();
    expect(typeof mod.getRegisteredHotkeys).toBe('function');
    const hotkeys = mod.getRegisteredHotkeys();
    expect(Array.isArray(hotkeys)).toBe(true);
  });
});
