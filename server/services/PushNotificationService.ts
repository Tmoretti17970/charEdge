// ═══════════════════════════════════════════════════════════════════
// charEdge — Push Notification Service
//
// Web Push API integration using VAPID keys.
// Delivers push notifications when alerts trigger server-side.
//
// Setup:
//   1. Generate VAPID keys: npx web-push generate-vapid-keys
//   2. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars
//   3. Client subscribes via PushRegistration component
//   4. AlertEvaluationLoop calls sendAlertNotification on trigger
//
// Usage: const pushService = new PushNotificationService();
// ═══════════════════════════════════════════════════════════════════

import { logger } from '../middleware/httpLogger.js';

// ─── Types ──────────────────────────────────────────────────────

export interface PushSubscription {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
}

export interface UserPushRecord {
    userId: string;
    subscription: PushSubscription;
    createdAt: string;
}

interface AlertPayload {
    type: 'price_alert';
    title: string;
    body: string;
    icon: string;
    tag: string;
    data: {
        alertId: string;
        symbol: string;
        price: number;
        url: string;
    };
}

// ─── Service ────────────────────────────────────────────────────

export class PushNotificationService {
    private vapidPublicKey: string;
    private vapidPrivateKey: string;
    private vapidSubject: string;
    private subscriptions: Map<string, UserPushRecord[]> = new Map();
    private webPush: typeof import('web-push') | null = null;

    constructor() {
        this.vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
        this.vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
        this.vapidSubject = process.env.VAPID_SUBJECT || 'mailto:contact@charedge.com';

        if (this.vapidPublicKey && this.vapidPrivateKey) {
            this.initWebPush();
        } else {
            logger?.warn?.('[PushService] VAPID keys not configured — push disabled');
        }
    }

    private async initWebPush(): Promise<void> {
        try {
            // Dynamic import — web-push is optional dependency
            const wp = await import('web-push');
            this.webPush = wp.default || wp;
            this.webPush.setVapidDetails(this.vapidSubject, this.vapidPublicKey, this.vapidPrivateKey);
            logger?.info?.('[PushService] Web Push initialized with VAPID keys');
        } catch (_) {
            logger?.warn?.('[PushService] web-push not installed — run: npm i web-push');
        }
    }

    getVapidPublicKey(): string {
        return this.vapidPublicKey;
    }

    // ─── Subscription Management ──────────────────────────────────

    registerSubscription(userId: string, subscription: PushSubscription): void {
        const existing = this.subscriptions.get(userId) || [];
        // Dedupe by endpoint
        const filtered = existing.filter((r) => r.subscription.endpoint !== subscription.endpoint);
        filtered.push({ userId, subscription, createdAt: new Date().toISOString() });
        this.subscriptions.set(userId, filtered);
        logger?.info?.(`[PushService] Registered push subscription for user ${userId}`);
    }

    removeSubscription(userId: string, endpoint: string): void {
        const existing = this.subscriptions.get(userId) || [];
        this.subscriptions.set(
            userId,
            existing.filter((r) => r.subscription.endpoint !== endpoint),
        );
    }

    getSubscriptionCount(): number {
        let count = 0;
        for (const subs of this.subscriptions.values()) count += subs.length;
        return count;
    }

    // ─── Send Notifications ───────────────────────────────────────

    async sendAlertNotification(
        userId: string,
        alert: { id: string; symbol: string; condition: string; price: number; note: string },
        currentPrice: number,
    ): Promise<void> {
        if (!this.webPush) {
            logger?.debug?.('[PushService] Push disabled — skipping notification');
            return;
        }

        const subs = this.subscriptions.get(userId);
        if (!subs || subs.length === 0) return;

        const condLabel: Record<string, string> = {
            above: '↑ above',
            below: '↓ below',
            cross_above: '↗ crossed above',
            cross_below: '↘ crossed below',
        };

        const payload: AlertPayload = {
            type: 'price_alert',
            title: `🔔 ${alert.symbol} Price Alert`,
            body: `${alert.symbol} ${condLabel[alert.condition] || alert.condition} $${alert.price.toFixed(2)} (now $${currentPrice.toFixed(2)})`,
            icon: '/favicon.svg',
            tag: `alert-${alert.id}`,
            data: {
                alertId: alert.id,
                symbol: alert.symbol,
                price: currentPrice,
                url: `/chart?symbol=${alert.symbol}`,
            },
        };

        const payloadStr = JSON.stringify(payload);

        // Send to all registered devices for this user
        const results = await Promise.allSettled(
            subs.map((record) =>
                this.webPush!.sendNotification(record.subscription as any, payloadStr).catch((err: any) => {
                    // Remove expired subscriptions (410 Gone)
                    if (err?.statusCode === 410 || err?.statusCode === 404) {
                        this.removeSubscription(userId, record.subscription.endpoint);
                        logger?.info?.(`[PushService] Removed expired subscription for ${userId}`);
                    }
                    throw err;
                }),
            ),
        );

        const success = results.filter((r) => r.status === 'fulfilled').length;
        const failed = results.filter((r) => r.status === 'rejected').length;
        if (success > 0) {
            logger?.info?.(`[PushService] Sent alert to ${success} device(s) for ${userId}`);
        }
        if (failed > 0) {
            logger?.warn?.(`[PushService] Failed to send to ${failed} device(s) for ${userId}`);
        }
    }

    async sendNotification(userId: string, title: string, body: string): Promise<void> {
        if (!this.webPush) return;

        const subs = this.subscriptions.get(userId);
        if (!subs || subs.length === 0) return;

        const payload = JSON.stringify({ type: 'system', title, body, icon: '/favicon.svg' });

        await Promise.allSettled(
            subs.map((record) => this.webPush!.sendNotification(record.subscription as any, payload)),
        );
    }
}
