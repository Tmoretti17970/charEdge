// ═══════════════════════════════════════════════════════════════════
// charEdge — Alert Store Tests
//
// Verifies that _lastPrice tracking uses a transient Map (no Zustand
// set() or localStorage write on ticks), and that alert evaluation
// correctly reads from the transient Map.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import { useAlertStore, checkAlerts, checkSymbolAlerts } from '../../state/useAlertStore.ts';

describe('useAlertStore', () => {
    beforeEach(() => {
        // Reset store to clean state
        useAlertStore.setState({ alerts: [], pushSubscribed: false });
    });

    // ─── Basic CRUD ────────────────────────────────────────────

    it('starts with empty alerts', () => {
        const s = useAlertStore.getState();
        expect(s.alerts).toEqual([]);
    });

    it('addAlert creates and returns an alert with id', () => {
        const id = useAlertStore.getState().addAlert({
            symbol: 'AAPL',
            condition: 'above',
            price: 200,
        });
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
        const alerts = useAlertStore.getState().alerts;
        expect(alerts.length).toBe(1);
        expect(alerts[0].symbol).toBe('AAPL');
        expect(alerts[0].condition).toBe('above');
        expect(alerts[0].price).toBe(200);
        expect(alerts[0].active).toBe(true);
    });

    it('addAlert uppercases symbol', () => {
        useAlertStore.getState().addAlert({
            symbol: 'btc',
            condition: 'below',
            price: 50000,
        });
        expect(useAlertStore.getState().alerts[0].symbol).toBe('BTC');
    });

    it('removeAlert removes by id', () => {
        const id = useAlertStore.getState().addAlert({
            symbol: 'ETH',
            condition: 'above',
            price: 3000,
        });
        useAlertStore.getState().removeAlert(id);
        expect(useAlertStore.getState().alerts.length).toBe(0);
    });

    it('toggleAlert flips active state', () => {
        const id = useAlertStore.getState().addAlert({
            symbol: 'SOL',
            condition: 'above',
            price: 100,
        });
        expect(useAlertStore.getState().alerts[0].active).toBe(true);
        useAlertStore.getState().toggleAlert(id);
        expect(useAlertStore.getState().alerts[0].active).toBe(false);
    });

    it('clearAll removes all alerts', () => {
        useAlertStore.getState().addAlert({ symbol: 'A', condition: 'above', price: 1 });
        useAlertStore.getState().addAlert({ symbol: 'B', condition: 'below', price: 2 });
        useAlertStore.getState().clearAll();
        expect(useAlertStore.getState().alerts).toEqual([]);
    });

    // ─── Transient _lastPrice ──────────────────────────────────

    it('updateLastPrice does NOT trigger Zustand set()', () => {
        // Subscribe to detect any state changes
        let changeCount = 0;
        const unsub = useAlertStore.subscribe(() => { changeCount++; });

        useAlertStore.getState().addAlert({
            symbol: 'BTC',
            condition: 'above',
            price: 50000,
        });
        // Reset the counter after addAlert's set()
        changeCount = 0;

        // Call updateLastPrice many times — should NOT trigger any set()
        for (let i = 0; i < 100; i++) {
            useAlertStore.getState().updateLastPrice('BTC', 49000 + i);
        }

        expect(changeCount).toBe(0);
        unsub();
    });

    it('Alert interface does NOT have _lastPrice field', () => {
        useAlertStore.getState().addAlert({
            symbol: 'BTC',
            condition: 'above',
            price: 50000,
        });
        const alert = useAlertStore.getState().alerts[0];
        expect(alert).not.toHaveProperty('_lastPrice');
    });

    // ─── Alert Evaluation ──────────────────────────────────────

    it('checkAlerts triggers above alert when price >= threshold', () => {
        useAlertStore.getState().addAlert({
            symbol: 'BTC',
            condition: 'above',
            price: 50000,
        });
        checkAlerts({ BTC: 50500 });
        const alert = useAlertStore.getState().alerts[0];
        expect(alert.active).toBe(false); // non-repeating: deactivated after trigger
        expect(alert.triggeredAt).not.toBeNull();
    });

    it('checkAlerts triggers below alert when price <= threshold', () => {
        useAlertStore.getState().addAlert({
            symbol: 'ETH',
            condition: 'below',
            price: 3000,
        });
        checkAlerts({ ETH: 2900 });
        const alert = useAlertStore.getState().alerts[0];
        expect(alert.active).toBe(false);
        expect(alert.triggeredAt).not.toBeNull();
    });

    it('cross_above requires transient _lastPrice to be below threshold', () => {
        useAlertStore.getState().addAlert({
            symbol: 'BTC',
            condition: 'cross_above',
            price: 50000,
        });

        // Set last price below threshold via transient map
        useAlertStore.getState().updateLastPrice('BTC', 49000);

        // Now check with price above threshold → should trigger
        checkAlerts({ BTC: 50500 });
        const alert = useAlertStore.getState().alerts[0];
        expect(alert.triggeredAt).not.toBeNull();
    });

    it('cross_above does NOT trigger without lastPrice', () => {
        useAlertStore.getState().addAlert({
            symbol: 'BTC',
            condition: 'cross_above',
            price: 50000,
        });

        // No updateLastPrice called → lastPrice is null → cross detection returns false
        checkAlerts({ BTC: 50500 });
        const alert = useAlertStore.getState().alerts[0];
        expect(alert.active).toBe(true); // still active, not triggered
        expect(alert.triggeredAt).toBeNull();
    });

    it('checkSymbolAlerts is a convenience wrapper', () => {
        useAlertStore.getState().addAlert({
            symbol: 'SOL',
            condition: 'above',
            price: 100,
        });
        checkSymbolAlerts('sol', 150);
        const alert = useAlertStore.getState().alerts[0];
        expect(alert.triggeredAt).not.toBeNull();
    });
});
