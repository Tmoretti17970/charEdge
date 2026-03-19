// ═══════════════════════════════════════════════════════════════════
// charEdge — Notification Engine (Sprint 3 Consolidation)
//
// Non-React notification logic. Consolidates:
//   • notificationRouter.ts (Sprints 3 + 12-14) — routing, push,
//     toast, sound, badges, email digest
//   • notificationAnalytics.ts (Sprint 20) — alert performance
//     stats, false positive detection, optimization suggestions
//
// All UI state lives in useNotificationStore.ts
// ═══════════════════════════════════════════════════════════════════

import { shouldDeliver, getAlertVolume, notificationLog } from './useNotificationStore';
import { playAlertSound } from '../app/misc/alertSounds';
import { logger } from '@/observability/logger';
import type { NotificationCategoryId, ChannelKey } from './useNotificationStore';

// ═══════════════════════════════════════════════════════════════════
//  PART A: Notification Router (ex notificationRouter.ts)
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export type NotificationVariant = 'success' | 'warning' | 'error' | 'info';

export interface NotificationPayload {
    category: NotificationCategoryId;
    title: string;
    body: string;
    icon?: string;
    variant?: NotificationVariant;
    soundType?: 'price' | 'urgent' | 'info' | 'success' | 'gentle';
    meta?: Record<string, unknown> | undefined;
    skipToast?: boolean;
    customEvent?: string;
    customEventDetail?: unknown;
    actions?: PushAction[];
    clickPath?: string;
}

export interface PushAction {
    title: string;
    action: string;
    icon?: string;
}

// ─── Category Maps ──────────────────────────────────────────────

const CATEGORY_SOUND_MAP: Record<NotificationCategoryId, string> = {
    securityAlerts: 'urgent', priceAlerts: 'price', customAlerts: 'price',
    tradingInsights: 'info', advancedTransactions: 'success',
    offersAnnouncements: 'gentle', smartAlerts: 'info', system: 'info',
};

const CATEGORY_VARIANT_MAP: Record<NotificationCategoryId, NotificationVariant> = {
    securityAlerts: 'warning', priceAlerts: 'success', customAlerts: 'info',
    tradingInsights: 'info', advancedTransactions: 'success',
    offersAnnouncements: 'info', smartAlerts: 'info', system: 'info',
};

const CATEGORY_ACCENT: Record<NotificationCategoryId, string> = {
    securityAlerts: '#f59e0b', priceAlerts: '#22c55e', customAlerts: '#3b82f6',
    tradingInsights: '#6366f1', advancedTransactions: '#22c55e',
    offersAnnouncements: '#8b5cf6', smartAlerts: '#3b82f6', system: '#6b7280',
};

// ─── Push Notification Grouping ─────────────────────────────────

let _pushGroupCount = 0;
let _pushGroupTimer: ReturnType<typeof setTimeout> | null = null;
const _pushGroupBuffer: NotificationPayload[] = [];
const PUSH_GROUP_WINDOW_MS = 3000;

function flushPushGroup(): void {
    if (_pushGroupBuffer.length === 0) return;
    if (_pushGroupBuffer.length === 1) {
        _deliverSinglePush(_pushGroupBuffer[0]);
    } else {
        const count = _pushGroupBuffer.length;
        try {
            new Notification(count > 1 ? `${count} new notifications` : _pushGroupBuffer[0].title, {
                body: _pushGroupBuffer.map(p => p.body).slice(0, 3).join('\n') +
                      (count > 3 ? `\n+${count - 3} more` : ''),
                icon: '/favicon.svg',
                tag: 'charEdge-group',
                // @ts-expect-error renotify is valid for grouped notifications
                renotify: true,
            });
        } catch (err) { logger.data.warn('[NotificationEngine] Push group failed:', (err as Error)?.message); }
    }
    _pushGroupCount += _pushGroupBuffer.length;
    _pushGroupBuffer.length = 0;
    _pushGroupTimer = null;
    _updateBadge();
}

