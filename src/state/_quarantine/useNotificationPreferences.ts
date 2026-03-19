// ═══════════════════════════════════════════════════════════════════
// charEdge — Unified Notification Preferences Store (Sprint 1)
//
// Coinbase-style notification management with:
//   - Global pause/resume with auto-resume timer
//   - 8 notification categories with per-category channel toggles
//   - Required channels (locked on, can't be disabled)
//   - DND schedule, global mute, master volume
//   - Alert frequency control & watchlist auto-alerts
//   - Per-asset-class alert type toggles
//
// Persisted to localStorage. Absorbs & replaces useAlertPreferences.
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
    /** Channels that cannot be disabled for this category */
    requiredChannels: ChannelKey[];
    /** Channels that are recommended (show nudge banner if off) */
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

export type AlertPresetId = '52w_high' | '52w_low' | 'percent_5_up' | 'percent_5_down' | 'percent_10_up' | 'percent_10_down';

// ─── Per-Asset-Class Prefs ──────────────────────────────────────

export interface AssetClassAlertPrefs {
    priceAlerts: boolean;
    percentAlerts: boolean;
    fiftyTwoWeekAlerts: boolean;
}

const DEFAULT_ASSET_CLASS_PREFS: AssetClassAlertPrefs = {
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
    until_morning: { label: 'Until 8:00 AM', ms: null }, // calculated dynamically
    indefinite: { label: 'Until I turn it back on', ms: null },
};

// ─── Dismissed Banners ──────────────────────────────────────────

export type DismissedBannerKey = `${NotificationCategoryId}_${ChannelKey}`;

// ─── State Interface ────────────────────────────────────────────

interface NotificationPreferencesState {
    // ── Global Controls ─────────────────────────────────
    pauseAll: boolean;
    pauseUntil: number | null; // timestamp for auto-resume, null = indefinite

    // ── Per-Category Channel Config ─────────────────────
    categories: Record<NotificationCategoryId, ChannelConfig>;

    // ── DND Schedule (migrated from useAlertPreferences) ─
    dndEnabled: boolean;
    dndStart: string;   // "22:00"
    dndEnd: string;     // "08:00"

    // ── Audio ───────────────────────────────────────────
    globalMute: boolean;
    globalVolume: number; // 0–1

    // ── Alert-Specific ──────────────────────────────────
    alertFrequency: AlertFrequency;
    watchlistAutoAlerts: boolean;
    defaultPresets: AlertPresetId[];
    assetClassPrefs: Record<string, AssetClassAlertPrefs>;

    // ── UI State ────────────────────────────────────────
    dismissedBanners: DismissedBannerKey[];
}

interface NotificationPreferencesActions {
    // Global
    setPauseAll: (paused: boolean, duration?: PauseDuration) => void;
    resumeAll: () => void;

    // Channel toggles
    setChannel: (category: NotificationCategoryId, channel: ChannelKey, enabled: boolean) => void;
    setCategoryChannels: (category: NotificationCategoryId, config: Partial<ChannelConfig>) => void;

    // DND
    setDnd: (enabled: boolean, start?: string, end?: string) => void;

    // Audio
    toggleMute: () => void;
    setVolume: (volume: number) => void;

    // Alert-specific
    setFrequency: (freq: AlertFrequency) => void;
    setWatchlistAutoAlerts: (enabled: boolean) => void;
    setDefaultPresets: (presets: AlertPresetId[]) => void;
    toggleDefaultPreset: (preset: AlertPresetId) => void;
    setAssetClassPref: (assetClass: string, key: keyof AssetClassAlertPrefs, value: boolean) => void;

    // Banners
    dismissBanner: (key: DismissedBannerKey) => void;
    resetDismissedBanners: () => void;

    // Utilities
    isChannelEnabled: (category: NotificationCategoryId, channel: ChannelKey) => boolean;
    isChannelRequired: (category: NotificationCategoryId, channel: ChannelKey) => boolean;
    getActiveChannelSummary: (category: NotificationCategoryId) => string;
}

// ─── Default Channel Configs ────────────────────────────────────

const DEFAULT_CATEGORIES: Record<NotificationCategoryId, ChannelConfig> = {
    securityAlerts:       { push: true, inApp: true, email: true, sound: false },
    priceAlerts:          { push: true, inApp: true, email: false, sound: true },
    customAlerts:         { push: true, inApp: true, email: false, sound: true },
    tradingInsights:      { push: true, inApp: true, email: false, sound: false },
    advancedTransactions: { push: true, inApp: true, email: false, sound: true },
    offersAnnouncements:  { push: true, inApp: false, email: true, sound: false },
    smartAlerts:          { push: true, inApp: true, email: false, sound: true },
    system:               { push: false, inApp: true, email: false, sound: false },
};

