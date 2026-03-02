// ═══════════════════════════════════════════════════════════════════
// charEdge — Journal Store (Zustand, Consolidated)
//
// Phase 0.3: Merged from useTradeStore + useSessionStore + useAutoArchiveStore.
// Persisted to IndexedDB via AppBoot auto-save (same as before).
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';

import { createTradeSlice } from './journal/tradeSlice.js';
import { createSessionSlice } from './journal/sessionSlice.js';
import { createAutoArchiveSlice } from './journal/autoArchiveSlice.js';

const useJournalStore = create((...a) => ({
  ...createTradeSlice(...a),
  ...createSessionSlice(...a),
  ...createAutoArchiveSlice(...a),
}));

export { useJournalStore };
export default useJournalStore;
