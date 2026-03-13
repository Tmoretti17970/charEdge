// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — Journal Store (Zustand, Consolidated)
//
// Phase 0.3: Merged from useTradeStore + useSessionStore + useAutoArchiveStore.
// Persisted to IndexedDB via AppBoot auto-save (same as before).
//
// v6: Seamless account switch — in-memory dual-slot cache,
//     invalidation instead of clearing analytics.
//
// NOTE: All cross-module imports use dynamic import() to avoid
// circular dependency chains that break React module initialization.
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

// ─── In-Memory Dual-Slot Cache ──────────────────────────────────
// Stores journal data for both accounts so switching back is instant.
// Cache is populated on first load and updated on every hydration.

const _cache = {
  real: null,
  demo: null,
};

// Track which accounts have already had their trades migrated
const _migrated = new Set();

let _rehydrationInProgress = false;

/**
 * Snapshot current journal state into the cache slot for `accountId`.
 */
function _snapshotToCache(accountId) {
  const state = useJournalStore.getState();
  _cache[accountId] = {
    trades: state.trades || [],
    playbooks: state.playbooks || [],
    notes: state.notes || [],
    tradePlans: state.tradePlans || [],
  };
}

/**
 * Rehydrate journal data for the currently active account.
 *
 * Fast path: if the target account's data is already cached in memory,
 * skip IDB entirely and hydrate from the cache (~0ms).
 *
 * Slow path (first visit): read from IDB, seed demo if needed,
 * migrate trades, then cache the result for next time.
 */
export async function rehydrateJournalForAccount() {
  if (_rehydrationInProgress) return;
  _rehydrationInProgress = true;

  try {
    // Dynamic imports — required to break circular dependency chains
    const { StorageService } = await import('../data/StorageService');
    const { getActiveAccountId, setSwitchingDone } = await import('./useAccountStore');
    const accountId = getActiveAccountId();

    // Save the outgoing account's data before we overwrite it
    const outgoingId = accountId === 'real' ? 'demo' : 'real';
    if (useJournalStore.getState().loaded) {
      _snapshotToCache(outgoingId);
    }

    // ── Fast path: cache hit ────────────────────────────────
    if (_cache[accountId]) {
      useJournalStore.getState().hydrate(_cache[accountId]);
      // Invalidate analytics hash — recomputes without skeleton flash
      import('../app/features/analytics/analyticsSingleton.js').then((m) => m.invalidateCache());
      setSwitchingDone();
      _rehydrationInProgress = false;
      return;
    }

    // ── Slow path: first visit — read from IDB ─────────────
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

    // Apply financial precision migration only once per account
    if (!_migrated.has(accountId)) {
      try {
        const { migrateAllTrades } = await import('../charting_library/model/Money.js');
        trades = migrateAllTrades(trades);
        _migrated.add(accountId);
      } catch {
        // Non-fatal — trades will just skip precision migration
      }
    }

    // Invalidate analytics hash so it recomputes — but DON'T clear the
    // result. This avoids the skeleton flash during the recompute window.
    import('../app/features/analytics/analyticsSingleton.js').then((m) => m.invalidateCache());

    const data = { trades, playbooks, notes, tradePlans };
    _cache[accountId] = data;
    useJournalStore.getState().hydrate(data);
    setSwitchingDone();
  } catch (err) {
    console.error('[rehydrateJournalForAccount] Rehydration failed:', err);
    // Ensure switching flag is cleared even on error
    import('./useAccountStore').then(({ setSwitchingDone }) => setSwitchingDone()).catch(() => {});
  } finally {
    _rehydrationInProgress = false;
  }
}

/**
 * Pre-warm the cache for a given account (called at boot for demo).
 * Runs in the background — never blocks the UI.
 */
export async function prewarmAccountCache(accountId) {
  if (_cache[accountId]) return; // Already cached

  try {
    const { openUnifiedDB } = await import('../data/UnifiedDB.js');
    const db = await openUnifiedDB();
    if (!db) return;

    const readAll = (table) =>
      new Promise((resolve) => {
        try {
          const tx = db.transaction(table, 'readonly');
          const req = tx.objectStore(table).getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        } catch {
          resolve([]);
        }
      });

    const [trades, playbooks, notes, tradePlans] = await Promise.all([
      readAll(`trades_${accountId}`),
      readAll(`playbooks_${accountId}`),
      readAll(`notes_${accountId}`),
      readAll(`tradePlans_${accountId}`),
    ]);

    // If demo is empty, seed it eagerly
    if (accountId === 'demo' && trades.length === 0 && playbooks.length === 0) {
      try {
        const { genDemoData } = await import('../data/demoData.js');
        const demo = genDemoData();
        _cache.demo = {
          trades: demo.trades || [],
          playbooks: demo.playbooks || [],
          notes: [],
          tradePlans: [],
        };
      } catch {
        _cache.demo = { trades: [], playbooks: [], notes: [], tradePlans: [] };
      }
      return;
    }

    _cache[accountId] = { trades, playbooks, notes, tradePlans };
  } catch {
    // Pre-warming failed — not critical, first switch will just use IDB
  }
}

// ─── Account Switch Listener ────────────────────────────────────
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

