// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — Layout Store (Zustand, Consolidated, TypeScript)
//
// Phase 0.3: Merged from 4 separate stores into one using slices.
// Phase 2: Converted to TypeScript.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createBentoSlice } from './layout/bentoSlice.js';
import { createDashboardSlice } from './layout/dashboardSlice.js';
import { createDiscoverLayoutSlice } from './layout/discoverLayoutSlice.js';
import { createPanelSlice } from './layout/panelSlice.js';

// ─── Types ──────────────────────────────────────────────────────

interface LayoutPersistedState {
    cardOrder?: string[];
    pinned?: Iterable<string>;
    hidden?: Iterable<string>;
    spans?: Record<string, number>;
    activeWidgets?: string[];
    activePreset?: string | null;
    dismissedSuggestions?: string[];
    discoverPreset?: string;
    hiddenWidgets?: string[];
    widgetSizes?: Record<string, string>;
    [key: string]: unknown;
}

// ─── Store ──────────────────────────────────────────────────────

const useLayoutStore = create(
    persist(
        (...a: Parameters<Parameters<typeof create>[0]>) => ({
            ...createBentoSlice(...a),
            ...createDashboardSlice(...a),
            ...createDiscoverLayoutSlice(...a),
            ...createPanelSlice(...a),
        }),
        {
            name: 'charEdge-layout',
            version: 1,
            partialize: (state: LayoutPersistedState) => ({
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
            merge: (persisted: LayoutPersistedState | undefined, current: LayoutPersistedState) => ({
                ...current,
                ...(persisted || {}),
                pinned: new Set(persisted?.pinned || []),
                hidden: new Set(persisted?.hidden || []),
            }),
        },
    ),
);

// ─── Custom Event Listeners ──────────────────────────────────────

interface LayoutStoreState {
    openPanel: (detail: unknown) => void;
    togglePanel: (panel: string) => void;
    [key: string]: unknown;
}

if (typeof window !== 'undefined') {
    window.addEventListener('tf:open-panel', (e: Event) => {
        (useLayoutStore.getState() as LayoutStoreState).openPanel((e as CustomEvent).detail);
    });
    window.addEventListener('tf:toggle-indicators', () => {
        (useLayoutStore.getState() as LayoutStoreState).togglePanel('indicators');
    });
    window.addEventListener('tf:toggle-object-tree', () => {
        (useLayoutStore.getState() as LayoutStoreState).togglePanel('objectTree');
    });
}

export { useLayoutStore };
export default useLayoutStore;
