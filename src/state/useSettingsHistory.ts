// ═══════════════════════════════════════════════════════════════════
// charEdge — Settings Change History Store
//
// Tracks the last 10 settings changes and provides undo capability.
// Persisted in localStorage for cross-session history.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { useUserStore } from './useUserStore';
import { useGamificationStore } from './useGamificationStore';
import { useUIStore } from './useUIStore';

const STORAGE_KEY = 'charEdge-settings-history';
const MAX_ENTRIES = 10;

// Store map for undo operations
const STORE_MAP = {
  user: useUserStore,
  gamification: useGamificationStore,
  ui: useUIStore,
};

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw).slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

function saveHistory(changes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(changes));
  } catch { /* quota exceeded — silently fail */ }
}

let nextId = Date.now();

export const useSettingsHistory = create((set, get) => ({
  changes: loadHistory(),

  /**
   * Record a settings change.
   * @param {{ store: string, key: string, label: string, previousValue: unknown, newValue: unknown }} change
   */
  record: (change) => {
    const entry = {
      id: String(nextId++),
      timestamp: Date.now(),
      ...change,
    };
    const updated = [entry, ...get().changes].slice(0, MAX_ENTRIES);
    set({ changes: updated });
    saveHistory(updated);
  },

  /**
   * Undo a specific change by ID.
   * Restores the previous value to the appropriate store.
   */
  undo: (id) => {
    const { changes } = get();
    const entry = changes.find((c) => c.id === id);
    if (!entry) return;

    // Restore previous value
    const store = STORE_MAP[entry.store];
    if (store) {
      store.setState({ [entry.key]: entry.previousValue });
    }

    // Remove the entry
    const updated = changes.filter((c) => c.id !== id);
    set({ changes: updated });
    saveHistory(updated);
  },

  /**
   * Clear all history.
   */
  clear: () => {
    set({ changes: [] });
    localStorage.removeItem(STORAGE_KEY);
  },
}));
