// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Alert Store (TypeScript)
//
// Price alert system: "Alert when AAPL > $200"
// Phase 2: Converted to TypeScript.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { playAlertSound } from '../app/misc/alertSounds';
import notificationLog from './useNotificationLog';
import { isInQuietHours, getAlertVolume } from './useAlertPreferences';
import alertHistory from './useAlertHistory';

// ─── Transient Price Tracking ───────────────────────────────────
// Stored outside Zustand to avoid triggering set()/persist on every tick.
// This map is never persisted — it's ephemeral runtime state.
const _lastPrices = new Map<string, number>();

// D5: Transient per-sub-condition satisfaction timestamps for temporal windows
// Key: "alertId:conditionIndex" → timestamp when condition was last satisfied
const _conditionSatisfiedAt: Map<string, number> = new Map();

// ─── Types ──────────────────────────────────────────────────────

export type AlertCondition = 'above' | 'below' | 'cross_above' | 'cross_below';

export type AlertVisualStyle = 'price' | 'system' | 'indicator';

export type AlertSoundType = 'price' | 'urgent' | 'info' | 'success' | 'error';

export type CompoundAlertLogic = 'AND' | 'OR';

export type AlertIndicator = 'RSI' | 'MACD' | 'VOLUME' | 'ATR';

export interface AlertSubCondition {
    type: 'price' | 'indicator';
    condition: AlertCondition;
    price?: number;
    indicator?: AlertIndicator;
    indicatorValue?: number;
    // D5: Temporal window — condition must happen within N candles
    windowBars?: number;
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
    // Multi-condition fields (optional, backward-compatible)
    compoundLogic?: CompoundAlertLogic;
    conditions?: AlertSubCondition[];
    // B5: Expiration + cooldown
    expiresAt?: string | null;
    cooldownMs?: number | null;
    // C4: Per-alert sound selection
    soundType?: AlertSoundType | null;
}

interface AddAlertParams {
    symbol: string;
    condition: AlertCondition;
    price: number;
    note?: string;
    repeating?: boolean;
    style?: AlertVisualStyle;
    expiresAt?: string | null;
    cooldownMs?: number | null;
    soundType?: AlertSoundType | null;
}

interface AddCompoundAlertParams {
    symbol: string;
    logic: CompoundAlertLogic;
    conditions: AlertSubCondition[];
    note?: string;
    repeating?: boolean;
    style?: AlertVisualStyle;
    expiresAt?: string | null;
    cooldownMs?: number | null;
    soundType?: AlertSoundType | null;
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

