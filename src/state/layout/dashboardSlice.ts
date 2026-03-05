// ═══════════════════════════════════════════════════════════════════
// charEdge — Dashboard Layout Slice
// Extracted from useDashboardStore for useLayoutStore consolidation.
// ═══════════════════════════════════════════════════════════════════

import { WIDGET_REGISTRY, DASHBOARD_PRESETS } from '../../app/components/widgets/DashboardWidgets.jsx';

const defaultWidgets = Object.values(WIDGET_REGISTRY)
  .filter((w) => w.default)
  .map((w) => w.id);

export const createDashboardSlice = (set, _get) => ({
  // ─── Dashboard State ──────────────────────────────────────────
  activeWidgets: [...defaultWidgets],
  activePreset: 'default',
  editMode: false,
  dismissedSuggestions: [],

  // ─── Dashboard Actions ────────────────────────────────────────
  setActiveWidgets: (widgets) =>
    set({
      activeWidgets: widgets,
      activePreset: null,
    }),

  toggleWidget: (id) =>
    set((s) => {
      const next = s.activeWidgets.includes(id)
        ? s.activeWidgets.filter((w) => w !== id)
        : [...s.activeWidgets, id];
      return { activeWidgets: next, activePreset: null };
    }),

  reorderWidgets: (fromIdx, toIdx) =>
    set((s) => {
      const next = [...s.activeWidgets];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return { activeWidgets: next, activePreset: null };
    }),

  applyPreset: (presetKey) => {
    const preset = DASHBOARD_PRESETS[presetKey];
    if (!preset) return;
    set({ activeWidgets: [...preset.widgets], activePreset: presetKey });
  },

  resetDashboard: () =>
    set({
      activeWidgets: [...defaultWidgets],
      activePreset: 'default',
    }),

  dismissSuggestion: (id) =>
    set((s) => ({
      dismissedSuggestions: [...(s.dismissedSuggestions || []), id],
    })),

  setEditMode: (val) => set({ editMode: val }),
  toggleEditMode: () => set((s) => ({ editMode: !s.editMode })),
});
