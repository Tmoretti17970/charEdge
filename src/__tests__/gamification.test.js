// ═══════════════════════════════════════════════════════════════════
// charEdge — Gamification Tests (Sprint A)
//
// Tests for: XP System, Streaks, Achievements, Daily Challenges,
//            Rank calculations, and Persistence (hydrate/toJSON).
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import {
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
} from '../state/useGamificationStore.js';

// Helper: reset store to clean state
const reset = () =>
  useGamificationStore.setState({
    xp: 0,
    xpLog: [],
    checklistCompletions: 0,
    goalsHit: 0,
    streaks: {
      trading: { current: 0, best: 0, lastDate: null },
      journaling: { current: 0, best: 0, lastDate: null },
      profitable: { current: 0, best: 0, lastDate: null },
    },
    achievements: {},
    dailyChallenge: null,
    weeklyChallenge: null,
    equippedCosmetic: 'default',
    completedMilestones: {},
    activeQuests: {},
    completedQuests: {},
    enabled: true,
    _pendingLevelUp: null,
    _pendingAchievements: [],
    _pendingMilestone: null,
  });

// Helper: create a trade
const mkTrade = (id, pnl = 100, opts = {}) => ({
  id,
  date: opts.date || new Date().toISOString(),
  symbol: opts.symbol || 'BTC',
  side: 'long',
  pnl,
  notes: opts.notes || '',
  stopLoss: opts.stopLoss || null,
  ...opts,
});

// ═══ Rank Calculations ══════════════════════════════════════════

describe('getRankForXP', () => {
  it('returns Apprentice for 0 XP', () => {
    expect(getRankForXP(0).name).toBe('Apprentice');
    expect(getRankForXP(0).level).toBe(1);
  });

  it('returns Journeyman at 500 XP', () => {
    expect(getRankForXP(500).name).toBe('Journeyman');
    expect(getRankForXP(500).level).toBe(2);
  });

  it('returns Strategist at 2000 XP', () => {
    expect(getRankForXP(2000).name).toBe('Strategist');
  });

  it('returns Forge Master at 50000+ XP', () => {
    expect(getRankForXP(50000).name).toBe('Forge Master');
    expect(getRankForXP(999999).name).toBe('Forge Master');
  });

  it('handles boundary values correctly', () => {
    expect(getRankForXP(499).name).toBe('Apprentice');
    expect(getRankForXP(500).name).toBe('Journeyman');
    expect(getRankForXP(1999).name).toBe('Journeyman');
    expect(getRankForXP(2000).name).toBe('Strategist');
  });
});

describe('getXPToNextLevel', () => {
  it('shows progress at 250 XP', () => {
    const result = getXPToNextLevel(250);
    expect(result.needed).toBe(250);
    expect(result.progress).toBe(0.5);
    expect(result.nextRank.name).toBe('Journeyman');
  });

  it('returns full progress at max level', () => {
    const result = getXPToNextLevel(50000);
    expect(result.progress).toBe(1);
    expect(result.nextRank).toBeNull();
  });
});

// ═══ XP System ══════════════════════════════════════════════════

