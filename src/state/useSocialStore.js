// ═══════════════════════════════════════════════════════════════════
// charEdge — Social Store (Zustand, Consolidated)
//
// Phase 0.3: Merged from 5 separate stores into one using slices.
// Absorbs: useFollowStore, usePollStore, useLiveRoomStore, useCopyTradeStore
// Phase 2.4: Also absorbs useSignalStore
//
// Persistence: follow, poll votes, and copy-trade data are persisted
// via zustand/persist with partialize.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createFeedSlice } from './social/feedSlice.js';
import { createFollowSlice } from './social/followSlice.js';
import { createPollSlice } from './social/pollSlice.js';
import { createLiveRoomSlice } from './social/liveRoomSlice.js';
import { createCopyTradeSlice } from './social/copyTradeSlice.js';
import { createSignalSlice } from './social/signalSlice.js';

const useSocialStore = create(
  persist(
    (...a) => ({
      ...createFeedSlice(...a),
      ...createFollowSlice(...a),
      ...createPollSlice(...a),
      ...createLiveRoomSlice(...a),
      ...createCopyTradeSlice(...a),
      ...createSignalSlice(...a),
    }),
    {
      name: 'charEdge-social',
      version: 1,
      partialize: (state) => ({
        // Follow data
        following: state.following,
        // Poll votes (not the poll data itself — that's hardcoded)
        userVotes: state.userVotes,
        // Copy trade targets
        copyTargets: state.copyTargets,
        // Signal preferences
        signalPreferences: state.signalPreferences,
      }),
    },
  ),
);

export { useSocialStore };
export default useSocialStore;
