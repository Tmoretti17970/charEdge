// ═══════════════════════════════════════════════════════════════════
// charEdge — Unified Notification Store (Sprint 3 Consolidation)
//
// Combines:
//   • Social notifications + notification log (Phase 2)
//   • Notification preferences (Sprint 1 — absorbed from
//     useNotificationPreferences.ts)
//
// Non-React notification logic lives in notificationEngine.ts
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Category IDs ───────────────────────────────────────────────

export const NOTIFICATION_CATEGORIES = [
  'securityAlerts',
  'priceAlerts',
  'customAlerts',
  'tradingInsights',
  'advancedTransactions',
  'offersAnnouncements',
  'smartAlerts',
  'system',
] as const;

export type NotificationCategoryId = (typeof NOTIFICATION_CATEGORIES)[number];

// ─── Category Metadata ──────────────────────────────────────────

export interface CategoryMeta {
  id: NotificationCategoryId;
  label: string;
  icon: string;
  description: string;
  requiredChannels: ChannelKey[];
  recommendedChannels: ChannelKey[];
}

export const CATEGORY_META: Record<NotificationCategoryId, CategoryMeta> = {
  securityAlerts: {
    id: 'securityAlerts',
    label: 'Security Alerts',
    icon: '🔐',
    description: 'Important security alerts, like new sign-ins and password changes.',
    requiredChannels: ['push', 'inApp', 'email'],
    recommendedChannels: [],
  },
  priceAlerts: {
    id: 'priceAlerts',
    label: 'Price Alerts',
    icon: '💰',
    description: 'Get notified when assets hit your target prices.',
    requiredChannels: [],
    recommendedChannels: ['push', 'sound'],
  },
  customAlerts: {
    id: 'customAlerts',
    label: 'Custom Alerts',
    icon: '🎯',
    description: 'Compound alerts, 52-week range, and percentage-based alerts you create.',
    requiredChannels: [],
    recommendedChannels: ['push'],
  },
  tradingInsights: {
    id: 'tradingInsights',
    label: 'Trading Insights',
    icon: '📊',
    description: 'Top movers, volume spikes, and market analysis.',
    requiredChannels: [],
    recommendedChannels: ['push'],
  },
  advancedTransactions: {
    id: 'advancedTransactions',
    label: 'Advanced Transactions',
    icon: '📋',
    description: 'Paper trade order fills, cancellations, and position updates.',
    requiredChannels: [],
    recommendedChannels: ['inApp', 'sound'],
  },
  offersAnnouncements: {
    id: 'offersAnnouncements',
    label: 'Offers & Announcements',
    icon: '🎁',
    description: 'New features, changelog updates, tips, and platform news.',
    requiredChannels: [],
    recommendedChannels: ['email'],
  },
  smartAlerts: {
    id: 'smartAlerts',
    label: 'Smart Alerts',
    icon: '⚡',
    description: 'AI-detected patterns, sentiment shifts, and volume anomalies.',
    requiredChannels: [],
    recommendedChannels: ['push', 'sound'],
  },
  system: {
    id: 'system',
    label: 'System',
    icon: '⚙️',
    description: 'App updates, maintenance windows, and system messages.',
    requiredChannels: ['inApp'],
    recommendedChannels: [],
  },
};

// ─── Channel Types ──────────────────────────────────────────────

export type ChannelKey = 'push' | 'inApp' | 'email' | 'sound';

export const CHANNEL_META: Record<ChannelKey, { label: string; icon: string }> = {
  push: { label: 'Push', icon: '📱' },
  inApp: { label: 'In-app', icon: '🖥️' },
  email: { label: 'Email', icon: '✉️' },
  sound: { label: 'Sound', icon: '🔊' },
};

export interface ChannelConfig {
  push: boolean;
  inApp: boolean;
  email: boolean;
  sound: boolean;
}

// ─── Alert Frequency ────────────────────────────────────────────

export type AlertFrequency = 'instant' | 'balanced' | 'quiet';

export const FREQUENCY_META: Record<AlertFrequency, { label: string; description: string }> = {
  instant: { label: 'Instant', description: 'Every alert fires immediately' },
  balanced: { label: 'Balanced', description: 'Smart throttling — max 1 per symbol per 15min' },
  quiet: { label: 'Quiet', description: 'Daily digest only, except urgent alerts' },
};

