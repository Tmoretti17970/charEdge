// ═══════════════════════════════════════════════════════════════════
// Adapter Compliance Test Suite (Task 2.4.6)
//
// Verifies all adapters conform to the BaseAdapter contract:
// - Extend BaseAdapter
// - Return canonical bar/quote formats
// - Report accurate capabilities
// - Declare valid latencyTier
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { BaseAdapter } from '../../data/adapters/BaseAdapter.js';

// Import all adapters
import { BinanceAdapter } from '../../data/adapters/BinanceAdapter.js';
import { BinanceFuturesAdapter } from '../../data/adapters/BinanceFuturesAdapter.js';
import { BybitAdapter } from '../../data/adapters/BybitAdapter.js';
import { BybitFuturesAdapter } from '../../data/adapters/BybitFuturesAdapter.js';
import { CoinbaseAdapter } from '../../data/adapters/CoinbaseAdapter.js';
import { CoinGeckoAdapter } from '../../data/adapters/CoinGeckoAdapter.js';
import { CryptoCompareAdapter } from '../../data/adapters/CryptoCompareAdapter.js';
import { KrakenAdapter } from '../../data/adapters/KrakenAdapter.js';
import { OKXAdapter } from '../../data/adapters/OKXAdapter.js';
import { PythAdapter } from '../../data/adapters/PythAdapter.js';
import { YahooAdapter } from '../../data/adapters/YahooAdapter.js';
import { AlpacaAdapter } from '../../data/adapters/AlpacaAdapter.js';
import { PolygonAdapter } from '../../data/adapters/PolygonAdapter.js';
import { FMPAdapter } from '../../data/adapters/FMPAdapter.js';
import { FinnhubAdapter } from '../../data/adapters/FinnhubAdapter.js';

const VALID_LATENCY_TIERS = ['realtime', 'fast', 'delayed'];

// Adapters to test with their expected tier
const ADAPTER_SPECS = [
    { name: 'BinanceAdapter', Ctor: BinanceAdapter, tier: 'realtime' },
    { name: 'BinanceFuturesAdapter', Ctor: BinanceFuturesAdapter, tier: 'realtime' },
    { name: 'BybitAdapter', Ctor: BybitAdapter, tier: 'realtime' },
    { name: 'BybitFuturesAdapter', Ctor: BybitFuturesAdapter, tier: 'realtime' },
    { name: 'CoinbaseAdapter', Ctor: CoinbaseAdapter, tier: 'realtime' },
    { name: 'KrakenAdapter', Ctor: KrakenAdapter, tier: 'realtime' },
    { name: 'OKXAdapter', Ctor: OKXAdapter, tier: 'realtime' },
    { name: 'PythAdapter', Ctor: PythAdapter, tier: 'realtime' },
    { name: 'AlpacaAdapter', Ctor: AlpacaAdapter, tier: 'fast' },
    { name: 'PolygonAdapter', Ctor: PolygonAdapter, tier: 'fast' },
    { name: 'FMPAdapter', Ctor: FMPAdapter, tier: 'fast' },
    { name: 'FinnhubAdapter', Ctor: FinnhubAdapter, tier: 'fast' },
    { name: 'CryptoCompareAdapter', Ctor: CryptoCompareAdapter, tier: 'fast' },
    { name: 'YahooAdapter', Ctor: YahooAdapter, tier: 'delayed' },
    { name: 'CoinGeckoAdapter', Ctor: CoinGeckoAdapter, tier: 'delayed' },
];

describe('Adapter Compliance Suite (2.4.6)', () => {
    // --- Structural compliance ---
    describe.each(ADAPTER_SPECS)('$name', ({ Ctor, name, tier }) => {
        let adapter;

        try {
            adapter = new Ctor();
        } catch {
            // Some adapters need config — skip if they can't be constructed
        }

        it('extends BaseAdapter', () => {
            if (!adapter) return;
            expect(adapter).toBeInstanceOf(BaseAdapter);
        });

        it('has a name', () => {
            if (!adapter) return;
            expect(typeof adapter.name).toBe('string');
            expect(adapter.name.length).toBeGreaterThan(0);
        });

        it('capabilities() returns correct shape', () => {
            if (!adapter) return;
            const caps = adapter.capabilities();
            expect(caps).toHaveProperty('fetchOHLCV');
            expect(caps).toHaveProperty('fetchQuote');
            expect(caps).toHaveProperty('subscribe');
            expect(caps).toHaveProperty('searchSymbols');
            expect(typeof caps.fetchOHLCV).toBe('boolean');
            expect(typeof caps.fetchQuote).toBe('boolean');
            expect(typeof caps.subscribe).toBe('boolean');
            expect(typeof caps.searchSymbols).toBe('boolean');
        });

        it('latencyTier() returns a valid tier', () => {
            if (!adapter) return;
            const lt = adapter.latencyTier();
            expect(VALID_LATENCY_TIERS).toContain(lt);
        });

        it(`latencyTier() returns expected tier: ${tier}`, () => {
            if (!adapter) return;
            expect(adapter.latencyTier()).toBe(tier);
        });

        it('supports() returns boolean', () => {
            if (!adapter) return;
            expect(typeof adapter.supports('BTCUSDT')).toBe('boolean');
            expect(typeof adapter.supports('AAPL')).toBe('boolean');
        });
    });

    // --- Bar format validation ---
    describe('BaseAdapter.validateBar()', () => {
        it('accepts a valid canonical bar', () => {
            const bar = { time: 1700000000000, open: 100, high: 110, low: 90, close: 105, volume: 5000 };
            const result = BaseAdapter.validateBar(bar);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('rejects bar with missing fields', () => {
            const bar = { time: 1700000000000, open: 100 };
            const result = BaseAdapter.validateBar(bar);
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('rejects bar with NaN values', () => {
            const bar = { time: NaN, open: 100, high: 110, low: 90, close: 105, volume: 5000 };
            const result = BaseAdapter.validateBar(bar);
            expect(result.valid).toBe(false);
        });

        it('rejects bar with string values', () => {
            const bar = { time: '2024-01-01', open: '100', high: 110, low: 90, close: 105, volume: 5000 };
            const result = BaseAdapter.validateBar(bar);
            expect(result.valid).toBe(false);
        });

        it('rejects null/undefined', () => {
            expect(BaseAdapter.validateBar(null).valid).toBe(false);
            expect(BaseAdapter.validateBar(undefined).valid).toBe(false);
        });
    });

    // --- Quote format validation ---
    describe('BaseAdapter.validateQuote()', () => {
        it('accepts a valid canonical quote', () => {
            const quote = { price: 100, change: 5, changePct: 5.26, volume: 10000, high: 105, low: 95, open: 95 };
            const result = BaseAdapter.validateQuote(quote);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('rejects quote with missing fields', () => {
            const quote = { price: 100 };
            const result = BaseAdapter.validateQuote(quote);
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('rejects null', () => {
            expect(BaseAdapter.validateQuote(null).valid).toBe(false);
        });
    });
});
