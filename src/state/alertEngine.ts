// ═══════════════════════════════════════════════════════════════════
// charEdge — Alert Engine (Phase 2 Consolidation)
//
// Non-React alert logic consolidated from:
//   - alertThrottler.ts → throttledNotify, getThrottleStats, etc.
//   - alertSuggestions.ts → generatePriceSuggestions, etc.
//   - alertAutomations.ts → useAlertAutomations, executeAutomations
//
// This file is the single import point for all alert-related
// non-React utilities and engines.
// ═══════════════════════════════════════════════════════════════════

// ─── Alert Throttler ────────────────────────────────────────────

import { useNotificationPreferences } from './useNotificationStore';
import { notify } from './notificationEngine';
import type { NotificationPayload } from './notificationEngine';

type FrequencyMode = 'instant' | 'balanced' | 'quiet';

interface ThrottleRecord {
  lastFired: number;
  count: number;
  suppressed: string[];
  lastPrice: number;
  basePrice: number;
}

const throttleMap = new Map<string, ThrottleRecord>();
const BALANCED_WINDOW_MS = 15 * 60 * 1000;
const URGENT_PERCENT_THRESHOLD = 10;
const QUIET_DIGEST_INTERVAL_MS = 60 * 60 * 1000;
let quietDigestTimer: ReturnType<typeof setInterval> | null = null;
const quietBatchQueue: NotificationPayload[] = [];

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

