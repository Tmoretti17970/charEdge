// ═══════════════════════════════════════════════════════════════════
// charEdge — Batch 8B: Daily Challenges & Quiz Engine Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { selectDailyChallenges, updateChallengeProgress } from '../../intelligence/DailyChallenges';
import { processAnswer, initializeCards, getDueCards, type QuizCard } from '../../intelligence/QuizEngine';

describe('DailyChallenges', () => {
    it('selects 3 challenges by default', () => {
        const challenges = selectDailyChallenges();
        expect(challenges.length).toBe(3);
        challenges.forEach(c => {
            expect(c.completed).toBe(false);
            expect(c.progress).toBe(0);
        });
    });

    it('returns deterministic challenges for same day', () => {
        const date = new Date('2026-03-06');
        const a = selectDailyChallenges(date);
        const b = selectDailyChallenges(date);
        expect(a.map(c => c.templateId)).toEqual(b.map(c => c.templateId));
    });

    it('returns different challenges across a week', () => {
        const sets = [];
        for (let d = 1; d <= 7; d++) {
            const date = new Date(`2026-03-0${d}`);
            sets.push(selectDailyChallenges(date).map(c => c.templateId).sort().join());
        }
        // Over 7 days, we should see at least 2 distinct challenge sets
        const unique = new Set(sets);
        expect(unique.size).toBeGreaterThanOrEqual(2);
    });

    it('updates challenge progress', () => {
        const challenges = selectDailyChallenges();
        const { challenge, justCompleted } = updateChallengeProgress(challenges[0]);
        expect(challenge.progress).toBe(1);
        // If target is 1, it should be completed
        if (challenges[0].target === 1) {
            expect(justCompleted).toBe(true);
            expect(challenge.completed).toBe(true);
        }
    });

    it('does not exceed target', () => {
        const challenges = selectDailyChallenges();
        let c = challenges[0];
        for (let i = 0; i < c.target + 5; i++) {
            c = updateChallengeProgress(c).challenge;
        }
        expect(c.progress).toBeLessThanOrEqual(c.target);
    });
});

describe('QuizEngine', () => {
    it('initializes cards with SM-2 defaults', () => {
        const cards = initializeCards();
        expect(cards.length).toBeGreaterThan(0);
        cards.forEach(c => {
            expect(c.easeFactor).toBe(2.5);
            expect(c.interval).toBe(0);
            expect(c.repetitions).toBe(0);
        });
    });

    it('all new cards are due immediately', () => {
        const cards = initializeCards();
        const due = getDueCards(cards);
        expect(due.length).toBe(cards.length);
    });

    it('correct answer increases interval and repetitions', () => {
        const card = initializeCards()[0];
        const updated = processAnswer(card, 4);
        expect(updated.interval).toBe(1);
        expect(updated.repetitions).toBe(1);
    });

    it('second correct answer jumps to 6-day interval', () => {
        let card = initializeCards()[0];
        card = processAnswer(card, 4);
        card = processAnswer(card, 4);
        expect(card.interval).toBe(6);
        expect(card.repetitions).toBe(2);
    });

    it('failed answer resets to beginning', () => {
        let card = initializeCards()[0];
        card = processAnswer(card, 5); // Perfect
        card = processAnswer(card, 5); // Perfect
        card = processAnswer(card, 1); // Fail
        expect(card.repetitions).toBe(0);
        expect(card.interval).toBe(1);
    });

    it('ease factor adjusts with quality', () => {
        const card = initializeCards()[0];
        const easy = processAnswer(card, 5);
        const hard = processAnswer(card, 3);
        expect(easy.easeFactor).toBeGreaterThan(hard.easeFactor);
    });

    it('ease factor never drops below 1.3', () => {
        let card = initializeCards()[0];
        for (let i = 0; i < 20; i++) {
            card = processAnswer(card, 0); // always fail
        }
        expect(card.easeFactor).toBeGreaterThanOrEqual(1.3);
    });
});