describe('XP System', () => {
  beforeEach(reset);

  it('awardXP increments XP correctly', () => {
    useGamificationStore.getState().awardXP(10, 'trade_logged');
    expect(useGamificationStore.getState().xp).toBe(10);
  });

  it('awardXP adds to log', () => {
    useGamificationStore.getState().awardXP(10, 'trade_logged');
    const log = useGamificationStore.getState().xpLog;
    expect(log.length).toBe(1);
    expect(log[0].source).toBe('trade_logged');
    expect(log[0].amount).toBe(10);
  });

  it('awardXP accumulates', () => {
    useGamificationStore.getState().awardXP(10, 'trade_logged');
    useGamificationStore.getState().awardXP(15, 'notes_written');
    useGamificationStore.getState().awardXP(20, 'checklist_done');
    expect(useGamificationStore.getState().xp).toBe(45);
    expect(useGamificationStore.getState().xpLog.length).toBe(3);
  });

  it('awardXP ignores zero or negative amounts', () => {
    useGamificationStore.getState().awardXP(0, 'test');
    useGamificationStore.getState().awardXP(-10, 'test');
    expect(useGamificationStore.getState().xp).toBe(0);
  });

  it('awardXP respects enabled flag', () => {
    useGamificationStore.setState({ enabled: false });
    useGamificationStore.getState().awardXP(999, 'test');
    expect(useGamificationStore.getState().xp).toBe(0);
  });

  it('detects level-up', () => {
    useGamificationStore.getState().awardXP(500, 'test');
    const pending = useGamificationStore.getState()._pendingLevelUp;
    expect(pending).not.toBeNull();
    expect(pending.oldRank.name).toBe('Apprentice');
    expect(pending.newRank.name).toBe('Journeyman');
  });

  it('does not trigger level-up within same rank', () => {
    useGamificationStore.getState().awardXP(100, 'test');
    expect(useGamificationStore.getState()._pendingLevelUp).toBeNull();
  });

  it('getLevel returns current rank', () => {
    useGamificationStore.setState({ xp: 2500 });
    const level = useGamificationStore.getState().getLevel();
    expect(level.name).toBe('Strategist');
    expect(level.level).toBe(3);
  });

  it('caps log at 50 entries', () => {
    for (let i = 0; i < 60; i++) {
      useGamificationStore.getState().awardXP(1, `test_${i}`);
    }
    expect(useGamificationStore.getState().xpLog.length).toBe(50);
  });
});

// ═══ Streaks ════════════════════════════════════════════════════

describe('Streaks', () => {
  beforeEach(reset);

  it('updateStreaks counts today trading streak', () => {
    const trades = [mkTrade('t1', 100)];
    useGamificationStore.getState().updateStreaks(trades);
    expect(useGamificationStore.getState().streaks.trading.current).toBe(1);
  });

  it('updateStreaks skips empty trades', () => {
    useGamificationStore.getState().updateStreaks([]);
    expect(useGamificationStore.getState().streaks.trading.current).toBe(0);
  });

  it('updateStreaks tracks journaling streak when notes present', () => {
    const trades = [mkTrade('t1', 100, { notes: 'This is a detailed note' })];
    useGamificationStore.getState().updateStreaks(trades);
    expect(useGamificationStore.getState().streaks.journaling.current).toBe(1);
  });

  it('updateStreaks does not track journaling streak without notes', () => {
    const trades = [mkTrade('t1', 100, { notes: '' })];
    useGamificationStore.getState().updateStreaks(trades);
    expect(useGamificationStore.getState().streaks.journaling.current).toBe(0);
  });

  it('updateStreaks tracks profitable day streak', () => {
    const trades = [mkTrade('t1', 100), mkTrade('t2', 50)];
    useGamificationStore.getState().updateStreaks(trades);
    expect(useGamificationStore.getState().streaks.profitable.current).toBe(1);
  });

  it('updateStreaks does not track profitable streak on losing day', () => {
    const trades = [mkTrade('t1', -100)];
    useGamificationStore.getState().updateStreaks(trades);
    expect(useGamificationStore.getState().streaks.profitable.current).toBe(0);
  });

  it('updateStreaks updates best streak', () => {
    const trades = [mkTrade('t1', 100)];
    useGamificationStore.getState().updateStreaks(trades);
    expect(useGamificationStore.getState().streaks.trading.best).toBe(1);
  });

  it('updateStreaks respects enabled flag', () => {
    useGamificationStore.setState({ enabled: false });
    useGamificationStore.getState().updateStreaks([mkTrade('t1')]);
    expect(useGamificationStore.getState().streaks.trading.current).toBe(0);
  });
});

// ═══ Achievements ═══════════════════════════════════════════════

