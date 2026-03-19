// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — Model Store (Sprint 46)
// Zustand store for ML model preferences and runtime state.
// Persists user preferences (enabled models) to localStorage.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Types ──────────────────────────────────────────────────────

export interface ModelInfo {
  id: string;
  name: string;
      version: 1,
  sizeKB: number;
  loaded: boolean;
  enabled: boolean;
  lastInferenceMs: number | null;
  inferenceCount: number;
}

export interface ModelStoreState {
  /** Which models the user has enabled (persisted) */
  enabledModels: Record<string, boolean>;
  /** Runtime inference statistics (not persisted) */
  inferenceStats: Record<string, { lastMs: number; count: number; totalMs: number }>;
  /** Whether the ML pipeline is globally enabled */
  mlEnabled: boolean;
}

export interface ModelStoreActions {
  setModelEnabled: (modelId: string, enabled: boolean) => void;
  toggleModel: (modelId: string) => void;
  setMlEnabled: (enabled: boolean) => void;
  toggleMlEnabled: () => void;
  enableAll: () => void;
  disableAll: () => void;
  recordInference: (modelId: string, durationMs: number) => void;
  isModelEnabled: (modelId: string) => boolean;
  getInferenceStats: (modelId: string) => { lastMs: number; count: number; avgMs: number } | null;
}

// ─── Default Enabled Models ─────────────────────────────────────

const DEFAULT_ENABLED: Record<string, boolean> = {
  'regime-classifier': true,
  'pattern-detector': true,
  'setup-quality': true,
  'anomaly-autoencoder': true,
  'behavior-classifier': true,
  'entry-quality': true,
};

// ─── Store ──────────────────────────────────────────────────────

export const useModelStore = create<ModelStoreState & ModelStoreActions>()(
  persist(
    (set, get) => ({
      enabledModels: { ...DEFAULT_ENABLED },
      inferenceStats: {},
      mlEnabled: true,

      setModelEnabled: (modelId: string, enabled: boolean) =>
        set((s) => ({
          enabledModels: { ...s.enabledModels, [modelId]: enabled },
        })),

      toggleModel: (modelId: string) =>
        set((s) => ({
          enabledModels: {
            ...s.enabledModels,
            [modelId]: !s.enabledModels[modelId],
          },
        })),

      setMlEnabled: (enabled: boolean) => set({ mlEnabled: enabled }),

      toggleMlEnabled: () => set((s) => ({ mlEnabled: !s.mlEnabled })),

      enableAll: () =>
        set(() => ({ enabledModels: { ...DEFAULT_ENABLED } })),

      disableAll: () =>
        set((s) => {
          const disabled: Record<string, boolean> = {};
          for (const key of Object.keys(s.enabledModels)) disabled[key] = false;
          return { enabledModels: disabled };
        }),

      recordInference: (modelId: string, durationMs: number) =>
        set((s) => {
          const prev = s.inferenceStats[modelId] || { lastMs: 0, count: 0, totalMs: 0 };
          return {
            inferenceStats: {
              ...s.inferenceStats,
              [modelId]: {
                lastMs: durationMs,
                count: prev.count + 1,
                totalMs: prev.totalMs + durationMs,
              },
            },
          };
        }),

      isModelEnabled: (modelId: string) => {
        const s = get();
        return s.mlEnabled && (s.enabledModels[modelId] ?? true);
      },

      getInferenceStats: (modelId: string) => {
        const stats = get().inferenceStats[modelId];
        if (!stats) return null;
        return {
          lastMs: stats.lastMs,
          count: stats.count,
          avgMs: stats.count > 0 ? stats.totalMs / stats.count : 0,
        };
      },
    }),
    {
      name: 'charEdge-model-prefs',
      version: 1,
      partialize: (state) => ({
        enabledModels: state.enabledModels,
        mlEnabled: state.mlEnabled,
      }),
    }
  )
);

export default useModelStore;
