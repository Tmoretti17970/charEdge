// ═══════════════════════════════════════════════════════════════════
// charEdge — Alert Preferences Store (Phase C5)
//
// Global alert settings: DND schedule, instant mute, master volume.
// Persisted to localStorage.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Types ──────────────────────────────────────────────────────

interface AlertPreferences {
    dndEnabled: boolean;
    dndStart: string;       // "22:00" — 24h format
    dndEnd: string;         // "08:00"
    globalMute: boolean;    // Instant mute toggle
    globalVolume: number;   // 0–1 master volume scale
}

interface AlertPreferencesActions {
    toggleMute: () => void;
    setDnd: (enabled: boolean, start?: string, end?: string) => void;
    setVolume: (volume: number) => void;
}

// ─── Store ──────────────────────────────────────────────────────

const useAlertPreferences = create<AlertPreferences & AlertPreferencesActions>()(
    persist(
        (set) => ({
            dndEnabled: false,
            dndStart: '22:00',
            dndEnd: '08:00',
            globalMute: false,
            globalVolume: 1,

            toggleMute: () => set((s) => ({ globalMute: !s.globalMute })),

            setDnd: (enabled, start, end) =>
                set((s) => ({
                    dndEnabled: enabled,
                    dndStart: start ?? s.dndStart,
                    dndEnd: end ?? s.dndEnd,
                })),

            setVolume: (volume) => set({ globalVolume: Math.max(0, Math.min(1, volume)) }),
        }),
        { name: 'charEdge-alert-prefs' },
    ),
);

// ─── Utilities ──────────────────────────────────────────────────

/**
 * Check if current time falls within the user's DND window.
 * Returns true if sounds/notifications should be suppressed.
 */
export function isInQuietHours(): boolean {
    const prefs = useAlertPreferences.getState();

    // Instant mute overrides everything
    if (prefs.globalMute) return true;

    // DND schedule
    if (!prefs.dndEnabled) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = prefs.dndStart.split(':').map(Number);
    const [endH, endM] = prefs.dndEnd.split(':').map(Number);
    const startMinutes = (startH || 0) * 60 + (startM || 0);
    const endMinutes = (endH || 0) * 60 + (endM || 0);

    // Handle overnight ranges (e.g., 22:00 → 08:00)
    if (startMinutes > endMinutes) {
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * Get the current master volume scale (0–1).
 */
export function getAlertVolume(): number {
    return useAlertPreferences.getState().globalVolume;
}

export { useAlertPreferences };
export default useAlertPreferences;
