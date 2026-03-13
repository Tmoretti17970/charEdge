// ═══════════════════════════════════════════════════════════════════
// charEdge — Account Store (Zustand, Persisted)
//
// Manages the active account context (demo vs. real).
// All journal data, analytics, and UI elements read from this store
// to determine which IDB stores to target.
//
// Persisted to localStorage so account choice survives refresh.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Types ──────────────────────────────────────────────────────

type AccountId = 'real' | 'demo';

interface Account {
  id: AccountId;
  label: string;
  icon: string;
  color: string;
}

interface AccountState {
  activeAccountId: AccountId;
  accounts: Account[];
  switchAccount: (id: AccountId) => void;
  toggleAccount: () => void;
  getActiveAccount: () => Account;
  isDemo: () => boolean;
}

// ─── Account Definitions ────────────────────────────────────────

export const ACCOUNTS: Account[] = [
  { id: 'real', label: 'Real', icon: '💰', color: '#22c55e' },
  { id: 'demo', label: 'Demo', icon: '🧪', color: '#3b82f6' },
];

// ─── Store ──────────────────────────────────────────────────────

const useAccountStore = create<AccountState>()(
  persist(
    (set, get) => ({
      activeAccountId: 'real' as AccountId,
      accounts: ACCOUNTS,

      switchAccount(id: AccountId) {
        if (id === get().activeAccountId) return;
        set({ activeAccountId: id });
      },

      toggleAccount() {
        const current = get().activeAccountId;
        set({ activeAccountId: current === 'real' ? 'demo' : 'real' });
      },

      getActiveAccount(): Account {
        const id = get().activeAccountId;
        return get().accounts.find((a) => a.id === id) || ACCOUNTS[0];
      },

      isDemo(): boolean {
        return get().activeAccountId === 'demo';
      },
    }),
    {
      name: 'charEdge-account',
      version: 1,
      partialize: (state) => ({
        activeAccountId: state.activeAccountId,
      }),
    },
  ),
);

// ─── Selector Helpers ───────────────────────────────────────────

/** Get the current account ID outside of React (for data layer use) */
export function getActiveAccountId(): AccountId {
  return useAccountStore.getState().activeAccountId;
}

/** Get the IDB store name for a base store and the active account */
export function accountStoreName(base: string): string {
  const accountId = useAccountStore.getState().activeAccountId;
  return `${base}_${accountId}`;
}

export type { AccountId, Account, AccountState };
export { useAccountStore };
export default useAccountStore;
