// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Unified Alert Store (TypeScript)
//
// Phase 2 Consolidation: Merged from 7 files into 1:
//   - useAlertStore.ts (core CRUD + evaluation)
//   - useAlertHistory.ts → history slice
//   - useSmartAlertFeed.ts → smartFeed slice
//   - useAlertPreferences.ts → removed (was already a wrapper)
//
// Non-React logic moved to alertEngine.ts:
//   - alertThrottler, alertSuggestions, alertAutomations
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { throttledNotify } from './alertEngine';

// ─── Transient Price Tracking ───────────────────────────────────
// Stored outside Zustand to avoid triggering set()/persist on every tick.
// This map is never persisted — it's ephemeral runtime state.
const _lastPrices = new Map<string, number>();

// D5: Transient per-sub-condition satisfaction timestamps for temporal windows
// Key: "alertId:conditionIndex" → timestamp when condition was last satisfied
const _conditionSatisfiedAt: Map<string, number> = new Map();

// ─── Types ──────────────────────────────────────────────────────

export type AlertCondition =
  | 'above'
  | 'below'
  | 'cross_above'
  | 'cross_below'
  | 'percent_above'
  | 'percent_below'
  | '52w_high'
  | '52w_low';

export type AlertVisualStyle = 'price' | 'system' | 'indicator';

export type AlertSoundType = 'price' | 'urgent' | 'info' | 'success' | 'error';

export type PercentTimeWindow = '1h' | '4h' | '24h' | '7d';

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
  // Position-bound alert fields
  linkedPositionId?: string | null;
  linkedLevelType?: 'sl' | 'tp' | null;
  // Coinbase-style market condition fields
  percentThreshold?: number | null; // For percent_above/below: e.g. 5 = ±5%
  timeWindow?: PercentTimeWindow | null; // For percent alerts: measurement window
  alertCategory?: 'price_target' | 'percent_change' | '52w_range' | 'custom'; // UI display category
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

export interface MarketAlertParams {
  symbol: string;
  preset: '52w_high' | '52w_low' | 'percent_5_up' | 'percent_5_down' | 'percent_10_up' | 'percent_10_down';
  note?: string;
  repeating?: boolean;
  soundType?: AlertSoundType | null;
}

// ─── History Slice Types (absorbed from useAlertHistory.ts) ──

export interface AlertHistoryEntry {
  id: string;
  alertId: string;
  symbol: string;
  condition: string;
  targetPrice: number;
  triggerPrice: number;
  triggeredAt: string;
  note: string;
  priceAt5m: number | null;
  priceAt15m: number | null;
  priceAt1h: number | null;
  outcome5m: number | null;
  outcome15m: number | null;
  outcome1h: number | null;
}

// ─── Smart Feed Slice Types (absorbed from useSmartAlertFeed.ts) ──

export interface SmartAlertEvent {
  id: string;
  type: 'price' | 'volume' | 'pattern' | 'earnings' | 'insider' | 'analyst' | 'sentiment';
  symbol: string;
  priority: 'critical' | 'important' | 'fyi';
  message: string;
  time: string;
  outcome: string | null;
}

// ─── Combined State & Actions ───────────────────────────────

export interface AlertState {
  alerts: Alert[];
  pushSubscribed: boolean;
  // History slice
  historyEntries: AlertHistoryEntry[];
  // Smart feed slice
  smartEvents: SmartAlertEvent[];
  smartIsLive: boolean;
}

export interface AlertActions {
  addAlert: (params: AddAlertParams) => string;
  addCompoundAlert: (params: AddCompoundAlertParams) => string;
  addMarketAlert: (params: MarketAlertParams) => string;
  removeAlert: (id: string) => void;
  toggleAlert: (id: string) => void;
  triggerAlert: (id: string) => void;
  updateAlertPrice: (id: string, newPrice: number) => void;
  updateLastPrice: (symbol: string, price: number) => void;
  clearTriggered: () => void;
  clearAll: () => void;
  getAlertsForSymbol: (symbol: string) => Alert[];
  subscribeToPush: () => Promise<void>;
  // History slice actions
  pushHistoryEntry: (
    alert: { id: string; symbol: string; condition: string; price: number; note?: string },
    triggerPrice: number,
  ) => string;
  updateHistoryOutcome: (entryId: string, timeframe: '5m' | '15m' | '1h', price: number) => void;
  clearHistory: () => void;
  getHistoryBySymbol: (symbol: string) => AlertHistoryEntry[];
  // Smart feed slice actions
  pushSmartEvent: (event: Omit<SmartAlertEvent, 'id' | 'time'>) => void;
  setSmartLive: (live: boolean) => void;
  clearSmartEvents: () => void;
}