function _deliverSinglePush(payload: NotificationPayload): void {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
        const options: NotificationOptions & { actions?: PushAction[]; renotify?: boolean; data?: unknown } = {
            body: payload.body, icon: '/favicon.svg',
            tag: `charEdge-${payload.category}-${Date.now()}`, renotify: true,
            data: { clickPath: payload.clickPath, category: payload.category, meta: payload.meta },
        };
        if (payload.actions && payload.actions.length > 0) options.actions = payload.actions;
        new Notification(payload.title, options);
    } catch (err) { logger.data.warn('[NotificationEngine] Push failed:', (err as Error)?.message); }
}

function deliverPush(payload: NotificationPayload): void {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    _pushGroupBuffer.push(payload);
    if (!_pushGroupTimer) _pushGroupTimer = setTimeout(flushPushGroup, PUSH_GROUP_WINDOW_MS);
}

function _updateBadge(): void {
    try { if ('setAppBadge' in navigator) (navigator as any).setAppBadge(_pushGroupCount); }
    catch (err) { logger.data.warn('[NotificationEngine] Badge update failed:', (err as Error)?.message); }
}

export function clearBadge(): void {
    _pushGroupCount = 0;
    try { if ('clearAppBadge' in navigator) (navigator as any).clearAppBadge(); }
    catch (err) { logger.data.warn('[NotificationEngine] Badge clear failed:', (err as Error)?.message); }
}

// ─── In-App Toast ───────────────────────────────────────────────

function deliverInApp(payload: NotificationPayload): void {
    if (typeof window === 'undefined') return;
    const variant = payload.variant || CATEGORY_VARIANT_MAP[payload.category] || 'info';
    const accent = CATEGORY_ACCENT[payload.category] || '#6b7280';
    window.dispatchEvent(new CustomEvent('charEdge:notification', {
        detail: { title: payload.title, body: payload.body, icon: payload.icon, variant,
            category: payload.category, meta: payload.meta, accent, clickPath: payload.clickPath,
            categoryLabel: payload.category },
    }));
    if (payload.customEvent) {
        window.dispatchEvent(new CustomEvent(payload.customEvent, {
            detail: payload.customEventDetail || { message: payload.body, category: payload.category, meta: payload.meta },
        }));
    }
}

// ─── Sound / Log ────────────────────────────────────────────────

function deliverSound(payload: NotificationPayload): void {
    const soundType = payload.soundType || CATEGORY_SOUND_MAP[payload.category] || 'price';
    try { playAlertSound(soundType as any, getAlertVolume()); }
    catch { /* audio may be blocked by autoplay policy */ }
}

function deliverLog(payload: NotificationPayload): void {
    const variantToType: Record<NotificationVariant, string> = { success: 'success', warning: 'warning', error: 'error', info: 'info' };
    const variant = payload.variant || CATEGORY_VARIANT_MAP[payload.category] || 'info';
    notificationLog.push({
        type: variantToType[variant] || 'info',
        message: `${payload.icon || ''} ${payload.title}: ${payload.body}`.trim(),
        category: payload.category, meta: payload.meta,
    });
}

// ─── Email Digest ───────────────────────────────────────────────

const _digestBuffer: NotificationPayload[] = [];

export function generateEmailDigest(): void {
    const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    const subject = encodeURIComponent(`charEdge Alert Summary — ${dateStr}`);
    let body = `charEdge Alert Summary — ${dateStr}\n${'═'.repeat(50)}\n\n`;
    if (_digestBuffer.length === 0) { body += 'No alerts in the current digest period.\n'; }
    else {
        body += `📊 ${_digestBuffer.length} alert${_digestBuffer.length > 1 ? 's' : ''} in digest\n\n`;
        _digestBuffer.slice(-20).forEach((entry, i) => { body += `${i + 1}. ${entry.icon || '🔔'} ${entry.title}: ${entry.body}\n`; });
    }
    body += `\n${'─'.repeat(50)}\nSent from charEdge · Manage at Settings > Notifications\n`;
    window.open(`mailto:?subject=${subject}&body=${encodeURIComponent(body)}`, '_self');
}

