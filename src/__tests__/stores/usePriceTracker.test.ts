// ═══════════════════════════════════════════════════════════════════
// charEdge — Price Tracker + Market Alert Tests
//
// Tests for usePriceTracker store and checkMarketAlerts function:
//   - 52-week high/low tracking
//   - Percentage change computation
//   - Market condition alert evaluation
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import { usePriceTracker, checkMarketAlerts } from '../../state/usePriceTracker';

describe('usePriceTracker', () => {
    beforeEach(() => {
        usePriceTracker.getState().clear();
    });

    // ─── Basic Price Tracking ─────────────────────────────────

    it('initializes stats on first pushPrice', () => {
        usePriceTracker.getState().pushPrice('BTC', 50000);
        const stat = usePriceTracker.getState().getStats('BTC');
        expect(stat).not.toBeNull();
        expect(stat!.symbol).toBe('BTC');
        expect(stat!.lastPrice).toBe(50000);
        expect(stat!.high52w).toBe(50000);
        expect(stat!.low52w).toBe(50000);
    });

    it('uppercases symbol', () => {
        usePriceTracker.getState().pushPrice('eth', 3000);
        expect(usePriceTracker.getState().getStats('ETH')).not.toBeNull();
        expect(usePriceTracker.getState().getStats('eth')).not.toBeNull();
    });

    it('returns null for untracked symbol', () => {
        expect(usePriceTracker.getState().getStats('UNKNOWN')).toBeNull();
    });

    // ─── 52-Week High/Low ─────────────────────────────────────

    it('tracks new 52-week high', () => {
        usePriceTracker.getState().pushPrice('BTC', 50000);
        usePriceTracker.getState().pushPrice('BTC', 55000);
        usePriceTracker.getState().pushPrice('BTC', 52000);

        const stat = usePriceTracker.getState().getStats('BTC');
        expect(stat!.high52w).toBe(55000);
        expect(stat!.lastPrice).toBe(52000);
    });

    it('tracks new 52-week low', () => {
        usePriceTracker.getState().pushPrice('BTC', 50000);
        usePriceTracker.getState().pushPrice('BTC', 45000);
        usePriceTracker.getState().pushPrice('BTC', 48000);

        const stat = usePriceTracker.getState().getStats('BTC');
        expect(stat!.low52w).toBe(45000);
        expect(stat!.lastPrice).toBe(48000);
    });

    it('computes 52w high proximity correctly', () => {
        usePriceTracker.getState().pushPrice('AAPL', 200);
        usePriceTracker.getState().pushPrice('AAPL', 190);

        const proximity = usePriceTracker.getState().get52wHighProximity('AAPL');
        // 190 is 5% below 200
        expect(proximity).toBeCloseTo(-5, 0);
    });

    it('computes 52w low proximity correctly', () => {
        usePriceTracker.getState().pushPrice('AAPL', 100);
        usePriceTracker.getState().pushPrice('AAPL', 110);

        const proximity = usePriceTracker.getState().get52wLowProximity('AAPL');
        // 110 is 10% above 100
        expect(proximity).toBeCloseTo(10, 0);
    });

    // ─── Seed 52w ─────────────────────────────────────────────

    it('seed52w sets historical high/low', () => {
        const highDate = '2025-06-01T00:00:00Z';
        const lowDate = '2025-01-15T00:00:00Z';
        usePriceTracker.getState().seed52w('ETH', 4800, highDate, 2200, lowDate);

        const stat = usePriceTracker.getState().getStats('ETH');
        expect(stat!.high52w).toBe(4800);
        expect(stat!.low52w).toBe(2200);
        expect(stat!.high52wDate).toBe(highDate);
        expect(stat!.low52wDate).toBe(lowDate);
    });

    it('seed52w merges with existing data (keeps better extremes)', () => {
        usePriceTracker.getState().pushPrice('ETH', 3500);
        usePriceTracker.getState().seed52w('ETH', 4000, '2025-06-01T00:00:00Z', 2000, '2025-01-15T00:00:00Z');

        const stat = usePriceTracker.getState().getStats('ETH');
        // seed high (4000) > existing (3500), so use seed
        expect(stat!.high52w).toBe(4000);
        // seed low (2000) < existing (3500), so use seed
        expect(stat!.low52w).toBe(2000);
    });

    // ─── Percentage Change ────────────────────────────────────

    it('returns null percent change for untracked symbol', () => {
        expect(usePriceTracker.getState().getPercentChange('NOBODY', '24h')).toBeNull();
    });

    it('returns percent change relative to reference price', () => {
        // Push initial price (sets reference)
        usePriceTracker.getState().pushPrice('BTC', 50000);
        // Push a new price (within 1h window, so reference stays)
        usePriceTracker.getState().pushPrice('BTC', 52500);

        // All windows should show 5% change since ref was set at init
        const pct = usePriceTracker.getState().getPercentChange('BTC', '1h');
        expect(pct).toBeCloseTo(5, 0);
    });

    // ─── clear ────────────────────────────────────────────────

    it('clear removes all stats', () => {
        usePriceTracker.getState().pushPrice('BTC', 50000);
        usePriceTracker.getState().pushPrice('ETH', 3000);
        usePriceTracker.getState().clear();
        expect(usePriceTracker.getState().getStats('BTC')).toBeNull();
        expect(usePriceTracker.getState().getStats('ETH')).toBeNull();
    });
});

