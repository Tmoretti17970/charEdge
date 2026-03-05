// ═══════════════════════════════════════════════════════════════════
// charEdge — Achievement Slice
//
// Achievement definitions and evaluation logic.
// Extracted from useGamificationStore for composition.
// ═══════════════════════════════════════════════════════════════════

export const ACHIEVEMENTS = [
  {
    id: 'first_blood',
    name: 'First Blood',
    description: 'Log your first trade',
    emoji: '🔥',
    rarity: 'common',
    check: (_state, trades) => (trades || []).length >= 1,
  },
  {
    id: 'journaler',
    name: 'Journaler',
    description: 'Write notes on 10 trades',
    emoji: '📝',
    rarity: 'common',
    check: (_state, trades) =>
      (trades || []).filter((t) => t.notes && t.notes.trim().length > 10).length >= 10,
  },
  {
    id: 'sharpshooter',
    name: 'Sharpshooter',
    description: '5 consecutive winning trades',
    emoji: '🎯',
    rarity: 'uncommon',
    check: (_state, trades) => {
      if (!trades || trades.length < 5) return false;
      const sorted = [...trades].sort((a, b) => new Date(b.date) - new Date(a.date));
      let streak = 0;
      for (const t of sorted) {
        if ((t.pnl || 0) > 0) { streak++; if (streak >= 5) return true; }
        else streak = 0;
      }
      return false;
    },
  },
  {
    id: 'zen_master',
    name: 'Zen Master',
    description: 'Complete pre-trade checklist 50 times',
    emoji: '🧘',
    rarity: 'uncommon',
    check: (state) => (state.checklistCompletions || 0) >= 50,
  },
  {
    id: 'data_nerd',
    name: 'Data Nerd',
    description: 'Log 25 trades with detailed notes',
    emoji: '📊',
    rarity: 'common',
    check: (_state, trades) =>
      (trades || []).filter((t) => t.notes && t.notes.trim().length > 50).length >= 25,
  },
  {
    id: 'summit',
    name: 'Summit',
    description: 'Hit a monthly PnL goal',
    emoji: '🏔️',
    rarity: 'rare',
    check: (state) => (state.goalsHit || 0) >= 1,
  },
  {
    id: 'inferno',
    name: 'Inferno',
    description: '30-day trading streak',
    emoji: '🔥',
    rarity: 'rare',
    check: (state) => (state.streaks?.trading?.best || 0) >= 30,
  },
  {
    id: 'brick_by_brick',
    name: 'Brick by Brick',
    description: '100 total trades logged',
    emoji: '🧱',
    rarity: 'uncommon',
    check: (_state, trades) => (trades || []).length >= 100,
  },
  {
    id: 'comeback_king',
    name: 'Comeback King',
    description: 'Recover from a drawdown to new equity high',
    emoji: '🌊',
    rarity: 'epic',
    check: (_state, trades) => {
      if (!trades || trades.length < 10) return false;
      const sorted = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
      let equity = 0, peak = 0, hadDrawdown = false;
      for (const t of sorted) {
        equity += t.pnl || 0;
        if (equity < peak * 0.9 && peak > 0) hadDrawdown = true;
        if (equity > peak) {
          if (hadDrawdown) return true;
          peak = equity;
        }
      }
      return false;
    },
  },
  {
    id: 'forge_master',
    name: 'Forge Master',
    description: 'Reach the maximum rank',
    emoji: '🏆',
    rarity: 'legendary',
    check: (state) => (state.xp || 0) >= 50000,
  },
  {
    id: 'discipline',
    name: 'Iron Discipline',
    description: '7-day journaling streak',
    emoji: '📕',
    rarity: 'uncommon',
    check: (state) => (state.streaks?.journaling?.best || 0) >= 7,
  },
  {
    id: 'centurion',
    name: 'Centurion',
    description: 'Earn 1,000 XP',
    emoji: '💎',
    rarity: 'uncommon',
    check: (state) => (state.xp || 0) >= 1000,
  },
  {
    id: 'charolettes_light',
    name: "Charolette's Light",
    description: 'Support a cause through Charolette\'s Light',
    emoji: '✦',
    rarity: 'legendary',
    check: (state) => !!state.charolettesLightUnlocked,
  },
];

export const createAchievementSlice = (set, get) => ({
  evaluateAchievements: (trades) => {
    if (!get().enabled) return;
    const state = get();
    const newAchievements = { ...state.achievements };
    const pending = [];

    for (const ach of ACHIEVEMENTS) {
      if (newAchievements[ach.id]) continue; // Already unlocked
      try {
        if (ach.check(state, trades)) {
          newAchievements[ach.id] = { unlockedAt: Date.now(), seen: false };
          pending.push({ id: ach.id, name: ach.name, emoji: ach.emoji, rarity: ach.rarity });
        }
      } catch (_) {
        // Skip broken checks
      }
    }

    if (pending.length > 0) {
      set({
        achievements: newAchievements,
        _pendingAchievements: [...state._pendingAchievements, ...pending],
      });
    }
  },

  consumePendingAchievements: () => {
    const pending = get()._pendingAchievements;
    set({ _pendingAchievements: [] });
    return pending;
  },

  markAchievementSeen: (id) => {
    const achievements = { ...get().achievements };
    if (achievements[id]) {
      achievements[id] = { ...achievements[id], seen: true };
      set({ achievements });
    }
  },
});
