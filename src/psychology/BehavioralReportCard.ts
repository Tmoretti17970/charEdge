// ═══════════════════════════════════════════════════════════════════
// charEdge — Weekly Behavioral Report Card (Task 4.12.13)
//
// Generates a comprehensive weekly behavioral analysis:
//   - Emotional tendencies by streak (winning/losing drift)
//   - Bias dominance scoring
//   - Habit reinforcement metrics
//   - Top 3 recurring errors with trade examples
//
// Extends JournalSummarizer and integrates:
//   - LeakDetector (behavioral leak types)
//   - TriggerCorrelation (trigger→loss patterns)
//   - BiasDetector (cognitive bias analysis)
//   - DisciplineCurve (rule adherence)
//   - FatigueAnalyzer (time patterns)
// ═══════════════════════════════════════════════════════════════════

import { analyzeTriggerCorrelation, type TriggerCorrelationReport, type TradeLike as TriggerTrade } from './TriggerCorrelation';
import { detectBiases, type BiasReport, type TradeLike as BiasTrade } from './BiasDetector';
import { computeDisciplineCurve, type DisciplineCurveData, type TradeLike as DisciplineTrade } from './DisciplineCurve';
import { analyzeFatigue, type FatigueReport, type TradeLike as FatigueTrade } from './FatigueAnalyzer';

// ─── Types ──────────────────────────────────────────────────────

export interface EmotionalTendency {
    /** The streak context: "after 2+ wins", "after 2+ losses", "neutral" */
    context: string;
    /** Average FOMO level in this context */
    avgFomo: number;
    /** Average impulse level */
    avgImpulse: number;
    /** Average clarity level */
    avgClarity: number;
    /** Average pre-trade mood */
    avgPreMood: number;
    /** Average post-trade mood */
    avgPostMood: number;
    /** Emotional drift: postMood - preMood (satisfaction vs regret) */
    avgDrift: number;
    /** Number of trades in this context */
    tradeCount: number;
}

export interface RecurringError {
    /** Error type (leak type or bias type) */
    type: string;
    /** Number of occurrences this week */
    count: number;
    /** Total cost attributed to this error */
    totalCost: number;
    /** Example trade IDs */
    exampleTradeIds: string[];
    /** Recommendation */
    recommendation: string;
}

export interface HabitMetrics {
    /** How many trades had pre-trade checklist / notes filled */
    journalCompletionRate: number;
    /** How many trades had psychological dimensions filled */
    psychDimensionRate: number;
    /** Daily consistency: days with at least one journal entry / total trading days */
    dailyConsistency: number;
    /** Average rating (1-5) of trades that were rated */
    avgRating: number;
    /** Streak: consecutive days of journaling */
    currentStreak: number;
}

export interface BehavioralReportCard {
    /** Report period */
    period: { from: string; to: string };
    /** Total trades analyzed */
    analyzedTrades: number;

    /** Emotional tendencies by streak context */
    emotionalTendencies: EmotionalTendency[];
    /** Top 3 recurring errors */
    topErrors: RecurringError[];
    /** Habit reinforcement metrics */
    habits: HabitMetrics;

    /** Sub-reports from each analyzer */
    triggerReport: TriggerCorrelationReport;
    biasReport: BiasReport;
    disciplineData: DisciplineCurveData;
    fatigueReport: FatigueReport;

    /** Composite behavioral score 0-100 */
    overallScore: number;
    /** Narrative summary */
    narrative: string;
}

// ─── Trade Shape (superset of all sub-analyzers) ────────────────

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
    playbook?: string;
    tags?: string[];
    ruleBreak?: boolean;
    triggers?: string[];
    fomo?: number | null;
    impulse?: number | null;
    clarity?: number | null;
    preMood?: number | null;
    postMood?: number | null;
    notes?: string;
    rating?: number | null;
    emotion?: string;
}

// ─── Engine ─────────────────────────────────────────────────────

export function generateReportCard(
    trades: TradeLike[],
    startingEquity: number = 10000
): BehavioralReportCard {
    if (trades.length === 0) {
        return createEmptyReport();
    }

    const sorted = [...trades].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const period = {
        from: sorted[0].date,
        to: sorted[sorted.length - 1].date,
    };

    // Run sub-analyzers
    const triggerReport = analyzeTriggerCorrelation(sorted as TriggerTrade[]);
    const biasReport = detectBiases(sorted as BiasTrade[]);
    const disciplineData = computeDisciplineCurve(sorted as DisciplineTrade[], startingEquity);
    const fatigueReport = analyzeFatigue(sorted as FatigueTrade[]);

    // Compute emotional tendencies
    const emotionalTendencies = computeEmotionalTendencies(sorted);

    // Compile top errors
    const topErrors = compileTopErrors(triggerReport, biasReport, sorted);

    // Compute habit metrics
    const habits = computeHabitMetrics(sorted);

    // Composite score
    const overallScore = computeOverallScore(
        triggerReport.triggerDisciplineScore,
        biasReport.score,
        disciplineData.disciplineRate * 100,
        habits.journalCompletionRate * 100,
        habits.psychDimensionRate * 100
    );

    // Generate narrative
    const narrative = buildNarrative(sorted, overallScore, topErrors, emotionalTendencies, fatigueReport, habits);

    return {
        period,
        analyzedTrades: sorted.length,
        emotionalTendencies,
        topErrors,
        habits,
        triggerReport,
        biasReport,
        disciplineData,
        fatigueReport,
        overallScore,
        narrative,
    };
}

