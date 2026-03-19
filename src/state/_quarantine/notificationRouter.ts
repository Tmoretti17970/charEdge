// ═══════════════════════════════════════════════════════════════════
// charEdge — Notification Delivery Router (Sprints 3 + 12-14)
//
// Central routing layer that all notification sources go through.
// Respects per-category channel preferences, pause, and DND.
//
// Sprint 3:  Core routing (push, inApp, sound, log)
// Sprint 12: Rich push (action buttons, grouping, badge count)
// Sprint 13: Enhanced toast (category accent colors, click-through)
// Sprint 14: Email digest (mailto-based summary export)
// ═══════════════════════════════════════════════════════════════════

import { shouldDeliver } from './useNotificationPreferences';
import { getAlertVolume } from './useNotificationPreferences';
import { playAlertSound } from '../app/misc/alertSounds';
import { logger } from '@/observability/logger';
import { notificationLog } from './useNotificationStore';
import type { NotificationCategoryId, ChannelKey } from './useNotificationPreferences';

// ─── Types ──────────────────────────────────────────────────────

export type NotificationVariant = 'success' | 'warning' | 'error' | 'info';

export interface NotificationPayload {
    /** Which category this notification belongs to */
    category: NotificationCategoryId;
    /** Short title (used in push, toast header, log) */
    title: string;
    /** Longer description body */
    body: string;
    /** Emoji icon for the notification */
    icon?: string;
    /** Visual variant for toast coloring */
    variant?: NotificationVariant;
    /** Sound type override (defaults based on category) */
    soundType?: 'price' | 'urgent' | 'info' | 'success' | 'gentle';
    /** Arbitrary metadata (alertId, symbol, price, etc.) */
    meta?: Record<string, unknown> | undefined;
    /** If true, skip the in-app toast (useful if caller handles their own UI) */
    skipToast?: boolean;
    /** Custom event name to dispatch on window (e.g. 'charEdge:alert-triggered') */
    customEvent?: string;
    /** Custom event detail */
    customEventDetail?: unknown;
    /** Sprint 12: Push notification action buttons */
    actions?: PushAction[];
    /** Sprint 13: Click-through URL path for toast/push */
    clickPath?: string;
}

export interface PushAction {
    title: string;
    action: string;  // identifier
    icon?: string;
}

// ─── Category → Sound Mapping ───────────────────────────────────

const CATEGORY_SOUND_MAP: Record<NotificationCategoryId, string> = {
    securityAlerts: 'urgent',
    priceAlerts: 'price',
    customAlerts: 'price',
    tradingInsights: 'info',
    advancedTransactions: 'success',
    offersAnnouncements: 'gentle',
    smartAlerts: 'info',
    system: 'info',
};

// ─── Category → Toast Variant (Sprint 13 enhanced) ──────────────

const CATEGORY_VARIANT_MAP: Record<NotificationCategoryId, NotificationVariant> = {
    securityAlerts: 'warning',
    priceAlerts: 'success',
    customAlerts: 'info',
    tradingInsights: 'info',
    advancedTransactions: 'success',
    offersAnnouncements: 'info',
    smartAlerts: 'info',
    system: 'info',
};

// Sprint 13: Category → Accent Color for toast styling
const CATEGORY_ACCENT: Record<NotificationCategoryId, string> = {
    securityAlerts: '#f59e0b',    // amber
    priceAlerts: '#22c55e',       // green
    customAlerts: '#3b82f6',      // blue
    tradingInsights: '#6366f1',   // indigo
    advancedTransactions: '#22c55e', // green
    offersAnnouncements: '#8b5cf6',  // violet
    smartAlerts: '#3b82f6',       // blue
    system: '#6b7280',            // gray
};

// ─── Sprint 12: Push Notification Grouping ──────────────────────

let _pushGroupCount = 0;
let _pushGroupTimer: ReturnType<typeof setTimeout> | null = null;
const _pushGroupBuffer: NotificationPayload[] = [];
const PUSH_GROUP_WINDOW_MS = 3000; // 3s window to batch push notifications

function flushPushGroup(): void {
    if (_pushGroupBuffer.length === 0) return;

    if (_pushGroupBuffer.length === 1) {
        _deliverSinglePush(_pushGroupBuffer[0]);
    } else {
        // Group multiple push notifications
        const count = _pushGroupBuffer.length;
        const catLabel = count > 1
            ? `${count} new notifications`
            : _pushGroupBuffer[0].title;

        try {
            new Notification(catLabel, {
                body: _pushGroupBuffer.map(p => p.body).slice(0, 3).join('\n') +
                      (count > 3 ? `\n+${count - 3} more` : ''),
                icon: '/favicon.svg',
                tag: 'charEdge-group',
                // @ts-expect-error renotify is valid for grouped notifications
                renotify: true,
            });
        } catch (err) { logger.data.warn('[NotificationRouter] Push group delivery failed:', (err as Error)?.message); }
    }

    _pushGroupCount += _pushGroupBuffer.length;
    _pushGroupBuffer.length = 0;
    _pushGroupTimer = null;

    // Sprint 12: Update badge count (PWA)
    _updateBadge();
}