describe('Achievements', () => {
  beforeEach(reset);

  it('unlocks first_blood on first trade', () => {
    const trades = [mkTrade('t1')];
    useGamificationStore.getState().evaluateAchievements(trades);
    expect(useGamificationStore.getState().achievements.first_blood).toBeDefined();
    expect(useGamificationStore.getState().achievements.first_blood.unlockedAt).toBeGreaterThan(0);
  });

  it('does not re-unlock existing achievements', () => {
    useGamificationStore.setState({
      achievements: { first_blood: { unlockedAt: 12345, seen: true } },
    });
    const trades = [mkTrade('t1')];
    useGamificationStore.getState().evaluateAchievements(trades);
    expect(useGamificationStore.getState().achievements.first_blood.unlockedAt).toBe(12345);
  });

  it('queues pending achievements for toasts', () => {
    const trades = [mkTrade('t1')];
    useGamificationStore.getState().evaluateAchievements(trades);
    const pending = useGamificationStore.getState()._pendingAchievements;
    expect(pending.length).toBeGreaterThan(0);
    expect(pending[0].id).toBe('first_blood');
  });

  it('consumePendingAchievements clears queue', () => {
    const trades = [mkTrade('t1')];
    useGamificationStore.getState().evaluateAchievements(trades);
    const consumed = useGamificationStore.getState().consumePendingAchievements();
    expect(consumed.length).toBeGreaterThan(0);
    expect(useGamificationStore.getState()._pendingAchievements.length).toBe(0);
  });

  it('unlocks brick_by_brick at 100 trades', () => {
    const trades = Array.from({ length: 100 }, (_, i) => mkTrade(`t${i}`));
    useGamificationStore.getState().evaluateAchievements(trades);
    expect(useGamificationStore.getState().achievements.brick_by_brick).toBeDefined();
  });

  it('unlocks centurion at 1000 XP', () => {
    useGamificationStore.setState({ xp: 1000 });
    useGamificationStore.getState().evaluateAchievements([]);
    expect(useGamificationStore.getState().achievements.centurion).toBeDefined();
  });

  it('unlocks forge_master at 50000 XP', () => {
    useGamificationStore.setState({ xp: 50000 });
    useGamificationStore.getState().evaluateAchievements([]);
    expect(useGamificationStore.getState().achievements.forge_master).toBeDefined();
  });

  it('markAchievementSeen updates seen flag', () => {
    useGamificationStore.setState({
      achievements: { first_blood: { unlockedAt: 12345, seen: false } },
    });
    useGamificationStore.getState().markAchievementSeen('first_blood');
    expect(useGamificationStore.getState().achievements.first_blood.seen).toBe(true);
  });

  it('all ACHIEVEMENTS have required fields', () => {
    for (const ach of ACHIEVEMENTS) {
      expect(ach.id).toBeDefined();
      expect(ach.name).toBeDefined();
      expect(ach.emoji).toBeDefined();
      expect(ach.rarity).toBeDefined();
      expect(typeof ach.check).toBe('function');
    }
  });

  it('charolettes_light does not unlock by default', () => {
    useGamificationStore.getState().evaluateAchievements([]);
    expect(useGamificationStore.getState().achievements.charolettes_light).toBeUndefined();
  });

  it('charolettes_light unlocks when flag is set', () => {
    useGamificationStore.setState({ charolettesLightUnlocked: true });
    useGamificationStore.getState().evaluateAchievements([]);
    expect(useGamificationStore.getState().achievements.charolettes_light).toBeDefined();
    expect(useGamificationStore.getState().achievements.charolettes_light.unlockedAt).toBeGreaterThan(0);
  });
});

// ═══ Daily Challenge ════════════════════════════════════════════

