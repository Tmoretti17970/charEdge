// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — User Store (Zustand, Consolidated, TypeScript)
//
// Phase 0.3: Merged from 6 separate stores into one using slices.
// Phase 2: Converted to TypeScript.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createAuthSlice } from './user/authSlice';
import { createPersonaSlice } from './user/personaSlice.js';
import { createProfileSlice } from './user/profileSlice.js';
import { createSettingsSlice } from './user/settingsSlice.js';
import { createOnboardingSlice } from './user/onboardingSlice';
import { createDisplayUnitSlice } from './user/displayUnitSlice.js';
import { createDensitySlice } from './user/densitySlice.js';
import { createThemeSlice } from './user/themeSlice';

// ─── Types ──────────────────────────────────────────────────────

interface LegacyMigration {
    mode?: string;
    theme?: string;
    accentColor?: string;
    fontSize?: string;
    chartColorPreset?: string;
    [key: string]: unknown;
}

interface UserPersistedState {
    displayUnit?: string;
    mode?: string;
    theme?: string;
    accentColor?: string;
    fontSize?: string;
    chartColorPreset?: string;
    simpleMode?: boolean;
    [key: string]: unknown;
}

// ─── Migration: absorb old localStorage keys on first load ──────

function migrateFromLegacyKeys(): LegacyMigration {
    if (typeof localStorage === 'undefined') return {};
    const merged: LegacyMigration = {};

    // Old charEdge-density store
    try {
        const raw = localStorage.getItem('charEdge-density');
        if (raw) {
            const parsed = JSON.parse(raw);
            const state = parsed?.state ?? parsed;
            if (state.mode) merged.mode = state.mode;
        }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) { /* ignore */ }

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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) { /* ignore */ }

    return merged;
}

// ─── Store ──────────────────────────────────────────────────────

const useUserStore = create(
    persist(
        (...a: Parameters<Parameters<typeof create>[0]>) => ({
            ...createAuthSlice(...a),
            ...createPersonaSlice(...a),
            ...createProfileSlice(...a),
            ...createSettingsSlice(...a),
            ...createOnboardingSlice(...a),
            ...createDisplayUnitSlice(...a),
            ...createDensitySlice(...a),
            ...createThemeSlice(...a),
        }),
        {
            name: 'charEdge-user',
            version: 2,
            partialize: (state: UserPersistedState) => ({
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
                // Profile (Sprint 2)
                profile: state.profile,
                // A3.2: Trading settings — prevent loss on force-quit
                dailyLossLimit: state.dailyLossLimit,
                defaultSymbol: state.defaultSymbol,
                defaultTf: state.defaultTf,
                accountSize: state.accountSize,
                riskPerTrade: state.riskPerTrade,
                riskPerTradePct: state.riskPerTradePct,
                maxDailyTrades: state.maxDailyTrades,
                maxOpenPositions: state.maxOpenPositions,
                riskFreeRate: state.riskFreeRate,
                positionSizing: state.positionSizing,
                kellyFraction: state.kellyFraction,
                activeRiskPreset: state.activeRiskPreset,
            }),
            migrate(persisted: UserPersistedState, version: number) {
                if (version < 1) {
                    const legacy = migrateFromLegacyKeys();
                    return { ...persisted, ...legacy };
                }
                // v1 → v2: Trading settings now persisted (A3.2), no data transformation needed
                return persisted;
            },
        },
    ),
);

export { useUserStore };
export default useUserStore;
