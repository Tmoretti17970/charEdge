// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — Social Store (Zustand, Consolidated)
//
// Phase 0.3: Originally merged from 5 separate stores using slices.
//
// ⚠️  All social slices quarantined (no backend exists).
//     See src/_quarantine/p2p/README.md for restoration instructions.
//     Store kept as empty shell to avoid breaking any residual imports.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';

const useSocialStore = create(() => ({
  // All slices quarantined — store is intentionally empty.
  // Restore by re-importing slices from _quarantine/p2p/state/
}));

export { useSocialStore };
export default useSocialStore;