describe('Daily Challenge', () => {
  beforeEach(reset);

  it('generateDailyChallenge creates a challenge', () => {
    useGamificationStore.getState().generateDailyChallenge();
    const challenge = useGamificationStore.getState().dailyChallenge;
    expect(challenge).not.toBeNull();
    expect(challenge.description).toBeDefined();
    expect(challenge.target).toBeGreaterThan(0);
    expect(challenge.xpReward).toBeGreaterThan(0);
  });

  it('generateDailyChallenge does not overwrite existing active challenge', () => {
    useGamificationStore.getState().generateDailyChallenge();
    const first = useGamificationStore.getState().dailyChallenge;
    useGamificationStore.getState().generateDailyChallenge();
    const second = useGamificationStore.getState().dailyChallenge;
    expect(first.id).toBe(second.id);
  });

  it('updateChallengeProgress tracks trade count', () => {
    // Manually set a trade_count challenge
    const todayKey = new Date().toISOString().slice(0, 10);
    useGamificationStore.setState({
      dailyChallenge: {
        id: 'log_3',
        description: 'Log 3 trades today',
        target: 3,
        xpReward: 50,
        type: 'trade_count',
        dateKey: todayKey,
        progress: 0,
        completed: false,
        completedAt: null,
        expiresAt: Date.now() + 86400000,
        _checklistCount: 0,
      },
    });

    const trades = [mkTrade('t1'), mkTrade('t2')];
    useGamificationStore.getState().updateChallengeProgress(trades);
    expect(useGamificationStore.getState().dailyChallenge.progress).toBe(2);
    expect(useGamificationStore.getState().dailyChallenge.completed).toBe(false);
  });

  it('CHALLENGE_POOL has valid entries', () => {
    for (const ch of CHALLENGE_POOL) {
      expect(ch.id).toBeDefined();
      expect(ch.description).toBeDefined();
      expect(ch.target).toBeGreaterThan(0);
      expect(ch.xpReward).toBeGreaterThan(0);
      expect(ch.type).toBeDefined();
    }
  });
});

// ═══ Persistence ════════════════════════════════════════════════

describe('Persistence', () => {
  beforeEach(reset);

  it('toJSON produces serializable data', () => {
    useGamificationStore.getState().awardXP(100, 'test');
    const json = useGamificationStore.getState().toJSON();
    expect(json.xp).toBe(100);
    expect(json.xpLog.length).toBe(1);
    expect(typeof json.streaks).toBe('object');
    expect(typeof json.achievements).toBe('object');
    // Should NOT contain transient state
    expect(json._pendingLevelUp).toBeUndefined();
    expect(json._pendingAchievements).toBeUndefined();
  });

  it('hydrate restores from saved data', () => {
    const saved = {
      xp: 5000,
      xpLog: [{ source: 'old', amount: 5000, ts: 1 }],
      checklistCompletions: 10,
      goalsHit: 3,
      streaks: {
        trading: { current: 5, best: 10, lastDate: '2025-01-01' },
        journaling: { current: 0, best: 3, lastDate: null },
        profitable: { current: 2, best: 7, lastDate: '2025-01-01' },
      },
      achievements: { first_blood: { unlockedAt: 1234, seen: true } },
      dailyChallenge: null,
      enabled: true,
    };

    useGamificationStore.getState().hydrate(saved);
    const state = useGamificationStore.getState();
    expect(state.xp).toBe(5000);
    expect(state.checklistCompletions).toBe(10);
    expect(state.streaks.trading.best).toBe(10);
    expect(state.achievements.first_blood.seen).toBe(true);
    // Transient state should be cleared
    expect(state._pendingLevelUp).toBeNull();
    expect(state._pendingAchievements).toEqual([]);
  });

  it('hydrate handles empty/null gracefully', () => {
    useGamificationStore.getState().hydrate(null);
    expect(useGamificationStore.getState().xp).toBe(0);
    useGamificationStore.getState().hydrate({});
    expect(useGamificationStore.getState().xp).toBe(0);
  });

  it('round-trip: toJSON → hydrate preserves state', () => {
    useGamificationStore.getState().awardXP(250, 'test');
    useGamificationStore.setState({ checklistCompletions: 5, goalsHit: 1 });
    const json = useGamificationStore.getState().toJSON();

    reset();
    useGamificationStore.getState().hydrate(json);

    expect(useGamificationStore.getState().xp).toBe(250);
    expect(useGamificationStore.getState().checklistCompletions).toBe(5);
    expect(useGamificationStore.getState().goalsHit).toBe(1);
  });
});

// ═══ Constants ══════════════════════════════════════════════════

