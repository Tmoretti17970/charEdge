// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — Gamification Store (Sprint A–D)
//
// XP/Leveling, Streaks, Achievements, Daily/Weekly Challenges,
// Cosmetic Rewards, Milestones, Trading Quests.
// Persisted to IndexedDB via AppBoot alongside other stores.
//
// Usage:
//   const xp = useGamificationStore(s => s.xp);
//   const level = useGamificationStore(s => s.getLevel());
//   useGamificationStore.getState().awardXP(10, 'trade_logged');
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { createTournamentSlice, MOCK_TOURNAMENTS } from './gamification/tournamentSlice';
import { createGoalSlice, GOAL_DEFAULTS } from './gamification/goalSlice';
import { ACHIEVEMENTS, createAchievementSlice } from './gamification/achievementSlice';
import { CHALLENGE_POOL, WEEKLY_CHALLENGE_POOL, createChallengeSlice, getTodayKey, getDateKey } from './gamification/challengeSlice';
import { QUEST_DEFS, createQuestSlice } from './gamification/questSlice.js';
import { COSMETIC_REWARDS, MILESTONE_DEFS, createCosmeticSlice } from './gamification/cosmeticSlice';

// ─── Rank Tiers ─────────────────────────────────────────────────

const RANKS = [
  { level: 1, name: 'Apprentice',        emoji: '🔰', minXP: 0,     color: '#8E8E93' },
  { level: 2, name: 'Journeyman',        emoji: '⚔️', minXP: 500,   color: '#34C759' },
  { level: 3, name: 'Strategist',        emoji: '🧠', minXP: 2000,  color: '#007AFF' },
  { level: 4, name: 'Tactician',         emoji: '🎯', minXP: 5000,  color: '#AF52DE' },
  { level: 5, name: 'Market Architect',  emoji: '🏛️', minXP: 15000, color: '#FF9500' },
  { level: 6, name: 'Forge Master',      emoji: '🔥', minXP: 50000, color: '#FF3B30' },
];

function getRankForXP(xp) {
  let rank = RANKS[0];
  for (const r of RANKS) {
    if (xp >= r.minXP) rank = r;
    else break;
  }
  return rank;
}

function getXPToNextLevel(xp) {
  const currentRank = getRankForXP(xp);
  const nextRank = RANKS.find((r) => r.minXP > xp);
  if (!nextRank) return { needed: 0, progress: 1, nextRank: null }; // Max level
  const rangeTotal = nextRank.minXP - currentRank.minXP;
  const rangeCurrent = xp - currentRank.minXP;
  return {
    needed: nextRank.minXP - xp,
    progress: rangeTotal > 0 ? rangeCurrent / rangeTotal : 1,
    nextRank,
  };
}

// ─── XP Award Table ─────────────────────────────────────────────

const XP_TABLE = {
  trade_logged:     10,
  notes_written:    15,
  checklist_done:   20,
  daily_debrief:    25,
  daily_goal_hit:   50,
  weekly_goal_hit:  100,
  streak_7:         100,
  streak_30:        300,
  streak_100:       500,
  chart_shared:     30,
  poll_voted:       5,
  trade_graded:     10,
  challenge_done:   0,  // Dynamic — set by challenge
};

// ─── Streak Helpers ─────────────────────────────────────────────

function getYesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function computeStreak(currentStreak, lastDate) {
  const today = getTodayKey();
  const yesterday = getYesterdayKey();

  if (lastDate === today) return currentStreak; // Already counted today
  if (lastDate === yesterday) return currentStreak + 1; // Continuing streak
  return 1; // Streak broken, starting new
}

// ═══════════════════════════════════════════════════════════════════
// Store
// ═══════════════════════════════════════════════════════════════════

