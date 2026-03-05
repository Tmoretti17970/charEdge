// 🔒 FROZEN: No new gamification development until post-launch (Wave 10)
// Existing functionality is maintained but not extended.
// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Challenges & Gamification (Sprint 18)
// Achievement system, chart challenges, streaks, and XP tracking.
// ═══════════════════════════════════════════════════════════════════

const GAMIFICATION_KEY = 'charEdge-chart-gamification';

let _savedProgress = null;
try {
  const raw = localStorage.getItem(GAMIFICATION_KEY);
  if (raw) _savedProgress = JSON.parse(raw);
} catch (_) { /* storage/API may be blocked */ }

const ACHIEVEMENTS = [
  { id: 'first_drawing', name: '✏️ First Mark', desc: 'Create your first drawing', xp: 10, condition: (s) => s.totalDrawings >= 1 },
  { id: 'drawing_10', name: '📐 Line Master', desc: 'Create 10 drawings', xp: 25, condition: (s) => s.totalDrawings >= 10 },
  { id: 'drawing_100', name: '🎨 Chart Artist', desc: 'Create 100 drawings', xp: 100, condition: (s) => s.totalDrawings >= 100 },
  { id: 'first_indicator', name: '📊 Data Driven', desc: 'Add your first indicator', xp: 10, condition: (s) => s.totalIndicators >= 1 },
  { id: 'indicator_5', name: '🔬 Analyst', desc: 'Use 5 different indicators', xp: 30, condition: (s) => s.uniqueIndicators >= 5 },
  { id: 'first_journal', name: '📝 Note Taker', desc: 'Create a chart journal entry', xp: 15, condition: (s) => s.totalJournals >= 1 },
  { id: 'streak_3', name: '🔥 On Fire', desc: '3-day charting streak', xp: 30, condition: (s) => s.currentStreak >= 3 },
  { id: 'streak_7', name: '⚡ Unstoppable', desc: '7-day charting streak', xp: 75, condition: (s) => s.currentStreak >= 7 },
  { id: 'streak_30', name: '🏆 Chart Legend', desc: '30-day charting streak', xp: 300, condition: (s) => s.currentStreak >= 30 },
  { id: 'symbols_10', name: '🌐 Market Explorer', desc: 'Analyze 10 different symbols', xp: 40, condition: (s) => s.uniqueSymbols >= 10 },
  { id: 'first_idea', name: '💡 Thought Leader', desc: 'Publish your first chart idea', xp: 20, condition: (s) => s.ideasPublished >= 1 },
  { id: 'first_collab', name: '🤝 Team Player', desc: 'Join a collaboration session', xp: 25, condition: (s) => s.collabSessions >= 1 },
  { id: 'sessions_50', name: '🎯 Dedicated', desc: 'Complete 50 charting sessions', xp: 150, condition: (s) => s.totalSessions >= 50 },
  { id: 'fib_master', name: '🔢 Fibonacci Master', desc: 'Use Fibonacci tools 20 times', xp: 50, condition: (s) => s.fibUsage >= 20 },
  { id: 'all_tools', name: '🧰 Tool Collector', desc: 'Use every drawing tool at least once', xp: 100, condition: (s) => s.uniqueTools >= 15 },
];

const DAILY_CHALLENGES = [
  { id: 'dc_trend', title: 'Trend Hunter', desc: 'Draw 3 trendlines on 3 different symbols', goal: 3, track: 'trendlines_today' },
  { id: 'dc_fib', title: 'Fib Finder', desc: 'Apply Fibonacci to 2 charts', goal: 2, track: 'fibs_today' },
  { id: 'dc_journal', title: 'Chart Journalist', desc: 'Create 2 journal entries from charts', goal: 2, track: 'journals_today' },
  { id: 'dc_analyze', title: 'Market Scanner', desc: 'Analyze 5 different symbols', goal: 5, track: 'symbols_today' },
  { id: 'dc_indicator', title: 'Signal Seeker', desc: 'Add 3 indicators to any chart', goal: 3, track: 'indicators_today' },
];

export function createGamificationState() {
  const defaults = {
    xp: 0,
    level: 1,
    currentStreak: 0,
    bestStreak: 0,
    lastActiveDate: null,
    unlockedAchievements: [],
    totalDrawings: 0,
    totalIndicators: 0,
    totalJournals: 0,
    totalSessions: 0,
    uniqueIndicators: 0,
    uniqueSymbols: 0,
    uniqueTools: 0,
    ideasPublished: 0,
    collabSessions: 0,
    fibUsage: 0,
    dailyChallenge: null,
    dailyChallengeDate: null,
    dailyChallengeProgress: 0,
  };

  return _savedProgress || defaults;
}

export function trackActivity(state, type, detail = {}) {
  const updated = { ...state };

  switch (type) {
    case 'drawing': updated.totalDrawings++; break;
    case 'indicator': updated.totalIndicators++; break;
    case 'journal': updated.totalJournals++; break;
    case 'session': updated.totalSessions++; break;
    case 'idea': updated.ideasPublished++; break;
    case 'collab': updated.collabSessions++; break;
    case 'fib': updated.fibUsage++; break;
  }

  // Update streak
  const today = new Date().toDateString();
  if (updated.lastActiveDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (updated.lastActiveDate === yesterday) {
      updated.currentStreak++;
    } else {
      updated.currentStreak = 1;
    }
    updated.bestStreak = Math.max(updated.bestStreak, updated.currentStreak);
    updated.lastActiveDate = today;
  }

  // Check achievements
  const newUnlocks = [];
  for (const ach of ACHIEVEMENTS) {
    if (updated.unlockedAchievements.includes(ach.id)) continue;
    if (ach.condition(updated)) {
      updated.unlockedAchievements.push(ach.id);
      updated.xp += ach.xp;
      newUnlocks.push(ach);
    }
  }

  // Level calculation (each level requires more XP)
  updated.level = Math.floor(1 + Math.sqrt(updated.xp / 50));

  // Persist
  try { localStorage.setItem(GAMIFICATION_KEY, JSON.stringify(updated)); } catch (_) { /* storage/API may be blocked */ }

  return { state: updated, newUnlocks };
}

export function getDailyChallenge() {
  const today = new Date().toDateString();
  const idx = new Date().getDate() % DAILY_CHALLENGES.length;
  return { ...DAILY_CHALLENGES[idx], date: today };
}

export function getAchievements() { return ACHIEVEMENTS; }
export function getXPForLevel(level) { return level * level * 50; }
export function getProgressToNextLevel(xp, level) {
  const current = getXPForLevel(level - 1);
  const next = getXPForLevel(level);
  return Math.min(1, (xp - current) / (next - current));
}
