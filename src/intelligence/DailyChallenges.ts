// ═══════════════════════════════════════════════════════════════════
// charEdge — Daily Challenges (Task 4.3.14)
//
// Time-limited daily challenges that reward quality behaviors:
//   - "Log your first trade before market close for bonus XP"
//   - "Complete pre-trade checklist 3x today"
//   - "Review yesterday's losing trade"
//
// Challenge templates rotate daily. Completion integrates with XPEngine.
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export interface ChallengeTemplate {
    id: string;
    title: string;
    description: string;
    xpReward: number;
    /** Condition checker — returns true when challenge is completed */
    category: 'journal' | 'analysis' | 'discipline' | 'review';
    /** Target count (e.g., "3x checklist" → target: 3) */
    target: number;
}

export interface ActiveChallenge {
    templateId: string;
    title: string;
    description: string;
    xpReward: number;
    category: ChallengeTemplate['category'];
    target: number;
    progress: number;
    completed: boolean;
    startedAt: string;
    expiresAt: string;
}

// ─── Challenge Templates ────────────────────────────────────────

export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
    {
        id: 'log-first-trade',
        title: 'Early Logger',
        description: 'Log your first trade before market close',
        xpReward: 25,
        category: 'journal',
        target: 1,
    },
    {
        id: 'checklist-3x',
        title: 'Prepared Trader',
        description: 'Complete your pre-trade checklist 3 times today',
        xpReward: 30,
        category: 'discipline',
        target: 3,
    },
    {
        id: 'review-losing-trade',
        title: 'Learning from Losses',
        description: 'Review and rate a losing trade from yesterday',
        xpReward: 35,
        category: 'review',
        target: 1,
    },
    {
        id: 'full-psych-log',
        title: 'Self-Aware',
        description: 'Log FOMO, impulse, and clarity on 2 trades',
        xpReward: 30,
        category: 'journal',
        target: 2,
    },
    {
        id: 'trigger-identification',
        title: 'Trigger Spotter',
        description: 'Identify and log triggers on a trade',
        xpReward: 25,
        category: 'analysis',
        target: 1,
    },
    {
        id: 'no-rule-breaks',
        title: 'Disciplined Day',
        description: 'Trade all day without breaking any rules',
        xpReward: 40,
        category: 'discipline',
        target: 1,
    },
    {
        id: 'add-notes-5x',
        title: 'Storyteller',
        description: 'Add detailed notes to 5 trades',
        xpReward: 35,
        category: 'journal',
        target: 5,
    },
    {
        id: 'rate-all-trades',
        title: 'Quality Rater',
        description: 'Rate all of today\'s trades (1-5 stars)',
        xpReward: 25,
        category: 'review',
        target: 1,
    },
    {
        id: 'review-report-card',
        title: 'Analyst',
        description: 'Review your weekly behavioral report card',
        xpReward: 20,
        category: 'review',
        target: 1,
    },
    {
        id: 'small-position',
        title: 'Risk Manager',
        description: 'Keep all positions under 2% of equity today',
        xpReward: 30,
        category: 'discipline',
        target: 1,
    },
];

// ─── Engine ─────────────────────────────────────────────────────

/**
 * Select up to `count` challenges for today.
 * Uses day-of-year as seed for deterministic daily rotation.
 */
export function selectDailyChallenges(
    date: Date = new Date(),
    count: number = 3
): ActiveChallenge[] {
    const dayOfYear = Math.floor(
        (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
    );

    // Seeded PRNG (LCG) for deterministic daily rotation
    let seed = dayOfYear * 2654435761; // Knuth multiplicative hash
    const nextRand = () => {
        seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
        return seed;
    };

    // Fisher-Yates shuffle with seeded PRNG
    const indices = CHALLENGE_TEMPLATES.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
        const j = nextRand() % (i + 1);
        [indices[i], indices[j]] = [indices[j]!, indices[i]!];
    }

    const selected = indices.slice(0, count).map(i => CHALLENGE_TEMPLATES[i]!);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return selected.map(template => ({
        templateId: template.id,
        title: template.title,
        description: template.description,
        xpReward: template.xpReward,
        category: template.category,
        target: template.target,
        progress: 0,
        completed: false,
        startedAt: date.toISOString(),
        expiresAt: endOfDay.toISOString(),
    }));
}

/**
 * Update challenge progress. Returns updated challenge + whether it was just completed.
 */
export function updateChallengeProgress(
    challenge: ActiveChallenge,
    incrementBy: number = 1
): { challenge: ActiveChallenge; justCompleted: boolean } {
    if (challenge.completed) {
        return { challenge, justCompleted: false };
    }

    const now = new Date();
    if (now > new Date(challenge.expiresAt)) {
        return { challenge, justCompleted: false };
    }

    const newProgress = Math.min(challenge.progress + incrementBy, challenge.target);
    const justCompleted = newProgress >= challenge.target && !challenge.completed;

    return {
        challenge: {
            ...challenge,
            progress: newProgress,
            completed: newProgress >= challenge.target,
        },
        justCompleted,
    };
}

/**
 * Check if any challenges have expired.
 */
export function pruneExpired(challenges: ActiveChallenge[]): ActiveChallenge[] {
    const now = new Date();
    return challenges.filter(c => new Date(c.expiresAt) > now);
}

function simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return Math.abs(hash);
}

export default { selectDailyChallenges, updateChallengeProgress, pruneExpired };