// ─── Emotional Tendencies ───────────────────────────────────────

function computeEmotionalTendencies(trades: TradeLike[]): EmotionalTendency[] {
    const contexts: Map<string, TradeLike[]> = new Map();
    contexts.set('after-wins', []);
    contexts.set('after-losses', []);
    contexts.set('neutral', []);

    // Classify each trade by streak context
    let consecutiveWins = 0;
    let consecutiveLosses = 0;

    for (const trade of trades) {
        let context: string;
        if (consecutiveWins >= 2) context = 'after-wins';
        else if (consecutiveLosses >= 2) context = 'after-losses';
        else context = 'neutral';

        contexts.get(context)!.push(trade);

        // Update streak
        if (trade.pnl > 0) {
            consecutiveWins++;
            consecutiveLosses = 0;
        } else if (trade.pnl < 0) {
            consecutiveLosses++;
            consecutiveWins = 0;
        }
    }

    const results: EmotionalTendency[] = [];
    for (const [context, contextTrades] of contexts) {
        if (contextTrades.length === 0) continue;

        const withPsych = contextTrades.filter(t =>
            t.fomo != null || t.impulse != null || t.clarity != null
        );

        if (withPsych.length === 0) {
            results.push({
                context, tradeCount: contextTrades.length,
                avgFomo: 0, avgImpulse: 0, avgClarity: 0,
                avgPreMood: 0, avgPostMood: 0, avgDrift: 0,
            });
            continue;
        }

        const avg = (arr: (number | null | undefined)[]): number => {
            const valid = arr.filter(v => v != null) as number[];
            return valid.length > 0 ? valid.reduce((s, v) => s + v, 0) / valid.length : 0;
        };

        const avgDrift = avg(withPsych.map(t =>
            t.postMood != null && t.preMood != null ? t.postMood - t.preMood : null
        ));

        results.push({
            context,
            tradeCount: contextTrades.length,
            avgFomo: avg(withPsych.map(t => t.fomo)),
            avgImpulse: avg(withPsych.map(t => t.impulse)),
            avgClarity: avg(withPsych.map(t => t.clarity)),
            avgPreMood: avg(withPsych.map(t => t.preMood)),
            avgPostMood: avg(withPsych.map(t => t.postMood)),
            avgDrift,
        });
    }

    return results;
}

// ─── Top Errors ─────────────────────────────────────────────────

function compileTopErrors(
    triggerReport: TriggerCorrelationReport,
    biasReport: BiasReport,
    trades: TradeLike[]
): RecurringError[] {
    const errors: RecurringError[] = [];

    // From trigger patterns
    for (const pattern of triggerReport.topPatterns) {
        errors.push({
            type: `Trigger: ${pattern.trigger}`,
            count: pattern.lossCount,
            totalCost: pattern.totalCost,
            exampleTradeIds: trades
                .filter(t => t.pnl < 0 && t.triggers?.includes(pattern.trigger))
                .slice(0, 3)
                .map(t => t.id),
            recommendation: `${pattern.trigger} appeared in ${pattern.lossCount} losing trades. Peak time: ${pattern.peakTimeOfDay}.`,
        });
    }

    // From bias detections
    const biasByType = new Map<string, { count: number; ids: string[]; rec: string }>();
    for (const bias of biasReport.biases) {
        const entry = biasByType.get(bias.type) || { count: 0, ids: [], rec: bias.recommendation };
        entry.count++;
        entry.ids.push(...bias.affectedTradeIds);
        biasByType.set(bias.type, entry);
    }

    for (const [type, data] of biasByType) {
        errors.push({
            type: `Bias: ${type}`,
            count: data.count,
            totalCost: 0, // Bias cost is harder to attribute
            exampleTradeIds: [...new Set(data.ids)].slice(0, 3),
            recommendation: data.rec,
        });
    }

    // Sort by cost, then count
    errors.sort((a, b) => (b.totalCost - a.totalCost) || (b.count - a.count));
    return errors.slice(0, 3);
}

// ─── Habit Metrics ──────────────────────────────────────────────