describe('Constants', () => {
  it('RANKS are ordered by minXP', () => {
    for (let i = 1; i < RANKS.length; i++) {
      expect(RANKS[i].minXP).toBeGreaterThan(RANKS[i - 1].minXP);
    }
  });

  it('RANKS have all required fields', () => {
    for (const rank of RANKS) {
      expect(rank.level).toBeGreaterThan(0);
      expect(rank.name).toBeDefined();
      expect(rank.emoji).toBeDefined();
      expect(rank.minXP).toBeGreaterThanOrEqual(0);
      expect(rank.color).toBeDefined();
    }
  });

  it('XP_TABLE has positive values for standard actions', () => {
    expect(XP_TABLE.trade_logged).toBeGreaterThan(0);
    expect(XP_TABLE.notes_written).toBeGreaterThan(0);
    expect(XP_TABLE.checklist_done).toBeGreaterThan(0);
  });
});

// ═══ Toggle ═════════════════════════════════════════════════════

describe('Enable/Disable', () => {
  beforeEach(reset);

  it('toggleEnabled flips enabled state', () => {
    expect(useGamificationStore.getState().enabled).toBe(true);
    useGamificationStore.getState().toggleEnabled();
    expect(useGamificationStore.getState().enabled).toBe(false);
    useGamificationStore.getState().toggleEnabled();
    expect(useGamificationStore.getState().enabled).toBe(true);
  });
});

// ═══ Reset Progress ═════════════════════════════════════════════

describe('Reset Progress', () => {
  beforeEach(reset);

  it('resetProgress clears all progression data', () => {
    // Build up some state first
    useGamificationStore.getState().awardXP(500, 'test');
    useGamificationStore.getState().evaluateAchievements([mkTrade('t1')]);
    useGamificationStore.getState().updateStreaks([mkTrade('t1')]);

    expect(useGamificationStore.getState().xp).toBeGreaterThan(0);

    // Reset
    useGamificationStore.getState().resetProgress();

    const s = useGamificationStore.getState();
    expect(s.xp).toBe(0);
    expect(s.xpLog).toEqual([]);
    expect(s.checklistCompletions).toBe(0);
    expect(s.goalsHit).toBe(0);
    expect(s.streaks.trading.current).toBe(0);
    expect(s.streaks.trading.best).toBe(0);
    expect(s.streaks.journaling.current).toBe(0);
    expect(s.streaks.profitable.current).toBe(0);
    expect(Object.keys(s.achievements)).toHaveLength(0);
    expect(s.dailyChallenge).toBeNull();
  });

  it('resetProgress preserves enabled state', () => {
    useGamificationStore.getState().awardXP(100, 'test');
    useGamificationStore.getState().resetProgress();
    // enabled should remain true (it's not reset)
    expect(useGamificationStore.getState().enabled).toBe(true);
  });
});

// ═══ Notification Preferences ═══════════════════════════════════

describe('Notification Preferences', () => {
  beforeEach(reset);

  it('default notificationPrefs are both true', () => {
    const prefs = useGamificationStore.getState().notificationPrefs;
    expect(prefs.levelUp).toBe(true);
    expect(prefs.achievements).toBe(true);
  });

  it('setNotificationPref toggles individual preferences', () => {
    useGamificationStore.getState().setNotificationPref('levelUp', false);
    expect(useGamificationStore.getState().notificationPrefs.levelUp).toBe(false);
    expect(useGamificationStore.getState().notificationPrefs.achievements).toBe(true);
  });

  it('setNotificationPref can re-enable preferences', () => {
    useGamificationStore.getState().setNotificationPref('achievements', false);
    expect(useGamificationStore.getState().notificationPrefs.achievements).toBe(false);
    useGamificationStore.getState().setNotificationPref('achievements', true);
    expect(useGamificationStore.getState().notificationPrefs.achievements).toBe(true);
  });

  it('notificationPrefs persist through hydrate/toJSON', () => {
    useGamificationStore.getState().setNotificationPref('levelUp', false);
    const json = useGamificationStore.getState().toJSON();
    expect(json.notificationPrefs.levelUp).toBe(false);

    reset();
    useGamificationStore.getState().hydrate(json);
    expect(useGamificationStore.getState().notificationPrefs.levelUp).toBe(false);
    expect(useGamificationStore.getState().notificationPrefs.achievements).toBe(true);
  });

  it('hydrate defaults notificationPrefs when missing', () => {
    useGamificationStore.getState().hydrate({ xp: 100 });
    const prefs = useGamificationStore.getState().notificationPrefs;
    expect(prefs.levelUp).toBe(true);
    expect(prefs.achievements).toBe(true);
  });
});

