// ═══════════════════════════════════════════════════════════════════
// charEdge — Challenge Slice
//
// Daily + Weekly challenge pools, evaluation helpers, and store actions.
// Extracted from useGamificationStore for composition.
// ═══════════════════════════════════════════════════════════════════

// ─── Daily Challenge Pool ───────────────────────────────────────

export const CHALLENGE_POOL = [
  { id: 'log_3',       description: 'Log 3 trades today',                  target: 3,  xpReward: 50,  type: 'trade_count' },
  { id: 'notes_all',   description: 'Write notes on every trade today',    target: 1,  xpReward: 60,  type: 'notes_pct' },
  { id: 'checklist_3', description: 'Complete pre-trade checklist 3 times', target: 3,  xpReward: 75,  type: 'checklist_count' },
  { id: 'winrate_60',  description: 'Keep win rate above 60% today',       target: 60, xpReward: 80,  type: 'winrate' },
  { id: 'log_5',       description: 'Log 5 trades today',                  target: 5,  xpReward: 70,  type: 'trade_count' },
  { id: 'risk_check',  description: 'Set stop loss on every trade today',  target: 1,  xpReward: 50,  type: 'stoploss_pct' },
  { id: 'reflect',     description: 'Write 100+ word notes on 2 trades',   target: 2,  xpReward: 65,  type: 'deep_notes' },
  { id: 'green_day',   description: 'End the day in profit',               target: 1,  xpReward: 100, type: 'profitable_day' },
  { id: 'early_bird',  description: 'Log your first trade before 10 AM',   target: 1,  xpReward: 40,  type: 'early_trade' },
  { id: 'diversify',   description: 'Trade 3 different symbols today',     target: 3,  xpReward: 55,  type: 'symbol_count' },
];

// ─── Weekly Challenge Pool ──────────────────────────────────────

export const WEEKLY_CHALLENGE_POOL = [
  { id: 'w_log_20',     description: 'Log 20 trades this week',              target: 20, xpReward: 150, type: 'trade_count' },
  { id: 'w_streak_5',   description: '5-day trading streak',                 target: 5,  xpReward: 200, type: 'streak_days' },
  { id: 'w_winrate_70', description: 'Win 70%+ on 3 different days',         target: 3,  xpReward: 250, type: 'win_days' },
  { id: 'w_journal_5',  description: 'Journal every trade for 5 days',       target: 5,  xpReward: 175, type: 'journal_days' },
  { id: 'w_green_days', description: 'End 4 days in profit',                 target: 4,  xpReward: 225, type: 'green_days' },
  { id: 'w_symbols_5',  description: 'Trade 5 different symbols this week',  target: 5,  xpReward: 125, type: 'unique_symbols' },
];

// ─── Helpers ────────────────────────────────────────────────────

export function getDateKey(dateStr) {
  try {
    return new Date(dateStr).toISOString().slice(0, 10);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_) {
    return null;
  }
}

export function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getWeekKey() {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getWeekStartDate() {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function evaluateChallengeProgress(challenge, trades) {
  if (!challenge || !challenge.id) return 0;
  const todayKey = getTodayKey();
  const todayTrades = (trades || []).filter((t) => getDateKey(t.date) === todayKey);

  switch (challenge.type) {
    case 'trade_count':
      return todayTrades.length;
    case 'notes_pct':
      return todayTrades.length > 0 &&
        todayTrades.every((t) => t.notes && t.notes.trim().length > 0)
        ? 1 : 0;
    case 'checklist_count':
      return challenge._checklistCount || 0; // Tracked externally
    case 'winrate': {
      if (todayTrades.length === 0) return 0;
      const wins = todayTrades.filter((t) => (t.pnl || 0) > 0).length;
      return Math.round((wins / todayTrades.length) * 100);
    }
    case 'stoploss_pct':
      return todayTrades.length > 0 &&
        todayTrades.every((t) => t.stopLoss != null && t.stopLoss !== 0)
        ? 1 : 0;
    case 'deep_notes':
      return todayTrades.filter((t) => t.notes && t.notes.trim().length >= 100).length;
    case 'profitable_day': {
      const pnl = todayTrades.reduce((s, t) => s + (t.pnl || 0), 0);
      return pnl > 0 ? 1 : 0;
    }
    case 'early_trade':
      return todayTrades.some((t) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        try { return new Date(t.date).getHours() < 10; } catch (_) { return false; }
      }) ? 1 : 0;
    case 'symbol_count':
      return new Set(todayTrades.map((t) => t.symbol?.toUpperCase())).size;
    default:
      return 0;
  }
}

function evaluateWeeklyProgress(challenge, trades) {
  if (!challenge || !challenge.id) return 0;
  const weekStart = getWeekStartDate();
  const weekTrades = (trades || []).filter((t) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    try { return new Date(t.date) >= weekStart; } catch (_) { return false; }
  });

  switch (challenge.type) {
    case 'trade_count':
      return weekTrades.length;
    case 'streak_days': {
      const days = new Set(weekTrades.map(t => getDateKey(t.date)).filter(Boolean));
      return days.size;
    }
    case 'win_days': {
      const byDay = {};
      weekTrades.forEach(t => {
        const dk = getDateKey(t.date);
        if (!dk) return;
        if (!byDay[dk]) byDay[dk] = { w: 0, total: 0 };
        byDay[dk].total++;
        if ((t.pnl || 0) > 0) byDay[dk].w++;
      });
      return Object.values(byDay).filter(d => d.total > 0 && (d.w / d.total) >= 0.7).length;
    }
    case 'journal_days': {
      const days = new Set();
      weekTrades.forEach(t => {
        if (t.notes && t.notes.trim().length > 0) {
          const dk = getDateKey(t.date);
          if (dk) days.add(dk);
        }
      });
      return days.size;
    }
    case 'green_days': {
      const byDay = {};
      weekTrades.forEach(t => {
        const dk = getDateKey(t.date);
        if (!dk) return;
        byDay[dk] = (byDay[dk] || 0) + (t.pnl || 0);
      });
      return Object.values(byDay).filter(pnl => pnl > 0).length;
    }
    case 'unique_symbols':
      return new Set(weekTrades.map(t => t.symbol?.toUpperCase()).filter(Boolean)).size;
    default:
      return 0;
  }
}

