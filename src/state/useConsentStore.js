// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — Cookie / Analytics Consent Store
//
// GDPR-compliant consent management.
// - `necessary` is always true (IndexedDB, service worker, local prefs)
// - `analytics` is null (undecided), true (opted in), or false (opted out)
// - Persisted to localStorage (not IndexedDB — must survive data resets)
//
// Usage:
//   const analytics = useConsentStore(s => s.analytics);
//   useConsentStore.getState().acceptAll();
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';

const STORAGE_KEY = 'charedge-consent';

function loadConsent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore corrupt data */ }
  return null;
}

function saveConsent(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      analytics: state.analytics,
      consentedAt: state.consentedAt,
    }));
  } catch { /* localStorage full or blocked */ }
}

const saved = loadConsent();

const useConsentStore = create((set, get) => ({
  // ─── State ───────────────────────────────────────────────
  necessary: true,                         // Always required
  analytics: saved?.analytics ?? null,     // null = undecided, true/false = user choice
  consentedAt: saved?.consentedAt ?? null, // ISO timestamp of last consent action

  // ─── Computed ────────────────────────────────────────────
  /** Whether the consent banner should be shown */
  needsConsent: () => get().analytics === null,

  // ─── Actions ─────────────────────────────────────────────

  /** Accept all categories */
  acceptAll: () => {
    const now = new Date().toISOString();
    set({ analytics: true, consentedAt: now });
    saveConsent({ analytics: true, consentedAt: now });
  },

  /** Reject non-essential categories */
  rejectAll: () => {
    const now = new Date().toISOString();
    set({ analytics: false, consentedAt: now });
    saveConsent({ analytics: false, consentedAt: now });
  },

  /** Update a single preference */
  setPreference: (key, val) => {
    if (key === 'necessary') return; // Cannot disable necessary
    const now = new Date().toISOString();
    set({ [key]: val, consentedAt: now });
    saveConsent({ ...get(), [key]: val, consentedAt: now });
  },

  /** Reset consent (e.g. for data deletion) */
  resetConsent: () => {
    set({ analytics: null, consentedAt: null });
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  },
}));

export { useConsentStore };
export default useConsentStore;
