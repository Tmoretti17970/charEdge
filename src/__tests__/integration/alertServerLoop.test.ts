// ═══════════════════════════════════════════════════════════════════
// charEdge — AlertEvaluationLoop Integration Tests
//
// Tests: alert triggering, non-repeating behavior, missing data,
//        cross-type alerts, push notification dispatch.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';
import { AlertEvaluationLoop } from '../../../server/services/AlertEvaluationLoop.ts';

// ─── Mock Factories ─────────────────────────────────────────────

function createMockAlert(overrides = {}) {
    return {
        id: 'alert-1',
        userId: 'user-1',
        symbol: 'BTCUSD',
        condition: 'above',
        price: 100,
        active: true,
        repeating: false,
        triggeredAt: null,
        createdAt: new Date().toISOString(),
        note: '',
        _lastPrice: null,
        ...overrides,
    };
}

function createMocks(alerts = [], prices = {}) {
    return {
        priceProvider: { getLatestPrices: vi.fn().mockReturnValue(prices) },
        alertStore: {
            getActiveAlerts: vi.fn().mockReturnValue(alerts),
            triggerAlert: vi.fn(),
            updateLastPrice: vi.fn(),
        },
        pushService: {
            sendAlertNotification: vi.fn().mockResolvedValue(undefined),
        },
    };
}

// ─── Tests ──────────────────────────────────────────────────────

describe('AlertEvaluationLoop', () => {
    it('triggers alert when price crosses above threshold', async () => {
        const alert = createMockAlert({ condition: 'above', price: 100 });
        const { priceProvider, alertStore, pushService } = createMocks([alert], { BTCUSD: 105 });

        const loop = new AlertEvaluationLoop(priceProvider, alertStore, pushService);
        const count = await loop.evaluate();

        expect(count).toBe(1);
        expect(alertStore.triggerAlert).toHaveBeenCalledWith('alert-1');
        expect(pushService.sendAlertNotification).toHaveBeenCalledWith('user-1', alert, 105);
    });

    it('triggers alert when price crosses below threshold', async () => {
        const alert = createMockAlert({ condition: 'below', price: 100 });
        const { priceProvider, alertStore, pushService } = createMocks([alert], { BTCUSD: 95 });

        const loop = new AlertEvaluationLoop(priceProvider, alertStore, pushService);
        const count = await loop.evaluate();

        expect(count).toBe(1);
        expect(alertStore.triggerAlert).toHaveBeenCalledWith('alert-1');
    });

    it('does NOT trigger when price is below above-threshold', async () => {
        const alert = createMockAlert({ condition: 'above', price: 100 });
        const { priceProvider, alertStore, pushService } = createMocks([alert], { BTCUSD: 95 });

        const loop = new AlertEvaluationLoop(priceProvider, alertStore, pushService);
        const count = await loop.evaluate();

        expect(count).toBe(0);
        expect(alertStore.triggerAlert).not.toHaveBeenCalled();
        expect(pushService.sendAlertNotification).not.toHaveBeenCalled();
    });

    it('handles cross_above correctly with lastPrice', async () => {
        const alert = createMockAlert({ condition: 'cross_above', price: 100, _lastPrice: 98 });
        const { priceProvider, alertStore, pushService } = createMocks([alert], { BTCUSD: 102 });

        const loop = new AlertEvaluationLoop(priceProvider, alertStore, pushService);
        const count = await loop.evaluate();

        expect(count).toBe(1);
        expect(alertStore.triggerAlert).toHaveBeenCalledWith('alert-1');
    });

    it('does NOT trigger cross_above without lastPrice', async () => {
        const alert = createMockAlert({ condition: 'cross_above', price: 100, _lastPrice: null });
        const { priceProvider, alertStore, pushService } = createMocks([alert], { BTCUSD: 102 });

        const loop = new AlertEvaluationLoop(priceProvider, alertStore, pushService);
        const count = await loop.evaluate();

        expect(count).toBe(0);
    });

    it('handles cross_below correctly', async () => {
        const alert = createMockAlert({ condition: 'cross_below', price: 100, _lastPrice: 102 });
        const { priceProvider, alertStore, pushService } = createMocks([alert], { BTCUSD: 98 });

        const loop = new AlertEvaluationLoop(priceProvider, alertStore, pushService);
        const count = await loop.evaluate();

        expect(count).toBe(1);
    });

    it('handles missing price data gracefully', async () => {
        const alert = createMockAlert({ symbol: 'ETHUSD' });
        // No ETHUSD price available
        const { priceProvider, alertStore, pushService } = createMocks([alert], { BTCUSD: 105 });

        const loop = new AlertEvaluationLoop(priceProvider, alertStore, pushService);
        const count = await loop.evaluate();

        expect(count).toBe(0);
        expect(alertStore.triggerAlert).not.toHaveBeenCalled();
    });

    it('handles empty prices gracefully', async () => {
        const alert = createMockAlert();
        const { priceProvider, alertStore, pushService } = createMocks([alert], {});

        const loop = new AlertEvaluationLoop(priceProvider, alertStore, pushService);
        const count = await loop.evaluate();

        expect(count).toBe(0);
    });

    it('always updates lastPrice after checking', async () => {
        const alert = createMockAlert({ condition: 'above', price: 200 });
        const { priceProvider, alertStore, pushService } = createMocks([alert], { BTCUSD: 105 });

        const loop = new AlertEvaluationLoop(priceProvider, alertStore, pushService);
        await loop.evaluate();

        expect(alertStore.updateLastPrice).toHaveBeenCalledWith('alert-1', 105);
    });

    it('evaluates multiple alerts', async () => {
        const alerts = [
            createMockAlert({ id: 'a1', symbol: 'BTCUSD', condition: 'above', price: 100 }),
            createMockAlert({ id: 'a2', symbol: 'ETHUSD', condition: 'below', price: 2000 }),
        ];
        const { priceProvider, alertStore, pushService } = createMocks(alerts, { BTCUSD: 105, ETHUSD: 1800 });

        const loop = new AlertEvaluationLoop(priceProvider, alertStore, pushService);
        const count = await loop.evaluate();

        expect(count).toBe(2);
        expect(alertStore.triggerAlert).toHaveBeenCalledTimes(2);
    });

    it('start/stop lifecycle works', () => {
        const { priceProvider, alertStore, pushService } = createMocks();
        const loop = new AlertEvaluationLoop(priceProvider, alertStore, pushService);

        expect(loop.isRunning()).toBe(false);
        loop.start();
        expect(loop.isRunning()).toBe(true);
        loop.stop();
        expect(loop.isRunning()).toBe(false);
    });

    it('emits alert:triggered event', async () => {
        const alert = createMockAlert({ condition: 'above', price: 100 });
        const { priceProvider, alertStore, pushService } = createMocks([alert], { BTCUSD: 105 });

        const loop = new AlertEvaluationLoop(priceProvider, alertStore, pushService);
        const spy = vi.fn();
        loop.on('alert:triggered', spy);

        await loop.evaluate();

        expect(spy).toHaveBeenCalledWith({ alert, price: 105 });
    });

    it('handles push service errors without crashing', async () => {
        const alert = createMockAlert({ condition: 'above', price: 100 });
        const { priceProvider, alertStore, pushService } = createMocks([alert], { BTCUSD: 105 });
        pushService.sendAlertNotification.mockRejectedValue(new Error('Push failed'));

        const loop = new AlertEvaluationLoop(priceProvider, alertStore, pushService);

        // Should not throw
        const count = await loop.evaluate();
        expect(count).toBe(1);
        expect(alertStore.triggerAlert).toHaveBeenCalled();
    });
});
