// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — Backtest Store
// Zustand state management for the strategy backtester.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { runBacktest, PRESET_STRATEGIES, DEFAULT_CONFIG } from '../charting_library/core/BacktestEngine.js';

const useBacktestStore = create(
  persist(
    (set, get) => ({
      // ─── UI State ──────────────────────────────────────────
      panelOpen: false,
      resultsOpen: false,

      // ─── Configuration ─────────────────────────────────────
      config: {
        ...DEFAULT_CONFIG,
        strategyId: 'sma_crossover',
      },

      // ─── Results ───────────────────────────────────────────
      currentResult: null,
      resultHistory: [],  // Last 10 results for comparison
      isRunning: false,
      error: null,

      // ─── Actions ───────────────────────────────────────────

      togglePanel() {
        set(s => ({ panelOpen: !s.panelOpen }));
      },

      openPanel() { set({ panelOpen: true }); },
      closePanel() { set({ panelOpen: false }); },

      openResults() { set({ resultsOpen: true }); },
      closeResults() { set({ resultsOpen: false }); },

      setConfig(updates) {
        set(s => ({ config: { ...s.config, ...updates } }));
      },

      /**
       * Run backtest with current config against provided bars.
       * @param {Object[]} bars - Historical OHLCV data
       * @param {Object} [customStrategy] - Optional custom strategy (overrides preset)
       */
      async runBacktest(bars, customStrategy = null) {
        const { config } = get();
        set({ isRunning: true, error: null });

        try {
          const strategy = customStrategy || PRESET_STRATEGIES[config.strategyId];
          if (!strategy) {
            set({ isRunning: false, error: `Strategy "${config.strategyId}" not found` });
            return;
          }

          // Run on next tick to avoid blocking UI
          await new Promise(resolve => setTimeout(resolve, 10));

          const result = runBacktest(bars, strategy, config);

          if (!result.success) {
            set({ isRunning: false, error: result.error });
            return;
          }

          // Save to history (keep last 10)
          const history = [
            { ...result, timestamp: Date.now(), id: crypto.randomUUID() },
            ...get().resultHistory,
          ].slice(0, 10);

          set({
            currentResult: result,
            resultHistory: history,
            resultsOpen: true,
            isRunning: false,
            error: null,
          });
        } catch (e) {
          set({ isRunning: false, error: e.message });
        }
      },

      clearResults() {
        set({ currentResult: null, resultsOpen: false });
      },

      clearHistory() {
        set({ resultHistory: [] });
      },

      // ─── Preset Info ───────────────────────────────────────

      getPresetList() {
        return Object.entries(PRESET_STRATEGIES).map(([id, s]) => ({
          id,
          name: s.name,
          description: s.description,
        }));
      },
    }),
    {
      name: 'charEdge-backtest',
      version: 1,
      partialize: (state) => ({
        config: state.config,
        resultHistory: state.resultHistory.slice(0, 5),
      }),
    },
  ),
);

export { useBacktestStore };
export default useBacktestStore;
