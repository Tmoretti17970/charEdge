// ═══════════════════════════════════════════════════════════════════
// charEdge — Alert Store Tests
//
// Verifies that _lastPrice tracking uses a transient Map (no Zustand
// set() or localStorage write on ticks), and that alert evaluation
// correctly reads from the transient Map.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Hoisted mock function (available to vi.mock factories)
const { mockPlayAlertSound, mockPush } = vi.hoisted(() => ({
    mockPlayAlertSound: vi.fn(),
    mockPush: vi.fn(),
}));

// Mock alertSounds (A3) — avoid AudioContext + logger dependency in tests
vi.mock('../../app/misc/alertSounds', () => ({
    playAlertSound: mockPlayAlertSound,
}));

// Mock notificationLog (A5) — avoid full store chain in tests
vi.mock('../../state/useNotificationStore', () => ({
    default: { push: mockPush, clear: vi.fn(), toggle: vi.fn() },
    useNotificationStore: { getState: () => ({ pushLog: mockPush }) },
    notificationLog: { push: mockPush, clear: vi.fn(), toggle: vi.fn() },
}));

// Mock notificationPreferences (absorbs alertPreferences) — DND always off, volume=1 for tests
vi.mock('../../state/useNotificationPreferences', () => ({
    useNotificationPreferences: { getState: () => ({ globalMute: false, dndEnabled: false, globalVolume: 1, alertFrequency: 'instant' }) },
    shouldDeliver: (_cat: string, channel: string) => channel === 'sound' || channel === 'inApp',
    getAlertVolume: () => 1,
    isInQuietHours: () => false,
}));



// Mock notification router to call playAlertSound and notificationLog directly
vi.mock('../../state/notificationRouter', async (importOriginal) => {
    const actual = await importOriginal() as Record<string, unknown>;
    return {
        ...actual,
        notify: (payload: any) => {
            // Deliver sound
            const soundType = payload.soundType || 'price';
            mockPlayAlertSound(soundType, 1);
            // Deliver log
            mockPush({
                type: payload.variant || 'info',
                message: `${payload.icon || ''} ${payload.title}: ${payload.body}`.trim(),
                category: payload.category,
                meta: payload.meta,
            });
        },
    };
});

import { useAlertStore, checkAlerts, checkSymbolAlerts } from '../../state/useAlertStore.ts';
import { playAlertSound } from '../../app/misc/alertSounds';

describe('useAlertStore', () => {
    beforeEach(() => {
        // Reset store to clean state
        useAlertStore.setState({ alerts: [], pushSubscribed: false });
        vi.clearAllMocks();
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

    // ─── A3: Sound Integration ────────────────────────────────

    it('A3: plays alert sound when alert triggers', () => {
        useAlertStore.getState().addAlert({
            symbol: 'AAPL',
            condition: 'above',
            price: 200,
            style: 'price',
        });
        checkAlerts({ AAPL: 210 });
        expect(playAlertSound).toHaveBeenCalledWith('price', expect.any(Number));
    });

    it('A3: maps system style to urgent sound', () => {
        useAlertStore.getState().addAlert({
            symbol: 'TSLA',
            condition: 'above',
            price: 300,
        });
        // Manually set the style to 'system' by updating the store
        useAlertStore.setState((s) => ({
            alerts: s.alerts.map((a) => ({ ...a, style: 'system' as const })),
        }));
        checkAlerts({ TSLA: 310 });
        expect(playAlertSound).toHaveBeenCalledWith('urgent', expect.any(Number));
    });

    // ─── A5: Notification Log Integration ─────────────────────

    it('A5: pushes to notification log when alert triggers', () => {
        useAlertStore.getState().addAlert({
            symbol: 'GOOG',
            condition: 'below',
            price: 150,
        });
        checkAlerts({ GOOG: 140 });
        expect(mockPush).toHaveBeenCalledWith(
            expect.objectContaining({
                category: 'priceAlerts',
                meta: expect.objectContaining({
                    symbol: 'GOOG',
                    price: 140,
                    condition: 'below',
                }),
            }),
        );
    });

    // ─── B5: Expiration + Cooldown ────────────────────────────

    it('B5: auto-deactivates expired alerts', () => {
        const pastDate = new Date(Date.now() - 60_000).toISOString();
        useAlertStore.getState().addAlert({
            symbol: 'MSFT',
            condition: 'above',
            price: 400,
            expiresAt: pastDate,
        });
        const before = useAlertStore.getState().alerts[0];
        expect(before.active).toBe(true);

        checkAlerts({ MSFT: 450 });

        const after = useAlertStore.getState().alerts[0];
        // Should be deactivated via triggerAlert due to expiration
        expect(after.active).toBe(false);
        expect(after.triggeredAt).not.toBeNull();
    });

    it('B5: does not trigger alert during cooldown', () => {
        const recentTrigger = new Date().toISOString();
        useAlertStore.getState().addAlert({
            symbol: 'AMZN',
            condition: 'above',
            price: 180,
            repeating: true,
            cooldownMs: 60_000, // 1 minute cooldown
        });
        // Simulate a recent trigger by manually setting triggeredAt
        useAlertStore.setState((s) => ({
            alerts: s.alerts.map((a) => ({ ...a, triggeredAt: recentTrigger })),
        }));

        vi.clearAllMocks();
        checkAlerts({ AMZN: 200 });

        // Should NOT trigger again because we're within cooldown
        expect(mockPlayAlertSound).not.toHaveBeenCalled();
        expect(mockPush).not.toHaveBeenCalled();
    });

    it('B5: triggers alert after cooldown expires', () => {
        const oldTrigger = new Date(Date.now() - 120_000).toISOString(); // 2 min ago
        useAlertStore.getState().addAlert({
            symbol: 'META',
            condition: 'above',
            price: 500,
            repeating: true,
            cooldownMs: 60_000, // 1 minute cooldown
        });
        // Simulate an old trigger
        useAlertStore.setState((s) => ({
            alerts: s.alerts.map((a) => ({ ...a, triggeredAt: oldTrigger })),
        }));

        vi.clearAllMocks();
        checkAlerts({ META: 550 });

        // Should trigger because cooldown has expired
        expect(mockPlayAlertSound).toHaveBeenCalled();
    });
});