export function addToDigest(payload: NotificationPayload): void { _digestBuffer.push(payload); }
export function getDigestBuffer(): NotificationPayload[] { return [..._digestBuffer]; }
export function clearDigest(): void { _digestBuffer.length = 0; }

// ─── Channel Handlers ───────────────────────────────────────────

const CHANNEL_HANDLERS: Record<ChannelKey, (p: NotificationPayload) => void> = {
    push: deliverPush,
    inApp: deliverInApp,
    email: (p) => { addToDigest(p); },
    sound: deliverSound,
};

// ─── Main Router ────────────────────────────────────────────────

export function notify(payload: NotificationPayload): void {
    const channels: ChannelKey[] = ['push', 'inApp', 'sound', 'email'];
    for (const channel of channels) {
        if (shouldDeliver(payload.category, channel)) {
            try { CHANNEL_HANDLERS[channel](payload); }
            catch { /* individual channel failure should not break others */ }
        }
    }
    deliverLog(payload);
}

export function notifyBatch(payloads: NotificationPayload[]): void {
    for (const p of payloads) notify(p);
}

export function requestPushPermission(): void {
    if (typeof window === 'undefined') return;
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
}

// ─── Convenience Helpers ────────────────────────────────────────

export function notifyPriceAlert(symbol: string, condition: string, price: number, meta?: Record<string, unknown>): void {
    notify({ category: 'priceAlerts', title: `🔔 ${symbol} Price Alert`,
        body: `${symbol} hit $${price.toFixed(2)} (${condition})`, icon: '📈', variant: 'success',
        soundType: 'price', meta: { symbol, price, condition, ...meta },
        clickPath: `/charts?symbol=${symbol}`,
        actions: [{ title: 'View Chart', action: 'view-chart' }, { title: 'Snooze 1h', action: 'snooze' }],
        customEvent: 'charEdge:alert-triggered', customEventDetail: { symbol, price, condition, ...meta },
    });
}

export function notifyTradeActivity(event: string, body: string, meta?: Record<string, unknown>): void {
    notify({ category: 'advancedTransactions', title: event, body, icon: '📋',
        variant: 'success', soundType: 'success', meta,
        actions: [{ title: 'View Trade', action: 'view-trade' }] });
}

export function notifySecurity(title: string, body: string, meta?: Record<string, unknown>): void {
    notify({ category: 'securityAlerts', title, body, icon: '🔐', variant: 'warning', soundType: 'urgent', meta });
}

export function notifySmartAlert(title: string, body: string, meta?: Record<string, unknown>): void {
    notify({ category: 'smartAlerts', title, body, icon: '⚡', variant: 'info', soundType: 'info', meta, clickPath: '/charts' });
}

export function notifyAnnouncement(title: string, body: string, meta?: Record<string, unknown>): void {
    notify({ category: 'offersAnnouncements', title, body, icon: '🎁', variant: 'info', soundType: 'gentle', meta });
}


// ═══════════════════════════════════════════════════════════════════
//  PART B: Alert Analytics (ex notificationAnalytics.ts)
// ═══════════════════════════════════════════════════════════════════

interface AlertSnapshot {
  id: string; symbol: string; condition: string; price: number;
  triggered: boolean; lastTriggered?: number; createdAt?: number;
  triggerCount?: number; expired?: boolean;
}

interface HistoryEntry {
  alertId: string; symbol: string; timestamp: number; priceAtTrigger: number;
  priceAfter5min?: number; priceAfter15min?: number; responseTimeMs?: number;
}

export interface AlertAnalytics {
  totalActive: number;
  staleCount: number;
  staleAlerts: { id: string; symbol: string; daysSinceCreated: number }[];
  mostActive: { symbol: string; condition: string; count: number } | null;
  avgResponseTimeMs: number;
  falsePositiveRate: number;
  alertsBySymbol: Record<string, number>;
  triggersByDayOfWeek: number[];
  triggersByHour: number[];
  suggestions: AnalyticsSuggestion[];
}

export interface AnalyticsSuggestion {
  type: 'removeStale' | 'adjustThreshold' | 'consolidate' | 'frequencyChange';
  title: string; body: string; icon: string; relatedAlertIds: string[];
}