            addAlert: ({ symbol, condition, price, note = '', repeating = false, style = 'price', expiresAt = null, cooldownMs = null, soundType = null }: AddAlertParams): string => {
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
                    expiresAt,
                    cooldownMs,
                    soundType,
                };
                set((s) => ({ alerts: [...s.alerts, alert] }));
                return alert.id;
            },

            addCompoundAlert: ({ symbol, logic, conditions, note = '', repeating = false, style = 'price', expiresAt = null, cooldownMs = null, soundType = null }: AddCompoundAlertParams): string => {
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
                    compoundLogic: logic,
                    conditions,
                    expiresAt,
                    cooldownMs,
                    soundType,
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
                // Write to transient Map — no Zustand set(), no localStorage write
                _lastPrices.set(symbol, price);
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
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                } catch (_) {
                    /* push subscription failed — degrade gracefully */
                }
            },
        }),
        {
            name: ALERT_KEY,
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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

        // B5: Skip expired alerts — auto-deactivate
        if (alert.expiresAt && new Date(alert.expiresAt) < new Date()) {
            store.triggerAlert(alert.id);
            continue;
        }

        // B5: Skip alerts in cooldown period
        if (alert.cooldownMs && alert.triggeredAt) {
            const lastTriggeredMs = new Date(alert.triggeredAt).getTime();
            if (Date.now() - lastTriggeredMs < alert.cooldownMs) {
                store.updateLastPrice(alert.symbol, price);
                continue;
            }
        }

        let triggered = false;

        // Read last price from transient Map (not from alert state)
        const lastPrice = _lastPrices.get(alert.symbol) ?? null;

        // Compound alert: evaluate all sub-conditions with AND/OR logic
        if (alert.conditions && alert.conditions.length > 0 && alert.compoundLogic) {
            const results = alert.conditions.map((sub, idx) => {
                const met = evaluateSubCondition(sub, price, lastPrice);
                const key = `${alert.id}:${idx}`;
                if (met) {
                    _conditionSatisfiedAt.set(key, Date.now());
                }
                return met;
            });

            if (alert.compoundLogic === 'AND') {
                // D5: Check if any condition has a windowBars constraint
                const hasWindow = alert.conditions.some((s) => s.windowBars && s.windowBars > 0);
                if (hasWindow) {
                    // All conditions must have been satisfied, and all within the window
                    const allSatisfied = alert.conditions.every((_, idx) =>
                        _conditionSatisfiedAt.has(`${alert.id}:${idx}`),
                    );
                    if (allSatisfied) {
                        const timestamps = alert.conditions.map((_, idx) =>
                            _conditionSatisfiedAt.get(`${alert.id}:${idx}`) || 0,
                        );
                        const oldest = Math.min(...timestamps);
                        const newest = Math.max(...timestamps);
                        // Use the max windowBars across conditions × 5s eval interval as window
                        const maxWindow = Math.max(...alert.conditions.map((s) => s.windowBars || Infinity));
                        const windowMs = maxWindow * 5000; // 5s per "bar" eval cycle
                        triggered = (newest - oldest) <= windowMs;
                        // Clear stale satisfactions if window expired
                        if (!triggered) {
                            alert.conditions.forEach((_, idx) => {
                                const ts = _conditionSatisfiedAt.get(`${alert.id}:${idx}`);
                                if (ts && Date.now() - ts > windowMs) {
                                    _conditionSatisfiedAt.delete(`${alert.id}:${idx}`);
                                }
                            });
                        }
                    }
                } else {
                    triggered = results.every(Boolean);
                }
            } else {
                triggered = results.some(Boolean);
            }
        } else {
            // Simple single-condition alert (backward compatible)
            triggered = evaluateSingleCondition(
                alert.condition,
                alert.price,
                price,
                lastPrice,
            );
        }

        if (triggered) {
            store.triggerAlert(alert.id);

            // C5: Suppress audio/visual during quiet hours (alert still triggers)
            const quiet = isInQuietHours();

            if (!quiet) {
                // C4: Per-alert sound — prefer soundType, fall back to style mapping
                const styleFallback: Record<string, AlertSoundType> = { price: 'price', system: 'urgent', indicator: 'info' };
                const soundToPlay: AlertSoundType = alert.soundType || styleFallback[alert.style] || 'price';
                try { playAlertSound(soundToPlay, getAlertVolume()); } catch { /* audio may be blocked */ }
            }

            const msg = `${alert.symbol} hit $${price.toFixed(2)} (alert: ${alert.condition} $${alert.price.toFixed(2)})`;
            if (!quiet) sendNotification(`🔔 ${alert.symbol} Price Alert`, msg);
            dispatchAlertToast(alert, price);

            // A5: Bridge to notification activity log
            notificationLog.push({
                type: 'info',
                message: `🔔 ${msg}`,
                category: 'alert',
                meta: { alertId: alert.id, symbol: alert.symbol, price, condition: alert.condition },
            });

            // C2: Record in alert history for outcome tracking
            alertHistory.getState().pushEntry(alert, price);
        }

        store.updateLastPrice(alert.symbol, price);
    }
}

export function checkSymbolAlerts(symbol: string, price: number): void {
    checkAlerts({ [symbol.toUpperCase()]: price });
}

export { useAlertStore };
export default useAlertStore;
