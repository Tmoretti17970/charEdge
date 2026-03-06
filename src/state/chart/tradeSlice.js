// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Trade Slice
// Extracted from useChartTradeStore for useChartStore consolidation.
//
// Handles the chart-based trade entry workflow: pending levels,
// risk parameters, position sizing, and trade submission.
// ═══════════════════════════════════════════════════════════════════

// ─── Pure Calculation Helpers (exported for consumer use) ────────

export function calcRiskReward(entry, stopLoss, takeProfit, side = 'long') {
  if (!entry || !stopLoss || !takeProfit) return null;
  const risk = Math.abs(entry - stopLoss);
  const reward = Math.abs(takeProfit - entry);
  if (risk === 0) return Infinity;
  return Number((reward / risk).toFixed(2));
}

export function calcPositionSize(accountSize, riskPercent, entry, stopLoss) {
  if (!accountSize || !riskPercent || !entry || !stopLoss) return null;
  const riskAmount = accountSize * (riskPercent / 100);
  const riskPerUnit = Math.abs(entry - stopLoss);
  if (riskPerUnit === 0) return null;
  return Math.floor(riskAmount / riskPerUnit);
}

// ─── Slice ───────────────────────────────────────────────────────

const TRADE_DEFAULTS = {
  tradeMode: false,
  tradeSide: 'long',
  pendingEntry: null,
  pendingStopLoss: null,
  pendingTakeProfit: null,
  riskPercent: 1,
  riskReward: null,
  positionSize: null,
  tradeNote: '',
  tradePlaybook: null,
  tradeSetup: '',
  showTradePanel: false,
  activeLevelDrag: null,
  // Quick trade bar
  quickTradeOpen: false,
  quickTradeSymbol: '',
  quickTradeSide: 'long',
};

export const createTradeSlice = (set, get) => ({
  ...TRADE_DEFAULTS,

  // ─── Mode ─────────────────────────────────────────────────────
  toggleTradeMode: () => {
    set((s) => ({
      tradeMode: !s.tradeMode,
      showTradePanel: !s.tradeMode,
      ...(!s.tradeMode ? {} : {
        pendingEntry: null,
        pendingStopLoss: null,
        pendingTakeProfit: null,
        riskReward: null,
        positionSize: null,
        tradeNote: '',
        tradePlaybook: null,
        tradeSetup: '',
      }),
    }));
  },

  setTradeMode: (on) => set({ tradeMode: on, showTradePanel: on }),
  setTradeSide: (side) => set({ tradeSide: side }),

  // Convenience: enter/exit trade mode with side (used by ChartTradeToolbar)
  enterTradeMode: (side = 'long') => set({ tradeMode: true, tradeSide: side, showTradePanel: true }),
  exitTradeMode: () => set({
    tradeMode: false,
    showTradePanel: false,
    pendingEntry: null,
    pendingStopLoss: null,
    pendingTakeProfit: null,
    riskReward: null,
    positionSize: null,
    tradeNote: '',
    tradePlaybook: null,
    tradeSetup: '',
  }),

  // ─── Levels ───────────────────────────────────────────────────
  setPendingEntry: (price) => {
    set({ pendingEntry: price });
    get()._recalcTrade();
  },

  setPendingStopLoss: (price) => {
    set({ pendingStopLoss: price });
    get()._recalcTrade();
  },

  setPendingTakeProfit: (price) => {
    set({ pendingTakeProfit: price });
    get()._recalcTrade();
  },

  setActiveLevelDrag: (level) => set({ activeLevelDrag: level }),

  // ─── Risk Parameters ──────────────────────────────────────────
  setRiskPercent: (pct) => {
    set({ riskPercent: pct });
    get()._recalcTrade();
  },

  // ─── Trade Metadata ───────────────────────────────────────────
  setTradeNote: (note) => set({ tradeNote: note }),
  setTradePlaybook: (playbook) => set({ tradePlaybook: playbook }),
  setTradeSetup: (setup) => set({ tradeSetup: setup }),
  setShowTradePanel: (show) => set({ showTradePanel: show }),

  // ─── Quick Trade ──────────────────────────────────────────────
  setQuickTradeOpen: (open) => set({ quickTradeOpen: open }),
  setQuickTradeSymbol: (sym) => set({ quickTradeSymbol: sym }),
  setQuickTradeSide: (side) => set({ quickTradeSide: side }),

  // ─── Internal Recalculation ───────────────────────────────────
  _recalcTrade: () => {
    const s = get();
    const rr = calcRiskReward(
      s.pendingEntry,
      s.pendingStopLoss,
      s.pendingTakeProfit,
      s.tradeSide,
    );

    // Try to get account size from settings (on the same store via useUserStore or from useSettingsStore)
    const accountSize = s.accountSize || 25000;
    const pos = calcPositionSize(
      accountSize,
      s.riskPercent,
      s.pendingEntry,
      s.pendingStopLoss,
    );

    set({ riskReward: rr, positionSize: pos });
  },

  // ─── Submit Trade ─────────────────────────────────────────────
  submitChartTrade: () => {
    const s = get();
    if (!s.pendingEntry) return null;

    const trade = {
      id: `ct_${Date.now()}`,
      symbol: s.symbol || 'UNKNOWN',
      side: s.tradeSide,
      entry: s.pendingEntry,
      stopLoss: s.pendingStopLoss,
      takeProfit: s.pendingTakeProfit,
      riskReward: s.riskReward,
      positionSize: s.positionSize,
      riskPercent: s.riskPercent,
      note: s.tradeNote,
      playbook: s.tradePlaybook,
      setup: s.tradeSetup,
      date: new Date().toISOString(),
      source: 'chart',
    };

    // Reset trade state
    set({
      pendingEntry: null,
      pendingStopLoss: null,
      pendingTakeProfit: null,
      riskReward: null,
      positionSize: null,
      tradeNote: '',
      tradePlaybook: null,
      tradeSetup: '',
      tradeMode: false,
      showTradePanel: false,
    });

    return trade;
  },

  resetChartTrade: () => set({ ...TRADE_DEFAULTS }),
});
