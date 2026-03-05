// ═══════════════════════════════════════════════════════════════════
// charEdge — Bento Layout Slice
// Extracted from useBentoLayoutStore for useLayoutStore consolidation.
// ═══════════════════════════════════════════════════════════════════

const DEFAULT_CARDS = [
  { id: 'today-session', label: "Today's Session", emoji: '📈', defaultSpan: 1 },
  { id: 'equity-curve', label: 'Equity Curve', emoji: '📊', defaultSpan: 2 },
  { id: 'profit-factor', label: 'Profit Factor', emoji: '⚡', defaultSpan: 1 },
  { id: 'win-loss', label: 'Win/Loss Ratio', emoji: '⚖️', defaultSpan: 1 },
  { id: 'max-drawdown', label: 'Max Drawdown', emoji: '📉', defaultSpan: 1 },
  { id: 'expectancy', label: 'Expectancy', emoji: '🔮', defaultSpan: 1 },
  { id: 'heatmap', label: 'Activity Heatmap', emoji: '🗓️', defaultSpan: 2 },
  { id: 'daily-pnl', label: 'Daily P&L', emoji: '💰', defaultSpan: 2 },
];

export const createBentoSlice = (set, get) => ({
  // ─── Bento State ──────────────────────────────────────────────
  cardOrder: DEFAULT_CARDS.map((c) => c.id),
  pinned: new Set(),
  hidden: new Set(),
  spans: {},
  customizing: false,

  // ─── Bento Actions ────────────────────────────────────────────
  togglePin: (cardId) => {
    set((s) => {
      const pinned = new Set(s.pinned);
      if (pinned.has(cardId)) pinned.delete(cardId);
      else pinned.add(cardId);
      return { pinned };
    });
  },

  toggleHide: (cardId) => {
    set((s) => {
      const hidden = new Set(s.hidden);
      if (hidden.has(cardId)) hidden.delete(cardId);
      else hidden.add(cardId);
      return { hidden };
    });
  },

  setSpan: (cardId, span) => {
    set((s) => ({
      spans: { ...s.spans, [cardId]: span },
    }));
  },

  reorder: (fromIdx, toIdx) => {
    set((s) => {
      const order = [...s.cardOrder];
      const [moved] = order.splice(fromIdx, 1);
      order.splice(toIdx, 0, moved);
      return { cardOrder: order };
    });
  },

  moveUp: (cardId) => {
    set((s) => {
      const order = [...s.cardOrder];
      const idx = order.indexOf(cardId);
      if (idx <= 0) return {};
      [order[idx - 1], order[idx]] = [order[idx], order[idx - 1]];
      return { cardOrder: order };
    });
  },

  moveDown: (cardId) => {
    set((s) => {
      const order = [...s.cardOrder];
      const idx = order.indexOf(cardId);
      if (idx < 0 || idx >= order.length - 1) return {};
      [order[idx], order[idx + 1]] = [order[idx + 1], order[idx]];
      return { cardOrder: order };
    });
  },

  toggleCustomizing: () => set((s) => ({ customizing: !s.customizing })),

  getVisibleCards: () => {
    const s = get();
    const visible = s.cardOrder.filter((id) => !s.hidden.has(id));
    const pinnedCards = visible.filter((id) => s.pinned.has(id));
    const unpinned = visible.filter((id) => !s.pinned.has(id));
    return [...pinnedCards, ...unpinned];
  },

  getCardDef: (cardId) => {
    return DEFAULT_CARDS.find((c) => c.id === cardId) || null;
  },

  getSpan: (cardId) => {
    const s = get();
    const def = DEFAULT_CARDS.find((c) => c.id === cardId);
    return s.spans[cardId] || def?.defaultSpan || 1;
  },

  resetBento: () => set({
    cardOrder: DEFAULT_CARDS.map((c) => c.id),
    pinned: new Set(),
    hidden: new Set(),
    spans: {},
    customizing: false,
  }),
});

export { DEFAULT_CARDS };