// ─── Alert Presets ──────────────────────────────────────────────

export type AlertPresetId =
  | '52w_high'
  | '52w_low'
  | 'percent_5_up'
  | 'percent_5_down'
  | 'percent_10_up'
  | 'percent_10_down';

// ─── Per-Asset-Class Prefs ──────────────────────────────────────

export interface AssetClassAlertPrefs {
  priceAlerts: boolean;
  percentAlerts: boolean;
  fiftyTwoWeekAlerts: boolean;
}

export const DEFAULT_ASSET_CLASS_PREFS: AssetClassAlertPrefs = {
  priceAlerts: true,
  percentAlerts: true,
  fiftyTwoWeekAlerts: true,
};

// ─── Pause Duration ─────────────────────────────────────────────

export type PauseDuration = '15min' | '1hour' | '4hours' | 'until_morning' | 'indefinite';

export const PAUSE_DURATIONS: Record<PauseDuration, { label: string; ms: number | null }> = {
  '15min': { label: '15 minutes', ms: 15 * 60 * 1000 },
  '1hour': { label: '1 hour', ms: 60 * 60 * 1000 },
  '4hours': { label: '4 hours', ms: 4 * 60 * 60 * 1000 },
  until_morning: { label: 'Until 8:00 AM', ms: null },
  indefinite: { label: 'Until I turn it back on', ms: null },
};

// ─── Dismissed Banners ──────────────────────────────────────────

export type DismissedBannerKey = `${NotificationCategoryId}_${ChannelKey}`;

// ─── Default Channel Configs ────────────────────────────────────

export const DEFAULT_CATEGORIES: Record<NotificationCategoryId, ChannelConfig> = {
  securityAlerts: { push: true, inApp: true, email: true, sound: false },
  priceAlerts: { push: true, inApp: true, email: false, sound: true },
  customAlerts: { push: true, inApp: true, email: false, sound: true },
  tradingInsights: { push: true, inApp: true, email: false, sound: false },
  advancedTransactions: { push: true, inApp: true, email: false, sound: true },
  offersAnnouncements: { push: true, inApp: false, email: true, sound: false },
  smartAlerts: { push: true, inApp: true, email: false, sound: true },
  system: { push: false, inApp: true, email: false, sound: false },
};

// ─── Notification Item Type ─────────────────────────────────────

export interface SocialNotification {
  id: string;
  type: string;
  actorName: string;
  actorAvatar: string;
  message: string;
  timestamp: number;
  read: boolean;
}

// ─── Log Entry Type ─────────────────────────────────────────────

export interface LogEntry {
  id: number;
  type: string;
  message: string;
  category: string;
  meta: Record<string, unknown> | null;
  ts: number;
}

export interface LogEntryInput {
  type?: string;
  message?: string;
  category?: string;
  meta?: Record<string, unknown> | undefined | null;
}

// ─── Notification Input Type ────────────────────────────────────

export interface NotificationInput {
  type: string;
  actorName: string;
  actorAvatar: string;
  message: string;
}

// ─── Store State Interface ──────────────────────────────────────

interface NotificationStoreState {
  // Social Notifications
  notifications: SocialNotification[];
  digestMode: string;
  unreadCount: number;
  getUnreadCount: () => number;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
  addNotification: (notif: NotificationInput) => void;
  clearAll: () => void;
  setDigestMode: (mode: string) => void;
  getDigest: () => Record<string, SocialNotification[]>;

  // Log
  logEntries: LogEntry[];
  logUnreadCount: number;
  logPanelOpen: boolean;
  pushLog: (entry: LogEntryInput) => void;
  toggleLogPanel: () => void;
  openLogPanel: () => void;
  closeLogPanel: () => void;
  markLogRead: () => void;
  clearLog: () => void;

  // Preferences
  pauseAll: boolean;
  pauseUntil: number | null;
  categories: Record<NotificationCategoryId, ChannelConfig>;
  dndEnabled: boolean;
  dndStart: string;
  dndEnd: string;
  globalMute: boolean;
  globalVolume: number;
  alertFrequency: AlertFrequency;
  watchlistAutoAlerts: boolean;
  defaultPresets: AlertPresetId[];
  assetClassPrefs: Record<string, AssetClassAlertPrefs>;
  dismissedBanners: DismissedBannerKey[];

