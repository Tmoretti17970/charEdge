// ═══════════════════════════════════════════════════════════════════
// charEdge — Cosmetic & Milestone Slice
//
// Cosmetic theme rewards and milestone tracking.
// Extracted from useGamificationStore for composition.
// ═══════════════════════════════════════════════════════════════════

import { ACHIEVEMENTS } from './achievementSlice.js';

// ─── Cosmetic Rewards ───────────────────────────────────────────

export const COSMETIC_REWARDS = [
  { id: 'default',    name: 'Forge Default', type: 'accent', emoji: '⚡', unlockXP: 0,     colors: { primary: '#FF6B35', accent: '#FF9500' } },
  { id: 'ocean',      name: 'Deep Ocean',    type: 'accent', emoji: '🌊', unlockXP: 500,   colors: { primary: '#007AFF', accent: '#5AC8FA' } },
  { id: 'amethyst',   name: 'Amethyst',      type: 'accent', emoji: '💎', unlockXP: 2000,  colors: { primary: '#AF52DE', accent: '#DA7FF5' } },
  { id: 'emerald',    name: 'Emerald',       type: 'accent', emoji: '🍀', unlockXP: 5000,  colors: { primary: '#34C759', accent: '#30D158' } },
  { id: 'crimson',    name: 'Crimson Fire',  type: 'accent', emoji: '🔥', unlockXP: 15000, colors: { primary: '#FF3B30', accent: '#FF6B6B' } },
  { id: 'aurora',     name: 'Aurora',        type: 'accent', emoji: '🌌', unlockXP: 50000, colors: { primary: '#BF5AF2', accent: '#64D2FF' } },
];

// ─── Milestone Definitions ──────────────────────────────────────

export const MILESTONE_DEFS = [
  { id: 'trade_100',    title: '100 Trades Logged!',          emoji: '💯', check: (_s, trades) => (trades || []).length >= 100 },
  { id: 'trade_500',    title: '500 Trades — Half a Thousand!', emoji: '🎉', check: (_s, trades) => (trades || []).length >= 500 },
  { id: 'xp_1000',      title: '1,000 XP Earned!',            emoji: '⭐', check: (s) => s.xp >= 1000 },
  { id: 'xp_5000',      title: '5,000 XP — Elite Status!',    emoji: '🏆', check: (s) => s.xp >= 5000 },
  { id: 'streak_14',    title: '14-Day Trading Streak!',      emoji: '🔥', check: (s) => (s.streaks?.trading?.best || 0) >= 14 },
  { id: 'all_achieve',  title: 'Achievement Hunter — All Badges!', emoji: '👑', check: (s) => Object.keys(s.achievements || {}).length >= ACHIEVEMENTS.length },
];

// ─── Slice ──────────────────────────────────────────────────────

export const createCosmeticSlice = (set, get) => ({
  // ─── Milestones ─────────────────────────────────────────

  evaluateMilestones: (trades) => {
    if (!get().enabled) return;
    const state = get();
    for (const ms of MILESTONE_DEFS) {
      if (state.completedMilestones[ms.id]) continue;
      try {
        if (ms.check(state, trades)) {
          set({
            completedMilestones: { ...get().completedMilestones, [ms.id]: Date.now() },
            _pendingMilestone: { id: ms.id, title: ms.title, emoji: ms.emoji },
          });
          return; // One at a time
        }
      } catch (_) { /* skip broken checks */ }
    }
  },

  clearPendingMilestone: () => set({ _pendingMilestone: null }),

  // ─── Cosmetics ──────────────────────────────────────────

  getUnlockedCosmetics: () => {
    const xp = get().xp;
    return COSMETIC_REWARDS.filter(c => xp >= c.unlockXP);
  },

  equipCosmetic: (id) => {
    const xp = get().xp;
    const cosmetic = COSMETIC_REWARDS.find(c => c.id === id);
    if (!cosmetic || xp < cosmetic.unlockXP) return;
    set({ equippedCosmetic: id });
  },

  getEquippedColors: () => {
    const id = get().equippedCosmetic;
    const cosmetic = COSMETIC_REWARDS.find(c => c.id === id);
    return cosmetic?.colors || COSMETIC_REWARDS[0].colors;
  },
});
