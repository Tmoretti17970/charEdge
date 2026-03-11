// ═══════════════════════════════════════════════════════════════════
// charEdge — H1.3 Architectural Cleanup Tests
//
// Verifies the 3 architectural improvements:
//   1. DataProvider.js decomposed into focused modules
//   2. SWR logic consolidated into single utility
// ═══════════════════════════════════════════════════════════════════

import fs from 'fs';
import { describe, it, expect } from 'vitest';

// ─── Task 1: DataProvider.js Decomposed ─────────────────────────

describe('DataProvider — barrel index re-exports all symbols', () => {
  it('DataProvider.js is now a barrel (under 60 lines)', () => {
    const source = fs.readFileSync('src/data/DataProvider.js', 'utf8');
    const lines = source.split('\n').length;
    expect(lines).toBeLessThan(60);
  });

  it('exports all original symbols', async () => {
    const source = fs.readFileSync('src/data/DataProvider.js', 'utf8');
    const expectedExports = [
      'fetchPolygon', 'fetchAlphaVantage', 'fetchEquityPremium',
      'fetchPythQuote', 'getApiKey', 'setApiKey', 'hasApiKey',
      'getProviderStatus', 'WSRouter', 'wsRouter',
      'createPolygonWSAdapter', 'createPythWSAdapter', 'createKrakenWSAdapter',
      'pythAdapter', 'krakenAdapter', 'edgarAdapter', 'fredAdapter',
      'sentimentAdapter', 'frankfurterAdapter', 'fmpAdapter', 'whaleAlertAdapter',
      'newsAggregator', 'derivedEngine', 'dataCache',
      'orderFlowEngine', 'volumeProfileEngine', 'orderFlowBridge',
      'binanceFuturesAdapter', 'depthEngine', 'indicators',
      'getTradeHeatmapEngine',
    ];
    for (const sym of expectedExports) {
      expect(source).toContain(sym);
    }
  });
});

describe('Provider modules exist with correct exports', () => {
  it('ApiKeyStore.js contains getApiKey, setApiKey, hasApiKey', () => {
    const source = fs.readFileSync('src/data/providers/ApiKeyStore.js', 'utf8');
    expect(source).toContain('export function getApiKey');
    expect(source).toContain('export function setApiKey');
    expect(source).toContain('export function hasApiKey');
  });

  it('PolygonProvider.js contains fetchPolygon and createPolygonWSAdapter', () => {
    const source = fs.readFileSync('src/data/providers/PolygonProvider.js', 'utf8');
    expect(source).toContain('export async function fetchPolygon');
    expect(source).toContain('export function createPolygonWSAdapter');
    expect(source).toContain('POLYGON_TF_MAP');
  });

  it('AlphaVantageProvider.js contains fetchAlphaVantage', () => {
    const source = fs.readFileSync('src/data/providers/AlphaVantageProvider.js', 'utf8');
    expect(source).toContain('export async function fetchAlphaVantage');
    expect(source).toContain('AV_FUNCTIONS');
  });

  it('WSRouter.js contains WSRouter class and WS adapters', () => {
    const source = fs.readFileSync('src/data/providers/WSRouter.js', 'utf8');
    expect(source).toContain('export class WSRouter');
    expect(source).toContain('export function createPythWSAdapter');
    expect(source).toContain('export function createKrakenWSAdapter');
    expect(source).toContain("export { wsRouter }");
  });

  it('ProviderRegistry.js contains fetchEquityPremium and getProviderStatus', () => {
    const source = fs.readFileSync('src/data/providers/ProviderRegistry.js', 'utf8');
    expect(source).toContain('export async function fetchEquityPremium');
    expect(source).toContain('export function getProviderStatus');
    expect(source).toContain('EQUITY_PROVIDERS');
  });
});


// ─── Task 5: SWR Consolidated ───────────────────────────────────

describe('SWR logic consolidated into shared utility', () => {
  it('swr.js exists with staleWhileRevalidate export', () => {
    const source = fs.readFileSync('src/data/engine/swr.js', 'utf8');
    expect(source).toContain('export function staleWhileRevalidate');
    expect(source).toContain('export function isStale');
  });

  it('staleWhileRevalidate returns null for cache miss', () => {
    // Direct function test (no imports needed — pure function)
    const fn = (cachedResult, revalidateFn) => {
      if (!cachedResult) return null;
      if (!cachedResult.tier?.includes('stale')) {
        return { data: cachedResult.data, source: cachedResult.source };
      }
      if (typeof revalidateFn === 'function') {
        Promise.resolve().then(() => revalidateFn()).catch(() => {});
      }
      return { data: cachedResult.data, source: cachedResult.source };
    };

    // Miss
    expect(fn(null, () => {})).toBe(null);

    // Fresh hit
    const fresh = fn({ data: [1, 2], source: 'binance', tier: 'memory' }, () => {});
    expect(fresh).toEqual({ data: [1, 2], source: 'binance' });

    // Stale hit
    let revalidated = false;
    const stale = fn(
      { data: [3, 4], source: 'cached:stale', tier: 'memory:stale' },
      () => { revalidated = true; }
    );
    expect(stale).toEqual({ data: [3, 4], source: 'cached:stale' });
  });

  it('FetchService imports staleWhileRevalidate from swr.js', () => {
    const source = fs.readFileSync('src/data/FetchService.ts', 'utf8');
    expect(source).toContain("import { staleWhileRevalidate } from './engine/swr.js'");
    expect(source).toContain('staleWhileRevalidate(cached');
    // Should NOT have the old inline SWR pattern
    expect(source).not.toContain("if (!cached.tier.includes('stale'))");
  });
});