// ═══ Sprint C: Cosmetic Rewards ═════════════════════════════════

describe('Cosmetic Rewards', () => {
  beforeEach(reset);

  it('COSMETIC_REWARDS catalog has entries with valid structure', () => {
    expect(COSMETIC_REWARDS.length).toBeGreaterThanOrEqual(3);
    for (const c of COSMETIC_REWARDS) {
      expect(c.id).toBeDefined();
      expect(c.name).toBeDefined();
      expect(c.colors.primary).toBeDefined();
      expect(c.colors.accent).toBeDefined();
      expect(typeof c.unlockXP).toBe('number');
    }
  });

  it('getUnlockedCosmetics returns only unlocked themes', () => {
    useGamificationStore.setState({ xp: 0 });
    const unlocked0 = useGamificationStore.getState().getUnlockedCosmetics();
    expect(unlocked0.length).toBe(1); // Only default at 0 XP

    useGamificationStore.setState({ xp: 2000 });
    const unlocked2k = useGamificationStore.getState().getUnlockedCosmetics();
    expect(unlocked2k.length).toBeGreaterThanOrEqual(3); // default + ocean + amethyst
  });

  it('equipCosmetic changes equippedCosmetic only if unlocked', () => {
    useGamificationStore.setState({ xp: 500 });
    useGamificationStore.getState().equipCosmetic('ocean');
    expect(useGamificationStore.getState().equippedCosmetic).toBe('ocean');

    // Should NOT equip a theme requiring more XP
    useGamificationStore.getState().equipCosmetic('aurora');
    expect(useGamificationStore.getState().equippedCosmetic).toBe('ocean'); // Still ocean
  });

  it('getEquippedColors returns the correct color pair', () => {
    useGamificationStore.setState({ xp: 500, equippedCosmetic: 'ocean' });
    const colors = useGamificationStore.getState().getEquippedColors();
    expect(colors.primary).toBe('#007AFF');
    expect(colors.accent).toBe('#5AC8FA');
  });
});

// ═══ Sprint C: Milestones ═══════════════════════════════════════

describe('Milestones', () => {
  beforeEach(reset);

  it('MILESTONE_DEFS has valid entries', () => {
    expect(MILESTONE_DEFS.length).toBeGreaterThanOrEqual(3);
    for (const ms of MILESTONE_DEFS) {
      expect(ms.id).toBeDefined();
      expect(ms.title).toBeDefined();
      expect(typeof ms.check).toBe('function');
    }
  });

  it('evaluateMilestones sets _pendingMilestone when triggered', () => {
    useGamificationStore.setState({ xp: 1000 });
    const trades = Array.from({ length: 100 }, (_, i) => mkTrade(i));
    useGamificationStore.getState().evaluateMilestones(trades);

    const pending = useGamificationStore.getState()._pendingMilestone;
    expect(pending).not.toBeNull();
    expect(pending.title).toBeDefined();
  });

  it('clearPendingMilestone resets pending state', () => {
    useGamificationStore.setState({ _pendingMilestone: { id: 'test', title: 'Test', emoji: '🎉' } });
    useGamificationStore.getState().clearPendingMilestone();
    expect(useGamificationStore.getState()._pendingMilestone).toBeNull();
  });
});

// ═══ Sprint D: Weekly Challenges ════════════════════════════════

