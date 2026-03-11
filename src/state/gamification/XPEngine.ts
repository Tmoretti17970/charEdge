// ═══════════════════════════════════════════════════════════════════
// charEdge — XP Engine (Task 4.3.13)
//
// Awards XP for quality trading behaviors:
//   - Pre-trade checklist completion: 10 XP
//   - Post-trade review with notes: 20 XP
//   - Identifying own mistake: 30 XP
//   - Streak bonuses for consecutive journal days
//
// Levels unlock features progressively (4.3.15).
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export interface XPEvent {
    type: 'CHECKLIST' | 'POST_REVIEW' | 'MISTAKE_ID' | 'STREAK_BONUS' | 'DAILY_CHALLENGE';
    xp: number;
    tradeId?: string;
    timestamp: string;
    description: string;
}

export interface XPState {
    totalXP: number;
    level: number;
    xpToNextLevel: number;
    currentStreak: number;
    longestStreak: number;
    events: XPEvent[];
}

// ─── Constants ──────────────────────────────────────────────────

const XP_AWARDS = {
    CHECKLIST: 10,
    POST_REVIEW: 20,
    MISTAKE_ID: 30,
    DAILY_CHALLENGE: 25,
    STREAK_3: 15,
    STREAK_7: 50,
    STREAK_14: 100,
    STREAK_30: 250,
} as const;

const LEVEL_THRESHOLDS = [
    0, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 12000, // L1-L10
    16000, 22000, 30000, 40000, 55000, // L11-L15
];

const STORAGE_KEY = 'charEdge-xp-state';

// ─── Engine ─────────────────────────────────────────────────────

export function createInitialState(): XPState {
    return {
        totalXP: 0,
        level: 1,
        xpToNextLevel: LEVEL_THRESHOLDS[1] ?? 100,
        currentStreak: 0,
        longestStreak: 0,
        events: [],
    };
}

export function awardXP(
    state: XPState,
    type: XPEvent['type'],
    options: { tradeId?: string; description?: string; xpOverride?: number } = {}
): XPState {
    const xp = options.xpOverride ?? (XP_AWARDS[type as keyof typeof XP_AWARDS] ?? 0);
    const event: XPEvent = {
        type,
        xp,
        tradeId: options.tradeId,
        timestamp: new Date().toISOString(),
        description: options.description || `${type}: +${xp} XP`,
    };

    const newTotalXP = state.totalXP + xp;
    const newLevel = computeLevel(newTotalXP);
    const nextThreshold = LEVEL_THRESHOLDS[newLevel] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]!;

    return {
        ...state,
        totalXP: newTotalXP,
        level: newLevel,
        xpToNextLevel: Math.max(0, nextThreshold - newTotalXP),
        events: [...state.events.slice(-99), event], // Keep last 100
    };
}

export function updateStreak(state: XPState, journaledToday: boolean): XPState {
    if (!journaledToday) {
        return { ...state, currentStreak: 0 };
    }

    const newStreak = state.currentStreak + 1;
    let bonusState = {
        ...state,
        currentStreak: newStreak,
        longestStreak: Math.max(state.longestStreak, newStreak),
    };

    // Award streak bonuses at milestones
    if (newStreak === 3) bonusState = awardXP(bonusState, 'STREAK_BONUS', { description: '🔥 3-day streak! +15 XP', xpOverride: XP_AWARDS.STREAK_3 });
    if (newStreak === 7) bonusState = awardXP(bonusState, 'STREAK_BONUS', { description: '🔥🔥 7-day streak! +50 XP', xpOverride: XP_AWARDS.STREAK_7 });
    if (newStreak === 14) bonusState = awardXP(bonusState, 'STREAK_BONUS', { description: '🔥🔥🔥 14-day streak! +100 XP', xpOverride: XP_AWARDS.STREAK_14 });
    if (newStreak === 30) bonusState = awardXP(bonusState, 'STREAK_BONUS', { description: '🏆 30-day streak! +250 XP', xpOverride: XP_AWARDS.STREAK_30 });

    return bonusState;
}

function computeLevel(totalXP: number): number {
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
        if (totalXP >= (LEVEL_THRESHOLDS[i] ?? 0)) return i + 1;
    }
    return 1;
}

// ─── Persistence ────────────────────────────────────────────────

export function saveXPState(state: XPState): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* storage full */ }
}

export function loadXPState(): XPState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : createInitialState();
    } catch {
        return createInitialState();
    }
}

export default { createInitialState, awardXP, updateStreak, saveXPState, loadXPState };