// ─── Store ──────────────────────────────────────────────────────

type StoreType = NotificationPreferencesState & NotificationPreferencesActions;

const useNotificationPreferences = create<StoreType>()(
    persist(
        (set, get) => ({
            // ── State Defaults ──────────────────────────────
            pauseAll: false,
            pauseUntil: null,

            categories: { ...DEFAULT_CATEGORIES },

            dndEnabled: false,
            dndStart: '22:00',
            dndEnd: '08:00',

            globalMute: false,
            globalVolume: 1,

            alertFrequency: 'instant',
            watchlistAutoAlerts: false,
            defaultPresets: ['52w_high', '52w_low'],
            assetClassPrefs: {
                crypto: { ...DEFAULT_ASSET_CLASS_PREFS },
                stocks: { ...DEFAULT_ASSET_CLASS_PREFS },
                futures: { ...DEFAULT_ASSET_CLASS_PREFS },
                etf: { ...DEFAULT_ASSET_CLASS_PREFS },
                forex: { ...DEFAULT_ASSET_CLASS_PREFS },
            },

            dismissedBanners: [],

            // ── Actions ─────────────────────────────────────

            setPauseAll: (paused, duration = 'indefinite') => {
                if (!paused) {
                    set({ pauseAll: false, pauseUntil: null });
                    return;
                }

                const durConfig = PAUSE_DURATIONS[duration];
                let until: number | null = null;

                if (duration === 'until_morning') {
                    // Calculate next 8:00 AM
                    const now = new Date();
                    const morning = new Date(now);
                    morning.setHours(8, 0, 0, 0);
                    if (morning.getTime() <= now.getTime()) {
                        morning.setDate(morning.getDate() + 1);
                    }
                    until = morning.getTime();
                } else if (durConfig?.ms) {
                    until = Date.now() + durConfig.ms;
                }

                set({ pauseAll: true, pauseUntil: until });
            },

            resumeAll: () => set({ pauseAll: false, pauseUntil: null }),

            setChannel: (category, channel, enabled) => {
                // Prevent disabling required channels
                const meta = CATEGORY_META[category];
                if (!enabled && meta.requiredChannels.includes(channel)) return;

                set((s) => ({
                    categories: {
                        ...s.categories,
                        [category]: {
                            ...s.categories[category],
                            [channel]: enabled,
                        },
                    },
                }));
            },

            setCategoryChannels: (category, config) => {
                const meta = CATEGORY_META[category];
                set((s) => {
                    const current = s.categories[category];
                    const updated = { ...current, ...config };
                    // Re-enforce required channels
                    for (const ch of meta.requiredChannels) {
                        updated[ch] = true;
                    }
                    return {
                        categories: { ...s.categories, [category]: updated },
                    };
                });
            },

            setDnd: (enabled, start, end) =>
                set((s) => ({
                    dndEnabled: enabled,
                    dndStart: start ?? s.dndStart,
                    dndEnd: end ?? s.dndEnd,
                })),

            toggleMute: () => set((s) => ({ globalMute: !s.globalMute })),

            setVolume: (volume) => set({ globalVolume: Math.max(0, Math.min(1, volume)) }),

            setFrequency: (freq) => set({ alertFrequency: freq }),

            setWatchlistAutoAlerts: (enabled) => set({ watchlistAutoAlerts: enabled }),

            setDefaultPresets: (presets) => set({ defaultPresets: presets }),

            toggleDefaultPreset: (preset) =>
                set((s) => ({
                    defaultPresets: s.defaultPresets.includes(preset)
                        ? s.defaultPresets.filter((p) => p !== preset)
                        : [...s.defaultPresets, preset],
                })),

            setAssetClassPref: (assetClass, key, value) =>
                set((s) => ({
                    assetClassPrefs: {
                        ...s.assetClassPrefs,
                        [assetClass]: {
                            ...(s.assetClassPrefs[assetClass] || DEFAULT_ASSET_CLASS_PREFS),
                            [key]: value,
                        },
                    },
                })),

            dismissBanner: (key) =>
                set((s) => ({
                    dismissedBanners: s.dismissedBanners.includes(key)
                        ? s.dismissedBanners
                        : [...s.dismissedBanners, key],
                })),

            resetDismissedBanners: () => set({ dismissedBanners: [] }),

            // ── Read-Only Utilities (callable from getState) ─

            isChannelEnabled: (category, channel) => {
                const state = get();
                // If globally paused, nothing is enabled
                if (state.pauseAll) {
                    if (state.pauseUntil && Date.now() >= state.pauseUntil) {
                        // Auto-resume expired — clear pause
                        set({ pauseAll: false, pauseUntil: null });
                    } else {
                        return false;
                    }
                }
                return state.categories[category]?.[channel] ?? false;
            },

            isChannelRequired: (category, channel) => {
                return CATEGORY_META[category]?.requiredChannels.includes(channel) ?? false;
            },

            getActiveChannelSummary: (category) => {
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
            name: 'charEdge-notification-prefs',
            version: 1,
            migrate(persisted: unknown, version: number) {
                const state = (persisted || {}) as Partial<NotificationPreferencesState>;

                if (version < 1) {
                    // Absorb old useAlertPreferences localStorage data
                    try {
                        const raw = localStorage.getItem('charEdge-alert-prefs');
                        if (raw) {
                            const parsed = JSON.parse(raw);
                            const old = parsed?.state ?? parsed;

                            // Map old frequency values to new naming
                            const freqMap: Record<string, AlertFrequency> = {
                                instant: 'instant',
                                hourly_digest: 'balanced',
                                daily_digest: 'quiet',
                                balanced: 'balanced',
                                quiet: 'quiet',
                            };

                            return {
                                ...state,
                                dndEnabled: old.dndEnabled ?? state.dndEnabled ?? false,
                                dndStart: old.dndStart ?? state.dndStart ?? '22:00',
                                dndEnd: old.dndEnd ?? state.dndEnd ?? '08:00',
                                globalMute: old.globalMute ?? state.globalMute ?? false,
                                globalVolume: old.globalVolume ?? state.globalVolume ?? 1,
                                alertFrequency: freqMap[old.alertFrequency] ?? state.alertFrequency ?? 'instant',
                                watchlistAutoAlerts: old.watchlistAutoAlerts ?? state.watchlistAutoAlerts ?? false,
                                defaultPresets: old.defaultPresets ?? state.defaultPresets ?? ['52w_high', '52w_low'],
                                assetClassPrefs: old.assetClassPrefs ?? state.assetClassPrefs,
                            } as StoreType;
                        }
                    } catch { /* migration errors are non-fatal */ }
                }
                return state as StoreType;
            },
        },
    ),
);

// ─── Global Utilities (Non-React, callable from anywhere) ───────

/**
 * Check if current time falls within the user's DND window
 * or if notifications are globally paused.
 */
export function isInQuietHours(): boolean {
    const prefs = useNotificationPreferences.getState();

    // Global pause check (with auto-resume)
    if (prefs.pauseAll) {
        if (prefs.pauseUntil && Date.now() >= prefs.pauseUntil) {
            useNotificationPreferences.setState({ pauseAll: false, pauseUntil: null });
        } else {
            return true;
        }
    }

    // Instant mute
    if (prefs.globalMute) return true;

    // DND schedule
    if (!prefs.dndEnabled) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = prefs.dndStart.split(':').map(Number);
    const [endH, endM] = prefs.dndEnd.split(':').map(Number);
    const startMinutes = (startH || 0) * 60 + (startM || 0);
    const endMinutes = (endH || 0) * 60 + (endM || 0);

    if (startMinutes > endMinutes) {
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * Get the current master volume scale (0–1).
 */
export function getAlertVolume(): number {
    return useNotificationPreferences.getState().globalVolume;
}

/**
 * Check if a specific alert type is enabled for an asset class.
 */
export function isAlertTypeEnabled(
    assetClass: string,
    alertType: keyof AssetClassAlertPrefs,
): boolean {
    const prefs = useNotificationPreferences.getState();
    const classPrefs = prefs.assetClassPrefs[assetClass] || DEFAULT_ASSET_CLASS_PREFS;
    return classPrefs[alertType];
}

/**
 * Check if a notification should be delivered on a specific channel
 * for a given category, respecting pause, DND, and per-category config.
 */
export function shouldDeliver(category: NotificationCategoryId, channel: ChannelKey): boolean {
    const prefs = useNotificationPreferences.getState();

    // Security alerts bypass pause (required channels are always on)
    const meta = CATEGORY_META[category];
    if (meta.requiredChannels.includes(channel)) {
        return true;
    }

    // Check pause (with auto-resume)
    if (prefs.pauseAll) {
        if (prefs.pauseUntil && Date.now() >= prefs.pauseUntil) {
            useNotificationPreferences.setState({ pauseAll: false, pauseUntil: null });
        } else {
            return false;
        }
    }

    // Check DND for sound channel
    if (channel === 'sound' && isInQuietHours()) {
        return false;
    }

    return prefs.categories[category]?.[channel] ?? false;
}

// ─── Exports ────────────────────────────────────────────────────

export { useNotificationPreferences, DEFAULT_ASSET_CLASS_PREFS, DEFAULT_CATEGORIES };
export default useNotificationPreferences;