  // Preference Actions
  setPauseAll: (paused: boolean, duration?: PauseDuration) => void;
  resumeAll: () => void;
  setChannel: (category: NotificationCategoryId, channel: ChannelKey, enabled: boolean) => void;
  setCategoryChannels: (category: NotificationCategoryId, config: Partial<ChannelConfig>) => void;
  setDnd: (enabled: boolean, start?: string, end?: string) => void;
  toggleMute: () => void;
  setVolume: (volume: number) => void;
  setFrequency: (freq: AlertFrequency) => void;
  setWatchlistAutoAlerts: (enabled: boolean) => void;
  setDefaultPresets: (presets: AlertPresetId[]) => void;
  toggleDefaultPreset: (preset: AlertPresetId) => void;
  setAssetClassPref: (assetClass: string, key: keyof AssetClassAlertPrefs, value: boolean) => void;
  dismissBanner: (key: DismissedBannerKey) => void;
  resetDismissedBanners: () => void;

  // Utilities
  isChannelEnabled: (category: NotificationCategoryId, channel: ChannelKey) => boolean;
  isChannelRequired: (category: NotificationCategoryId, channel: ChannelKey) => boolean;
  getActiveChannelSummary: (category: NotificationCategoryId) => string;
}

// ─── Constants ──────────────────────────────────────────────────

const NOW = Date.now();
const HOUR = 3600_000;
const MIN = 60_000;
const MAX_LOG_ENTRIES = 200;
let _logId = 0;

const INITIAL_NOTIFICATIONS: SocialNotification[] = [
  {
    id: 'n1',
    type: 'like',
    actorName: 'Emma Chen',
    actorAvatar: '🐍',
    message: 'liked your chart idea "BTC breakout from 4h consolidation"',
    timestamp: NOW - 12 * MIN,
    read: false,
  },
  {
    id: 'n2',
    type: 'follow',
    actorName: 'Marcus Rivera',
    actorAvatar: '📈',
    message: 'started following you',
    timestamp: NOW - 45 * MIN,
    read: false,
  },
  {
    id: 'n3',
    type: 'comment',
    actorName: 'Priya Sharma',
    actorAvatar: '💎',
    message: 'commented on your chart idea: "Great analysis, that level is key"',
    timestamp: NOW - 2 * HOUR,
    read: false,
  },
  {
    id: 'n4',
    type: 'prediction',
    actorName: 'System',
    actorAvatar: '🔮',
    message: 'Prediction "BTC hits $100k" — you voted Yes (71.9% agree)',
    timestamp: NOW - 3 * HOUR,
    read: true,
  },
  {
    id: 'n5',
    type: 'like',
    actorName: 'Dan Brooks',
    actorAvatar: '🦁',
    message: 'liked your chart idea "ETH weekly structure"',
    timestamp: NOW - 5 * HOUR,
    read: true,
  },
  {
    id: 'n6',
    type: 'milestone',
    actorName: 'charEdge',
    actorAvatar: '🏆',
    message: 'You reached Gold League! Keep climbing the Alpha Board.',
    timestamp: NOW - 8 * HOUR,
    read: true,
  },
  {
    id: 'n7',
    type: 'comment',
    actorName: 'Sofia Navarro',
    actorAvatar: '⚡',
    message: 'replied to your comment: "Totally agree, patience is everything"',
    timestamp: NOW - 12 * HOUR,
    read: true,
  },
  {
    id: 'n8',
    type: 'follow',
    actorName: 'Alex Kim',
    actorAvatar: '🔥',
    message: 'started following you',
    timestamp: NOW - 18 * HOUR,
    read: true,
  },
];

// ─── Store ──────────────────────────────────────────────────────