function computeHabitMetrics(trades: TradeLike[]): HabitMetrics {
    const withNotes = trades.filter(t => t.notes && t.notes.trim().length > 0);
    const withPsych = trades.filter(t =>
        t.fomo != null || t.impulse != null || t.clarity != null
    );
    const withRating = trades.filter(t => t.rating != null);

    // Daily consistency
    const tradingDays = new Set(trades.map(t => new Date(t.date).toDateString()));
    const journaledDays = new Set(
        withNotes.map(t => new Date(t.date).toDateString())
    );
    const dailyConsistency = tradingDays.size > 0
        ? journaledDays.size / tradingDays.size
        : 0;

    // Current journaling streak
    const sortedDays = [...tradingDays].sort((a, b) =>
        new Date(a).getTime() - new Date(b).getTime()
    );
    let currentStreak = 0;
    for (let i = sortedDays.length - 1; i >= 0; i--) {
        if (journaledDays.has(sortedDays[i])) {
            currentStreak++;
        } else {
            break;
        }
    }

    const avgRating = withRating.length > 0
        ? withRating.reduce((s, t) => s + (t.rating || 0), 0) / withRating.length
        : 0;

    return {
        journalCompletionRate: trades.length > 0 ? withNotes.length / trades.length : 0,
        psychDimensionRate: trades.length > 0 ? withPsych.length / trades.length : 0,
        dailyConsistency,
        avgRating,
        currentStreak,
    };
}

// ─── Overall Score ──────────────────────────────────────────────

function computeOverallScore(
    triggerScore: number,
    biasScore: number,
    disciplineRate: number,
    journalRate: number,
    psychRate: number
): number {
    // Weighted average
    const score = (
        triggerScore * 0.25 +
        biasScore * 0.25 +
        disciplineRate * 0.25 +
        journalRate * 0.15 +
        psychRate * 0.10
    );
    return Math.round(Math.max(0, Math.min(100, score)));
}

// ─── Narrative ──────────────────────────────────────────────────

function buildNarrative(
    trades: TradeLike[],
    score: number,
    topErrors: RecurringError[],
    tendencies: EmotionalTendency[],
    fatigue: FatigueReport,
    habits: HabitMetrics
): string {
    const wins = trades.filter(t => t.pnl > 0).length;
    const losses = trades.filter(t => t.pnl < 0).length;
    const netPnl = trades.reduce((s, t) => s + t.pnl, 0);
    const parts: string[] = [];

    // Overview
    parts.push(`This week: ${trades.length} trades, ${wins}W/${losses}L, ${netPnl >= 0 ? '+' : ''}$${netPnl.toFixed(0)}. Behavioral score: ${score}/100.`);

    // Top error
    if (topErrors.length > 0) {
        parts.push(`#1 issue: ${topErrors[0].type} (${topErrors[0].count} occurrences). ${topErrors[0].recommendation}`);
    }

    // Emotional insight
    const afterLosses = tendencies.find(t => t.context === 'after-losses');
    if (afterLosses && afterLosses.tradeCount > 0 && afterLosses.avgFomo > 5) {
        parts.push(`After losing streaks, FOMO spikes to ${afterLosses.avgFomo.toFixed(1)}/10. This is driving revenge entries.`);
    }

    // Fatigue
    if (fatigue.fatigueThreshold !== null) {
        parts.push(`Performance drops after ${Math.round(fatigue.fatigueThreshold / 60)}h sessions.`);
    }

    // Habits
    if (habits.journalCompletionRate < 0.5) {
        parts.push(`Only ${Math.round(habits.journalCompletionRate * 100)}% of trades have notes — journal more for better pattern recognition.`);
    }

    return parts.join(' ');
}

// ─── Empty Report ───────────────────────────────────────────────

function createEmptyReport(): BehavioralReportCard {
    return {
        period: { from: '', to: '' },
        analyzedTrades: 0,
        emotionalTendencies: [],
        topErrors: [],
        habits: {
            journalCompletionRate: 0,
            psychDimensionRate: 0,
            dailyConsistency: 0,
            avgRating: 0,
            currentStreak: 0,
        },
        triggerReport: {
            topPatterns: [],
            clusters: [],
            triggerDisciplineScore: 100,
            analyzedTrades: 0,
            tradesWithTriggers: 0,
            period: { from: '', to: '' },
        },
        biasReport: {
            biases: [],
            dominantBias: null,
            overallSeverity: 'none',
            score: 100,
            analyzedTrades: 0,
        },
        disciplineData: {
            points: [],
            startingEquity: 10000,
            finalActualEquity: 10000,
            finalDisciplinedEquity: 10000,
            costOfIndiscipline: 0,
            ruleBreakCount: 0,
            totalTrades: 0,
            disciplineRate: 1,
        },
        fatigueReport: {
            bestHours: null,
            worstHours: null,
            hourlyBreakdown: [],
            weekdayMatrix: [],
            sessionFatigueCurve: [],
            fatigueThreshold: null,
            analyzedTrades: 0,
            recommendations: [],
        },
        overallScore: 100,
        narrative: 'No trades to analyze this period.',
    };
}

export default generateReportCard;
