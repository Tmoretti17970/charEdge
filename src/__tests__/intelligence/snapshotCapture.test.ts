// ═══════════════════════════════════════════════════════════════════
// charEdge — Batch 7: Snapshot Capture Tests (Tasks 4.1.1–2)
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';

describe('4.1.1 — TradeSnapshot (types)', () => {
    it('createSnapshot returns valid snapshot shape', async () => {
        const { createSnapshot } = await import('../../types/TradeSnapshot.ts');
        const snapshot = createSnapshot({
            symbol: 'BTC',
            timeframe: '1h',
            price: 50000,
            indicators: { rsi_14: 65, sma_20: 49500 },
        });

        expect(snapshot).toHaveProperty('capturedAt');
        expect(snapshot).toHaveProperty('price', 50000);
        expect(snapshot).toHaveProperty('symbol', 'BTC');
        expect(snapshot).toHaveProperty('timeframe', '1h');
        expect(snapshot.indicators).toHaveProperty('rsi_14', 65);
        expect(snapshot.indicators).toHaveProperty('sma_20', 49500);
        expect(typeof snapshot.capturedAt).toBe('number');
        expect(snapshot.capturedAt).toBeGreaterThan(0);
    });

    it('createSnapshot includes optional fields when provided', async () => {
        const { createSnapshot } = await import('../../types/TradeSnapshot.ts');
        const snapshot = createSnapshot({
            symbol: 'ETH',
            timeframe: '5m',
            price: 3000,
            indicators: {},
            bid: 2999.5,
            ask: 3000.5,
            volumeBar: 1500,
            volume24h: 1_000_000,
        });

        expect(snapshot.bid).toBe(2999.5);
        expect(snapshot.ask).toBe(3000.5);
        expect(snapshot.spread).toBeCloseTo(1.0, 2);
        expect(snapshot.volumeBar).toBe(1500);
        expect(snapshot.volume24h).toBe(1_000_000);
    });

    it('indicatorKey produces correct format', async () => {
        const { indicatorKey } = await import('../../types/TradeSnapshot.ts');

        expect(indicatorKey({ indicatorId: 'sma', params: { period: 20 } })).toBe('sma_20');
        expect(indicatorKey({ type: 'ema', params: { length: 50 } })).toBe('ema_50');
        expect(indicatorKey({ indicatorId: 'rsi', params: { period: 14 } })).toBe('rsi_14');
        expect(indicatorKey({ indicatorId: 'vwap' })).toBe('vwap');
        expect(indicatorKey({})).toBe('unknown');
    });
});

describe('4.1.1 — TradeSnapshot (intelligence/)', () => {
    it('captureTradeSnapshot returns full snapshot', async () => {
        const mod = await import('../../intelligence/TradeSnapshot.ts');
        const snapshot = mod.captureTradeSnapshot({
            symbol: 'AAPL',
            side: 'long',
            entryPrice: 150,
            quantity: 10,
            timeframe: '1d',
        });

        expect(snapshot).toHaveProperty('id');
        expect(snapshot).toHaveProperty('timestamp');
        expect(snapshot).toHaveProperty('symbol', 'AAPL');
        expect(snapshot).toHaveProperty('side', 'long');
        expect(snapshot).toHaveProperty('entryPrice', 150);
        expect(snapshot).toHaveProperty('quantity', 10);
        expect(typeof snapshot.id).toBe('string');
        expect(snapshot.id.length).toBeGreaterThan(0);
    });

    it('closeTradeSnapshot computes P&L', async () => {
        const mod = await import('../../intelligence/TradeSnapshot.ts');
        const entry = mod.captureTradeSnapshot({
            symbol: 'BTC',
            side: 'long',
            entryPrice: 50000,
            quantity: 1,
            timeframe: '1h',
        });

        const closed = mod.closeTradeSnapshot(entry, 52000);
        expect(closed.exitPrice).toBe(52000);
        expect(closed.pnl).toBe(2000);
        expect(closed.outcome).toBe('win');
    });

    it('closeTradeSnapshot handles loss', async () => {
        const mod = await import('../../intelligence/TradeSnapshot.ts');
        const entry = mod.captureTradeSnapshot({
            symbol: 'ETH',
            side: 'long',
            entryPrice: 3000,
            quantity: 2,
            timeframe: '5m',
        });

        const closed = mod.closeTradeSnapshot(entry, 2900);
        expect(closed.pnl).toBe(-200);
        expect(closed.outcome).toBe('loss');
    });

    it('querySnapshots filters by symbol', async () => {
        const mod = await import('../../intelligence/TradeSnapshot.ts');
        // loadSnapshots returns whatever is in localStorage
        const all = mod.loadSnapshots();
        const btc = mod.querySnapshots({ symbol: 'BTC' });
        // All returned items should have the matching symbol
        for (const s of btc) {
            expect(s.symbol).toBe('BTC');
        }
    });
});
