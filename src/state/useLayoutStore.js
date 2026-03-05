// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — Layout Store (Zustand, Consolidated)
//
// Phase 0.3: Merged from 4 separate stores into one using slices.
// Absorbs: useBentoLayoutStore, useDashboardStore,
//          useDiscoverLayoutStore, usePanelStore
//
// Persistence: bento card order/pins/hidden/spans and dashboard
// widget config are persisted via zustand/persist with partialize.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createBentoSlice } from './layout/bentoSlice.js';
import { createDashboardSlice } from './layout/dashboardSlice.js';
import { createDiscoverLayoutSlice } from './layout/discoverLayoutSlice.js';
import { createPanelSlice } from './layout/panelSlice.js';

const useLayoutStore = create(
  persist(
    (...a) => ({
      ...createBentoSlice(...a),
      ...createDashboardSlice(...a),
      ...createDiscoverLayoutSlice(...a),
      ...createPanelSlice(...a),
    }),
    {
      name: 'charEdge-layout',
      version: 1,
      partialize: (state) => ({
        // Bento
        cardOrder: state.cardOrder,
        pinned: [...(state.pinned || [])],
        hidden: [...(state.hidden || [])],
        spans: state.spans,
        // Dashboard
        activeWidgets: state.activeWidgets,
        activePreset: state.activePreset,
        dismissedSuggestions: state.dismissedSuggestions,
        // Discover layout
        discoverPreset: state.discoverPreset,
        hiddenWidgets: state.hiddenWidgets,
        widgetSizes: state.widgetSizes,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted || {}),
        pinned: new Set(persisted?.pinned || []),
        hidden: new Set(persisted?.hidden || []),
      }),
    },
  ),
);

// ─── Custom Event Listeners ──────────────────────────────────────
if (typeof window !== 'undefined') {
  window.addEventListener('tf:open-panel', (e) => {
    useLayoutStore.getState().openPanel(e.detail);
  });
  window.addEventListener('tf:toggle-indicators', () => {
    useLayoutStore.getState().togglePanel('indicators');
  });
  window.addEventListener('tf:toggle-object-tree', () => {
    useLayoutStore.getState().togglePanel('objectTree');
  });
}

export { useLayoutStore };
export default useLayoutStore;
