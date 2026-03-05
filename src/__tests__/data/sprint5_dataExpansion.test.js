// ═══════════════════════════════════════════════════════════════════
// charEdge — Sprint 5 Data Expansion Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── 6.5.1: Expanded Crypto List ────────────────────────────────

describe('6.5.1 — Expanded Crypto IDs', () => {
    let CRYPTO_IDS, isCrypto;

    beforeEach(async () => {
        const mod = await import('../../constants/assets.js');
        CRYPTO_IDS = mod.CRYPTO_IDS;
        isCrypto = mod.isCrypto;
    });

    it('has 55+ crypto entries', () => {
        const count = Object.keys(CRYPTO_IDS).length;
        expect(count).toBeGreaterThanOrEqual(55);
    });

    it('includes original 38 symbols', () => {
        expect(CRYPTO_IDS.BTC).toBe('bitcoin');
        expect(CRYPTO_IDS.ETH).toBe('ethereum');
        expect(CRYPTO_IDS.SOL).toBe('solana');
        expect(CRYPTO_IDS.PEPE).toBe('pepe');
        expect(CRYPTO_IDS.AXS).toBe('axie-infinity');
    });

    it('includes new 6.5.1 expansion symbols', () => {
        expect(CRYPTO_IDS.HBAR).toBe('hedera-hashgraph');
        expect(CRYPTO_IDS.VET).toBe('vechain');
        expect(CRYPTO_IDS.XLM).toBe('stellar');
        expect(CRYPTO_IDS.ICP).toBe('internet-computer');
        expect(CRYPTO_IDS.FET).toBe('fetch-ai');
        expect(CRYPTO_IDS.GRT).toBe('the-graph');
        expect(CRYPTO_IDS.THETA).toBe('theta-token');
        expect(CRYPTO_IDS.EOS).toBe('eos');
        expect(CRYPTO_IDS.FLOW).toBe('flow');
        expect(CRYPTO_IDS.XTZ).toBe('tezos');
        expect(CRYPTO_IDS.EGLD).toBe('multiversx');
        expect(CRYPTO_IDS.NEO).toBe('neo');
        expect(CRYPTO_IDS.KAVA).toBe('kava');
        expect(CRYPTO_IDS.ZIL).toBe('zilliqa');
        expect(CRYPTO_IDS.ENJ).toBe('enjincoin');
        expect(CRYPTO_IDS.CHZ).toBe('chiliz');
        expect(CRYPTO_IDS.GALA).toBe('gala');
    });

    it('isCrypto detects new symbols', () => {
        expect(isCrypto('HBAR')).toBe(true);
        expect(isCrypto('XLM')).toBe(true);
        expect(isCrypto('THETA')).toBe(true);
        expect(isCrypto('GALA')).toBe(true);
    });

    it('isCrypto detects USDT-suffixed new symbols', () => {
        expect(isCrypto('HBARUSDT')).toBe(true);
        expect(isCrypto('GALAUSDT')).toBe(true);
        expect(isCrypto('VETUSDT')).toBe(true);
    });

    it('isCrypto still rejects non-crypto', () => {
        expect(isCrypto('AAPL')).toBe(false);
        expect(isCrypto('TSLA')).toBe(false);
        expect(isCrypto('ES')).toBe(false);
    });
});

// ─── 6.5.2: Polygon Adapter ────────────────────────────────────

describe('6.5.2 — PolygonAdapter', () => {
    let PolygonAdapter, polygonAdapter;

    beforeEach(async () => {
        const mod = await import('../../data/adapters/PolygonAdapter.js');
        PolygonAdapter = mod.PolygonAdapter;
        polygonAdapter = mod.polygonAdapter;
    });

    it('exports PolygonAdapter class and singleton', () => {
        expect(PolygonAdapter).toBeDefined();
        expect(polygonAdapter).toBeInstanceOf(PolygonAdapter);
    });

    it('extends BaseAdapter with name "polygon"', () => {
        expect(polygonAdapter.name).toBe('polygon');
    });

    it('isConfigured returns false by default', () => {
        const adapter = new PolygonAdapter();
        expect(adapter.isConfigured).toBe(false);
    });

    it('isConfigured returns true after configure()', () => {
        const adapter = new PolygonAdapter();
        adapter.configure('test-api-key');
        expect(adapter.isConfigured).toBe(true);
    });

    it('supports US equity tickers', () => {
        const adapter = new PolygonAdapter();
        expect(adapter.supports('AAPL')).toBe(true);
        expect(adapter.supports('TSLA')).toBe(true);
        expect(adapter.supports('SPY')).toBe(true);
    });

    it('does not support Binance-style pairs', () => {
        const adapter = new PolygonAdapter();
        expect(adapter.supports('BTCUSDT')).toBe(false);
        expect(adapter.supports('ETHBUSD')).toBe(false);
    });

    it('supports Polygon crypto format (X: prefix)', () => {
        const adapter = new PolygonAdapter();
        expect(adapter.supports('X:BTCUSD')).toBe(true);
    });

    it('throws when fetching without config', async () => {
        const adapter = new PolygonAdapter();
        await expect(adapter.fetchOHLCV('AAPL')).rejects.toThrow('not configured');
    });

    it('returns empty array from searchSymbols without config', async () => {
        const adapter = new PolygonAdapter();
        const results = await adapter.searchSymbols('AAPL');
        expect(results).toEqual([]);
    });

    it('returns noop unsubscribe without config', () => {
        const adapter = new PolygonAdapter();
        const unsub = adapter.subscribe('AAPL', () => { });
        expect(typeof unsub).toBe('function');
        unsub(); // should not throw
    });

    it('dispose clears state', () => {
        const adapter = new PolygonAdapter();
        adapter.dispose();
        // Should not throw
    });
});

// ─── 6.5.4: Symbol Discovery ───────────────────────────────────

describe('6.5.4 — SymbolDiscovery', () => {
    let SymbolDiscovery;

    beforeEach(async () => {
        const mod = await import('../../data/engine/market/SymbolDiscovery.js');
        SymbolDiscovery = mod.SymbolDiscovery;
    });

    it('exports SymbolDiscovery class', () => {
        expect(SymbolDiscovery).toBeDefined();
    });

    it('returns empty array for empty query', async () => {
        const disc = new SymbolDiscovery();
        const results = await disc.search('');
        expect(results).toEqual([]);
    });

    it('returns empty array for null query', async () => {
        const disc = new SymbolDiscovery();
        const results = await disc.search(null);
        expect(results).toEqual([]);
    });

    it('getAdapterStatus returns object', async () => {
        const disc = new SymbolDiscovery();
        const status = await disc.getAdapterStatus();
        expect(typeof status).toBe('object');
    });
});