function _deliverSinglePush(payload: NotificationPayload): void {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    try {
        const options: NotificationOptions & { actions?: PushAction[]; renotify?: boolean; data?: unknown } = {
            body: payload.body,
            icon: '/favicon.svg',
            tag: `charEdge-${payload.category}-${Date.now()}`,
            renotify: true,
            data: {
                clickPath: payload.clickPath,
                category: payload.category,
                meta: payload.meta,
            },
        };

        // Sprint 12: Add action buttons if supported
        if (payload.actions && payload.actions.length > 0) {
            options.actions = payload.actions;
        }

        new Notification(payload.title, options);
    } catch (err) {
        logger.data.warn('[NotificationRouter] Single push failed:', (err as Error)?.message);
    }
}

/**
 * Sprint 12: Send a browser push notification with grouping.
 * Buffers notifications within a 3s window and groups them.
 */
function deliverPush(payload: NotificationPayload): void {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    _pushGroupBuffer.push(payload);

    if (!_pushGroupTimer) {
        _pushGroupTimer = setTimeout(flushPushGroup, PUSH_GROUP_WINDOW_MS);
    }
}

/**
 * Sprint 12: Update PWA badge count
 */
function _updateBadge(): void {
    try {
        if ('setAppBadge' in navigator) {
            (navigator as any).setAppBadge(_pushGroupCount);
        }
    } catch (err) { logger.data.warn('[NotificationRouter] Badge update failed:', (err as Error)?.message); }
}

/** Reset badge count */
export function clearBadge(): void {
    _pushGroupCount = 0;
    try {
        if ('clearAppBadge' in navigator) {
            (navigator as any).clearAppBadge();
        }
    } catch (err) { logger.data.warn('[NotificationRouter] Badge clear failed:', (err as Error)?.message); }
}

// ─── Sprint 13: Enhanced In-App Toast ───────────────────────────

/**
 * Dispatch an enhanced in-app toast notification.
 * Sprint 13: Includes category accent color, click-through, and icon.
 */
function deliverInApp(payload: NotificationPayload): void {
    if (typeof window === 'undefined') return;

    const variant = payload.variant || CATEGORY_VARIANT_MAP[payload.category] || 'info';
    const accent = CATEGORY_ACCENT[payload.category] || '#6b7280';

    // Sprint 13: Enhanced toast event with category metadata
    window.dispatchEvent(
        new CustomEvent('charEdge:notification', {
            detail: {
                title: payload.title,
                body: payload.body,
                icon: payload.icon,
                variant,
                category: payload.category,
                meta: payload.meta,
                // Sprint 13 additions:
                accent,
                clickPath: payload.clickPath,
                categoryLabel: payload.category,
            },
        }),
    );

    // Also dispatch any custom event the caller requested
    if (payload.customEvent) {
        window.dispatchEvent(
            new CustomEvent(payload.customEvent, {
                detail: payload.customEventDetail || {
                    message: payload.body,
                    category: payload.category,
                    meta: payload.meta,
                },
            }),
        );
    }
}

// ─── Sound Delivery ─────────────────────────────────────────────

function deliverSound(payload: NotificationPayload): void {
    const soundType = payload.soundType || CATEGORY_SOUND_MAP[payload.category] || 'price';
    try {
        playAlertSound(soundType as any, getAlertVolume());
    } catch {
        /* audio may be blocked by browser autoplay policy */
    }
}

// ─── Activity Log ───────────────────────────────────────────────

function deliverLog(payload: NotificationPayload): void {
    const variantToType: Record<NotificationVariant, string> = {
        success: 'success',
        warning: 'warning',
        error: 'error',
        info: 'info',
    };
    const variant = payload.variant || CATEGORY_VARIANT_MAP[payload.category] || 'info';

    notificationLog.push({
        type: variantToType[variant] || 'info',
        message: `${payload.icon || ''} ${payload.title}: ${payload.body}`.trim(),
        category: payload.category,
        meta: payload.meta,
    });
}

// ─── Sprint 14: Email Digest ────────────────────────────────────

const _digestBuffer: NotificationPayload[] = [];

/**
 * Sprint 14: Generate and open an email digest summary.
 * Opens the user's email client with a formatted alert summary.
 */
