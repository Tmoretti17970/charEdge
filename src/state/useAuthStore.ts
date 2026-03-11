// ═══════════════════════════════════════════════════════════════════
// charEdge — Auth Store (Zustand)
// Manages Supabase authentication state with auto-refresh.
// ═══════════════════════════════════════════════════════════════════
import { create } from 'zustand';
import { supabase } from '../data/supabaseClient.js';
import type { User, Session, AuthError, Provider } from '@supabase/supabase-js';

// ─── Types ─────────────────────────────────────────────────────────

export interface AuthState {
    /** Current authenticated user (null if signed out) */
    user: User | null;
    /** Current session with tokens */
    session: Session | null;
    /** True while checking initial session or during auth operations */
    loading: boolean;
    /** True after initial session check completes */
    initialized: boolean;
    /** Last auth error message */
    error: string | null;

    // ─── Actions ──────────────────────────────────────────────────
    /** Sign up with email and password */
    signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
    /** Sign in with email and password */
    signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
    /** Sign in with OAuth provider (Google, GitHub, etc.) */
    signInWithOAuth: (provider: Provider) => Promise<{ error: AuthError | null }>;
    /** Sign out the current user */
    signOut: () => Promise<void>;
    /** Initialize auth listener — call once in App root */
    initialize: () => () => void;
    /** Clear any auth error */
    clearError: () => void;
}

// ─── Store ─────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>((set, _get) => ({
    user: null,
    session: null,
    loading: true,
    initialized: false,
    error: null,

    signUp: async (email, password) => {
        if (!supabase) {
            const error = { message: 'Auth not configured', status: 500 } as AuthError;
            set({ error: error.message });
            return { error };
        }

        set({ loading: true, error: null });
        const { data, error } = await supabase.auth.signUp({ email, password });

        if (error) {
            set({ loading: false, error: error.message });
        } else {
            set({
                user: data.user,
                session: data.session,
                loading: false,
            });
        }
        return { error };
    },

    signIn: async (email, password) => {
        if (!supabase) {
            const error = { message: 'Auth not configured', status: 500 } as AuthError;
            set({ error: error.message });
            return { error };
        }

        set({ loading: true, error: null });
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            set({ loading: false, error: error.message });
        } else {
            set({
                user: data.user,
                session: data.session,
                loading: false,
            });
        }
        return { error };
    },

    signInWithOAuth: async (provider) => {
        if (!supabase) {
            const error = { message: 'Auth not configured', status: 500 } as AuthError;
            set({ error: error.message });
            return { error };
        }

        set({ loading: true, error: null });
        const { error } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });

        if (error) {
            set({ loading: false, error: error.message });
        }
        // Note: on success, browser redirects — state updates via onAuthStateChange
        return { error };
    },

    signOut: async () => {
        if (!supabase) return;
        set({ loading: true, error: null });
        await supabase.auth.signOut();
        set({ user: null, session: null, loading: false });
    },

    initialize: () => {
        if (!supabase) {
            set({ loading: false, initialized: true });
            return () => { }; // no-op unsubscribe
        }

        // Check existing session
        supabase.auth.getSession().then(({ data: { session } }) => {
            set({
                session,
                user: session?.user ?? null,
                loading: false,
                initialized: true,
            });
        });

        // Listen for auth changes (login, logout, token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                set({
                    session,
                    user: session?.user ?? null,
                    loading: false,
                });
            }
        );

        // Return unsubscribe function for cleanup
        return () => subscription.unsubscribe();
    },

    clearError: () => set({ error: null }),
}));

export default useAuthStore;
