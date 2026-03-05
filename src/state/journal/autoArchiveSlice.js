// ═══════════════════════════════════════════════════════════════════
// Auto-Archive Slice — widget/workspace activity tracking
// Previously: useAutoArchiveStore.js
// ═══════════════════════════════════════════════════════════════════

const DAY = 86_400_000;

export const createAutoArchiveSlice = (set, get) => ({
  widgetInteractions: {},
  workspaceInteractions: {},
  digestMode: 'instant',

  recordWidgetInteraction(widgetId) {
    set((s) => ({
      widgetInteractions: {
        ...s.widgetInteractions,
        [widgetId]: Date.now(),
      },
    }));
  },

  recordWorkspaceOpen(workspaceId) {
    set((s) => ({
      workspaceInteractions: {
        ...s.workspaceInteractions,
        [workspaceId]: Date.now(),
      },
    }));
  },

  setDigestMode(mode) {
    set({ digestMode: mode });
  },

  getStaleWidgets(activeWidgets = []) {
    const now = Date.now();
    const interactions = get().widgetInteractions;

    return activeWidgets.map((id) => {
      const lastInteraction = interactions[id] || 0;
      const daysSince = lastInteraction === 0
        ? Infinity
        : Math.floor((now - lastInteraction) / DAY);

      let status = 'active';
      if (daysSince >= 30) status = 'dormant';
      else if (daysSince >= 14) status = 'stale';

      return { widgetId: id, daysSinceInteraction: daysSince, status };
    });
  },

  getStaleWorkspaces(workspaces = [], dayThreshold = 30) {
    const now = Date.now();
    const interactions = get().workspaceInteractions;

    return workspaces.filter((ws) => {
      const lastOpen = interactions[ws.id] || 0;
      return lastOpen > 0 && now - lastOpen > dayThreshold * DAY;
    });
  },

  resetArchive() {
    set({
      widgetInteractions: {},
      workspaceInteractions: {},
      digestMode: 'instant',
    });
  },
});
