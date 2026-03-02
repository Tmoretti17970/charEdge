// ═══════════════════════════════════════════════════════════════════
// charEdge — useSignalStore (DEPRECATED — re-export shim)
//
// Phase 2.4: This store has been consolidated into useSocialStore.
// This file re-exports useSocialStore for backward compatibility.
// ═══════════════════════════════════════════════════════════════════

import { useSocialStore } from './useSocialStore.js';

// useSocialStore now contains all signal state + actions
const useSignalStore = useSocialStore;

export { useSignalStore };
export default useSignalStore;
