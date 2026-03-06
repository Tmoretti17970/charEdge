// ═══════════════════════════════════════════════════════════════════
// charEdge — Coachmark Registry (Batch 16: 3.1.7)
//
// Central registry of all contextual coachmarks with skill-level
// metadata. Coachmarks are filtered by the user's selected skill
// level so beginners see basics and advanced users skip them.
//
// Usage:
//   import { getCoachmarksForLevel, COACHMARKS } from './coachmarkRegistry';
//   const tips = getCoachmarksForLevel('beginner');
// ═══════════════════════════════════════════════════════════════════

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';
export type Position = 'top' | 'bottom' | 'left' | 'right';

export interface CoachmarkEntry {
    id: string;
    target: string;           // CSS selector for target element
    title: string;
    message: string;
    skillLevel: SkillLevel;   // Minimum skill level to see this tip
    position: Position;
    ctaLabel?: string;
    /** Priority: lower = shown first. Default 50. */
    priority?: number;
}

// ─── Registry ────────────────────────────────────────────────────

export const COACHMARKS: CoachmarkEntry[] = [
    // ─── Beginner: Core Concepts ─────────────────────────────────
    {
        id: 'tip-chart-basics',
        target: '[data-testid="chart-container"]',
        title: '📈 Your Chart',
        message: 'This is your main chart. Scroll to zoom, drag to pan. Click any candle to see the price.',
        skillLevel: 'beginner',
        position: 'bottom',
        priority: 10,
    },
    {
        id: 'tip-add-trade',
        target: '[data-testid="add-trade-btn"]',
        title: '📝 Log Your First Trade',
        message: 'Click here to record a trade. Tracking trades is the first step to finding your edge.',
        skillLevel: 'beginner',
        position: 'bottom',
        ctaLabel: 'Add Trade',
        priority: 20,
    },
    {
        id: 'tip-watchlist',
        target: '[data-testid="watchlist-panel"]',
        title: '👀 Your Watchlist',
        message: 'Add symbols you want to track. Click any symbol to load its chart.',
        skillLevel: 'beginner',
        position: 'right',
        priority: 30,
    },
    {
        id: 'tip-timeframe',
        target: '[data-testid="timeframe-selector"]',
        title: '⏱ Timeframes',
        message: 'Switch between timeframes (1m, 5m, 1h, 1D, etc.) to see different perspectives.',
        skillLevel: 'beginner',
        position: 'bottom',
        priority: 40,
    },

    // ─── Intermediate: Analysis Features ─────────────────────────
    {
        id: 'tip-indicators',
        target: '[data-testid="indicator-btn"]',
        title: '📊 Add Indicators',
        message: 'Add technical indicators like RSI, MACD, and Bollinger Bands to your chart.',
        skillLevel: 'intermediate',
        position: 'bottom',
        priority: 50,
    },
    {
        id: 'tip-drawings',
        target: '[data-testid="drawing-tools"]',
        title: '✏️ Drawing Tools',
        message: 'Use trend lines, Fibonacci retracements, and more to mark key levels.',
        skillLevel: 'intermediate',
        position: 'right',
        priority: 60,
    },
    {
        id: 'tip-journal',
        target: '[data-testid="journal-tab"]',
        title: '📓 Trade Journal',
        message: 'Review your trades, add notes, and spot patterns in your behavior.',
        skillLevel: 'intermediate',
        position: 'bottom',
        priority: 70,
    },
    {
        id: 'tip-alerts',
        target: '[data-testid="alerts-btn"]',
        title: '🔔 Price Alerts',
        message: 'Set alerts to get notified when price hits your target levels.',
        skillLevel: 'intermediate',
        position: 'left',
        priority: 80,
    },

    // ─── Advanced: Intelligence & Analytics ──────────────────────
    {
        id: 'tip-analytics-dashboard',
        target: '[data-testid="analytics-tab"]',
        title: '📉 Analytics Dashboard',
        message: 'Deep-dive into your trading stats: win rate, Sharpe ratio, equity curves, and more.',
        skillLevel: 'advanced',
        position: 'bottom',
        priority: 90,
    },
    {
        id: 'tip-ghost-boxes',
        target: '[data-testid="ghost-boxes"]',
        title: '👻 Ghost Boxes',
        message: 'See AI-predicted price zones based on your historical trade data and chart patterns.',
        skillLevel: 'advanced',
        position: 'left',
        priority: 100,
    },
    {
        id: 'tip-replay',
        target: '[data-testid="replay-btn"]',
        title: '⏪ Market Replay',
        message: 'Replay historical market data to practice trading without risking real money.',
        skillLevel: 'advanced',
        position: 'bottom',
        priority: 110,
    },
    {
        id: 'tip-keyboard-shortcuts',
        target: 'body',
        title: '⌨️ Keyboard Shortcuts',
        message: 'Press ? to see all keyboard shortcuts. Arrow keys navigate candles, Tab cycles chart elements.',
        skillLevel: 'advanced',
        position: 'bottom',
        priority: 120,
    },
];

// ─── Filtering ───────────────────────────────────────────────────

const LEVEL_RANK: Record<SkillLevel, number> = {
    beginner: 0,
    intermediate: 1,
    advanced: 2,
};

/**
 * Get coachmarks applicable for a given skill level.
 * Beginners see only beginner tips.
 * Intermediate sees beginner + intermediate.
 * Advanced sees all.
 *
 * @param level - User's selected skill level
 * @returns Sorted array of applicable coachmarks
 */
export function getCoachmarksForLevel(level: SkillLevel): CoachmarkEntry[] {
    const maxRank = LEVEL_RANK[level];
    return COACHMARKS
        .filter(c => LEVEL_RANK[c.skillLevel] <= maxRank)
        .sort((a, b) => (a.priority ?? 50) - (b.priority ?? 50));
}

/**
 * Get a single coachmark by ID.
 */
export function getCoachmarkById(id: string): CoachmarkEntry | undefined {
    return COACHMARKS.find(c => c.id === id);
}
