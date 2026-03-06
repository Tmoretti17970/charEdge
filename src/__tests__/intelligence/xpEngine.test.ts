// ═══════════════════════════════════════════════════════════════════
// charEdge — Batch 8B: XP Engine Tests (Task 4.3.13)
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { createInitialState, awardXP, updateStreak } from '../../intelligence/XPEngine';

describe('XPEngine', () => {
    it('creates initial state', () => {
        const state = createInitialState();
        expect(state.totalXP).toBe(0);
        expect(state.level).toBe(1);
        expect(state.currentStreak).toBe(0);
        expect(state.events).toEqual([]);
    });

    it('awards XP for checklist', () => {
        let state = createInitialState();
        state = awardXP(state, 'CHECKLIST', { tradeId: 't1' });
        expect(state.totalXP).toBe(10);
        expect(state.events.length).toBe(1);
        expect(state.events[0].type).toBe('CHECKLIST');
    });

    it('awards XP for post-trade review', () => {
        let state = createInitialState();
        state = awardXP(state, 'POST_REVIEW');
        expect(state.totalXP).toBe(20);
    });

    it('awards XP for mistake identification', () => {
        let state = createInitialState();
        state = awardXP(state, 'MISTAKE_ID');
        expect(state.totalXP).toBe(30);
    });

    it('levels up at threshold', () => {
        let state = createInitialState();
        // Award enough XP to reach level 2 (100 XP)
        for (let i = 0; i < 10; i++) {
            state = awardXP(state, 'CHECKLIST'); // 10 each = 100 total
        }
        expect(state.level).toBe(2);
    });

    it('increments streak on journal days', () => {
        let state = createInitialState();
        state = updateStreak(state, true);
        expect(state.currentStreak).toBe(1);
        state = updateStreak(state, true);
        expect(state.currentStreak).toBe(2);
    });

    it('resets streak on missed day', () => {
        let state = createInitialState();
        state = updateStreak(state, true);
        state = updateStreak(state, true);
        state = updateStreak(state, false);
        expect(state.currentStreak).toBe(0);
    });

    it('awards streak bonus at 3-day milestone', () => {
        let state = createInitialState();
        state = updateStreak(state, true);
        state = updateStreak(state, true);
        const before = state.totalXP;
        state = updateStreak(state, true); // 3-day streak → bonus
        expect(state.totalXP).toBeGreaterThan(before);
        expect(state.currentStreak).toBe(3);
    });

    it('tracks longest streak', () => {
        let state = createInitialState();
        for (let i = 0; i < 5; i++) {
            state = updateStreak(state, true);
        }
        expect(state.longestStreak).toBe(5);
        state = updateStreak(state, false);
        expect(state.longestStreak).toBe(5); // preserved
    });

    it('caps events at 100', () => {
        let state = createInitialState();
        for (let i = 0; i < 110; i++) {
            state = awardXP(state, 'CHECKLIST');
        }
        expect(state.events.length).toBeLessThanOrEqual(100);
    });
});
