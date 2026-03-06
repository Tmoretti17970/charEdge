// ═══════════════════════════════════════════════════════════════════
// charEdge — PWA Push Notification Manager (Batch 16: 3.5.4)
//
// Manages browser push notification permissions, subscriptions,
// and local notification fallback for price alerts delivery.
//
// Usage:
//   import { pushManager } from './PushManager.js';
//   await pushManager.requestPermission();
//   await pushManager.subscribe();
//   pushManager.showLocalNotification('Price Alert', 'BTC hit $50,000');
// ═══════════════════════════════════════════════════════════════════

import { logger } from './logger.js';

// ─── VAPID Config ────────────────────────────────────────────────
const VAPID_PUBLIC_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_VAPID_PUBLIC_KEY) || '';

// ─── Utils ───────────────────────────────────────────────────────

/**
 * Convert a base64 VAPID key to a Uint8Array for PushManager.subscribe().
 * @param {string} base64String
 * @returns {Uint8Array}
 */
function _urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// ─── Push Notification Manager ───────────────────────────────────

class PushNotificationManager {
    constructor() {
        /** @type {'default'|'granted'|'denied'} */
        this._permission = typeof Notification !== 'undefined' ? Notification.permission : 'default';
        /** @type {PushSubscription|null} */
        this._subscription = null;
    }

    // ─── Permission ──────────────────────────────────────────────

    /**
     * Request notification permission from the user.
     * @returns {Promise<'granted'|'denied'|'default'>}
     */
    async requestPermission() {
        if (typeof Notification === 'undefined') {
            logger.boot.warn('[PushManager] Notifications not supported');
            return 'denied';
        }

        // Already decided
        if (Notification.permission !== 'default') {
            this._permission = Notification.permission;
            return this._permission;
        }

        try {
            const result = await Notification.requestPermission();
            this._permission = result;
            logger.boot.info(`[PushManager] Permission: ${result}`);
            return result;
        } catch (err) {
            logger.boot.warn('[PushManager] Permission request failed:', err?.message);
            return 'denied';
        }
    }

    /**
     * Check current permission status.
     * @returns {'granted'|'denied'|'default'}
     */
    getPermission() {
        if (typeof Notification !== 'undefined') {
            this._permission = Notification.permission;
        }
        return this._permission;
    }

    /**
     * @returns {boolean}
     */
    isSupported() {
        return typeof Notification !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
    }

    // ─── Subscription ────────────────────────────────────────────

    /**
     * Subscribe to push notifications via the Service Worker's PushManager.
     * Requires VAPID public key to be configured.
     * @returns {Promise<PushSubscription|null>}
     */
    async subscribe() {
        if (!this.isSupported()) {
            logger.boot.warn('[PushManager] Push not supported');
            return null;
        }

        if (this._permission !== 'granted') {
            const perm = await this.requestPermission();
            if (perm !== 'granted') return null;
        }

        try {
            const registration = await navigator.serviceWorker.ready;

            // Check for existing subscription
            const existing = await registration.pushManager.getSubscription();
            if (existing) {
                this._subscription = existing;
                return existing;
            }

            if (!VAPID_PUBLIC_KEY) {
                logger.boot.warn('[PushManager] No VAPID key configured — using local notifications only');
                return null;
            }

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: _urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });

            this._subscription = subscription;
            logger.boot.info('[PushManager] Subscribed to push notifications');
            return subscription;
        } catch (err) {
            logger.boot.warn('[PushManager] Subscribe failed:', err?.message);
            return null;
        }
    }

    /**
     * Unsubscribe from push notifications.
     * @returns {Promise<boolean>}
     */
    async unsubscribe() {
        if (!this._subscription) {
            try {
                const registration = await navigator.serviceWorker.ready;
                const sub = await registration.pushManager.getSubscription();
                if (sub) {
                    await sub.unsubscribe();
                    this._subscription = null;
                    return true;
                }
            } catch (_) { /* no sub */ }
            return false;
        }

        try {
            await this._subscription.unsubscribe();
            this._subscription = null;
            return true;
        } catch (_) {
            return false;
        }
    }

    /**
     * Get current subscription status.
     * @returns {{ supported: boolean, permission: string, subscribed: boolean }}
     */
    getSubscriptionStatus() {
        return {
            supported: this.isSupported(),
            permission: this._permission,
            subscribed: !!this._subscription,
        };
    }

    // ─── Local Notifications ────────────────────────────────────

    /**
     * Show a local notification (for foreground alerts or VAPID-less mode).
     * Falls back to in-app notification if Notification API denied.
     *
     * @param {string} title
     * @param {string} body
     * @param {{ icon?: string, url?: string, alertId?: string, tag?: string }} data
     * @returns {boolean} true if notification was shown
     */
    showLocalNotification(title, body, data = {}) {
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
            return false;
        }

        try {
            const notification = new Notification(title, {
                body,
                icon: data.icon || '/icons/icon-192.png',
                badge: '/icons/badge-72.png',
                tag: data.tag || data.alertId || 'charedge-alert',
                data: {
                    url: data.url || '/',
                    alertId: data.alertId,
                },
                requireInteraction: true,
            });

            notification.onclick = () => {
                window.focus();
                if (data.url) {
                    window.location.hash = data.url;
                }
                notification.close();
            };

            return true;
        } catch (err) {
            logger.boot.warn('[PushManager] Local notification failed:', err?.message);
            return false;
        }
    }

    /**
     * Show a notification via the Service Worker (works when tab is closed).
     * @param {string} title
     * @param {string} body
     * @param {object} data
     * @returns {Promise<boolean>}
     */
    async showSWNotification(title, body, data = {}) {
        try {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification(title, {
                body,
                icon: '/icons/icon-192.png',
                badge: '/icons/badge-72.png',
                tag: data.tag || 'charedge-alert',
                data,
                requireInteraction: true,
            });
            return true;
        } catch (err) {
            logger.boot.warn('[PushManager] SW notification failed:', err?.message);
            return false;
        }
    }
}

// ─── Singleton + Exports ─────────────────────────────────────────

export const pushManager = new PushNotificationManager();
export { PushNotificationManager };
export default pushManager;
