// ═══════════════════════════════════════════════════════════════════
// charEdge — Haptic Feedback (Phase 3, Task 3.2.4)
//
// Provides subtle haptic feedback on supported mobile devices
// using the Vibration API (navigator.vibrate).
//
// Usage:
//   import { haptics } from './haptics.ts';
//   haptics.trigger('success');
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

export interface HapticsAPI {
    /** Trigger a haptic vibration pattern */
    trigger(pattern: HapticPattern): void;
    /** Whether the device supports haptic feedback */
    isSupported(): boolean;
    /** Enable/disable haptics globally */
    setEnabled(enabled: boolean): void;
    /** Check if haptics are enabled */
    isEnabled(): boolean;
}

// ─── Vibration Patterns (ms) ────────────────────────────────────

const PATTERNS: Record<HapticPattern, number | number[]> = {
    light: 10,                // Quick tap — button press, toggle
    medium: 25,                // Moderate — drag threshold crossed
    heavy: 50,                // Strong — long-press feedback
    success: [10, 50, 20],     // Double-pulse — trade logged, goal hit
    warning: [30, 30, 30],     // Triple-pulse — loss limit approaching
    error: [50, 100, 50],    // Long-short-long — validation error
};

// ─── State ──────────────────────────────────────────────────────

let _enabled = true;

// Load preference from localStorage
try {
    const saved = localStorage.getItem('charedge-haptics');
    if (saved === 'false') _enabled = false;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
} catch (_) {
    // Storage unavailable
}

// ─── Implementation ─────────────────────────────────────────────

function isVibrationSupported(): boolean {
    return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

function triggerHaptic(pattern: HapticPattern): void {
    if (!_enabled || !isVibrationSupported()) return;

    try {
        const vibration = PATTERNS[pattern];
        if (vibration != null) {
            navigator.vibrate(vibration);
        }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
        // Vibration API may throw in some contexts
    }
}

// ─── Exported API ───────────────────────────────────────────────

export const haptics: HapticsAPI = {
    trigger: triggerHaptic,
    isSupported: isVibrationSupported,
    setEnabled(enabled: boolean): void {
        _enabled = enabled;
        try {
            localStorage.setItem('charedge-haptics', String(enabled));
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_) {
            // Storage unavailable
        }
    },
    isEnabled(): boolean {
        return _enabled;
    },
};

export default haptics;
