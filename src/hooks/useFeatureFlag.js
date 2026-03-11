// ═══════════════════════════════════════════════════════════════════
// charEdge — Feature Flag Hook (Task 1C.2)
//
// Simple localStorage-backed feature flag system for gating
// experimental/Labs features. Unlike the tier-based FeatureGate,
// this is a boolean on/off toggle per flag.
//
// Usage:
//   const isLabs = useFeatureFlag('labs-mode');
//   setFeatureFlag('labs-mode', true);
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';

const LS_PREFIX = 'charEdge:ff:';

// ─── Default Flags ──────────────────────────────────────────────

const DEFAULTS = {
    'labs-mode': false,   // Show experimental/mock features
};

// ─── Utilities ──────────────────────────────────────────────────

/**
 * Get a feature flag value.
 * @param {string} name - Flag name
 * @returns {boolean}
 */
export function getFeatureFlag(name) {
    try {
        const stored = localStorage.getItem(LS_PREFIX + name);
        if (stored !== null) return stored === 'true';
    } catch { /* SSR or storage unavailable */ }
    return DEFAULTS[name] ?? false;
}

/**
 * Set a feature flag value.
 * @param {string} name - Flag name
 * @param {boolean} value
 */
export function setFeatureFlag(name, value) {
    try {
        localStorage.setItem(LS_PREFIX + name, String(!!value));
        // Dispatch event so other hooks/tabs re-sync
        window.dispatchEvent(new CustomEvent('charEdge:ff-change', { detail: { name, value: !!value } }));
    } catch { /* SSR or storage unavailable */ }
}

/**
 * Toggle a feature flag.
 * @param {string} name
 * @returns {boolean} New value
 */
export function toggleFeatureFlag(name) {
    const next = !getFeatureFlag(name);
    setFeatureFlag(name, next);
    return next;
}

// ─── React Hook ─────────────────────────────────────────────────

/**
 * React hook to read a feature flag with automatic re-render on change.
 * @param {string} name - Flag name
 * @returns {boolean}
 */
export function useFeatureFlag(name) {
    const [value, setValue] = useState(() => getFeatureFlag(name));

    useEffect(() => {
        const handler = (e) => {
            if (e.detail?.name === name) {
                setValue(e.detail.value);
            }
        };
        window.addEventListener('charEdge:ff-change', handler);
        return () => window.removeEventListener('charEdge:ff-change', handler);
    }, [name]);

    return value;
}

/**
 * Hook that returns [value, toggle] for a feature flag.
 * @param {string} name
 * @returns {[boolean, () => void]}
 */
export function useFeatureFlagToggle(name) {
    const value = useFeatureFlag(name);
    const toggle = useCallback(() => toggleFeatureFlag(name), [name]);
    return [value, toggle];
}

export default useFeatureFlag;