const useGamificationStore = create((...a) => {
  const [set, get] = a;
  return ({
  // ─── Composed Slices ──────────────────────────────────────
  ...createTournamentSlice(...a),
  ...createGoalSlice(...a),
  ...createAchievementSlice(...a),
  ...createChallengeSlice(...a),
  ...createQuestSlice(...a),
  ...createCosmeticSlice(...a),

  // ─── State ───────────────────────────────────────────────
  xp: 0,
  xpLog: [],            // Last 50 [{source, amount, ts}]
  checklistCompletions: 0,
  goalsHit: 0,

  streaks: {
    trading:    { current: 0, best: 0, lastDate: null },
    journaling: { current: 0, best: 0, lastDate: null },
    profitable: { current: 0, best: 0, lastDate: null },
  },

  achievements: {},      // { [id]: { unlockedAt, seen } }

  dailyChallenge: null,  // Current active challenge
  weeklyChallenge: null, // Current weekly challenge

  // Sprint C — Cosmetics
  equippedCosmetic: 'default',

  // Sprint C — Milestones
  completedMilestones: {},  // { [id]: timestamp }

  // Sprint D — Quests
  activeQuests: {},         // { [questId]: { step, progress, startedAt } }
  completedQuests: {},      // { [questId]: timestamp }

  enabled: true,         // Master toggle

  notificationPrefs: {
    levelUp: true,        // Show level-up modal
    achievements: true,   // Show achievement toasts
  },

  // Transient UI state (not persisted)
  _pendingLevelUp: null,       // { oldRank, newRank } — consumed by LevelUpModal
  _pendingAchievements: [],    // [{id, name, emoji, rarity}] — consumed by AchievementToast
  _pendingMilestone: null,     // { id, title, emoji } — consumed by MilestoneModal

  // ─── XP System ──────────────────────────────────────────

  getLevel: () => getRankForXP(get().xp),

  getXPProgress: () => getXPToNextLevel(get().xp),

  awardXP: (amount, source) => {
    if (!get().enabled || amount <= 0) return;

    const oldXP = get().xp;
    const oldRank = getRankForXP(oldXP);
    const newXP = oldXP + amount;
    const newRank = getRankForXP(newXP);

    const entry = { source, amount, ts: Date.now() };
    const log = [entry, ...get().xpLog].slice(0, 50);

    const updates = { xp: newXP, xpLog: log };

    // Detect level-up
    if (newRank.level > oldRank.level) {
      updates._pendingLevelUp = { oldRank, newRank };
    }

    set(updates);
  },

  clearPendingLevelUp: () => set({ _pendingLevelUp: null }),

  // ─── Streaks ────────────────────────────────────────────

  updateStreaks: (trades) => {
    if (!get().enabled) return;
    const today = getTodayKey();
    const todayTrades = (trades || []).filter((t) => getDateKey(t.date) === today);
    if (todayTrades.length === 0) return;

    const state = get();
    const newStreaks = { ...state.streaks };

    // Trading streak
    const ts = state.streaks.trading;
    if (ts.lastDate !== today) {
      const newCurrent = computeStreak(ts.current, ts.lastDate);
      newStreaks.trading = {
        current: newCurrent,
        best: Math.max(ts.best, newCurrent),
        lastDate: today,
      };
    }

    // Journaling streak
    const hasNotes = todayTrades.some((t) => t.notes && t.notes.trim().length > 0);
    if (hasNotes) {
      const js = state.streaks.journaling;
      if (js.lastDate !== today) {
        const newCurrent = computeStreak(js.current, js.lastDate);
        newStreaks.journaling = {
          current: newCurrent,
          best: Math.max(js.best, newCurrent),
          lastDate: today,
        };
      }
    }

    // Profitable day streak
    const todayPnl = todayTrades.reduce((s, t) => s + (t.pnl || 0), 0);
    if (todayPnl > 0) {
      const ps = state.streaks.profitable;
      if (ps.lastDate !== today) {
        const newCurrent = computeStreak(ps.current, ps.lastDate);
        newStreaks.profitable = {
          current: newCurrent,
          best: Math.max(ps.best, newCurrent),
          lastDate: today,
        };
      }
    }

    set({ streaks: newStreaks });

    // Award streak milestone XP
    const tradingStreak = newStreaks.trading.current;
    if (tradingStreak === 7) get().awardXP(XP_TABLE.streak_7, 'streak_7');
    if (tradingStreak === 30) get().awardXP(XP_TABLE.streak_30, 'streak_30');
    if (tradingStreak === 100) get().awardXP(XP_TABLE.streak_100, 'streak_100');
  },

  // ─── Counters ───────────────────────────────────────────

  incrementChecklistCount: () => {
    const state = get();
    set({ checklistCompletions: state.checklistCompletions + 1 });

    // Update daily challenge if it's checklist-related
    const challenge = state.dailyChallenge;
    if (challenge && challenge.type === 'checklist_count' && !challenge.completed) {
      set({
        dailyChallenge: {
          ...get().dailyChallenge,
          _checklistCount: (challenge._checklistCount || 0) + 1,
        },
      });
    }
  },

  incrementGoalsHit: () => {
    set({ goalsHit: get().goalsHit + 1 });
  },

  // ─── Settings ───────────────────────────────────────────

  toggleEnabled: () => set((s) => ({ enabled: !s.enabled })),

  setNotificationPref: (key, val) =>
    set((s) => ({
      notificationPrefs: { ...s.notificationPrefs, [key]: val },
    })),

  resetProgress: () =>
    set({
      xp: 0,
      xpLog: [],
      checklistCompletions: 0,
      goalsHit: 0,
      streaks: {
        trading:    { current: 0, best: 0, lastDate: null },
        journaling: { current: 0, best: 0, lastDate: null },
        profitable: { current: 0, best: 0, lastDate: null },
      },
      achievements: {},
      dailyChallenge: null,
      weeklyChallenge: null,
      completedMilestones: {},
      activeQuests: {},
      completedQuests: {},
      equippedCosmetic: 'default',
      _pendingLevelUp: null,
      _pendingAchievements: [],
      _pendingMilestone: null,
    }),

  // ─── Persistence ────────────────────────────────────────

  hydrate: (saved = {}) => {
    if (!saved || typeof saved !== 'object') return;

    // Migrate tournament data from old localStorage key
    let tournamentData = {};
    try {
      const raw = localStorage.getItem('tf-tournament-store');
      if (raw) {
        const parsed = JSON.parse(raw);
        const state = parsed?.state || parsed;
        tournamentData = {
          tournaments: state.tournaments || MOCK_TOURNAMENTS,
          myEntries: state.myEntries || [],
        };
        localStorage.removeItem('tf-tournament-store');
      }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) { /* ignore */ }

    // Migrate goal data from old localStorage key
    let goalData = {};
    try {
      const raw = localStorage.getItem('charEdge-goals');
      if (raw) {
        const parsed = JSON.parse(raw);
        const state = parsed?.state || parsed;
        goalData = {
          goals: state.goals || GOAL_DEFAULTS.goals,
          dailyLossLimit: state.dailyLossLimit || 0,
          dailyLossEnabled: state.dailyLossEnabled || false,
          winRateTarget: state.winRateTarget || 0,
          winRateEnabled: state.winRateEnabled || false,
          tradeCountTarget: state.tradeCountTarget || 0,
          tradeCountEnabled: state.tradeCountEnabled || false,
        };
        localStorage.removeItem('charEdge-goals');
      }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) { /* ignore */ }

    set({
      xp: saved.xp || 0,
      xpLog: Array.isArray(saved.xpLog) ? saved.xpLog.slice(0, 50) : [],
      checklistCompletions: saved.checklistCompletions || 0,
      goalsHit: saved.goalsHit || 0,
      streaks: saved.streaks || {
        trading:    { current: 0, best: 0, lastDate: null },
        journaling: { current: 0, best: 0, lastDate: null },
        profitable: { current: 0, best: 0, lastDate: null },
      },
      achievements: saved.achievements || {},
      dailyChallenge: saved.dailyChallenge || null,
      weeklyChallenge: saved.weeklyChallenge || null,
      equippedCosmetic: saved.equippedCosmetic || 'default',
      completedMilestones: saved.completedMilestones || {},
      activeQuests: saved.activeQuests || {},
      completedQuests: saved.completedQuests || {},
      enabled: saved.enabled !== false,
      notificationPrefs: saved.notificationPrefs || { levelUp: true, achievements: true },
      _pendingLevelUp: null,
      _pendingAchievements: [],
      _pendingMilestone: null,
      // Tournament data (from migration or saved)
      tournaments: saved.tournaments || tournamentData.tournaments || MOCK_TOURNAMENTS,
      myEntries: saved.myEntries || tournamentData.myEntries || [],
      // Goal data (from migration or saved)
      goals: saved.goals || goalData.goals || GOAL_DEFAULTS.goals,
      dailyLossLimit: saved.dailyLossLimit ?? goalData.dailyLossLimit ?? 0,
      dailyLossEnabled: saved.dailyLossEnabled ?? goalData.dailyLossEnabled ?? false,
      winRateTarget: saved.winRateTarget ?? goalData.winRateTarget ?? 0,
      winRateEnabled: saved.winRateEnabled ?? goalData.winRateEnabled ?? false,
      tradeCountTarget: saved.tradeCountTarget ?? goalData.tradeCountTarget ?? 0,
      tradeCountEnabled: saved.tradeCountEnabled ?? goalData.tradeCountEnabled ?? false,
    });
  },

  toJSON: () => {
    const s = get();
    return {
      xp: s.xp,
      xpLog: s.xpLog,
      checklistCompletions: s.checklistCompletions,
      goalsHit: s.goalsHit,
      streaks: s.streaks,
      achievements: s.achievements,
      dailyChallenge: s.dailyChallenge,
      weeklyChallenge: s.weeklyChallenge,
      equippedCosmetic: s.equippedCosmetic,
      completedMilestones: s.completedMilestones,
      activeQuests: s.activeQuests,
      completedQuests: s.completedQuests,
      enabled: s.enabled,
      notificationPrefs: s.notificationPrefs,
      // Tournament data
      tournaments: s.tournaments,
      myEntries: s.myEntries,
      // Goal data
      goals: s.goals,
      dailyLossLimit: s.dailyLossLimit,
      dailyLossEnabled: s.dailyLossEnabled,
      winRateTarget: s.winRateTarget,
      winRateEnabled: s.winRateEnabled,
      tradeCountTarget: s.tradeCountTarget,
      tradeCountEnabled: s.tradeCountEnabled,
    };
  },
});
});

// ─── Exports ────────────────────────────────────────────────────

export {
  useGamificationStore,
  RANKS,
  ACHIEVEMENTS,
  CHALLENGE_POOL,
  WEEKLY_CHALLENGE_POOL,
  COSMETIC_REWARDS,
  MILESTONE_DEFS,
  QUEST_DEFS,
  getRankForXP,
  getXPToNextLevel,
  XP_TABLE,
};
export default useGamificationStore;
