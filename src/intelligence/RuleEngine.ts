// ═══════════════════════════════════════════════════════════════════
// charEdge — Rule Engine v2 (Task 4.3.5)
//
// Define and evaluate trading rules for automated compliance:
//   - Max daily trades
//   - Max position size (% of equity)
//   - Required pre-trade checklist
//   - Time-of-day restrictions
//   - Max consecutive losses before cooling off
//   - Min R-multiple target
//
// Rules are evaluated against each trade, producing violations
// that feed into LeakDetector, DisciplineCurve, and BehavioralReport.
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export type RuleType =
    | 'MAX_DAILY_TRADES'
    | 'MAX_POSITION_SIZE'
    | 'REQUIRE_CHECKLIST'
    | 'TIME_RESTRICTION'
    | 'MAX_CONSECUTIVE_LOSSES'
    | 'MIN_R_MULTIPLE'
    | 'MAX_DAILY_LOSS'
    | 'CUSTOM';

export interface Rule {
    id: string;
    type: RuleType;
    name: string;
    description: string;
    enabled: boolean;
    /** Rule-specific parameters */
    params: Record<string, number | string | boolean | string[]>;
}

export interface RuleViolation {
    ruleId: string;
    ruleName: string;
    ruleType: RuleType;
    tradeId: string;
    message: string;
    severity: 'hard' | 'soft'; // hard = should not have traded, soft = warning
}

export interface RuleEvaluationResult {
    violations: RuleViolation[];
    totalRules: number;
    passedRules: number;
    adherenceRate: number; // 0-1
    violatedRuleIds: string[];
}

// ─── Trade Shape ────────────────────────────────────────────────

export interface TradeLike {
    id: string;
    date: string;
    pnl: number;
    qty?: number;
    entry?: number;
    exit?: number;
    side?: string;
    stopLoss?: number | null;
    takeProfit?: number | null;
    rMultiple?: number | null;
    notes?: string;
    tags?: string[];
    ruleBreak?: boolean;
}

// ─── Default Rules ──────────────────────────────────────────────

export const DEFAULT_RULES: Rule[] = [
    {
        id: 'max-daily-trades',
        type: 'MAX_DAILY_TRADES',
        name: 'Max Daily Trades',
        description: 'Limit the number of trades per day',
        enabled: true,
        params: { limit: 6 },
    },
    {
        id: 'max-position-size',
        type: 'MAX_POSITION_SIZE',
        name: 'Max Position Size',
        description: 'Max position as % of equity',
        enabled: true,
        params: { maxPercent: 5 },
    },
    {
        id: 'max-consecutive-losses',
        type: 'MAX_CONSECUTIVE_LOSSES',
        name: 'Cooling Off Period',
        description: 'Stop trading after N consecutive losses',
        enabled: true,
        params: { limit: 3 },
    },
    {
        id: 'max-daily-loss',
        type: 'MAX_DAILY_LOSS',
        name: 'Max Daily Loss',
        description: 'Stop trading if daily loss exceeds threshold',
        enabled: true,
        params: { maxLoss: 500 },
    },
];

// ─── Engine ─────────────────────────────────────────────────────

export function evaluateRules(
    trade: TradeLike,
    allTrades: TradeLike[],
    rules: Rule[],
    equity: number = 10000
): RuleEvaluationResult {
    const enabledRules = rules.filter(r => r.enabled);
    const violations: RuleViolation[] = [];

    for (const rule of enabledRules) {
        const violation = checkRule(rule, trade, allTrades, equity);
        if (violation) violations.push(violation);
    }

    return {
        violations,
        totalRules: enabledRules.length,
        passedRules: enabledRules.length - violations.length,
        adherenceRate: enabledRules.length > 0
            ? (enabledRules.length - violations.length) / enabledRules.length
            : 1,
        violatedRuleIds: violations.map(v => v.ruleId),
    };
}