describe('Weekly Challenges', () => {
  beforeEach(reset);

  it('WEEKLY_CHALLENGE_POOL has valid entries', () => {
    expect(WEEKLY_CHALLENGE_POOL.length).toBeGreaterThanOrEqual(3);
    for (const c of WEEKLY_CHALLENGE_POOL) {
      expect(c.id).toBeDefined();
      expect(c.xpReward).toBeGreaterThan(0);
      expect(c.target).toBeGreaterThan(0);
    }
  });

  it('generateWeeklyChallenge creates a weekly challenge', () => {
    expect(useGamificationStore.getState().weeklyChallenge).toBeNull();
    useGamificationStore.getState().generateWeeklyChallenge();
    const wc = useGamificationStore.getState().weeklyChallenge;
    expect(wc).not.toBeNull();
    expect(wc.description).toBeDefined();
    expect(wc.completed).toBe(false);
  });

  it('weekly challenge XP reward is higher than daily', () => {
    const minWeekly = Math.min(...WEEKLY_CHALLENGE_POOL.map(c => c.xpReward));
    const maxDaily = Math.max(...CHALLENGE_POOL.map(c => c.xpReward));
    expect(minWeekly).toBeGreaterThanOrEqual(maxDaily); // Weeklies pay more
  });
});

// ═══ Sprint D: Trading Quests ═══════════════════════════════════

describe('Trading Quests', () => {
  beforeEach(reset);

  it('QUEST_DEFS has valid multi-step quests', () => {
    expect(QUEST_DEFS.length).toBeGreaterThanOrEqual(3);
    for (const q of QUEST_DEFS) {
      expect(q.id).toBeDefined();
      expect(q.steps.length).toBeGreaterThanOrEqual(2);
      expect(q.xpReward).toBeGreaterThan(0);
      expect(typeof q.evaluate).toBe('function');
    }
  });

  it('startQuest adds an active quest', () => {
    useGamificationStore.getState().startQuest('risk_manager');
    const aq = useGamificationStore.getState().activeQuests;
    expect(aq.risk_manager).toBeDefined();
    expect(aq.risk_manager.step).toBe(0);
    expect(aq.risk_manager.progress).toBe(0);
  });

  it('startQuest prevents duplicates', () => {
    useGamificationStore.getState().startQuest('risk_manager');
    useGamificationStore.getState().startQuest('risk_manager');
    expect(Object.keys(useGamificationStore.getState().activeQuests).length).toBe(1);
  });

  it('evaluateQuestProgress updates quest progress', () => {
    useGamificationStore.getState().startQuest('volume_trader');
    const trades = Array.from({ length: 15 }, (_, i) => mkTrade(i));
    useGamificationStore.getState().evaluateQuestProgress(trades);

    const aq = useGamificationStore.getState().activeQuests;
    expect(aq.volume_trader.progress).toBe(15);
  });
});

// ═══ Sprint C+D: Persistence ════════════════════════════════════

describe('Sprint C+D Persistence', () => {
  beforeEach(reset);

  it('toJSON includes all new Sprint C+D fields', () => {
    useGamificationStore.setState({
      equippedCosmetic: 'ocean',
      completedMilestones: { xp_1000: Date.now() },
      activeQuests: { risk_manager: { step: 1, progress: 3, startedAt: Date.now() } },
    });

    const json = useGamificationStore.getState().toJSON();
    expect(json.equippedCosmetic).toBe('ocean');
    expect(json.completedMilestones.xp_1000).toBeDefined();
    expect(json.activeQuests.risk_manager).toBeDefined();
    expect(json.weeklyChallenge).toBeDefined(); // null is fine
  });

  it('hydrate restores Sprint C+D state', () => {
    const saved = {
      xp: 2000,
      equippedCosmetic: 'amethyst',
      completedMilestones: { xp_1000: 123 },
      activeQuests: { risk_manager: { step: 0, progress: 1, startedAt: 100 } },
      completedQuests: { volume_trader: 456 },
      weeklyChallenge: { id: 'w_log_20', weekKey: '2026-W08', progress: 5, completed: false },
    };
    useGamificationStore.getState().hydrate(saved);

    const s = useGamificationStore.getState();
    expect(s.equippedCosmetic).toBe('amethyst');
    expect(s.completedMilestones.xp_1000).toBe(123);
    expect(s.activeQuests.risk_manager.progress).toBe(1);
    expect(s.completedQuests.volume_trader).toBe(456);
    expect(s.weeklyChallenge.id).toBe('w_log_20');
  });
});
