// ═══════════════════════════════════════════════════════════════════
// charEdge — Session Recap Generator
//
// Auto-generates trading session summaries from trade data.
// Sessions are bounded by configurable inactivity gaps (default: 4h).
// ═══════════════════════════════════════════════════════════════════

export interface Trade {
    pnl: number | null;
    size: number;
    entryDate: string;
    exitDate?: string | null;
    symbol?: string;
    side?: string;
}

export interface SessionRecap {
    sessionId: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    tradeCount: number;
    wins: number;
    losses: number;
    breakeven: number;
    winRate: number;
    netPnl: number;
    grossProfit: number;
    grossLoss: number;
    profitFactor: number;
    avgHoldMinutes: number;
    bestTrade: { pnl: number; symbol?: string } | null;
    worstTrade: { pnl: number; symbol?: string } | null;
    symbols: string[];
    avgSize: number;
}

interface RecapConfig {
    /** Minutes of inactivity to split sessions (default: 240 = 4h) */
    inactivityGapMinutes: number;
    /** Minimum trades to count as a session (default: 1) */
    minTrades: number;
}

const DEFAULT_CONFIG: RecapConfig = {
    inactivityGapMinutes: 240,
    minTrades: 1,
};

/**
 * Group trades into sessions and generate recap for each.
 */
export function generateSessionRecaps(
    trades: Trade[],
    config: Partial<RecapConfig> = {},
): SessionRecap[] {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    // Sort by entry date
    const sorted = [...trades]
        .filter((t) => t.entryDate)
        .sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());

    if (sorted.length === 0) return [];

    // Split into sessions by inactivity gap
    const sessions: Trade[][] = [];
    let currentSession: Trade[] = [sorted[0]!];

    for (let i = 1; i < sorted.length; i++) {
        const prevEnd = sorted[i - 1]!.exitDate || sorted[i - 1]!.entryDate;
        const currStart = sorted[i]!.entryDate;
        const gap = new Date(currStart).getTime() - new Date(prevEnd).getTime();

        if (gap > cfg.inactivityGapMinutes * 60_000) {
            sessions.push(currentSession);
            currentSession = [];
        }
        currentSession.push(sorted[i]!);
    }
    sessions.push(currentSession);

    // Generate recaps
    return sessions
        .filter((s) => s.length >= cfg.minTrades)
        .map((sessionTrades, idx) => computeRecap(sessionTrades, idx));
}

/**
 * Generate recap for the most recent session only.
 */
export function generateLatestRecap(
    trades: Trade[],
    config: Partial<RecapConfig> = {},
): SessionRecap | null {
    const recaps = generateSessionRecaps(trades, config);
    return recaps.length > 0 ? recaps[recaps.length - 1]! : null;
}

function computeRecap(trades: Trade[], index: number): SessionRecap {
    const startTime = trades[0]!.entryDate;
    const lastTrade = trades[trades.length - 1]!;
    const endTime = lastTrade.exitDate || lastTrade.entryDate;

    const durationMinutes = Math.round(
        (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60_000,
    );

    let wins = 0;
    let losses = 0;
    let breakeven = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let totalHoldMs = 0;
    let totalSize = 0;
    let bestTrade: { pnl: number; symbol?: string } | null = null;
    let worstTrade: { pnl: number; symbol?: string } | null = null;
    const symbolSet = new Set<string>();

    for (const trade of trades) {
        const pnl = trade.pnl ?? 0;

        if (pnl > 0) {
            wins++;
            grossProfit += pnl;
        } else if (pnl < 0) {
            losses++;
            grossLoss += Math.abs(pnl);
        } else {
            breakeven++;
        }

        if (!bestTrade || pnl > bestTrade.pnl) {
            bestTrade = { pnl, symbol: trade.symbol };
        }
        if (!worstTrade || pnl < worstTrade.pnl) {
            worstTrade = { pnl, symbol: trade.symbol };
        }

        if (trade.exitDate && trade.entryDate) {
            totalHoldMs += new Date(trade.exitDate).getTime() - new Date(trade.entryDate).getTime();
        }

        totalSize += trade.size;
        if (trade.symbol) symbolSet.add(trade.symbol);
    }

    const netPnl = grossProfit - grossLoss;
    const tradeCount = trades.length;
    const winRate = tradeCount > 0 ? Math.round((wins / tradeCount) * 100) : 0;
    const avgHoldMinutes = tradeCount > 0 ? Math.round(totalHoldMs / tradeCount / 60_000) : 0;
    const profitFactor = grossLoss > 0 ? Math.round((grossProfit / grossLoss) * 100) / 100 : grossProfit > 0 ? Infinity : 0;

    return {
        sessionId: `session_${index + 1}`,
        startTime,
        endTime,
        durationMinutes,
        tradeCount,
        wins,
        losses,
        breakeven,
        winRate,
        netPnl: Math.round(netPnl * 100) / 100,
        grossProfit: Math.round(grossProfit * 100) / 100,
        grossLoss: Math.round(grossLoss * 100) / 100,
        profitFactor,
        avgHoldMinutes,
        bestTrade,
        worstTrade,
        symbols: [...symbolSet],
        avgSize: tradeCount > 0 ? Math.round((totalSize / tradeCount) * 100) / 100 : 0,
    };
}
