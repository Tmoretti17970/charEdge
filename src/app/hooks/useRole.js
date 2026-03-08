// ═══════════════════════════════════════════════════════════════════
// charEdge — useRole Hook
//
// Derives the current user's role from the auth store and provides
// convenient permission checks. Works with both Supabase and local
// auth providers. Falls back to 'free' when no user is signed in.
//
// Usage:
//   const { role, hasRole, isTrader, isAdmin } = useRole();
//   if (hasRole('pro')) { /* show pro features */ }
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useAuthStore } from '../../state/useAuthStore.js';

/** Role hierarchy — higher index = more permissions */
const ROLE_LEVELS = { free: 0, viewer: 0, trader: 1, pro: 2, admin: 3 };

/**
 * @typedef {'free'|'viewer'|'trader'|'pro'|'admin'} Role
 */

/**
 * Hook that returns the current user's role and permission helpers.
 * @returns {{
 *   role: Role,
 *   hasRole: (minRole: Role) => boolean,
 *   isFree: boolean,
 *   isTrader: boolean,
 *   isPro: boolean,
 *   isAdmin: boolean,
 *   isAuthenticated: boolean,
 * }}
 */
export function useRole() {
    const user = useAuthStore((s) => s.user);

    return useMemo(() => {
        // Resolve role from Supabase user_metadata, JWT claims, or local fallback
        const raw =
            user?.role ||
            user?.user_metadata?.role ||
            user?.app_metadata?.role ||
            (user ? 'free' : 'free');

        const role = ROLE_LEVELS[raw] !== undefined ? raw : 'free';
        const level = ROLE_LEVELS[role] ?? 0;

        return {
            /** Current role string */
            role,

            /**
             * Check if user has at least the given role level.
             * @param {Role} minRole
             * @returns {boolean}
             */
            hasRole: (minRole) => level >= (ROLE_LEVELS[minRole] ?? 0),

            /** Convenience booleans */
            isFree: level === 0,
            isTrader: level >= 1,
            isPro: level >= 2,
            isAdmin: level >= 3,

            /** Whether a user session exists */
            isAuthenticated: !!user,
        };
    }, [user]);
}

export default useRole;