export function generateEmailDigest(): void {
    const today = new Date();
    const dateStr = today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

    const subject = encodeURIComponent(`charEdge Alert Summary — ${dateStr}`);

    let body = `charEdge Alert Summary — ${dateStr}\n`;
    body += `${'═'.repeat(50)}\n\n`;

    if (_digestBuffer.length === 0) {
        body += 'No alerts in the current digest period.\n';
    } else {
        body += `📊 ${_digestBuffer.length} alert${_digestBuffer.length > 1 ? 's' : ''} in digest\n\n`;
        _digestBuffer.slice(-20).forEach((entry, i) => {
            body += `${i + 1}. ${entry.icon || '🔔'} ${entry.title}: ${entry.body}\n`;
        });
    }

    body += `\n${'─'.repeat(50)}\n`;
    body += `Sent from charEdge · Manage at Settings > Notifications\n`;

    const encodedBody = encodeURIComponent(body);
    window.open(`mailto:?subject=${subject}&body=${encodedBody}`, '_self');
}

/**
 * Sprint 14: Add to digest buffer.
 */
export function addToDigest(payload: NotificationPayload): void {
    _digestBuffer.push(payload);
}

/**
 * Sprint 14: Get current digest buffer.
 */
export function getDigestBuffer(): NotificationPayload[] {
    return [..._digestBuffer];
}

/**
 * Sprint 14: Clear digest buffer after sending.
 */
export function clearDigest(): void {
    _digestBuffer.length = 0;
}

// ─── Channel Delivery Map ───────────────────────────────────────

const CHANNEL_HANDLERS: Record<ChannelKey, (p: NotificationPayload) => void> = {
    push: deliverPush,
    inApp: deliverInApp,
    email: (p) => { addToDigest(p); }, // Sprint 14: buffer for email digest
    sound: deliverSound,
};

// ─── Main Router ────────────────────────────────────────────────

/**
 * Central notification dispatch — THE one function all notification
 * sources should call. Routes to enabled channels, respects pause/DND.
 */
export function notify(payload: NotificationPayload): void {
    const channels: ChannelKey[] = ['push', 'inApp', 'sound', 'email'];

    for (const channel of channels) {
        if (shouldDeliver(payload.category, channel)) {
            try {
                CHANNEL_HANDLERS[channel](payload);
            } catch {
                /* individual channel failure should not break others */
            }
        }
    }

    // Always log to activity log
    deliverLog(payload);
}

/**
 * Batch-send multiple notifications.
 */
export function notifyBatch(payloads: NotificationPayload[]): void {
    for (const payload of payloads) {
        notify(payload);
    }
}

/**
 * Request browser notification permission if not already granted.
 */
export function requestPushPermission(): void {
    if (typeof window === 'undefined') return;
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

// ─── Convenience Helpers ────────────────────────────────────────

/** Fire a price alert notification */
export function notifyPriceAlert(symbol: string, condition: string, price: number, meta?: Record<string, unknown>): void {
    notify({
        category: 'priceAlerts',
        title: `🔔 ${symbol} Price Alert`,
        body: `${symbol} hit $${price.toFixed(2)} (${condition})`,
        icon: '📈',
        variant: 'success',
        soundType: 'price',
        meta: { symbol, price, condition, ...meta },
        clickPath: `/charts?symbol=${symbol}`,
        actions: [
            { title: 'View Chart', action: 'view-chart' },
            { title: 'Snooze 1h', action: 'snooze' },
        ],
        customEvent: 'charEdge:alert-triggered',
        customEventDetail: { symbol, price, condition, ...meta },
    });
}

/** Fire a trade activity notification */
export function notifyTradeActivity(event: string, body: string, meta?: Record<string, unknown>): void {
    notify({
        category: 'advancedTransactions',
        title: event,
        body,
        icon: '📋',
        variant: 'success',
        soundType: 'success',
        meta,
        actions: [
            { title: 'View Trade', action: 'view-trade' },
        ],
    });
}

/** Fire a security notification */
export function notifySecurity(title: string, body: string, meta?: Record<string, unknown>): void {
    notify({
        category: 'securityAlerts',
        title,
        body,
        icon: '🔐',
        variant: 'warning',
        soundType: 'urgent',
        meta,
    });
}

/** Fire a smart alert notification */
export function notifySmartAlert(title: string, body: string, meta?: Record<string, unknown>): void {
    notify({
        category: 'smartAlerts',
        title,
        body,
        icon: '⚡',
        variant: 'info',
        soundType: 'info',
        meta,
        clickPath: '/charts',
    });
}

/** Fire an announcement notification */
export function notifyAnnouncement(title: string, body: string, meta?: Record<string, unknown>): void {
    notify({
        category: 'offersAnnouncements',
        title,
        body,
        icon: '🎁',
        variant: 'info',
        soundType: 'gentle',
        meta,
    });
}

export default notify;
