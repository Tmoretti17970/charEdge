// ═══════════════════════════════════════════════════════════════════
// charEdge — Server-Side Alert Evaluation Loop
//
// Evaluates price alerts server-side so they fire even when the
// browser tab is closed. Runs on a 5-second cadence.
//
// Architecture:
//   - Reads active alerts from the database (or in-memory store)
//   - Compares against latest cached prices from the data feed
//   - On trigger: emits event → PushNotificationService delivers
//
// Usage: import { startAlertLoop } from './AlertEvaluationLoop.ts';
//        startAlertLoop(priceProvider, alertStore, pushService);
// ═══════════════════════════════════════════════════════════════════

import { EventEmitter } from 'events';

// ─── Types ──────────────────────────────────────────────────────

export type AlertCondition = 'above' | 'below' | 'cross_above' | 'cross_below';

export interface ServerAlert {
    id: string;
    userId: string;
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

export interface PriceProvider {
    getLatestPrices(): Record<string, number>;
}

export interface AlertStore {
    getActiveAlerts(): ServerAlert[];
    triggerAlert(id: string): void;
    updateLastPrice(id: string, price: number): void;
}

export interface PushService {
    sendAlertNotification(userId: string, alert: ServerAlert, currentPrice: number): Promise<void>;
}

// ─── Alert Evaluation Engine ────────────────────────────────────

const EVAL_INTERVAL_MS = 5000; // 5 seconds

export class AlertEvaluationLoop extends EventEmitter {
    private priceProvider: PriceProvider;
    private alertStore: AlertStore;
    private pushService: PushService;
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private running = false;

    constructor(priceProvider: PriceProvider, alertStore: AlertStore, pushService: PushService) {
        super();
        this.priceProvider = priceProvider;
        this.alertStore = alertStore;
        this.pushService = pushService;
    }

    start(): void {
        if (this.running) return;
        this.running = true;
        this.intervalId = setInterval(() => this.evaluate(), EVAL_INTERVAL_MS);
        this.emit('started');
    }

    stop(): void {
        if (!this.running) return;
        this.running = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.emit('stopped');
    }

    isRunning(): boolean {
        return this.running;
    }

    async evaluate(): Promise<number> {
        const prices = this.priceProvider.getLatestPrices();
        if (!prices || Object.keys(prices).length === 0) return 0;

        const alerts = this.alertStore.getActiveAlerts();
        let triggeredCount = 0;

        for (const alert of alerts) {
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
                    if (alert._lastPrice != null && alert._lastPrice < alert.price && price >= alert.price) {
                        triggered = true;
                    }
                    break;
                case 'cross_below':
                    if (alert._lastPrice != null && alert._lastPrice > alert.price && price <= alert.price) {
                        triggered = true;
                    }
                    break;
            }

            if (triggered) {
                this.alertStore.triggerAlert(alert.id);
                triggeredCount++;

                // Send push notification asynchronously
                this.pushService
                    .sendAlertNotification(alert.userId, alert, price)
                    .catch((err) => this.emit('push-error', { alertId: alert.id, error: err }));

                this.emit('alert:triggered', { alert, price });
            }

            // Always update last price for cross-type detection
            this.alertStore.updateLastPrice(alert.id, price);
        }

        if (triggeredCount > 0) {
            this.emit('evaluation:complete', { triggeredCount, totalChecked: alerts.length });
        }

        return triggeredCount;
    }
}

// ─── Factory ────────────────────────────────────────────────────

export function startAlertLoop(
    priceProvider: PriceProvider,
    alertStore: AlertStore,
    pushService: PushService,
): AlertEvaluationLoop {
    const loop = new AlertEvaluationLoop(priceProvider, alertStore, pushService);
    loop.start();
    return loop;
}