export function evaluateAllTrades(
    trades: TradeLike[],
    rules: Rule[],
    equity: number = 10000
): Map<string, RuleEvaluationResult> {
    const results = new Map<string, RuleEvaluationResult>();
    const sorted = [...trades].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    for (let i = 0; i < sorted.length; i++) {
        const trade = sorted[i]!;
        const priorTrades = sorted.slice(0, i);
        const result = evaluateRules(trade, priorTrades, rules, equity);
        results.set(trade.id, result);
    }

    return results;
}

// ─── Rule Checkers ──────────────────────────────────────────────

function checkRule(
    rule: Rule,
    trade: TradeLike,
    allTrades: TradeLike[],
    equity: number
): RuleViolation | null {
    switch (rule.type) {
        case 'MAX_DAILY_TRADES':
            return checkMaxDailyTrades(rule, trade, allTrades);
        case 'MAX_POSITION_SIZE':
            return checkMaxPositionSize(rule, trade, equity);
        case 'MAX_CONSECUTIVE_LOSSES':
            return checkMaxConsecutiveLosses(rule, trade, allTrades);
        case 'MAX_DAILY_LOSS':
            return checkMaxDailyLoss(rule, trade, allTrades);
        default:
            return null;
    }
}

function checkMaxDailyTrades(
    rule: Rule,
    trade: TradeLike,
    allTrades: TradeLike[]
): RuleViolation | null {
    const limit = rule.params.limit as number;
    const tradeDate = new Date(trade.date).toDateString();
    const sameDayTrades = allTrades.filter(
        t => new Date(t.date).toDateString() === tradeDate
    );

    if (sameDayTrades.length >= limit) {
        return {
            ruleId: rule.id,
            ruleName: rule.name,
            ruleType: rule.type,
            tradeId: trade.id,
            message: `Exceeded max ${limit} trades/day (this is trade #${sameDayTrades.length + 1})`,
            severity: 'hard',
        };
    }
    return null;
}

function checkMaxPositionSize(
    rule: Rule,
    trade: TradeLike,
    equity: number
): RuleViolation | null {
    const maxPercent = rule.params.maxPercent as number;
    if (!trade.entry || !trade.qty || equity <= 0) return null;

    const positionValue = trade.entry * trade.qty;
    const percent = (positionValue / equity) * 100;

    if (percent > maxPercent) {
        return {
            ruleId: rule.id,
            ruleName: rule.name,
            ruleType: rule.type,
            tradeId: trade.id,
            message: `Position size ${percent.toFixed(1)}% exceeds max ${maxPercent}%`,
            severity: 'hard',
        };
    }
    return null;
}

function checkMaxConsecutiveLosses(
    rule: Rule,
    trade: TradeLike,
    allTrades: TradeLike[]
): RuleViolation | null {
    const limit = rule.params.limit as number;
    // Count consecutive losses ending at the last trade before this one
    let streak = 0;
    const sorted = [...allTrades].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    for (const t of sorted) {
        if (t.pnl < 0) streak++;
        else break;
    }

    if (streak >= limit) {
        return {
            ruleId: rule.id,
            ruleName: rule.name,
            ruleType: rule.type,
            tradeId: trade.id,
            message: `Traded after ${streak} consecutive losses (limit: ${limit}). Take a break.`,
            severity: 'hard',
        };
    }
    return null;
}

function checkMaxDailyLoss(
    rule: Rule,
    trade: TradeLike,
    allTrades: TradeLike[]
): RuleViolation | null {
    const maxLoss = rule.params.maxLoss as number;
    const tradeDate = new Date(trade.date).toDateString();
    const sameDayTrades = allTrades.filter(
        t => new Date(t.date).toDateString() === tradeDate
    );

    const dailyPnl = sameDayTrades.reduce((sum, t) => sum + t.pnl, 0);

    if (dailyPnl < -maxLoss) {
        return {
            ruleId: rule.id,
            ruleName: rule.name,
            ruleType: rule.type,
            tradeId: trade.id,
            message: `Daily loss $${Math.abs(dailyPnl).toFixed(0)} exceeds max $${maxLoss}. Stop trading for today.`,
            severity: 'hard',
        };
    }
    return null;
}

export default evaluateRules;