const STALE_DAYS = 30;
const STALE_MS = STALE_DAYS * 24 * 60 * 60 * 1000;

export function getAlertAnalytics(alerts: AlertSnapshot[], history: HistoryEntry[]): AlertAnalytics {
  const now = Date.now();
  const active = alerts.filter((a) => !a.triggered && !a.expired);

  // Stale detection
  const staleAlerts = active
    .filter((a) => (now - (a.createdAt || now)) > STALE_MS && !a.lastTriggered)
    .map((a) => ({ id: a.id, symbol: a.symbol, daysSinceCreated: Math.floor((now - (a.createdAt || now)) / (24 * 60 * 60 * 1000)) }));

  // Most active
  const symbolCondMap = new Map<string, number>();
  const symbolCondDetails = new Map<string, { symbol: string; condition: string }>();
  for (const entry of history) {
    const key = entry.symbol;
    symbolCondMap.set(key, (symbolCondMap.get(key) || 0) + 1);
    if (!symbolCondDetails.has(key)) symbolCondDetails.set(key, { symbol: entry.symbol, condition: '' });
  }
  let mostActive: AlertAnalytics['mostActive'] = null;
  let maxCount = 0;
  symbolCondMap.forEach((count, key) => {
    if (count > maxCount) { maxCount = count; const d = symbolCondDetails.get(key); mostActive = { symbol: d?.symbol || key, condition: d?.condition || '', count }; }
  });

  // Response time
  const responseTimes = history.filter((h) => h.responseTimeMs && h.responseTimeMs > 0);
  const avgResponseTimeMs = responseTimes.length
    ? responseTimes.reduce((sum, h) => sum + (h.responseTimeMs || 0), 0) / responseTimes.length : 0;

  // False positive rate
  const withAfterPrice = history.filter((h) => h.priceAfter5min != null);
  const falsePositives = withAfterPrice.filter((h) => {
    if (!h.priceAfter5min) return false;
    return Math.abs(((h.priceAfter5min - h.priceAtTrigger) / h.priceAtTrigger) * 100) > 1;
  });
  const falsePositiveRate = withAfterPrice.length ? falsePositives.length / withAfterPrice.length : 0;

  // Distribution
  const alertsBySymbol: Record<string, number> = {};
  for (const a of alerts) alertsBySymbol[a.symbol] = (alertsBySymbol[a.symbol] || 0) + 1;
  const triggersByDayOfWeek = new Array(7).fill(0);
  const triggersByHour = new Array(24).fill(0);
  for (const entry of history) { const d = new Date(entry.timestamp); triggersByDayOfWeek[d.getDay()]++; triggersByHour[d.getHours()]++; }

  // Suggestions
  const suggestions: AnalyticsSuggestion[] = [];
  if (staleAlerts.length > 3) suggestions.push({ type: 'removeStale', title: `Remove ${staleAlerts.length} stale alerts`, body: `${staleAlerts.length} alerts haven't triggered in ${STALE_DAYS}+ days.`, icon: '🧹', relatedAlertIds: staleAlerts.map((a) => a.id) });
  for (const [symbol, count] of Object.entries(alertsBySymbol).filter(([, c]) => c >= 5)) {
    suggestions.push({ type: 'consolidate', title: `Consolidate ${symbol} alerts`, body: `You have ${count} alerts on ${symbol}. Consider using a template.`, icon: '📦', relatedAlertIds: alerts.filter((a) => a.symbol === symbol).map((a) => a.id) });
  }
  if (falsePositiveRate > 0.5 && withAfterPrice.length >= 5) suggestions.push({ type: 'frequencyChange', title: 'High false positive rate', body: `${Math.round(falsePositiveRate * 100)}% of alerts reversed quickly. Try "Balanced" mode.`, icon: '📊', relatedAlertIds: [] });

  return { totalActive: active.length, staleCount: staleAlerts.length, staleAlerts, mostActive, avgResponseTimeMs, falsePositiveRate, alertsBySymbol, triggersByDayOfWeek, triggersByHour, suggestions };
}

export default notify;
