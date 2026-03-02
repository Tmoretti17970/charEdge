// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — useThemeVars Hook
// React hook for JS-side access to CSS custom property theme colors.
// Use this for the rare cases where you need color values in JS
// (canvas drawing, dynamic calculations, conditional styling).
// For normal component styling, prefer CSS vars directly: var(--tf-bg).
// ═══════════════════════════════════════════════════════════════════

import { useSyncExternalStore } from 'react';
import { C, DARK_COLORS } from '../constants.js';

// Global version counter incremented on every theme change
let _version = 0;
const _listeners = new Set();

function subscribe(cb) {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}

function getSnapshot() {
  return _version;
}

/**
 * Notify useThemeVars consumers that the theme has changed.
 * Called by useThemeStore after refreshing CSS vars.
 */
export function notifyThemeChange() {
  _version++;
  _listeners.forEach((cb) => cb());
}

/**
 * React hook that returns the current theme color palette.
 * Re-renders when theme changes.
 *
 * @returns {typeof DARK_COLORS} Current theme colors
 *
 * @example
 * const colors = useThemeVars();
 * return <canvas style={{ background: colors.bg }} />;
 */
export function useThemeVars() {
  useSyncExternalStore(subscribe, getSnapshot);
  return C;
}

export default useThemeVars;
