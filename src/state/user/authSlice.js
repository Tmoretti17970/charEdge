// ═══════════════════════════════════════════════════════════════════
// charEdge — Auth Slice
// Extracted from useAuthStore for useUserStore consolidation.
// ═══════════════════════════════════════════════════════════════════

import { initAuthProvider, getAuthProvider } from '../../services/AuthService.js';
import { initApiKeys } from '../../data/providers/ApiKeyStore.js';

export const createAuthSlice = (set, get) => ({
  // ─── Auth State ─────────────────────────────────────────────
  user: null,
  loading: true,
  error: null,
  provider: 'local',
  isAuthenticated: false,

  // ─── Initialize ─────────────────────────────────────────────
  init: async () => {
    try {
      // Decrypt API keys into memory before providers use them
      await initApiKeys();

      const provider = await initAuthProvider();
      set({ provider: provider.name });

      const user = await provider.getUser();
      if (user) {
        set({ user, isAuthenticated: true, loading: false, error: null });
      } else {
        set({ user: null, isAuthenticated: false, loading: false });
      }

      provider.onAuthStateChange(async (event, _session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          const updatedUser = await provider.getUser();
          set({ user: updatedUser, isAuthenticated: !!updatedUser, error: null });
        } else if (event === 'SIGNED_OUT') {
          set({ user: null, isAuthenticated: false });
        }
      });
    } catch (err) {
      console.warn('[Auth] Init failed:', err.message);
      set({ loading: false, error: err.message });
    }
  },

  // ─── Sign In ────────────────────────────────────────────────
  signIn: async (method, credentials = {}) => {
    const provider = getAuthProvider();
    set({ loading: true, error: null });

    try {
      if (method === 'email') {
        await provider.signInEmail(credentials.email, credentials.password);
      } else if (method === 'google' || method === 'oauth') {
        await provider.signInOAuth(credentials.provider || 'google');
        return;
      }

      const user = await provider.getUser();
      set({ user, isAuthenticated: !!user, loading: false });
    } catch (err) {
      set({ loading: false, error: err.message });
      throw err;
    }
  },

  // ─── Sign Up ────────────────────────────────────────────────
  signUp: async (email, password) => {
    const provider = getAuthProvider();
    set({ loading: true, error: null });

    try {
      await provider.signUpEmail(email, password);
      const user = await provider.getUser();
      set({ user, isAuthenticated: !!user, loading: false });
    } catch (err) {
      set({ loading: false, error: err.message });
      throw err;
    }
  },

  // ─── Sign Out ───────────────────────────────────────────────
  signOut: async () => {
    const provider = getAuthProvider();
    try {
      await provider.signOut();
    } catch {
      /* ignore sign out errors */
    }
    set({ user: null, isAuthenticated: false, error: null });
  },

  // ─── Token Access ───────────────────────────────────────────
  getToken: async () => {
    const provider = getAuthProvider();
    return provider.getToken();
  },

  // ─── Password Reset ────────────────────────────────────────
  resetPassword: async (email) => {
    const provider = getAuthProvider();
    set({ error: null });
    try {
      await provider.resetPassword(email);
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  // ─── Helpers ────────────────────────────────────────────────
  clearError: () => set({ error: null }),

  isPro: () => {
    const { user } = get();
    return user?.plan === 'pro';
  },

  isLocal: () => {
    const { provider } = get();
    return provider === 'local';
  },
});