// ─── Store ──────────────────────────────────────────────────────

const ALERT_KEY = 'charEdge-alerts';

const MAX_HISTORY_ENTRIES = 200;
const MAX_SMART_EVENTS = 50;

const useAlertStore = create<AlertState & AlertActions>()(
  persist(
    (set, _get) => ({
      alerts: [],
      pushSubscribed: false,

      // ── History Slice ────────────────────────────────
      historyEntries: [],

      // ── Smart Feed Slice ─────────────────────────────
      smartEvents: [],
      smartIsLive: false,

      addAlert: ({
        symbol,
        condition,
        price,
        note = '',
        repeating = false,
        style = 'price',
        expiresAt = null,
        cooldownMs = null,
        soundType = null,
      }: AddAlertParams): string => {
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

      addCompoundAlert: ({
        symbol,
        logic,
        conditions,
        note = '',
        repeating = false,
        style = 'price',
        expiresAt = null,
        cooldownMs = null,
        soundType = null,
      }: AddCompoundAlertParams): string => {
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

      addMarketAlert: ({
        symbol,
        preset,
        note = '',
        repeating = true,
        soundType = null,
      }: MarketAlertParams): string => {
        type PresetConfig = {
          condition: AlertCondition;
          percentThreshold?: number;
          timeWindow?: PercentTimeWindow;
          alertCategory: 'price_target' | 'percent_change' | '52w_range' | 'custom';
          defaultNote: string;
        };
        const PRESET_MAP: Record<string, PresetConfig> = {
          '52w_high': { condition: '52w_high', alertCategory: '52w_range', defaultNote: '📈 52-Week High Alert' },
          '52w_low': { condition: '52w_low', alertCategory: '52w_range', defaultNote: '📉 52-Week Low Alert' },
          percent_5_up: {
            condition: 'percent_above',
            percentThreshold: 5,
            timeWindow: '24h',
            alertCategory: 'percent_change',
            defaultNote: '📊 +5% in 24h',
          },
          percent_5_down: {
            condition: 'percent_below',
            percentThreshold: 5,
            timeWindow: '24h',
            alertCategory: 'percent_change',
            defaultNote: '📊 -5% in 24h',
          },
          percent_10_up: {
            condition: 'percent_above',
            percentThreshold: 10,
            timeWindow: '24h',
            alertCategory: 'percent_change',
            defaultNote: '📊 +10% in 24h',
          },
          percent_10_down: {
            condition: 'percent_below',
            percentThreshold: 10,
            timeWindow: '24h',
            alertCategory: 'percent_change',
            defaultNote: '📊 -10% in 24h',
          },
        };

        const config = PRESET_MAP[preset];
        if (!config) return '';

        const alert: Alert = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          symbol: (symbol || '').toUpperCase(),
          condition: config.condition,
          price: 0, // Not used for market alerts — price tracker handles evaluation
          active: true,
          repeating,
          triggeredAt: null,
          createdAt: new Date().toISOString(),
          note: note || config.defaultNote,
          style: 'system',
          soundType,
          percentThreshold: config.percentThreshold ?? null,
          timeWindow: config.timeWindow ?? null,
          alertCategory: config.alertCategory,
        };
        set((s) => ({ alerts: [...s.alerts, alert] }));
        return alert.id;
      },

      removeAlert: (id: string) => {
        set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) }));
      },

      updateAlertPrice: (id: string, newPrice: number) => {
        set((s) => ({
          alerts: s.alerts.map((a) => (a.id === id ? { ...a, price: newPrice } : a)),
        }));
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

      getAlertsForSymbol: (symbol: string) => {
        return _get().alerts.filter((a) => a.symbol === symbol.toUpperCase());
      },

      subscribeToPush: async () => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
        try {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: window.__VAPID_PUBLIC_KEY || '',
          });
          await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sub.toJSON()),
          });
          set({ pushSubscribed: true });
           
        } catch {
          /* push subscription failed — degrade gracefully */
        }
      },

      // ── History Slice Actions ────────────────────────

      pushHistoryEntry: (alert, triggerPrice) => {
        const entry: AlertHistoryEntry = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          alertId: alert.id,
          symbol: alert.symbol,
          condition: alert.condition,
          targetPrice: alert.price,
          triggerPrice,
          triggeredAt: new Date().toISOString(),
          note: alert.note || '',
          priceAt5m: null,
          priceAt15m: null,
          priceAt1h: null,
          outcome5m: null,
          outcome15m: null,
          outcome1h: null,
        };
        set((s) => ({
          historyEntries: [entry, ...s.historyEntries].slice(0, MAX_HISTORY_ENTRIES),
        }));
        return entry.id;
      },

      updateHistoryOutcome: (entryId, timeframe, price) => {
        set((s) => ({
          historyEntries: s.historyEntries.map((e) => {
            if (e.id !== entryId) return e;
            const pctChange = e.triggerPrice > 0 ? ((price - e.triggerPrice) / e.triggerPrice) * 100 : null;
            switch (timeframe) {
              case '5m':
                return { ...e, priceAt5m: price, outcome5m: pctChange };
              case '15m':
                return { ...e, priceAt15m: price, outcome15m: pctChange };
              case '1h':
                return { ...e, priceAt1h: price, outcome1h: pctChange };
              default:
                return e;
            }
          }),
        }));
      },

      clearHistory: () => set({ historyEntries: [] }),

      getHistoryBySymbol: (symbol) =>
        _get().historyEntries.filter((e) => e.symbol.toUpperCase() === symbol.toUpperCase()),

      // ── Smart Feed Slice Actions ─────────────────────

      pushSmartEvent: (event) => {
        const entry: SmartAlertEvent = {
          ...event,
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          time: new Date().toISOString(),
        };
        set((s) => ({
          smartEvents: [entry, ...s.smartEvents].slice(0, MAX_SMART_EVENTS),
        }));
      },

      setSmartLive: (live) => set({ smartIsLive: live }),

      clearSmartEvents: () => set({ smartEvents: [] }),
    }),
    {
      name: ALERT_KEY,
      version: 1,
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
       
    } catch {
      /* notifications may fail in some contexts */
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function dispatchAlertToast(alert: Alert, currentPrice: number): void {
  if (typeof window === 'undefined') return;
  const condLabel: Partial<Record<AlertCondition, string>> = {
    above: '↑ above',
    below: '↓ below',
    cross_above: '↗ crossed above',
    cross_below: '↘ crossed below',
    percent_above: '📈 percent above',
    percent_below: '📉 percent below',
    '52w_high': '🌟 52-week high',
    '52w_low': '⚠️ 52-week low',
  };
  window.dispatchEvent(
    new CustomEvent('charEdge:alert-triggered', {
      detail: {
        alert,
        currentPrice,
        message: `${alert.symbol} ${condLabel[alert.condition] || alert.condition} ${alert.price > 0 ? '$' + alert.price.toFixed(2) : ''}`,
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
    case 'above':
      return currentPrice >= targetPrice;
    case 'below':
      return currentPrice <= targetPrice;
    case 'cross_above':
      if (lastPrice == null) return false;
      return lastPrice < targetPrice && currentPrice >= targetPrice;
    case 'cross_below':
      if (lastPrice == null) return false;
      return lastPrice > targetPrice && currentPrice <= targetPrice;
    default:
      return false;
  }
}

function evaluateSubCondition(sub: AlertSubCondition, currentPrice: number, lastPrice: number | null): boolean {
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
          const allSatisfied = alert.conditions.every((_, idx) => _conditionSatisfiedAt.has(`${alert.id}:${idx}`));
          if (allSatisfied) {
            const timestamps = alert.conditions.map((_, idx) => _conditionSatisfiedAt.get(`${alert.id}:${idx}`) || 0);
            const oldest = Math.min(...timestamps);
            const newest = Math.max(...timestamps);
            // Use the max windowBars across conditions × 5s eval interval as window
            const maxWindow = Math.max(...alert.conditions.map((s) => s.windowBars || Infinity));
            const windowMs = maxWindow * 5000; // 5s per "bar" eval cycle
            triggered = newest - oldest <= windowMs;
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
      triggered = evaluateSingleCondition(alert.condition, alert.price, price, lastPrice);
    }

    if (triggered) {
      store.triggerAlert(alert.id);

      // ── Sprint 8: Route through frequency-aware throttler ──
      // The throttler respects Instant/Balanced/Quiet modes,
      // batches alerts per symbol, and overrides for urgent moves.
      const condLabel: Partial<Record<AlertCondition, string>> = {
        above: '↑ above',
        below: '↓ below',
        cross_above: '↗ crossed above',
        cross_below: '↘ crossed below',
        percent_above: '📈 percent above',
        percent_below: '📉 percent below',
        '52w_high': '🌟 52-week high',
        '52w_low': '⚠️ 52-week low',
      };
      const condStr = condLabel[alert.condition] || alert.condition;
      throttledNotify({
        category: 'priceAlerts',
        title: `🔔 ${alert.symbol} Price Alert`,
        body: `${alert.symbol} hit $${price.toFixed(2)} (${condStr})`,
        icon: '📈',
        variant: 'success',
        soundType:
          alert.soundType || (alert.style === 'system' ? 'urgent' : alert.style === 'indicator' ? 'info' : 'price'),
        meta: { symbol: alert.symbol, price, condition: alert.condition, alertId: alert.id, alert },
        customEvent: 'charEdge:alert-triggered',
        customEventDetail: { symbol: alert.symbol, price, condition: alert.condition, alert },
      });

      // C2: Record in alert history for outcome tracking
      store.pushHistoryEntry(alert, price);
    }

    store.updateLastPrice(alert.symbol, price);
  }
}

export function checkSymbolAlerts(symbol: string, price: number): void {
  checkAlerts({ [symbol.toUpperCase()]: price });
}

// ─── Position-Bound Alert Helpers ───────────────────────────────

/**
 * Auto-create alerts for a position's SL and TP levels.
 * Called when a position opens with SL/TP set.
 */
export function addPositionAlerts(
  positionId: string,
  symbol: string,
  side: 'long' | 'short',
  stopLoss?: number | null,
  takeProfit?: number | null,
): string[] {
  const store = useAlertStore.getState();
  const ids: string[] = [];

  if (stopLoss != null) {
    const condition: AlertCondition = side === 'long' ? 'cross_below' : 'cross_above';
    const id = store.addAlert({
      symbol,
      condition,
      price: stopLoss,
      note: `[Auto] Stop Loss for ${side} position`,
      repeating: false,
      style: 'system',
      soundType: 'urgent',
    });
    // Patch with linkedPositionId
    useAlertStore.setState((s) => ({
      alerts: s.alerts.map((a) =>
        a.id === id ? { ...a, linkedPositionId: positionId, linkedLevelType: 'sl' as const } : a,
      ),
    }));
    ids.push(id);
  }

  if (takeProfit != null) {
    const condition: AlertCondition = side === 'long' ? 'cross_above' : 'cross_below';
    const id = store.addAlert({
      symbol,
      condition,
      price: takeProfit,
      note: `[Auto] Take Profit for ${side} position`,
      repeating: false,
      style: 'system',
      soundType: 'success',
    });
    useAlertStore.setState((s) => ({
      alerts: s.alerts.map((a) =>
        a.id === id ? { ...a, linkedPositionId: positionId, linkedLevelType: 'tp' as const } : a,
      ),
    }));
    ids.push(id);
  }

  return ids;
}

/**
 * Update alert prices when SL/TP lines are dragged.
 */
export function updatePositionAlerts(positionId: string, levels: { stopLoss?: number; takeProfit?: number }): void {
  useAlertStore.setState((s) => ({
    alerts: s.alerts.map((a) => {
      if (a.linkedPositionId !== positionId) return a;
      if (a.linkedLevelType === 'sl' && levels.stopLoss != null) {
        return { ...a, price: levels.stopLoss };
      }
      if (a.linkedLevelType === 'tp' && levels.takeProfit != null) {
        return { ...a, price: levels.takeProfit };
      }
      return a;
    }),
  }));
}

/**
 * Dismiss all alerts linked to a closed position.
 */
export function dismissPositionAlerts(positionId: string): void {
  useAlertStore.setState((s) => ({
    alerts: s.alerts.filter((a) => a.linkedPositionId !== positionId),
  }));
}

export { useAlertStore };
export default useAlertStore;
