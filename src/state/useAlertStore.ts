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

export type AlertVisualStyle = 'price' | 'system' | 'indicator';

export type CompoundAlertLogic = 'AND' | 'OR';

export type AlertIndicator = 'RSI' | 'MACD' | 'VOLUME' | 'ATR';

export interface AlertSubCondition {
    type: 'price' | 'indicator';
    condition: AlertCondition;
    price?: number;
    indicator?: AlertIndicator;
    indicatorValue?: number;
}

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
    style: AlertVisualStyle;
    _lastPrice: number | null;
    // Multi-condition fields (optional, backward-compatible)
    compoundLogic?: CompoundAlertLogic;
    conditions?: AlertSubCondition[];
}

interface AddAlertParams {
    symbol: string;
    condition: AlertCondition;
    price: number;
    note?: string;
    repeating?: boolean;
    style?: AlertVisualStyle;
}

interface AddCompoundAlertParams {
    symbol: string;
    logic: CompoundAlertLogic;
    conditions: AlertSubCondition[];
    note?: string;
    repeating?: boolean;
    style?: AlertVisualStyle;
}

export interface AlertState {
    alerts: Alert[];
    pushSubscribed: boolean;
}

export interface AlertActions {
    addAlert: (params: AddAlertParams) => string;
    addCompoundAlert: (params: AddCompoundAlertParams) => string;
    removeAlert: (id: string) => void;
    toggleAlert: (id: string) => void;
    triggerAlert: (id: string) => void;
    updateLastPrice: (symbol: string, price: number) => void;
    clearTriggered: () => void;
    clearAll: () => void;
    subscribeToPush: () => Promise<void>;
}

// ─── Store ──────────────────────────────────────────────────────

const ALERT_KEY = 'charEdge-alerts';

const useAlertStore = create<AlertState & AlertActions>()(
    persist(
        (set, _get) => ({
            alerts: [],
            pushSubscribed: false,

            addAlert: ({ symbol, condition, price, note = '', repeating = false, style = 'price' }: AddAlertParams): string => {
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
                    style,
                    _lastPrice: null,
                };
                set((s) => ({ alerts: [...s.alerts, alert] }));
                return alert.id;
            },

            addCompoundAlert: ({ symbol, logic, conditions, note = '', repeating = false, style = 'price' }: AddCompoundAlertParams): string => {
                const alert: Alert = {
                    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                    symbol: (symbol || '').toUpperCase(),
                    condition: conditions[0]?.condition || 'above',
                    price: conditions[0]?.price || 0,
                    active: true,
                    repeating,
                    triggeredAt: null,
                    createdAt: new Date().toISOString(),
                    note,
                    style,
                    _lastPrice: null,
                    compoundLogic: logic,
                    conditions,
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

            subscribeToPush: async () => {
                if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
                try {
                    const reg = await navigator.serviceWorker.ready;
                    const sub = await reg.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: window.__VAPID_PUBLIC_KEY || '',
                    });
                    // Register with server
                    await fetch('/api/push/subscribe', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(sub.toJSON()),
                    });
                    set({ pushSubscribed: true });
                } catch (_) {
                    /* push subscription failed — degrade gracefully */
                }
            },
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

function evaluateSingleCondition(
    condition: AlertCondition,
    targetPrice: number,
    currentPrice: number,
    lastPrice: number | null,
): boolean {
    switch (condition) {
        case 'above': return currentPrice >= targetPrice;
        case 'below': return currentPrice <= targetPrice;
        case 'cross_above':
            if (lastPrice == null) return false;
            return lastPrice < targetPrice && currentPrice >= targetPrice;
        case 'cross_below':
            if (lastPrice == null) return false;
            return lastPrice > targetPrice && currentPrice <= targetPrice;
        default: return false;
    }
}

function evaluateSubCondition(
    sub: AlertSubCondition,
    currentPrice: number,
    lastPrice: number | null,
): boolean {
    if (sub.type === 'price') {
        return evaluateSingleCondition(sub.condition, sub.price || 0, currentPrice, lastPrice);
    }
    // Indicator-based conditions — compare indicatorValue against a threshold
    // The indicatorValue would be populated by the evaluation loop from live data
    if (sub.type === 'indicator' && sub.indicatorValue != null && sub.price != null) {
        return evaluateSingleCondition(sub.condition, sub.price, sub.indicatorValue, null);
    }
    return false;
}

export function checkAlerts(prices: Record<string, number>): void {
    if (!prices || typeof prices !== 'object') return;

    const store = useAlertStore.getState();
    const activeAlerts = store.alerts.filter((a) => a.active);

    for (const alert of activeAlerts) {
        const price = prices[alert.symbol];
        if (price == null) continue;

        let triggered = false;

        // Compound alert: evaluate all sub-conditions with AND/OR logic
        if (alert.conditions && alert.conditions.length > 0 && alert.compoundLogic) {
            const results = alert.conditions.map((sub) =>
                evaluateSubCondition(sub, price, alert._lastPrice),
            );
            triggered = alert.compoundLogic === 'AND'
                ? results.every(Boolean)
                : results.some(Boolean);
        } else {
            // Simple single-condition alert (backward compatible)
            triggered = evaluateSingleCondition(
                alert.condition,
                alert.price,
                price,
                alert._lastPrice,
            );
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
