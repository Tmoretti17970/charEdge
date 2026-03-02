// ═══════════════════════════════════════════════════════════════════
// charEdge — User Store (Zustand, Consolidated)
//
// Phase 0.3: Merged from 6 separate stores into one using slices.
// Absorbs: useAuthStore, usePersonaStore, useSettingsStore,
//          useOnboardingStore, useDisplayUnitStore,
//          useDensityStore, useThemeStore
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createAuthSlice } from './user/authSlice.js';
import { createPersonaSlice } from './user/personaSlice.js';
import { createSettingsSlice } from './user/settingsSlice.js';
import { createOnboardingSlice } from './user/onboardingSlice.js';
import { createDisplayUnitSlice } from './user/displayUnitSlice.js';
import { createDensitySlice } from './user/densitySlice.js';
import { createThemeSlice } from './user/themeSlice.js';

// ─── Migration: absorb old localStorage keys on first load ──────

function migrateFromLegacyKeys() {
  if (typeof localStorage === 'undefined') return {};
  const merged = {};

  // Old charEdge-density store
  try {
    const raw = localStorage.getItem('charEdge-density');
    if (raw) {
      const parsed = JSON.parse(raw);
      const state = parsed?.state ?? parsed;
      if (state.mode) merged.mode = state.mode;
    }
  } catch { /* ignore */ }

  // Old charEdge-theme store
  try {
    const raw = localStorage.getItem('charEdge-theme');
    if (raw) {
      const parsed = JSON.parse(raw);
      const state = parsed?.state ?? parsed;
      if (state.theme) merged.theme = state.theme;
      if (state.accentColor) merged.accentColor = state.accentColor;
      if (state.fontSize) merged.fontSize = state.fontSize;
      if (state.chartColorPreset) merged.chartColorPreset = state.chartColorPreset;
    }
  } catch { /* ignore */ }

  return merged;
}

// ─── Store ──────────────────────────────────────────────────────

const useUserStore = create(
  persist(
    (...a) => ({
      ...createAuthSlice(...a),
      ...createPersonaSlice(...a),
      ...createSettingsSlice(...a),
      ...createOnboardingSlice(...a),
      ...createDisplayUnitSlice(...a),
      ...createDensitySlice(...a),
      ...createThemeSlice(...a),
    }),
    {
      name: 'charEdge-user',
      version: 1,
      partialize: (state) => ({
        // Display unit
        displayUnit: state.displayUnit,
        // Density
        mode: state.mode,
        // Theme & appearance
        theme: state.theme,
        accentColor: state.accentColor,
        fontSize: state.fontSize,
        chartColorPreset: state.chartColorPreset,
        // Simple Mode
        simpleMode: state.simpleMode,
      }),
      migrate(persisted, version) {
        if (version < 1) {
          // First time with new key — absorb old localStorage values
          const legacy = migrateFromLegacyKeys();
          return { ...persisted, ...legacy };
        }
        return persisted;
      },
    },
  ),
);

export { useUserStore };
export default useUserStore;
