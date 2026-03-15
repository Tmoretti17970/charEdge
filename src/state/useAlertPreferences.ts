// ═══════════════════════════════════════════════════════════════════
// charEdge — Alert Preferences (Backward-Compatible Wrapper)
//
// DEPRECATED: This file now delegates to useNotificationPreferences.
// All new code should import from useNotificationPreferences directly.
//
// Kept for backward compatibility with existing consumers:
//   - useAlertStore.ts (imports isInQuietHours, getAlertVolume)
//   - AlertPanel.jsx (direct store subscriptions)
//   - SmartAlerts.jsx (globalMute, toggleMute)
// ═══════════════════════════════════════════════════════════════════

import useNotificationPreferences, {
    isInQuietHours,
    getAlertVolume,
    isAlertTypeEnabled,
    DEFAULT_ASSET_CLASS_PREFS,
} from './useNotificationPreferences';

import type { AssetClassAlertPrefs } from './useNotificationPreferences';
export type { AssetClassAlertPrefs };

// Re-export legacy types under old names
export type AlertFrequency = 'instant' | 'hourly_digest' | 'daily_digest';
export type AlertPresetId = '52w_high' | '52w_low' | 'percent_5_up' | 'percent_5_down' | 'percent_10_up' | 'percent_10_down';

// ─── Thin Wrapper Store ─────────────────────────────────────────
// This creates a Zustand-compatible selector interface that reads
// from the new unified store, so all existing `useAlertPreferences(s => s.xxx)`
// calls continue to work without any changes.

const useAlertPreferences = Object.assign(
    // The hook function: delegates all selector calls to the unified store
    function useAlertPreferencesHook<T>(selector?: (state: any) => T): T {
        if (selector) {
            return useNotificationPreferences(selector);
        }
        return useNotificationPreferences() as T;
    },
    {
        // Static .getState() — most common usage pattern in AlertPanel
        getState: () => useNotificationPreferences.getState(),
        // Static .setState() — used directly in AlertPanel for DND, volume, etc.
        setState: (partial: any) => useNotificationPreferences.setState(partial),
        // Subscribe for external listeners
        subscribe: (listener: any) => useNotificationPreferences.subscribe(listener),
    },
);

// ─── Re-exports ─────────────────────────────────────────────────

export { useAlertPreferences, DEFAULT_ASSET_CLASS_PREFS, isInQuietHours, getAlertVolume, isAlertTypeEnabled };
export default useAlertPreferences;
