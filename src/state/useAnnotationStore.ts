// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — useAnnotationStore (DEPRECATED — re-export shim)
//
// Phase 2.4: This store has been consolidated into useChartStore.
// This file re-exports useChartStore for backward compatibility.
// ═══════════════════════════════════════════════════════════════════

import { useChartStore } from './useChartStore';

// useChartStore now contains all annotation state + actions
const useAnnotationStore = useChartStore;

export { useAnnotationStore };
export default useAnnotationStore;
