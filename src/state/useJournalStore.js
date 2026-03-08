// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — Journal Store (Zustand, Consolidated)
//
// Phase 0.3: Merged from useTradeStore + useSessionStore + useAutoArchiveStore.
// Task 1A.2: Now persisted to encrypted IndexedDB via encryptedPersistStorage.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { encryptedPersistStorage } from '../data/encryptedPersistStorage.js';

import { createTradeSlice } from './journal/tradeSlice.js';
import { createSessionSlice } from './journal/sessionSlice.js';
import { createAutoArchiveSlice } from './journal/autoArchiveSlice.js';

const useJournalStore = create(
  persist(
    (...a) => ({
      ...createTradeSlice(...a),
      ...createSessionSlice(...a),
      ...createAutoArchiveSlice(...a),
    }),
    {
      name: 'charEdge-journal',
      version: 1,
      storage: encryptedPersistStorage('journal'),
      partialize: (state) => ({
        trades: state.trades,
        sessions: state.sessions,
        archivedTrades: state.archivedTrades,
      }),
    },
  ),
);

export { useJournalStore };
export default useJournalStore;
