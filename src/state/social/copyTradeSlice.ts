// ═══════════════════════════════════════════════════════════════════
// Copy Trade Slice — mirror trading relationships
// Previously: useCopyTradeStore.js
// ═══════════════════════════════════════════════════════════════════

const MOCK_HISTORY = [
  { id: 'ct_1', traderId: 'trader_1', traderName: 'CryptoKing', symbol: 'BTC', side: 'long', entry: 64200, exit: 65800, pnl: 1600, rMultiple: 2.1, date: '2026-02-23T14:30:00Z' },
  { id: 'ct_2', traderId: 'trader_1', traderName: 'CryptoKing', symbol: 'ETH', side: 'long', entry: 3420, exit: 3380, pnl: -120, rMultiple: -0.4, date: '2026-02-22T10:15:00Z' },
  { id: 'ct_3', traderId: 'trader_2', traderName: 'SwingMaster', symbol: 'SOL', side: 'long', entry: 142, exit: 156, pnl: 840, rMultiple: 1.8, date: '2026-02-22T09:00:00Z' },
  { id: 'ct_4', traderId: 'trader_3', traderName: 'MacroAlpha', symbol: 'EURUSD', side: 'short', entry: 1.0892, exit: 1.0845, pnl: 470, rMultiple: 1.5, date: '2026-02-21T16:00:00Z' },
  { id: 'ct_5', traderId: 'trader_2', traderName: 'SwingMaster', symbol: 'AVAX', side: 'long', entry: 38.5, exit: 41.2, pnl: 540, rMultiple: 2.0, date: '2026-02-20T11:30:00Z' },
];

export const createCopyTradeSlice = (set, get) => ({
  copyTargets: [],
  copyHistory: MOCK_HISTORY,

  addCopyTarget: (target) => {
    const { copyTargets } = get();
    if (copyTargets.find((t) => t.userId === target.userId)) return;
    set({
      copyTargets: [
        ...copyTargets,
        {
          userId: target.userId,
          name: target.name,
          avatar: target.avatar || '👤',
          allocation: target.allocation || 10,
          riskMultiplier: target.riskMultiplier || 1.0,
          maxPositions: target.maxPositions || 3,
          stopLossOverride: target.stopLossOverride || false,
          active: true,
          copiedAt: new Date().toISOString(),
          totalPnl: 0,
          tradeCount: 0,
          winRate: 0,
        },
      ],
    });
  },

  removeCopyTarget: (userId) => {
    set({ copyTargets: get().copyTargets.filter((t) => t.userId !== userId) });
  },

  updateCopyTarget: (userId, updates) => {
    set({
      copyTargets: get().copyTargets.map((t) =>
        t.userId === userId ? { ...t, ...updates } : t
      ),
    });
  },

  toggleActive: (userId) => {
    set({
      copyTargets: get().copyTargets.map((t) =>
        t.userId === userId ? { ...t, active: !t.active } : t
      ),
    });
  },

  isCopying: (userId) => get().copyTargets.some((t) => t.userId === userId),

  getCopiedTraders: () => get().copyTargets.filter((t) => t.active),

  getHistoryForTrader: (userId) =>
    get().copyHistory.filter((h) => h.traderId === userId),

  getTotalCopyPnl: () =>
    get().copyHistory.reduce((sum, h) => sum + h.pnl, 0),
});
