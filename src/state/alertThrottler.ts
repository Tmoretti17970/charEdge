// ═══════════════════════════════════════════════════════════════════
// charEdge — Alert Frequency Throttler (Sprint 8)
//
// Smart throttling service for the three frequency modes:
//   - Instant: every alert fires immediately
//   - Balanced: max 1 alert per symbol per 15min, batches similar
//   - Quiet: suppresses all except urgent (>10% price move)
//
// Usage:
//   import { throttledNotify } from './alertThrottler';
//   throttledNotify(payload); // replaces direct notify() for price alerts
// ═══════════════════════════════════════════════════════════════════

import { useNotificationPreferences } from './useNotificationPreferences';
import { notify, notifyPriceAlert } from './notificationRouter';
import type { NotificationPayload } from './notificationRouter';

// ─── Types ──────────────────────────────────────────────────────

type FrequencyMode = 'instant' | 'balanced' | 'quiet';

interface ThrottleRecord {
  lastFired: number;
  count: number;           // alerts suppressed since last fire
  suppressed: string[];    // messages that were batched
  lastPrice: number;
  basePrice: number;       // price at first alert (for % change detection)
}

// ─── State ──────────────────────────────────────────────────────

const throttleMap = new Map<string, ThrottleRecord>();

// Balanced mode: max 1 per symbol per window
const BALANCED_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Urgent override: fires immediately regardless of mode if price moves this much
const URGENT_PERCENT_THRESHOLD = 10; // 10%

// Quiet mode: batch interval for digest
const QUIET_DIGEST_INTERVAL_MS = 60 * 60 * 1000; // 1 hour (collect, then fire batch)
let quietDigestTimer: ReturnType<typeof setInterval> | null = null;
const quietBatchQueue: NotificationPayload[] = [];

// ─── Helpers ────────────────────────────────────────────────────

function getFrequency(): FrequencyMode {
  return useNotificationPreferences.getState().alertFrequency as FrequencyMode;
}

function isUrgentPriceMove(symbol: string, currentPrice: number): boolean {
  const record = throttleMap.get(symbol);
  if (!record || !record.basePrice) return false;
  const pctChange = Math.abs((currentPrice - record.basePrice) / record.basePrice) * 100;
  return pctChange >= URGENT_PERCENT_THRESHOLD;
}

function getOrCreateRecord(symbol: string, price: number): ThrottleRecord {
  let record = throttleMap.get(symbol);
  if (!record) {
    record = {
      lastFired: 0,
      count: 0,
      suppressed: [],
      lastPrice: price,
      basePrice: price,
    };
    throttleMap.set(symbol, record);
  }
  record.lastPrice = price;
  return record;
}

// ─── Core Throttle Logic ────────────────────────────────────────

/**
 * Throttled notification dispatch for price alerts.
 * Respects the user's frequency preference (Instant/Balanced/Quiet).
 */
export function throttledNotify(payload: NotificationPayload): void {
  const freq = getFrequency();
  const symbol = (payload.meta?.symbol as string) || '';
  const price = (payload.meta?.price as number) || 0;

  // Always fires for non-price categories
  if (payload.category !== 'priceAlerts') {
    notify(payload);
    return;
  }

  // ── Urgent override: 10%+ moves always fire immediately ──
  if (symbol && price && isUrgentPriceMove(symbol, price)) {
    const record = getOrCreateRecord(symbol, price);
    record.basePrice = price; // reset base after urgent fire
    record.lastFired = Date.now();
    record.count = 0;
    record.suppressed = [];

    notify({
      ...payload,
      title: `🚨 ${symbol} Urgent Alert`,
      body: `${payload.body} (significant price movement detected)`,
      soundType: 'urgent',
      variant: 'warning',
    });
    return;
  }

  switch (freq) {
    case 'instant':
      handleInstant(payload, symbol, price);
      break;
    case 'balanced':
      handleBalanced(payload, symbol, price);
      break;
    case 'quiet':
      handleQuiet(payload, symbol, price);
      break;
    default:
      notify(payload);
  }
}

// ─── Instant Mode ───────────────────────────────────────────────

function handleInstant(payload: NotificationPayload, symbol: string, price: number): void {
  const record = getOrCreateRecord(symbol, price);
  record.lastFired = Date.now();
  record.basePrice = price;
  notify(payload);
}

// ─── Balanced Mode ──────────────────────────────────────────────

function handleBalanced(payload: NotificationPayload, symbol: string, price: number): void {
  const record = getOrCreateRecord(symbol, price);
  const now = Date.now();
  const elapsed = now - record.lastFired;

  if (elapsed >= BALANCED_WINDOW_MS) {
    // Window expired — fire (include batch summary if there were suppressed alerts)
    if (record.count > 0) {
      notify({
        ...payload,
        title: `🔔 ${symbol} Price Alerts`,
        body: `${record.count + 1} alerts in the last ${Math.round(BALANCED_WINDOW_MS / 60000)}min — latest: ${payload.body}`,
        meta: { ...payload.meta, batched: true, batchCount: record.count + 1 },
      });
    } else {
      notify(payload);
    }
    record.lastFired = now;
    record.count = 0;
    record.suppressed = [];
    record.basePrice = price;
  } else {
    // Within window — suppress and batch
    record.count++;
    record.suppressed.push(payload.body);
  }
}

// ─── Quiet Mode ─────────────────────────────────────────────────

function handleQuiet(payload: NotificationPayload, _symbol: string, price: number): void {
  // In quiet mode, queue everything for periodic digest
  quietBatchQueue.push(payload);
  getOrCreateRecord(_symbol, price);

  // Start digest timer if not running
  if (!quietDigestTimer) {
    quietDigestTimer = setInterval(flushQuietDigest, QUIET_DIGEST_INTERVAL_MS);
  }
}

function flushQuietDigest(): void {
  if (quietBatchQueue.length === 0) return;

  const count = quietBatchQueue.length;
  const symbols = [...new Set(quietBatchQueue.map((p) => (p.meta?.symbol as string) || '?'))];
  const symbolSummary = symbols.slice(0, 5).join(', ') + (symbols.length > 5 ? ` +${symbols.length - 5} more` : '');

  notify({
    category: 'priceAlerts',
    title: `📊 Alert Digest`,
    body: `${count} alert${count > 1 ? 's' : ''} triggered (${symbolSummary})`,
    icon: '📊',
    variant: 'info',
    soundType: 'gentle',
    meta: { digest: true, count, symbols },
  });

  quietBatchQueue.length = 0;
}

// ─── Public API ─────────────────────────────────────────────────

/** Get current throttle stats (for UI display) */
export function getThrottleStats(): { symbol: string; suppressed: number; lastFired: number }[] {
  const stats: { symbol: string; suppressed: number; lastFired: number }[] = [];
  throttleMap.forEach((record, symbol) => {
    stats.push({
      symbol,
      suppressed: record.count,
      lastFired: record.lastFired,
    });
  });
  return stats;
}

/** Reset throttle state for a symbol */
export function resetThrottle(symbol: string): void {
  throttleMap.delete(symbol);
}

/** Clear all throttle state */
export function clearAllThrottles(): void {
  throttleMap.clear();
  quietBatchQueue.length = 0;
  if (quietDigestTimer) {
    clearInterval(quietDigestTimer);
    quietDigestTimer = null;
  }
}

/** Manually flush the quiet mode digest */
export { flushQuietDigest };

export default throttledNotify;
