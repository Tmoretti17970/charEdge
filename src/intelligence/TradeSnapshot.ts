// ═══════════════════════════════════════════════════════════════════
// charEdge — TradeSnapshot (Task 4.1.1)
//
// Captures a comprehensive snapshot of market state at the moment
// a trade is executed. Used for post-trade analysis, pattern
// recognition, and cognitive bias detection.
//
// A snapshot includes:
//   - Entry/exit prices and timestamps
//   - Surrounding OHLCV bars (context window)
//   - Active indicators at time of trade
//   - Account state (position size, P&L, equity)
//   - Psychological markers (journaled emotions, time of day)
//
// Usage:
//   import { captureTradeSnapshot } from './TradeSnapshot';
//   const snapshot = captureTradeSnapshot({ side: 'long', ... });
// ═══════════════════════════════════════════════════════════════════

/** Bar data for the context window around the trade */
export interface ContextBar {
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

/** Active indicator at time of trade */
export interface IndicatorSnapshot {
    name: string;           // e.g. 'RSI', 'EMA(20)'
    value: number | string; // Current value at trade time
    signal?: 'buy' | 'sell' | 'neutral';
}

/** Account state at time of trade */
export interface AccountState {
    equity: number;
    positionSize: number;
    leverage: number;
    unrealizedPnL: number;
    dailyPnL: number;
    drawdownPercent: number;
}

/** Psychological context */
export interface PsychContext {
    emotion?: string;       // User's journaled emotion state
    confidence?: number;    // 1-10 self-rated confidence
    timeOfDay: 'pre-market' | 'open' | 'mid-day' | 'close' | 'after-hours';
    sessionDuration: number; // Minutes in current session
    recentLosses: number;   // Consecutive losses prior to this trade
    tilting?: boolean;       // Detected tilt from pattern analysis
}

/** Full trade snapshot */
export interface TradeSnapshot {
    id: string;
    timestamp: string;

    // Trade details
    symbol: string;
    side: 'long' | 'short';
    entryPrice: number;
    exitPrice?: number;
    quantity: number;
    timeframe: string;

    // Outcome (populated on close)
    pnl?: number;
    pnlPercent?: number;
    holdDuration?: number;  // Milliseconds
    outcome?: 'win' | 'loss' | 'breakeven';

    // Context
    bars: ContextBar[];           // Surrounding bars (N before, M after)
    indicators: IndicatorSnapshot[];
    accountState: AccountState;
    psychContext: PsychContext;

    // Classification (populated by analysis)
    setupType?: string;     // e.g. 'breakout', 'pullback', 'reversal'
    executionGrade?: 'A' | 'B' | 'C' | 'D' | 'F';
    tags: string[];         // User + auto-generated tags
    notes?: string;         // User's trade notes

