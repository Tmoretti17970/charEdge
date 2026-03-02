// ═══════════════════════════════════════════════════════════════════
// charEdge — Settings Slice
// Extracted from useSettingsStore for useUserStore consolidation.
// ═══════════════════════════════════════════════════════════════════

import { DEFAULT_SETTINGS } from '../../constants.js';

export const createSettingsSlice = (set) => ({
  ...DEFAULT_SETTINGS,

  update: (updates) => set((s) => ({ ...s, ...updates })),

  hydrateSettings: (saved = {}) => set({ ...DEFAULT_SETTINGS, ...saved }),

  resetSettings: () => set({ ...DEFAULT_SETTINGS }),
});
