// ═══════════════════════════════════════════════════════════════════
// charEdge — Signal Slice (Social Store)
//
// Manages trade signal alerts from followed traders.
// Migrated from standalone useSignalStore → useSocialStore slice.
// ═══════════════════════════════════════════════════════════════════

const MOCK_SIGNALS = [
  { id: 'sig_1', traderId: 'trader_1', traderName: 'CryptoKing', avatar: '👑', type: 'idea', message: 'Posted a BTC Long idea — targeting 68k', symbol: 'BTC', ts: Date.now() - 300000, read: false },
  { id: 'sig_2', traderId: 'trader_2', traderName: 'SwingMaster', avatar: '🎯', type: 'trade', message: 'Opened a SOL Long position', symbol: 'SOL', ts: Date.now() - 900000, read: false },
  { id: 'sig_3', traderId: 'trader_3', traderName: 'MacroAlpha', avatar: '🧠', type: 'idea', message: 'Published EUR/USD short thesis with chart analysis', symbol: 'EURUSD', ts: Date.now() - 1800000, read: true },
  { id: 'sig_4', traderId: 'trader_1', traderName: 'CryptoKing', avatar: '👑', type: 'trade', message: 'Closed ETH Long — +$1,200 profit', symbol: 'ETH', ts: Date.now() - 3600000, read: true },
  { id: 'sig_5', traderId: 'trader_4', traderName: 'NightOwl', avatar: '🦉', type: 'prediction', message: 'Created prediction: "BTC above 70k by March?"', symbol: 'BTC', ts: Date.now() - 7200000, read: true },
];

export const createSignalSlice = (set, get) => ({
  signals: MOCK_SIGNALS,
  signalPreferences: {},

  toggleTraderSignals: (traderId) => {
    const prefs = { ...get().signalPreferences };
    prefs[traderId] = !prefs[traderId];
    set({ signalPreferences: prefs });
  },

  isTraderSignalEnabled: (traderId) => {
    return get().signalPreferences[traderId] !== false; // default on
  },

  markSignalRead: (signalId) => {
    set({
      signals: get().signals.map((s) =>
        s.id === signalId ? { ...s, read: true } : s
      ),
    });
  },

  markAllSignalsRead: () => {
    set({
      signals: get().signals.map((s) => ({ ...s, read: true })),
    });
  },

  // Backward-compat aliases (used by SignalAlertPanel)
  markAllRead: () => {
    set({
      signals: get().signals.map((s) => ({ ...s, read: true })),
    });
  },

  getSignalUnreadCount: () => get().signals.filter((s) => !s.read).length,

  // Backward-compat alias
  getUnreadCount: () => get().signals.filter((s) => !s.read).length,
});