// ─── checkMarketAlerts Tests ────────────────────────────────────

describe('checkMarketAlerts', () => {
    beforeEach(() => {
        usePriceTracker.getState().clear();
    });

    it('triggers 52w_high alert when price equals 52-week high', () => {
        usePriceTracker.getState().pushPrice('BTC', 60000);
        // Price IS the 52w high (first ever seen)

        const triggered: string[] = [];
        checkMarketAlerts(
            [{ id: 'a1', symbol: 'BTC', condition: '52w_high', price: 0, active: true }],
            (id) => triggered.push(id),
        );

        expect(triggered).toContain('a1');
    });

    it('triggers 52w_low alert when price equals 52-week low', () => {
        usePriceTracker.getState().pushPrice('BTC', 30000);

        const triggered: string[] = [];
        checkMarketAlerts(
            [{ id: 'a2', symbol: 'BTC', condition: '52w_low', price: 0, active: true }],
            (id) => triggered.push(id),
        );

        expect(triggered).toContain('a2');
    });

    it('triggers percent_above alert when change exceeds threshold', () => {
        // Set reference price
        usePriceTracker.getState().pushPrice('ETH', 3000);
        // Price up 10%
        usePriceTracker.getState().pushPrice('ETH', 3300);

        const triggered: string[] = [];
        checkMarketAlerts(
            [{ id: 'a3', symbol: 'ETH', condition: 'percent_above', price: 0, active: true, percentThreshold: 5, timeWindow: '1h' }],
            (id) => triggered.push(id),
        );

        expect(triggered).toContain('a3');
    });

    it('does NOT trigger percent_above when change is below threshold', () => {
        usePriceTracker.getState().pushPrice('ETH', 3000);
        usePriceTracker.getState().pushPrice('ETH', 3100); // ~3.3% up

        const triggered: string[] = [];
        checkMarketAlerts(
            [{ id: 'a4', symbol: 'ETH', condition: 'percent_above', price: 0, active: true, percentThreshold: 5, timeWindow: '1h' }],
            (id) => triggered.push(id),
        );

        expect(triggered).not.toContain('a4');
    });

    it('triggers percent_below alert when change is below negative threshold', () => {
        usePriceTracker.getState().pushPrice('BTC', 50000);
        usePriceTracker.getState().pushPrice('BTC', 45000); // -10%

        const triggered: string[] = [];
        checkMarketAlerts(
            [{ id: 'a5', symbol: 'BTC', condition: 'percent_below', price: 0, active: true, percentThreshold: 5, timeWindow: '1h' }],
            (id) => triggered.push(id),
        );

        expect(triggered).toContain('a5');
    });

    it('skips inactive alerts', () => {
        usePriceTracker.getState().pushPrice('BTC', 60000);

        const triggered: string[] = [];
        checkMarketAlerts(
            [{ id: 'a6', symbol: 'BTC', condition: '52w_high', price: 0, active: false }],
            (id) => triggered.push(id),
        );

        expect(triggered).toHaveLength(0);
    });

    it('skips non-market-condition alert types', () => {
        usePriceTracker.getState().pushPrice('BTC', 60000);

        const triggered: string[] = [];
        checkMarketAlerts(
            [{ id: 'a7', symbol: 'BTC', condition: 'above', price: 50000, active: true }],
            (id) => triggered.push(id),
        );

        expect(triggered).toHaveLength(0);
    });
});