// ─── Slice ──────────────────────────────────────────────────────

export const createChallengeSlice = (set, get) => ({
  // ─── Daily Challenge ────────────────────────────────────

  generateDailyChallenge: () => {
    const today = getTodayKey();
    const existing = get().dailyChallenge;
    if (existing && existing.dateKey === today && !existing.completed) return; // Already has one today

    // Pick a random challenge (seeded by date for consistency)
    const seed = today.replace(/-/g, '');
    const idx = parseInt(seed, 10) % CHALLENGE_POOL.length;
    const template = CHALLENGE_POOL[idx];

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    set({
      dailyChallenge: {
        ...template,
        dateKey: today,
        progress: 0,
        completed: false,
        completedAt: null,
        expiresAt: endOfDay.getTime(),
        _checklistCount: 0,
      },
    });
  },

  updateChallengeProgress: (trades) => {
    const challenge = get().dailyChallenge;
    if (!challenge || challenge.completed) return;

    const todayKey = getTodayKey();
    if (challenge.dateKey !== todayKey) {
      get().generateDailyChallenge(); // New day, generate fresh
      return;
    }

    const progress = evaluateChallengeProgress(challenge, trades);
    const completed = progress >= challenge.target;

    set({
      dailyChallenge: {
        ...challenge,
        progress,
        completed,
        completedAt: completed && !challenge.completedAt ? Date.now() : challenge.completedAt,
      },
    });

    // Award XP on completion (once)
    if (completed && !challenge.completedAt) {
      get().awardXP(challenge.xpReward, 'challenge_done');
    }
  },

  // ─── Weekly Challenge ───────────────────────────────────

  generateWeeklyChallenge: () => {
    const weekKey = getWeekKey();
    const existing = get().weeklyChallenge;
    if (existing && existing.weekKey === weekKey && !existing.completed) return;

    const seed = weekKey.replace(/\D/g, '');
    const idx = parseInt(seed, 10) % WEEKLY_CHALLENGE_POOL.length;
    const template = WEEKLY_CHALLENGE_POOL[idx];

    set({
      weeklyChallenge: {
        ...template,
        weekKey,
        progress: 0,
        completed: false,
        completedAt: null,
      },
    });
  },

  updateWeeklyChallengeProgress: (trades) => {
    const challenge = get().weeklyChallenge;
    if (!challenge || challenge.completed) return;

    const weekKey = getWeekKey();
    if (challenge.weekKey !== weekKey) {
      get().generateWeeklyChallenge();
      return;
    }

    const progress = evaluateWeeklyProgress(challenge, trades);
    const completed = progress >= challenge.target;

    set({
      weeklyChallenge: {
        ...challenge,
        progress,
        completed,
        completedAt: completed && !challenge.completedAt ? Date.now() : challenge.completedAt,
      },
    });

    if (completed && !challenge.completedAt) {
      get().awardXP(challenge.xpReward, 'weekly_challenge');
    }
  },
});