    // Market context
    marketPhase?: 'trending' | 'ranging' | 'volatile' | 'quiet';
    vwapRelation?: 'above' | 'below' | 'at';
    volumeProfile?: 'high' | 'average' | 'low';
}

// ─── Constants ──────────────────────────────────────────────────

const CONTEXT_BARS_BEFORE = 50;  // Bars before entry
const CONTEXT_BARS_AFTER = 20;   // Bars after entry (for post-trade analysis)

// ─── Helpers ────────────────────────────────────────────────────

function generateId(): string {
    return `ts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getTimeOfDay(): PsychContext['timeOfDay'] {
    const hour = new Date().getHours();
    if (hour < 9) return 'pre-market';
    if (hour < 10) return 'open';
    if (hour < 14) return 'mid-day';
    if (hour < 16) return 'close';
    return 'after-hours';
}

function classifyOutcome(pnl: number): TradeSnapshot['outcome'] {
    if (pnl > 0) return 'win';
    if (pnl < 0) return 'loss';
    return 'breakeven';
}

function gradeExecution(snapshot: TradeSnapshot): TradeSnapshot['executionGrade'] {
    let score = 0;

    // Check if entry was at a good level relative to context
    if (snapshot.indicators.some(i => i.signal === 'buy' && snapshot.side === 'long')) score += 2;
    if (snapshot.indicators.some(i => i.signal === 'sell' && snapshot.side === 'short')) score += 2;

    // Position sizing relative to account
    const riskPercent = (snapshot.quantity * snapshot.entryPrice) / snapshot.accountState.equity;
    if (riskPercent <= 0.02) score += 2; // Good risk management
    else if (riskPercent <= 0.05) score += 1; // Acceptable

    // Tilt check
    if (!snapshot.psychContext.tilting) score += 1;
    if (snapshot.psychContext.confidence && snapshot.psychContext.confidence >= 6) score += 1;

    // PnL if available
    if (snapshot.pnl !== undefined) {
        if (snapshot.pnl > 0) score += 2;
        else if (snapshot.pnl === 0) score += 1;
    }

    if (score >= 8) return 'A';
    if (score >= 6) return 'B';
    if (score >= 4) return 'C';
    if (score >= 2) return 'D';
    return 'F';
}

// ─── Public API ─────────────────────────────────────────────────

export interface CaptureInput {
    symbol: string;
    side: 'long' | 'short';
    entryPrice: number;
    quantity: number;
    timeframe: string;
    bars?: ContextBar[];
    indicators?: IndicatorSnapshot[];
    accountState?: Partial<AccountState>;
    emotion?: string;
    confidence?: number;
    sessionDuration?: number;
    recentLosses?: number;
    notes?: string;
    tags?: string[];
}

/**
 * Capture a trade snapshot at entry time.
 * The snapshot can be updated later with exit data.
 */
export function captureTradeSnapshot(input: CaptureInput): TradeSnapshot {
    const now = new Date();

    return {
        id: generateId(),
        timestamp: now.toISOString(),

        symbol: input.symbol,
        side: input.side,
        entryPrice: input.entryPrice,
        quantity: input.quantity,
        timeframe: input.timeframe,

        bars: input.bars || [],
        indicators: input.indicators || [],

        accountState: {
            equity: input.accountState?.equity ?? 0,
            positionSize: input.accountState?.positionSize ?? input.quantity,
            leverage: input.accountState?.leverage ?? 1,
            unrealizedPnL: input.accountState?.unrealizedPnL ?? 0,
            dailyPnL: input.accountState?.dailyPnL ?? 0,
            drawdownPercent: input.accountState?.drawdownPercent ?? 0,
        },

        psychContext: {
            emotion: input.emotion,
            confidence: input.confidence,
            timeOfDay: getTimeOfDay(),
            sessionDuration: input.sessionDuration ?? 0,
            recentLosses: input.recentLosses ?? 0,
            tilting: (input.recentLosses ?? 0) >= 3,
        },

        tags: input.tags || [],
        notes: input.notes,
    };
}

/**
 * Close a trade snapshot with exit data and compute outcome metrics.
 */
export function closeTradeSnapshot(
    snapshot: TradeSnapshot,
    exitPrice: number,
    exitTimestamp?: string
): TradeSnapshot {
    const pnl = snapshot.side === 'long'
        ? (exitPrice - snapshot.entryPrice) * snapshot.quantity
        : (snapshot.entryPrice - exitPrice) * snapshot.quantity;

    const pnlPercent = (pnl / (snapshot.entryPrice * snapshot.quantity)) * 100;
    const holdDuration = exitTimestamp
        ? new Date(exitTimestamp).getTime() - new Date(snapshot.timestamp).getTime()
        : Date.now() - new Date(snapshot.timestamp).getTime();

    const closed: TradeSnapshot = {
        ...snapshot,
        exitPrice,
        pnl,
        pnlPercent,
        holdDuration,
        outcome: classifyOutcome(pnl),
    };

    closed.executionGrade = gradeExecution(closed);

    return closed;
}

// ─── Storage ────────────────────────────────────────────────────

const STORAGE_KEY = 'charEdge-trade-snapshots';
const MAX_STORED = 500;

/** Save a snapshot to local storage */
export function saveSnapshot(snapshot: TradeSnapshot): void {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const all: TradeSnapshot[] = raw ? JSON.parse(raw) : [];
        all.push(snapshot);

        // Cap to prevent unbounded growth
        const trimmed = all.length > MAX_STORED ? all.slice(-MAX_STORED) : all;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch { /* localStorage may be full */ }
}

/** Load all snapshots */
export function loadSnapshots(): TradeSnapshot[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

/** Get snapshots filtered by symbol, side, or outcome */
export function querySnapshots(filter: Partial<Pick<TradeSnapshot, 'symbol' | 'side' | 'outcome'>>): TradeSnapshot[] {
    const all = loadSnapshots();
    return all.filter(s => {
        if (filter.symbol && s.symbol !== filter.symbol) return false;
        if (filter.side && s.side !== filter.side) return false;
        if (filter.outcome && s.outcome !== filter.outcome) return false;
        return true;
    });
}

export { CONTEXT_BARS_BEFORE, CONTEXT_BARS_AFTER };
