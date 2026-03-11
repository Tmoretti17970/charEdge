// ═══════════════════════════════════════════════════════════════════
// charEdge — Post-Trade Reflection Engine (Task 4.3.11)
//
// Structured post-trade reflection with guided prompts.
// Feeds into BehavioralReportCard for pattern analysis.
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export interface ReflectionPrompt {
    id: string;
    category: 'plan' | 'execution' | 'psychology' | 'improvement';
    question: string;
    inputType: 'text' | 'rating' | 'select';
    options?: string[];  // for 'select' type
}

export interface ReflectionAnswer {
    promptId: string;
    answer: string | number;
    timestamp: string;
}

export interface TradeReflection {
    tradeId: string;
    symbol: string;
    pnl: number;
    answers: ReflectionAnswer[];
    completedAt: string;
    planAdherence: number;   // 1-10 how well did you follow the plan
    lessonLearned: string;
    wouldTakeAgain: boolean;
}

export interface ReflectionInsight {
    pattern: string;
    frequency: number;
    impact: 'positive' | 'negative' | 'neutral';
}

// ─── Default Prompts ────────────────────────────────────────────

export const REFLECTION_PROMPTS: ReflectionPrompt[] = [
    {
        id: 'plan-had',
        category: 'plan',
        question: 'Did you have a trading plan before entering?',
        inputType: 'select',
        options: ['Yes — written plan', 'Yes — mental plan', 'Partially', 'No — impulse trade'],
    },
    {
        id: 'plan-followed',
        category: 'plan',
        question: 'How closely did you follow your plan?',
        inputType: 'rating',
    },
    {
        id: 'entry-quality',
        category: 'execution',
        question: 'Rate your entry timing (1 = too early/late, 10 = perfect)',
        inputType: 'rating',
    },
    {
        id: 'exit-quality',
        category: 'execution',
        question: 'Rate your exit timing',
        inputType: 'rating',
    },
    {
        id: 'size-appropriate',
        category: 'execution',
        question: 'Was your position size appropriate for the setup?',
        inputType: 'select',
        options: ['Too large', 'Correct', 'Too small'],
    },
    {
        id: 'emotion-during',
        category: 'psychology',
        question: 'What was your primary emotion during the trade?',
        inputType: 'select',
        options: ['Calm/confident', 'Anxious', 'Greedy', 'Fearful', 'Frustrated', 'Excited', 'Numb'],
    },
    {
        id: 'emotion-influence',
        category: 'psychology',
        question: 'Did emotions influence your decisions?',
        inputType: 'select',
        options: ['Not at all', 'Slightly', 'Significantly', 'Dominated my decisions'],
    },
    {
        id: 'what-change',
        category: 'improvement',
        question: 'What would you do differently?',
        inputType: 'text',
    },
    {
        id: 'lesson',
        category: 'improvement',
        question: 'What is the #1 lesson from this trade?',
        inputType: 'text',
    },
    {
        id: 'would-take-again',
        category: 'improvement',
        question: 'Would you take this setup again?',
        inputType: 'select',
        options: ['Yes — exactly the same', 'Yes — with modifications', 'No — bad setup', 'Unsure'],
    },
];

// ─── Engine ─────────────────────────────────────────────────────

const STORAGE_KEY = 'charEdge-reflections';

export function createReflection(
    tradeId: string,
    symbol: string,
    pnl: number,
    answers: ReflectionAnswer[],
): TradeReflection {
    // Extract plan adherence from the 'plan-followed' prompt
    const planAnswer = answers.find((a) => a.promptId === 'plan-followed');
    const planAdherence = typeof planAnswer?.answer === 'number' ? planAnswer.answer : 5;

    // Extract lesson from the 'lesson' prompt
    const lessonAnswer = answers.find((a) => a.promptId === 'lesson');
    const lessonLearned = typeof lessonAnswer?.answer === 'string' ? lessonAnswer.answer : '';

    // Extract would-take-again
    const againAnswer = answers.find((a) => a.promptId === 'would-take-again');
    const wouldTakeAgain = typeof againAnswer?.answer === 'string'
        ? againAnswer.answer.startsWith('Yes')
        : true;

    return {
        tradeId,
        symbol,
        pnl,
        answers,
        completedAt: new Date().toISOString(),
        planAdherence,
        lessonLearned,
        wouldTakeAgain,
    };
}

export function analyzeReflections(reflections: TradeReflection[]): ReflectionInsight[] {
    if (reflections.length < 3) return [];

    const insights: ReflectionInsight[] = [];

    // Analyze emotion patterns
    const emotionCounts = new Map<string, { count: number; totalPnl: number }>();
    for (const r of reflections) {
        const emotionAnswer = r.answers.find((a) => a.promptId === 'emotion-during');
        if (!emotionAnswer || typeof emotionAnswer.answer !== 'string') continue;
        const emotion = emotionAnswer.answer;
        const existing = emotionCounts.get(emotion) || { count: 0, totalPnl: 0 };
        existing.count++;
        existing.totalPnl += r.pnl;
        emotionCounts.set(emotion, existing);
    }

    for (const [emotion, data] of emotionCounts) {
        if (data.count >= 2) {
            const avgPnl = data.totalPnl / data.count;
            insights.push({
                pattern: `When feeling "${emotion}", avg P&L is $${avgPnl.toFixed(2)} (${data.count} trades)`,
                frequency: data.count,
                impact: avgPnl > 0 ? 'positive' : avgPnl < 0 ? 'negative' : 'neutral',
            });
        }
    }

    // Plan adherence vs P&L correlation
    const highAdherence = reflections.filter((r) => r.planAdherence >= 7);
    const lowAdherence = reflections.filter((r) => r.planAdherence <= 4);

    if (highAdherence.length >= 2 && lowAdherence.length >= 2) {
        const highAvg = highAdherence.reduce((s, r) => s + r.pnl, 0) / highAdherence.length;
        const lowAvg = lowAdherence.reduce((s, r) => s + r.pnl, 0) / lowAdherence.length;

        if (highAvg > lowAvg) {
            insights.push({
                pattern: `Following your plan pays: high-adherence trades avg $${highAvg.toFixed(2)} vs $${lowAvg.toFixed(2)} when deviating`,
                frequency: highAdherence.length + lowAdherence.length,
                impact: 'positive',
            });
        }
    }

    // Emotion influence correlation
    const emotionInfluenced = reflections.filter((r) => {
        const a = r.answers.find((ans) => ans.promptId === 'emotion-influence');
        return a && (a.answer === 'Significantly' || a.answer === 'Dominated my decisions');
    });

    if (emotionInfluenced.length >= 2) {
        const avgPnl = emotionInfluenced.reduce((s, r) => s + r.pnl, 0) / emotionInfluenced.length;
        insights.push({
            pattern: `Emotion-driven trades avg $${avgPnl.toFixed(2)} (${emotionInfluenced.length} trades)`,
            frequency: emotionInfluenced.length,
            impact: avgPnl > 0 ? 'positive' : 'negative',
        });
    }

    return insights.sort((a, b) => b.frequency - a.frequency);
}

export function saveReflections(reflections: TradeReflection[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(reflections));
    } catch { /* storage full */ }
}

export function loadReflections(): TradeReflection[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export default { REFLECTION_PROMPTS, createReflection, analyzeReflections, saveReflections, loadReflections };
