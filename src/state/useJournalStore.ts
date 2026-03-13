// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — Journal Store (Zustand, Consolidated)
//
// Phase 0.3: Merged from useTradeStore + useSessionStore + useAutoArchiveStore.
// Persisted to IndexedDB via AppBoot auto-save (same as before).
//
// v5: Account-aware — rehydrateForAccount() swaps data on account switch.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';

import { createTradeSlice } from './journal/tradeSlice';
import { createSessionSlice } from './journal/sessionSlice.js';
import { createAutoArchiveSlice } from './journal/autoArchiveSlice.js';

const useJournalStore = create((...a) => ({
  ...createTradeSlice(...a),
  ...createSessionSlice(...a),
  ...createAutoArchiveSlice(...a),
}));

// ─── Account Switch Rehydration ─────────────────────────────────
// When the active account changes, reload journal data from the
// corresponding IDB stores. StorageService already routes to the
// correct account stores via accountStoreName().

let _rehydrationInProgress = false;

/**
 * Rehydrate journal data from the IDB stores for the currently active account.
 * Called automatically on account switch, or manually from AppBoot.
 * Seeds demo data if switching to an empty demo account.
 */
export async function rehydrateJournalForAccount() {
  if (_rehydrationInProgress) return;
  _rehydrationInProgress = true;

  try {
    const { StorageService } = await import('../data/StorageService');
    const { getActiveAccountId } = await import('./useAccountStore');
    const accountId = getActiveAccountId();

    const [tradesResult, playbooksResult, notesResult, tradePlansResult] = await Promise.all([
      StorageService.trades.getAll(),
      StorageService.playbooks.getAll(),
      StorageService.notes.getAll(),
      StorageService.tradePlans.getAll(),
    ]);

    let trades = tradesResult.ok ? tradesResult.data : [];
    let playbooks = playbooksResult.ok ? playbooksResult.data : [];
    const notes = notesResult.ok ? notesResult.data : [];
    const tradePlans = tradePlansResult.ok ? tradePlansResult.data : [];

    // If switching to demo and the stores are empty → seed demo data
    if (accountId === 'demo' && trades.length === 0 && playbooks.length === 0) {
      try {
        const { genDemoData } = await import('../data/demoData.js');
        const demo = genDemoData();
        trades = demo.trades || [];
        playbooks = demo.playbooks || [];

        // Persist seeded demo data to the demo stores
        if (trades.length > 0) await StorageService.trades.bulkPut(trades);
        if (playbooks.length > 0) {
          for (const pb of playbooks) await StorageService.playbooks.put(pb);
        }
      } catch (seedErr) {
        console.warn('[rehydrateJournalForAccount] Demo data seeding failed:', seedErr);
      }
    }

    // Apply financial precision migration (safely)
    try {
      const { migrateAllTrades } = await import('../charting_library/model/Money.js');
      trades = migrateAllTrades(trades);
    } catch {
      // Non-fatal — trades will just skip precision migration
    }

    // Clear stale analytics so dashboard shows a skeleton during recompute
    const { useAnalyticsStore } = await import('./useAnalyticsStore');
    useAnalyticsStore.getState().clear();

    useJournalStore.getState().hydrate({ trades, playbooks, notes, tradePlans });
  } catch (err) {
    console.error('[rehydrateJournalForAccount] Rehydration failed:', err);
  } finally {
    _rehydrationInProgress = false;
  }
}

// Subscribe to account changes — auto-rehydrate journal on switch
// (lazy init to avoid circular import at module load time)
let _accountSubInitialized = false;

export function initAccountSwitchListener() {
  if (_accountSubInitialized) return;
  _accountSubInitialized = true;

  import('./useAccountStore').then(({ useAccountStore }) => {
    let prevId = useAccountStore.getState().activeAccountId;
    useAccountStore.subscribe((state) => {
      if (state.activeAccountId !== prevId) {
        prevId = state.activeAccountId;
        rehydrateJournalForAccount();
      }
    });
  });
}

export { useJournalStore };
export default useJournalStore;