export function throttledNotify(payload: NotificationPayload): void {
  const freq = getFrequency();
  const symbol = (payload.meta?.symbol as string) || '';
  const price = (payload.meta?.price as number) || 0;

  if (payload.category !== 'priceAlerts') {
    notify(payload);
    return;
  }

  if (symbol && price && isUrgentPriceMove(symbol, price)) {
    const record = getOrCreateRecord(symbol, price);
    record.basePrice = price;
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

function handleInstant(payload: NotificationPayload, symbol: string, price: number): void {
  const record = getOrCreateRecord(symbol, price);
  record.lastFired = Date.now();
  record.basePrice = price;
  notify(payload);
}

function handleBalanced(payload: NotificationPayload, symbol: string, price: number): void {
  const record = getOrCreateRecord(symbol, price);
  const now = Date.now();
  const elapsed = now - record.lastFired;

  if (elapsed >= BALANCED_WINDOW_MS) {
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
    record.count++;
    record.suppressed.push(payload.body);
  }
}

function handleQuiet(payload: NotificationPayload, _symbol: string, price: number): void {
  quietBatchQueue.push(payload);
  getOrCreateRecord(_symbol, price);

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

export function resetThrottle(symbol: string): void {
  throttleMap.delete(symbol);
}

export function clearAllThrottles(): void {
  throttleMap.clear();
  quietBatchQueue.length = 0;
  if (quietDigestTimer) {
    clearInterval(quietDigestTimer);
    quietDigestTimer = null;
  }
}

export { flushQuietDigest };

// ─── Alert Suggestions ──────────────────────────────────────────

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SuggestionType =
  | 'resistance'
  | 'support'
  | 'stopLoss'
  | 'watchlist52w'
  | 'percentMove'
  | 'roundNumber';

export interface AlertSuggestion {
  id: string;
  type: SuggestionType;
  symbol: string;
  title: string;
  body: string;
  icon: string;
  price: number;
  condition: string;
  timestamp: number;
  trigger: string;
}

interface SuggestionState {
  suggestions: AlertSuggestion[];
  dismissedIds: string[];
  dismissedTypes: string[];

  addSuggestion: (s: AlertSuggestion) => void;
  dismiss: (id: string) => void;
  dismissType: (symbol: string, type: SuggestionType) => void;
  clear: () => void;
  isDismissed: (id: string) => boolean;
  isTypeDismissed: (symbol: string, type: SuggestionType) => boolean;
}

const MAX_SUGGESTIONS = 5;

export const useSuggestionStore = create<SuggestionState>()(
  persist(
    (set, get) => ({
      suggestions: [],
      dismissedIds: [],
      dismissedTypes: [],

      addSuggestion: (s) => set((state) => {
        if (state.dismissedIds.includes(s.id)) return state;
        if (state.dismissedTypes.includes(`${s.symbol}:${s.type}`)) return state;
        if (state.suggestions.some((existing) => existing.id === s.id)) return state;

        const updated = [s, ...state.suggestions].slice(0, MAX_SUGGESTIONS);
        return { suggestions: updated };
      }),

      dismiss: (id) => set((state) => ({
        suggestions: state.suggestions.filter((s) => s.id !== id),
        dismissedIds: [...state.dismissedIds.slice(-50), id],
      })),

      dismissType: (symbol, type) => set((state) => ({
        suggestions: state.suggestions.filter((s) => !(s.symbol === symbol && s.type === type)),
        dismissedTypes: [...state.dismissedTypes.slice(-30), `${symbol}:${type}`],
      })),

      clear: () => set({ suggestions: [] }),

      isDismissed: (id) => get().dismissedIds.includes(id),
      isTypeDismissed: (symbol, type) => get().dismissedTypes.includes(`${symbol}:${type}`),
    }),
    {
      name: 'charEdge-alert-suggestions',
      partialize: (s) => ({ dismissedIds: s.dismissedIds, dismissedTypes: s.dismissedTypes }),
    },
  ),
);

export function generatePriceSuggestions(
  symbol: string,
  currentPrice: number,
  high52w?: number,
  low52w?: number,
): void {
  const store = useSuggestionStore.getState();

  const magnitude = currentPrice > 1000 ? 100 : currentPrice > 100 ? 10 : 1;
  const nextRound = Math.ceil(currentPrice / magnitude) * magnitude;

  if (nextRound !== currentPrice && !store.isTypeDismissed(symbol, 'roundNumber')) {
    const id = `${symbol}-round-${nextRound}`;
    if (!store.isDismissed(id)) {
      store.addSuggestion({
        id,
        type: 'roundNumber',
        symbol,
        title: `Set alert at $${nextRound.toLocaleString()}?`,
        body: `${symbol} is approaching the $${nextRound.toLocaleString()} level`,
        icon: '🎯',
        price: nextRound,
        condition: 'above',
        timestamp: Date.now(),
        trigger: 'chart_view',
      });
    }
  }

  const supportLevel = Math.round(currentPrice * 0.95 * 100) / 100;
  if (!store.isTypeDismissed(symbol, 'support')) {
    const id = `${symbol}-support-${supportLevel}`;
    if (!store.isDismissed(id)) {
      store.addSuggestion({
        id,
        type: 'support',
        symbol,
        title: `Alert if ${symbol} drops 5%?`,
        body: `Set alert at $${supportLevel.toFixed(2)} as a support level warning`,
        icon: '📉',
        price: supportLevel,
        condition: 'below',
        timestamp: Date.now(),
        trigger: 'chart_view',
      });
    }
  }

  if (high52w && currentPrice > high52w * 0.95 && !store.isTypeDismissed(symbol, 'resistance')) {
    const id = `${symbol}-52wh-${high52w}`;
    if (!store.isDismissed(id)) {
      store.addSuggestion({
        id,
        type: 'resistance',
        symbol,
        title: `Near 52-week high!`,
        body: `${symbol} is within ${((1 - currentPrice / high52w) * -100).toFixed(1)}% of its 52W high ($${high52w.toFixed(2)})`,
        icon: '🌟',
        price: high52w,
        condition: '52w_high',
        timestamp: Date.now(),
        trigger: 'proximity',
      });
    }
  }

  if (low52w && currentPrice < low52w * 1.05 && !store.isTypeDismissed(symbol, 'support')) {
    const id = `${symbol}-52wl-${low52w}`;
    if (!store.isDismissed(id)) {
      store.addSuggestion({
        id,
        type: 'support',
        symbol,
        title: `Near 52-week low`,
        body: `${symbol} is within ${((currentPrice / low52w - 1) * 100).toFixed(1)}% of its 52W low ($${low52w.toFixed(2)})`,
        icon: '⚠️',
        price: low52w,
        condition: '52w_low',
        timestamp: Date.now(),
        trigger: 'proximity',
      });
    }
  }
}

export function suggestStopLossAlert(
  symbol: string,
  entryPrice: number,
  side: 'long' | 'short' = 'long',
): void {
  const store = useSuggestionStore.getState();
  if (store.isTypeDismissed(symbol, 'stopLoss')) return;

  const slPercent = 0.02;
  const slPrice = side === 'long'
    ? Math.round(entryPrice * (1 - slPercent) * 100) / 100
    : Math.round(entryPrice * (1 + slPercent) * 100) / 100;

  const id = `${symbol}-sl-${slPrice}`;
  if (store.isDismissed(id)) return;

  store.addSuggestion({
    id,
    type: 'stopLoss',
    symbol,
    title: `Set stop-loss alert?`,
    body: `Alert if ${symbol} hits $${slPrice.toFixed(2)} (-${(slPercent * 100).toFixed(0)}% from entry)`,
    icon: '🛑',
    price: slPrice,
    condition: side === 'long' ? 'below' : 'above',
    timestamp: Date.now(),
    trigger: 'trade_entry',
  });
}

export function suggestWatchlistAlerts(symbol: string, currentPrice: number): void {
  const store = useSuggestionStore.getState();
  if (store.isTypeDismissed(symbol, 'watchlist52w')) return;

  const id = `${symbol}-watchlist-52w`;
  if (store.isDismissed(id)) return;

  store.addSuggestion({
    id,
    type: 'watchlist52w',
    symbol,
    title: `Enable 52W alerts for ${symbol}?`,
    body: `Get notified when ${symbol} hits a new 52-week high or low`,
    icon: '📊',
    price: currentPrice,
    condition: '52w_high',
    timestamp: Date.now(),
    trigger: 'watchlist_add',
  });
}

// ─── Alert Automations ──────────────────────────────────────────

export type AutomationAction =
  | 'closePosition'
  | 'trailingAlert'
  | 'logJournal'
  | 'switchChart'
  | 'mute1h'
  | 'playCustomSound';

export interface AutomationRule {
  id: string;
  alertId?: string;
  symbolPattern?: string;
  conditionType?: string;
  action: AutomationAction;
  params?: Record<string, unknown>;
  enabled: boolean;
  label: string;
  executionCount: number;
  lastExecuted: number;
}

interface AutomationState {
  rules: AutomationRule[];
  addRule: (rule: Omit<AutomationRule, 'id' | 'executionCount' | 'lastExecuted'>) => string;
  removeRule: (id: string) => void;
  toggleRule: (id: string) => void;
  updateRule: (id: string, updates: Partial<AutomationRule>) => void;
  getRulesForAlert: (alertId: string, symbol: string, condition?: string) => AutomationRule[];
}

let _ruleId = 0;

export const useAlertAutomations = create<AutomationState>()(
  persist(
    (set, get) => ({
      rules: [],

      addRule: (rule) => {
        const id = `auto-${Date.now()}-${++_ruleId}`;
        set((s) => ({
          rules: [...s.rules, { ...rule, id, executionCount: 0, lastExecuted: 0 }],
        }));
        return id;
      },

      removeRule: (id) => set((s) => ({
        rules: s.rules.filter((r) => r.id !== id),
      })),

      toggleRule: (id) => set((s) => ({
        rules: s.rules.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r),
      })),

      updateRule: (id, updates) => set((s) => ({
        rules: s.rules.map((r) => r.id === id ? { ...r, ...updates } : r),
      })),

      getRulesForAlert: (alertId, symbol, condition) => {
        return get().rules.filter((rule) => {
          if (!rule.enabled) return false;
          if (rule.alertId && rule.alertId === alertId) return true;
          if (rule.symbolPattern === '*') return true;
          if (rule.symbolPattern && rule.symbolPattern === symbol) {
            if (!rule.conditionType || rule.conditionType === condition) return true;
          }
          return false;
        });
      },
    }),
    { name: 'charEdge-alert-automations', version: 1 },
  ),
);

type ActionExecutor = (rule: AutomationRule, context: ExecutionContext) => void;

interface ExecutionContext {
  symbol: string;
  price: number;
  alertId: string;
  condition?: string;
}

const executors: Record<AutomationAction, ActionExecutor> = {
  closePosition: (_rule, ctx) => {
    window.dispatchEvent(new CustomEvent('charEdge:automation', {
      detail: { action: 'closePosition', symbol: ctx.symbol, price: ctx.price },
    }));
  },

  trailingAlert: (rule, ctx) => {
    const offsetPct = (rule.params?.offsetPercent as number) || 0.02;
    const isAbove = ctx.condition?.includes('above') || ctx.condition?.includes('high');
    const newPrice = isAbove
      ? ctx.price * (1 - offsetPct)
      : ctx.price * (1 + offsetPct);

    window.dispatchEvent(new CustomEvent('charEdge:automation', {
      detail: {
        action: 'createAlert',
        symbol: ctx.symbol,
        price: Math.round(newPrice * 100) / 100,
        condition: isAbove ? 'below' : 'above',
        source: 'trailing-automation',
      },
    }));
  },

  logJournal: (_rule, ctx) => {
    window.dispatchEvent(new CustomEvent('charEdge:automation', {
      detail: {
        action: 'logJournal',
        symbol: ctx.symbol,
        entry: `Alert triggered: ${ctx.symbol} at $${ctx.price} (${ctx.condition})`,
        timestamp: Date.now(),
      },
    }));
  },

  switchChart: (_rule, ctx) => {
    window.dispatchEvent(new CustomEvent('charEdge:automation', {
      detail: { action: 'switchChart', symbol: ctx.symbol },
    }));
  },

  mute1h: (_rule, ctx) => {
    window.dispatchEvent(new CustomEvent('charEdge:automation', {
      detail: { action: 'muteSymbol', symbol: ctx.symbol, durationMs: 3600000 },
    }));
  },

  playCustomSound: (rule, _ctx) => {
    const soundName = (rule.params?.soundName as string) || 'price';
    window.dispatchEvent(new CustomEvent('charEdge:automation', {
      detail: { action: 'playSound', sound: soundName },
    }));
  },
};

export function executeAutomations(
  alertId: string,
  symbol: string,
  price: number,
  condition?: string,
): void {
  const store = useAlertAutomations.getState();
  const rules = store.getRulesForAlert(alertId, symbol, condition);
  const context: ExecutionContext = { symbol, price, alertId, condition };

  for (const rule of rules) {
    const executor = executors[rule.action];
    if (executor) {
      try {
        executor(rule, context);
        useAlertAutomations.setState((s) => ({
          rules: s.rules.map((r) =>
            r.id === rule.id
              ? { ...r, executionCount: r.executionCount + 1, lastExecuted: Date.now() }
              : r,
          ),
        }));
      } catch (err) {
        console.warn(`[alertEngine] Rule ${rule.id} failed:`, err);
      }
    }
  }
}

// ─── Notification Analytics (pure functions) ────────────────────

export interface AlertSnapshot {
  id: string;
  symbol: string;
  condition: string;
  price: number;
  triggered: boolean;
  lastTriggered?: number;
  createdAt?: number;
  triggerCount?: number;
  expired?: boolean;
}

export interface HistoryEntry {
  alertId: string;
  symbol: string;
  timestamp: number;
  priceAtTrigger: number;
  priceAfter5min?: number;
  priceAfter15min?: number;
  responseTimeMs?: number;
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
  title: string;
  body: string;
  icon: string;
  relatedAlertIds: string[];
}

const STALE_DAYS = 30;
const STALE_MS = STALE_DAYS * 24 * 60 * 60 * 1000;

export function getAlertAnalytics(
  alerts: AlertSnapshot[],
  history: HistoryEntry[],
): AlertAnalytics {
  const now = Date.now();
  const active = alerts.filter((a) => !a.triggered && !a.expired);

  const staleAlerts = active
    .filter((a) => {
      const sinceCreated = now - (a.createdAt || now);
      return sinceCreated > STALE_MS && !a.lastTriggered;
    })
    .map((a) => ({
      id: a.id,
      symbol: a.symbol,
      daysSinceCreated: Math.floor((now - (a.createdAt || now)) / (24 * 60 * 60 * 1000)),
    }));

  const symbolCondMap = new Map<string, number>();
  const symbolCondDetails = new Map<string, { symbol: string; condition: string }>();
  for (const entry of history) {
    const key = `${entry.symbol}`;
    symbolCondMap.set(key, (symbolCondMap.get(key) || 0) + 1);
    if (!symbolCondDetails.has(key)) {
      symbolCondDetails.set(key, { symbol: entry.symbol, condition: '' });
    }
  }
  let mostActive: AlertAnalytics['mostActive'] = null;
  let maxCount = 0;
  symbolCondMap.forEach((count, key) => {
    if (count > maxCount) {
      maxCount = count;
      const details = symbolCondDetails.get(key);
      mostActive = { symbol: details?.symbol || key, condition: details?.condition || '', count };
    }
  });

  const responseTimes = history.filter((h) => h.responseTimeMs && h.responseTimeMs > 0);
  const avgResponseTimeMs = responseTimes.length
    ? responseTimes.reduce((sum, h) => sum + (h.responseTimeMs || 0), 0) / responseTimes.length
    : 0;

  const withAfterPrice = history.filter((h) => h.priceAfter5min != null);
  const falsePositives = withAfterPrice.filter((h) => {
    if (!h.priceAfter5min) return false;
    const pctChange = ((h.priceAfter5min - h.priceAtTrigger) / h.priceAtTrigger) * 100;
    return Math.abs(pctChange) > 1;
  });
  const falsePositiveRate = withAfterPrice.length
    ? falsePositives.length / withAfterPrice.length
    : 0;

  const alertsBySymbol: Record<string, number> = {};
  for (const a of alerts) {
    alertsBySymbol[a.symbol] = (alertsBySymbol[a.symbol] || 0) + 1;
  }

  const triggersByDayOfWeek = new Array(7).fill(0);
  const triggersByHour = new Array(24).fill(0);
  for (const entry of history) {
    const d = new Date(entry.timestamp);
    triggersByDayOfWeek[d.getDay()]++;
    triggersByHour[d.getHours()]++;
  }

  const suggestions: AnalyticsSuggestion[] = [];

  if (staleAlerts.length > 3) {
    suggestions.push({
      type: 'removeStale',
      title: `Remove ${staleAlerts.length} stale alerts`,
      body: `${staleAlerts.length} alerts haven't triggered in ${STALE_DAYS}+ days. Consider cleaning them up.`,
      icon: '🧹',
      relatedAlertIds: staleAlerts.map((a) => a.id),
    });
  }

  const overdoneSymbols = Object.entries(alertsBySymbol).filter(([, count]) => count >= 5);
  for (const [symbol, count] of overdoneSymbols) {
    suggestions.push({
      type: 'consolidate',
      title: `Consolidate ${symbol} alerts`,
      body: `You have ${count} alerts on ${symbol}. Consider using an alert template instead.`,
      icon: '📦',
      relatedAlertIds: alerts.filter((a) => a.symbol === symbol).map((a) => a.id),
    });
  }

  if (falsePositiveRate > 0.5 && withAfterPrice.length >= 5) {
    suggestions.push({
      type: 'frequencyChange',
      title: 'High false positive rate',
      body: `${Math.round(falsePositiveRate * 100)}% of your alerts reversed quickly. Try "Balanced" frequency mode.`,
      icon: '📊',
      relatedAlertIds: [],
    });
  }

  return {
    totalActive: active.length,
    staleCount: staleAlerts.length,
    staleAlerts,
    mostActive,
    avgResponseTimeMs,
    falsePositiveRate,
    alertsBySymbol,
    triggersByDayOfWeek,
    triggersByHour,
    suggestions,
  };
}

export default throttledNotify;
