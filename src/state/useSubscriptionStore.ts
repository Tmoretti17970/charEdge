// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — Subscription Store (Zustand)
//
// Client-side plan state. Fetches /api/billing/status when the app
// runs behind server.js; defaults to 'free' when running standalone
// via Vite dev (offline-first).
//
// Usage:
//   import { useSubscriptionStore, canUse } from '../state/useSubscriptionStore.js';
//   const plan = useSubscriptionStore(s => s.plan);
//   if (canUse('aiCoach')) { /* show AI Coach */ }
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';

const FREE_FEATURES = {
  aiCoach: false,
  gpuCompute: false,
  scripting: false,
  cloudSync: false,
  brokerAutoImport: false,
  maxTrades: 500,
  maxCharts: 4,
  exportFormats: ['csv'],
  priority: false,
};

export const useSubscriptionStore = create((set, _get) => ({
  // ─── State ─────────────────────────────────────────────────────
  plan: 'free',
  status: 'active',
  features: { ...FREE_FEATURES },
  loading: false,
  error: null,
  stripeConfigured: false,

  // ─── Actions ───────────────────────────────────────────────────

  /** Fetch current plan from server. Silently falls back to free. */
  fetchStatus: async (token) => {
    if (!token) return; // No auth → stay free
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/billing/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      set({
        plan: data.plan || 'free',
        status: data.status || 'active',
        features: data.features || FREE_FEATURES,
        stripeConfigured: data.stripeConfigured || false,
        loading: false,
      });
    } catch (err) {
      // Offline-first: fail silently, keep free plan
      set({ loading: false, error: err.message });
    }
  },

  /** Start checkout flow for a plan ('trader' or 'pro'). */
  checkout: async (targetPlan, token) => {
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: targetPlan }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { checkoutUrl } = await res.json();
      if (checkoutUrl) window.location.href = checkoutUrl;
    } catch (err) {
      set({ error: err.message });
    }
  },

  /** Open Stripe Customer Portal for subscription management. */
  openPortal: async (token) => {
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { portalUrl } = await res.json();
      if (portalUrl) window.location.href = portalUrl;
    } catch (err) {
      set({ error: err.message });
    }
  },
}));

/**
 * Check if the current plan allows a specific feature.
 * @param {string} featureName — key from PLAN_FEATURES (e.g. 'aiCoach', 'gpuCompute')
 * @returns {boolean}
 */
export function canUse(featureName) {
  return !!useSubscriptionStore.getState().features[featureName];
}

export default useSubscriptionStore;