export const useNotificationStore = create<NotificationStoreState>()(
  persist(
    (set, get) => ({
      // ══════════════════════════════════════════════════════════
      // Social Notifications Slice
      // ══════════════════════════════════════════════════════════

      notifications: INITIAL_NOTIFICATIONS,
      digestMode: 'instant',

      get unreadCount() {
        return get().notifications.filter((n) => !n.read).length;
      },
      getUnreadCount: () => get().notifications.filter((n) => !n.read).length,

      markAsRead: (id: string) => {
        set({ notifications: get().notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) });
      },
      markAllRead: () => {
        set({ notifications: get().notifications.map((n) => ({ ...n, read: true })) });
      },
      addNotification: (notif: NotificationInput) => {
        const id = `n_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
        set({
          notifications: [{ ...notif, id, timestamp: Date.now(), read: false }, ...get().notifications].slice(0, 50),
        });
      },
      clearAll: () => set({ notifications: [] }),
      setDigestMode: (mode: string) => set({ digestMode: mode }),
      getDigest: () => {
        const cutoff = Date.now() - 86_400_000;
        const recent = get().notifications.filter((n) => n.timestamp >= cutoff);
        const byType: Record<string, SocialNotification[]> = {};
        for (const n of recent) {
          if (!byType[n.type]) byType[n.type] = [];
          byType[n.type]!.push(n);
        }
        return byType;
      },

      // ══════════════════════════════════════════════════════════
      // Log Slice (absorbed from useNotificationLog.ts)
      // ══════════════════════════════════════════════════════════

      logEntries: [],
      logUnreadCount: 0,
      logPanelOpen: false,

      pushLog: (entry: LogEntryInput) =>
        set((s) => {
          const record: LogEntry = {
            id: ++_logId,
            type: entry.type || 'info',
            message: entry.message || '',
            category: entry.category || 'system',
            meta: entry.meta || null,
            ts: Date.now(),
          };
          const newEntries = [...s.logEntries, record];
          while (newEntries.length > MAX_LOG_ENTRIES) newEntries.shift();
          return { logEntries: newEntries, logUnreadCount: s.logPanelOpen ? 0 : s.logUnreadCount + 1 };
        }),
      toggleLogPanel: () =>
        set((s) => ({ logPanelOpen: !s.logPanelOpen, logUnreadCount: s.logPanelOpen ? s.logUnreadCount : 0 })),
      openLogPanel: () => set({ logPanelOpen: true, logUnreadCount: 0 }),
      closeLogPanel: () => set({ logPanelOpen: false }),
      markLogRead: () => set({ logUnreadCount: 0 }),
      clearLog: () => set({ logEntries: [], logUnreadCount: 0 }),

      // ══════════════════════════════════════════════════════════
      // Preferences Slice (absorbed from useNotificationPreferences.ts)
      // ══════════════════════════════════════════════════════════

      pauseAll: false,
      pauseUntil: null as number | null,
      categories: { ...DEFAULT_CATEGORIES },
      dndEnabled: false,
      dndStart: '22:00',
      dndEnd: '08:00',
      globalMute: false,
      globalVolume: 1,
      alertFrequency: 'instant' as AlertFrequency,
      watchlistAutoAlerts: false,
      defaultPresets: ['52w_high', '52w_low'] as AlertPresetId[],
      assetClassPrefs: {
        crypto: { ...DEFAULT_ASSET_CLASS_PREFS },
        stocks: { ...DEFAULT_ASSET_CLASS_PREFS },
        futures: { ...DEFAULT_ASSET_CLASS_PREFS },
        etf: { ...DEFAULT_ASSET_CLASS_PREFS },
        forex: { ...DEFAULT_ASSET_CLASS_PREFS },
      } as Record<string, AssetClassAlertPrefs>,
      dismissedBanners: [] as DismissedBannerKey[],

      // ── Preferences Actions ───────────────────────────────

      setPauseAll: (paused: boolean, duration: PauseDuration = 'indefinite') => {
        if (!paused) {
          set({ pauseAll: false, pauseUntil: null });
          return;
        }
        const durConfig = PAUSE_DURATIONS[duration];
        let until: number | null = null;
        if (duration === 'until_morning') {
          const now = new Date();
          const morning = new Date(now);
          morning.setHours(8, 0, 0, 0);
          if (morning.getTime() <= now.getTime()) morning.setDate(morning.getDate() + 1);
          until = morning.getTime();
        } else if (durConfig?.ms) {
          until = Date.now() + durConfig.ms;
        }
        set({ pauseAll: true, pauseUntil: until });
      },
      resumeAll: () => set({ pauseAll: false, pauseUntil: null }),

      setChannel: (category: NotificationCategoryId, channel: ChannelKey, enabled: boolean) => {
        const meta = CATEGORY_META[category];
        if (!enabled && meta.requiredChannels.includes(channel)) return;
        set((s) => ({
          categories: { ...s.categories, [category]: { ...s.categories[category], [channel]: enabled } },
        }));
      },
      setCategoryChannels: (category: NotificationCategoryId, config: Partial<ChannelConfig>) => {
        const meta = CATEGORY_META[category];
        set((s) => {
          const updated = { ...s.categories[category], ...config };
          for (const ch of meta.requiredChannels) updated[ch] = true;
          return { categories: { ...s.categories, [category]: updated } };
        });
      },

      setDnd: (enabled: boolean, start?: string, end?: string) =>
        set((s) => ({ dndEnabled: enabled, dndStart: start ?? s.dndStart, dndEnd: end ?? s.dndEnd })),
      toggleMute: () => set((s) => ({ globalMute: !s.globalMute })),
      setVolume: (volume: number) => set({ globalVolume: Math.max(0, Math.min(1, volume)) }),
      setFrequency: (freq: AlertFrequency) => set({ alertFrequency: freq }),
      setWatchlistAutoAlerts: (enabled: boolean) => set({ watchlistAutoAlerts: enabled }),
      setDefaultPresets: (presets: AlertPresetId[]) => set({ defaultPresets: presets }),
      toggleDefaultPreset: (preset: AlertPresetId) =>
        set((s) => ({
          defaultPresets: s.defaultPresets.includes(preset)
            ? s.defaultPresets.filter((p) => p !== preset)
            : [...s.defaultPresets, preset],
        })),
      setAssetClassPref: (assetClass: string, key: keyof AssetClassAlertPrefs, value: boolean) =>
        set((s) => ({
          assetClassPrefs: {
            ...s.assetClassPrefs,
            [assetClass]: { ...(s.assetClassPrefs[assetClass] || DEFAULT_ASSET_CLASS_PREFS), [key]: value },
          },
        })),
      dismissBanner: (key: DismissedBannerKey) =>
        set((s) => ({
          dismissedBanners: s.dismissedBanners.includes(key) ? s.dismissedBanners : [...s.dismissedBanners, key],
        })),
      resetDismissedBanners: () => set({ dismissedBanners: [] }),

      // ── Preference Utilities ──────────────────────────────

      isChannelEnabled: (category: NotificationCategoryId, channel: ChannelKey) => {
        const state = get();
        if (state.pauseAll) {
          if (state.pauseUntil && Date.now() >= state.pauseUntil) {
            set({ pauseAll: false, pauseUntil: null });
          } else {
            return false;
          }
        }
        return state.categories[category]?.[channel] ?? false;
      },
      isChannelRequired: (category: NotificationCategoryId, channel: ChannelKey) => {
        return CATEGORY_META[category]?.requiredChannels.includes(channel) ?? false;
      },
      getActiveChannelSummary: (category: NotificationCategoryId) => {
        const config = get().categories[category];
        if (!config) return '';
        const active: string[] = [];
        if (config.push) active.push('Push');
        if (config.inApp) active.push('In-app');
        if (config.email) active.push('Email');
        if (config.sound) active.push('Sound');
        return active.length > 0 ? `via ${active.join(', ')}` : 'All off';
      },
    }),
    {
      name: 'tf-notifications-store',
      version: 2,
      // Persist social notifications + preferences, NOT log entries (session-only)
      partialize: (state) => ({
        notifications: state.notifications,
        digestMode: state.digestMode,
        pauseAll: state.pauseAll,
        pauseUntil: state.pauseUntil,
        categories: state.categories,
        dndEnabled: state.dndEnabled,
        dndStart: state.dndStart,
        dndEnd: state.dndEnd,
        globalMute: state.globalMute,
        globalVolume: state.globalVolume,
        alertFrequency: state.alertFrequency,
        watchlistAutoAlerts: state.watchlistAutoAlerts,
        defaultPresets: state.defaultPresets,
        assetClassPrefs: state.assetClassPrefs,
        dismissedBanners: state.dismissedBanners,
      }),
      migrate(persisted: unknown, version: number) {
        const state = (persisted || {}) as Record<string, unknown>;

        if (version < 2) {
          // Absorb old useNotificationPreferences data (charEdge-notification-prefs)
          try {
            const raw = localStorage.getItem('charEdge-notification-prefs');
            if (raw) {
              const parsed = JSON.parse(raw);
              const old = parsed?.state ?? parsed;
              const freqMap: Record<string, AlertFrequency> = {
                instant: 'instant',
                hourly_digest: 'balanced',
                daily_digest: 'quiet',
                balanced: 'balanced',
                quiet: 'quiet',
              };
              return {
                ...state,
                categories: old.categories ?? state.categories ?? DEFAULT_CATEGORIES,
                dndEnabled: old.dndEnabled ?? state.dndEnabled ?? false,
                dndStart: old.dndStart ?? state.dndStart ?? '22:00',
                dndEnd: old.dndEnd ?? state.dndEnd ?? '08:00',
                globalMute: old.globalMute ?? state.globalMute ?? false,
                globalVolume: old.globalVolume ?? state.globalVolume ?? 1,
                alertFrequency: freqMap[old.alertFrequency] ?? state.alertFrequency ?? 'instant',
                watchlistAutoAlerts: old.watchlistAutoAlerts ?? state.watchlistAutoAlerts ?? false,
                defaultPresets: old.defaultPresets ?? state.defaultPresets ?? ['52w_high', '52w_low'],
                assetClassPrefs: old.assetClassPrefs ?? state.assetClassPrefs,
                dismissedBanners: old.dismissedBanners ?? state.dismissedBanners ?? [],
              };
            }
          } catch {
            /* migration errors are non-fatal */
          }
        }
        return state;
      },
    },
  ),
);

// ─── Backward-compatible notificationLog API (non-React) ────────

export const notificationLog = {
  push: (entry: LogEntryInput) => useNotificationStore.getState().pushLog(entry),
  clear: () => useNotificationStore.getState().clearLog(),
  toggle: () => useNotificationStore.getState().toggleLogPanel(),
};

// ─── Global Utilities (Non-React, callable from anywhere) ───────

/** Check if current time is within DND or globally paused. */
export function isInQuietHours(): boolean {
  const prefs = useNotificationStore.getState();
  if (prefs.pauseAll) {
    if (prefs.pauseUntil && Date.now() >= prefs.pauseUntil) {
      useNotificationStore.setState({ pauseAll: false, pauseUntil: null });
    } else {
      return true;
    }
  }
  if (prefs.globalMute) return true;
  if (!prefs.dndEnabled) return false;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = prefs.dndStart.split(':').map(Number);
  const [endH, endM] = prefs.dndEnd.split(':').map(Number);
  const startMinutes = (startH || 0) * 60 + (startM || 0);
  const endMinutes = (endH || 0) * 60 + (endM || 0);
  if (startMinutes > endMinutes) return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/** Get the current master volume scale (0–1). */
export function getAlertVolume(): number {
  return useNotificationStore.getState().globalVolume;
}

/** Check if a specific alert type is enabled for an asset class. */
export function isAlertTypeEnabled(assetClass: string, alertType: keyof AssetClassAlertPrefs): boolean {
  const prefs = useNotificationStore.getState();
  const classPrefs = prefs.assetClassPrefs[assetClass] || DEFAULT_ASSET_CLASS_PREFS;
  return classPrefs[alertType];
}

/**
 * Check if a notification should be delivered on a specific channel.
 * Respects pause, DND, and per-category config.
 */
export function shouldDeliver(category: NotificationCategoryId, channel: ChannelKey): boolean {
  const prefs = useNotificationStore.getState();
  const meta = CATEGORY_META[category];
  if (meta.requiredChannels.includes(channel)) return true;
  if (prefs.pauseAll) {
    if (prefs.pauseUntil && Date.now() >= prefs.pauseUntil) {
      useNotificationStore.setState({ pauseAll: false, pauseUntil: null });
    } else {
      return false;
    }
  }
  if (channel === 'sound' && isInQuietHours()) return false;
  return prefs.categories[category]?.[channel] ?? false;
}

// ─── Backward-compatible re-export alias ────────────────────────
// Components that imported useNotificationPreferences can now import
// from this file. The store shape is the same.
export const useNotificationPreferences = useNotificationStore;

export default useNotificationStore;
