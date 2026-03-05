// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Alert Store (TypeScript)
//
// Price alert system: "Alert when AAPL > $200"
// Phase 2: Converted to TypeScript.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Types ──────────────────────────────────────────────────────

export type AlertCondition = 'above' | 'below' | 'cross_above' | 'cross_below';

export interface Alert {
    id: string;
    symbol: string;
    condition: AlertCondition;
    price: number;
    active: boolean;
    repeating: boolean;
    triggeredAt: string | null;
    createdAt: string;
    note: string;
    _lastPrice: number | null;
}

interface AddAlertParams {
    symbol: string;
    condition: AlertCondition;
    price: number;
    note?: string;
    repeating?: boolean;
}

export interface AlertState {
    alerts: Alert[];
}

export interface AlertActions {
    addAlert: (params: AddAlertParams) => string;
    removeAlert: (id: string) => void;
    toggleAlert: (id: string) => void;
    triggerAlert: (id: string) => void;
    updateLastPrice: (symbol: string, price: number) => void;
    clearTriggered: () => void;
    clearAll: () => void;
}

// ─── Store ──────────────────────────────────────────────────────

const ALERT_KEY = 'charEdge-alerts';

const useAlertStore = create<AlertState & AlertActions>()(
    persist(
        (set, _get) => ({
            alerts: [],

            addAlert: ({ symbol, condition, price, note = '', repeating = false }: AddAlertParams): string => {
                const alert: Alert = {
                    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                    symbol: (symbol || '').toUpperCase(),
                    condition,
                    price: Number(price),
                    active: true,
                    repeating,
                    triggeredAt: null,
                    createdAt: new Date().toISOString(),
                    note,
                    _lastPrice: null,
                };
                set((s) => ({ alerts: [...s.alerts, alert] }));
                return alert.id;
            },

            removeAlert: (id: string) => {
                set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) }));
            },

            toggleAlert: (id: string) => {
                set((s) => ({
                    alerts: s.alerts.map((a) =>
                        a.id === id ? { ...a, active: !a.active, triggeredAt: !a.active ? null : a.triggeredAt } : a,
                    ),
                }));
            },

            triggerAlert: (id: string) => {
                set((s) => ({
                    alerts: s.alerts.map((a) => {
                        if (a.id !== id) return a;
                        return {
                            ...a,
                            active: a.repeating,
                            triggeredAt: new Date().toISOString(),
                        };
                    }),
                }));
            },

            updateLastPrice: (symbol: string, price: number) => {
                set((s) => ({
                    alerts: s.alerts.map((a) => (a.symbol === symbol ? { ...a, _lastPrice: price } : a)),
                }));
            },

            clearTriggered: () => {
                set((s) => ({
                    alerts: s.alerts.filter((a) => a.active || a.repeating),
                }));
            },

            clearAll: () => set({ alerts: [] }),
        }),
        {
            name: ALERT_KEY,
            partialize: (state: AlertState) => ({
                alerts: state.alerts.map((a) => ({
                    ...a,
                    _lastPrice: null,
                })),
            }),
        },
    ),
);

// ─── Alert Checker ──────────────────────────────────────────────

export function requestNotificationPermission(): void {
    if (typeof window === 'undefined') return;
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function sendNotification(title: string, body: string): void {
    if (typeof window === 'undefined') return;
    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            new Notification(title, {
                body,
                icon: '/favicon.svg',
                tag: 'charEdge-alert',
                renotify: true,
            });
        } catch (_) {
            /* notifications may fail in some contexts */
        }
    }
}

function dispatchAlertToast(alert: Alert, currentPrice: number): void {
    if (typeof window === 'undefined') return;
    const condLabel: Record<AlertCondition, string> = {
        above: '↑ above',
        below: '↓ below',
        cross_above: '↗ crossed above',
        cross_below: '↘ crossed below',
    };
    window.dispatchEvent(
        new CustomEvent('charEdge:alert-triggered', {
            detail: {
                alert,
                currentPrice,
                message: `${alert.symbol} ${condLabel[alert.condition] || alert.condition} $${alert.price.toFixed(2)}`,
            },
        }),
    );
}

export function checkAlerts(prices: Record<string, number>): void {
    if (!prices || typeof prices !== 'object') return;

    const store = useAlertStore.getState();
    const activeAlerts = store.alerts.filter((a) => a.active);

    for (const alert of activeAlerts) {
        const price = prices[alert.symbol];
        if (price == null) continue;

        let triggered = false;

        switch (alert.condition) {
            case 'above':
                triggered = price >= alert.price;
                break;
            case 'below':
                triggered = price <= alert.price;
                break;
            case 'cross_above':
                if (alert._lastPrice == null) break;
                if (alert._lastPrice < alert.price && price >= alert.price) {
                    triggered = true;
                }
                break;
            case 'cross_below':
                if (alert._lastPrice == null) break;
                if (alert._lastPrice > alert.price && price <= alert.price) {
                    triggered = true;
                }
                break;
        }

        if (triggered) {
            store.triggerAlert(alert.id);
            const msg = `${alert.symbol} hit $${price.toFixed(2)} (alert: ${alert.condition} $${alert.price.toFixed(2)})`;
            sendNotification(`🔔 ${alert.symbol} Price Alert`, msg);
            dispatchAlertToast(alert, price);
        }

        store.updateLastPrice(alert.symbol, price);
    }
}

export function checkSymbolAlerts(symbol: string, price: number): void {
    checkAlerts({ [symbol.toUpperCase()]: price });
}

export { useAlertStore };
export default useAlertStore;
