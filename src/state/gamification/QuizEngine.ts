// ═══════════════════════════════════════════════════════════════════
// charEdge — Spaced Repetition Quiz Engine (Task 4.3.12)
//
// SM-2 based spaced repetition system for trading education:
//   - Risk management concepts
//   - Position sizing rules
//   - Psychology concepts (FOMO, revenge trading, etc.)
//
// Quiz reviews are scheduled using the SM-2 algorithm to optimize
// long-term retention. Integrates with XPEngine for rewards.
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export interface QuizCard {
    id: string;
    category: 'risk' | 'position-sizing' | 'psychology' | 'discipline';
    question: string;
    answer: string;
    /** SM-2 parameters */
    easeFactor: number; // starts at 2.5
    interval: number;   // days until next review
    repetitions: number;
    nextReviewDate: string;
}

export type AnswerQuality = 0 | 1 | 2 | 3 | 4 | 5;
// 0 = complete blackout, 5 = instant perfect recall

// ─── Default Card Deck ──────────────────────────────────────────

export const DEFAULT_CARDS: Omit<QuizCard, 'easeFactor' | 'interval' | 'repetitions' | 'nextReviewDate'>[] = [
    {
        id: 'risk-001',
        category: 'risk',
        question: 'What is the 1% rule in risk management?',
        answer: 'Never risk more than 1% of your total account equity on a single trade. If your account is $10,000, max risk per trade is $100.',
    },
    {
        id: 'risk-002',
        category: 'risk',
        question: 'What happens when you risk 5% per trade and lose 5 in a row?',
        answer: 'You lose ~22.6% of your account (compounding). At 1% risk, 5 consecutive losses only costs ~4.9%.',
    },
    {
        id: 'risk-003',
        category: 'risk',
        question: 'Why should you use a hard stop-loss instead of a mental stop?',
        answer: 'Mental stops are broken under stress (anchoring bias). Hard stops execute automatically, removing emotion from the exit decision.',
    },
    {
        id: 'psych-001',
        category: 'psychology',
        question: 'What is revenge trading and how do you prevent it?',
        answer: 'Trading immediately after a loss to "get back" money. Prevention: mandatory cooling-off period (15-30 min), max consecutive loss limit, step away from screen.',
    },
    {
        id: 'psych-002',
        category: 'psychology',
        question: 'What is the disposition effect?',
        answer: 'Tendency to sell winners too early (locking in gains) and hold losers too long (hoping for recovery). Solution: use mechanical targets and stops.',
    },
    {
        id: 'psych-003',
        category: 'psychology',
        question: 'What triggers FOMO entries?',
        answer: 'Seeing a large move without being positioned. Leads to chasing extended moves with poor risk/reward. Solution: have predefined setups and wait for them.',
    },
    {
        id: 'sizing-001',
        category: 'position-sizing',
        question: 'How do you calculate position size from a stop-loss level?',
        answer: 'Position Size = Risk Amount / (Entry Price - Stop Price). If risking $100 with entry at $50 and stop at $48, size = 100/2 = 50 shares.',
    },
    {
        id: 'sizing-002',
        category: 'position-sizing',
        question: 'What is R-multiple and how is it used?',
        answer: 'R = Initial Risk. If you risk $100 and make $300, the trade is 3R. Track R-multiples to evaluate strategy quality independent of position size.',
    },
    {
        id: 'disc-001',
        category: 'discipline',
        question: 'Why should you journal EVERY trade, not just losses?',
        answer: 'Winning trades can have bad process (lucky). Without logging, you can\'t distinguish skill from luck, and you reinforce bad habits that happened to work.',
    },
    {
        id: 'disc-002',
        category: 'discipline',
        question: 'What is the purpose of a pre-trade checklist?',
        answer: 'Forces deliberate decision-making, prevents impulse entries, ensures all criteria are met before risking capital. Reduces unforced errors by 30-50%.',
    },
];

// ─── SM-2 Algorithm ─────────────────────────────────────────────

export function processAnswer(
    card: QuizCard,
    quality: AnswerQuality
): QuizCard {
    let { easeFactor, interval, repetitions } = card;

    if (quality < 3) {
        // Failed: reset to beginning
        repetitions = 0;
        interval = 1;
    } else {
        // Passed: advance
        if (repetitions === 0) {
            interval = 1;
        } else if (repetitions === 1) {
            interval = 6;
        } else {
            interval = Math.round(interval * easeFactor);
        }
        repetitions++;
    }

    // Update ease factor
    easeFactor = Math.max(
        1.3,
        easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    );

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);

    return {
        ...card,
        easeFactor,
        interval,
        repetitions,
        nextReviewDate: nextReview.toISOString(),
    };
}

/**
 * Initialize a fresh card set from defaults.
 */
export function initializeCards(): QuizCard[] {
    const now = new Date().toISOString();
    return DEFAULT_CARDS.map(c => ({
        ...c,
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
        nextReviewDate: now,
    }));
}

/**
 * Get cards due for review today.
 */
export function getDueCards(cards: QuizCard[], now: Date = new Date()): QuizCard[] {
    return cards.filter(c => new Date(c.nextReviewDate) <= now);
}

// ─── Persistence ────────────────────────────────────────────────

const STORAGE_KEY = 'charEdge-quiz-cards';

export function saveCards(cards: QuizCard[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
    } catch { /* storage full */ }
}

export function loadCards(): QuizCard[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : initializeCards();
    } catch {
        return initializeCards();
    }
}

export default { processAnswer, initializeCards, getDueCards, saveCards, loadCards };
