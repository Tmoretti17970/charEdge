// ═══════════════════════════════════════════════════════════════════
// charEdge — Batch 8B: Rule Engine Tests (Task 4.3.5)
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
    evaluateRules,
    evaluateAllTrades,
    DEFAULT_RULES,
    type TradeLike,
    type Rule,
} from '@/trading/RuleEngine';

const makeTrade = (overrides: Partial<TradeLike> = {}): TradeLike => ({
    id: `t-${Math.random().toString(36).slice(2, 6)}`,
    date: new Date().toISOString(),
    pnl: 50,
    qty: 1,
    entry: 100,
    exit: 105,
    ...overrides,
});

describe('RuleEngine', () => {
    it('returns clean result when all rules pass', () => {
        const trade = makeTrade();
        const result = evaluateRules(trade, [], DEFAULT_RULES, 100000);
        expect(result.violations).toEqual([]);
        expect(result.adherenceRate).toBe(1);
    });

    it('detects max daily trades violation', () => {
        const rules: Rule[] = [{
            id: 'max-daily', type: 'MAX_DAILY_TRADES', name: 'Max 2/day',
            description: '', enabled: true, params: { limit: 2 },
        }];
        const today = new Date().toISOString();
        const priorTrades = [makeTrade({ date: today }), makeTrade({ date: today })];
        const newTrade = makeTrade({ date: today });

        const result = evaluateRules(newTrade, priorTrades, rules);
        expect(result.violations.length).toBe(1);
        expect(result.violations[0].ruleType).toBe('MAX_DAILY_TRADES');
    });

    it('detects max position size violation', () => {
        const rules: Rule[] = [{
            id: 'max-pos', type: 'MAX_POSITION_SIZE', name: 'Max 2%',
            description: '', enabled: true, params: { maxPercent: 2 },
        }];
        const trade = makeTrade({ entry: 100, qty: 30 }); // $3000 = 30% of $10k

        const result = evaluateRules(trade, [], rules, 10000);
        expect(result.violations.length).toBe(1);
        expect(result.violations[0].ruleType).toBe('MAX_POSITION_SIZE');
    });

    it('detects consecutive loss violation', () => {
        const rules: Rule[] = [{
            id: 'consec', type: 'MAX_CONSECUTIVE_LOSSES', name: 'Stop after 3',
            description: '', enabled: true, params: { limit: 3 },
        }];
        const priorTrades = [
            makeTrade({ pnl: -50 }),
            makeTrade({ pnl: -30 }),
            makeTrade({ pnl: -40 }),
        ];
        const trade = makeTrade();

        const result = evaluateRules(trade, priorTrades, rules);
        expect(result.violations.length).toBe(1);
        expect(result.violations[0].ruleType).toBe('MAX_CONSECUTIVE_LOSSES');
    });

    it('detects max daily loss violation', () => {
        const rules: Rule[] = [{
            id: 'daily-loss', type: 'MAX_DAILY_LOSS', name: 'Max $200/day',
            description: '', enabled: true, params: { maxLoss: 200 },
        }];
        const today = new Date().toISOString();
        const priorTrades = [
            makeTrade({ pnl: -150, date: today }),
            makeTrade({ pnl: -100, date: today }),
        ];
        const trade = makeTrade({ date: today });

        const result = evaluateRules(trade, priorTrades, rules);
        expect(result.violations.length).toBe(1);
        expect(result.violations[0].ruleType).toBe('MAX_DAILY_LOSS');
    });

    it('skips disabled rules', () => {
        const rules: Rule[] = [{
            id: 'disabled', type: 'MAX_DAILY_TRADES', name: 'Max trades',
            description: '', enabled: false, params: { limit: 1 },
        }];
        const trade = makeTrade();
        const result = evaluateRules(trade, [makeTrade()], rules);
        expect(result.violations).toEqual([]);
        expect(result.totalRules).toBe(0);
    });

    it('evaluateAllTrades processes full history', () => {
        const rules: Rule[] = [{
            id: 'max-daily', type: 'MAX_DAILY_TRADES', name: 'Max 2/day',
            description: '', enabled: true, params: { limit: 2 },
        }];
        const today = new Date().toISOString();
        const trades = [
            makeTrade({ id: 't1', date: today }),
            makeTrade({ id: 't2', date: today }),
            makeTrade({ id: 't3', date: today }), // this should violate
        ];
        const results = evaluateAllTrades(trades, rules);
        expect(results.size).toBe(3);
        // t3 should have a violation
        const t3Result = results.get('t3');
        expect(t3Result?.violations.length).toBe(1);
    });
});
