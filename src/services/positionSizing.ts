// ═══════════════════════════════════════════════════════════════════
// charEdge — Position Sizing Calculators
//
// Three industry-standard position sizing algorithms:
//   1. Kelly Criterion — mathematically optimal, aggressive
//   2. Fixed-Fractional — risk X% of equity per trade
//   3. ATR-Based — volatility-adjusted sizing
// ═══════════════════════════════════════════════════════════════════

export interface KellyInput {
    winRate: number;       // 0-1 (e.g., 0.55 = 55%)
    avgWin: number;        // average winning trade P&L
    avgLoss: number;       // average losing trade P&L (positive number)
    /** Use half-Kelly for conservative sizing (default: true) */
    halfKelly?: boolean;
}

export interface FixedFractionalInput {
    equity: number;        // current account equity
    riskPercent: number;   // max risk per trade (e.g., 1 = 1%)
    stopLossDistance: number; // distance to stop loss in price
    pricePerUnit: number;  // price per 1 unit of the instrument
}

export interface AtrInput {
    equity: number;        // current account equity
    riskPercent: number;   // max risk per trade (e.g., 1 = 1%)
    atr: number;           // current ATR value
    atrMultiplier?: number; // stop distance = ATR × multiplier (default: 2)
    pricePerUnit: number;  // price per 1 unit
}

export interface SizingResult {
    method: string;
    positionSize: number;
    riskAmount: number;
    riskPercent: number;
    details: Record<string, number>;
}

/**
 * Kelly Criterion: mathematically optimal fraction of equity to risk.
 *
 * Formula: f* = (bp - q) / b
 *   where b = avgWin/avgLoss, p = winRate, q = 1-winRate
 *
 * Half-Kelly is strongly recommended for real trading.
 */
export function kellySize(input: KellyInput): SizingResult {
    const { winRate, avgWin, avgLoss, halfKelly = true } = input;

    if (winRate <= 0 || winRate >= 1 || avgWin <= 0 || avgLoss <= 0) {
        return {
            method: 'kelly',
            positionSize: 0,
            riskAmount: 0,
            riskPercent: 0,
            details: { kellyFraction: 0, edge: 0 },
        };
    }

    const b = avgWin / avgLoss; // win/loss ratio
    const p = winRate;
    const q = 1 - p;

    // Kelly formula: f* = (bp - q) / b
    let kellyFraction = (b * p - q) / b;

    // Negative Kelly = no edge, don't trade
    if (kellyFraction <= 0) {
        return {
            method: 'kelly',
            positionSize: 0,
            riskAmount: 0,
            riskPercent: 0,
            details: { kellyFraction, edge: kellyFraction * 100 },
        };
    }

    if (halfKelly) {
        kellyFraction /= 2;
    }

    // Cap at 25% to prevent ruin
    kellyFraction = Math.min(kellyFraction, 0.25);

    return {
        method: halfKelly ? 'half-kelly' : 'kelly',
        positionSize: 0, // Caller applies to their equity
        riskAmount: 0,
        riskPercent: Math.round(kellyFraction * 10000) / 100,
        details: {
            kellyFraction: Math.round(kellyFraction * 10000) / 10000,
            fullKelly: halfKelly ? kellyFraction * 2 : kellyFraction,
            edge: Math.round((b * p - q) * 10000) / 100,
            winLossRatio: Math.round(b * 100) / 100,
        },
    };
}

/**
 * Fixed-Fractional: risk a fixed percentage of equity per trade.
 *
 * Position size = (equity × riskPercent) / stopLossDistance
 */
export function fixedFractionalSize(input: FixedFractionalInput): SizingResult {
    const { equity, riskPercent, stopLossDistance, pricePerUnit } = input;

    if (equity <= 0 || riskPercent <= 0 || stopLossDistance <= 0 || pricePerUnit <= 0) {
        return {
            method: 'fixed-fractional',
            positionSize: 0,
            riskAmount: 0,
            riskPercent: 0,
            details: {},
        };
    }

    const riskAmount = equity * (riskPercent / 100);
    const units = riskAmount / stopLossDistance;
    const positionSize = Math.floor(units * 1000) / 1000; // Round down to avoid over-sizing

    return {
        method: 'fixed-fractional',
        positionSize,
        riskAmount: Math.round(riskAmount * 100) / 100,
        riskPercent,
        details: {
            equity,
            stopLossDistance,
            positionValue: Math.round(positionSize * pricePerUnit * 100) / 100,
        },
    };
}

/**
 * ATR-Based: volatility-adjusted position sizing.
 *
 * Stop distance = ATR × multiplier
 * Position size = (equity × riskPercent) / stopDistance
 */
export function atrSize(input: AtrInput): SizingResult {
    const { equity, riskPercent, atr, atrMultiplier = 2, pricePerUnit } = input;

    if (equity <= 0 || riskPercent <= 0 || atr <= 0 || pricePerUnit <= 0) {
        return {
            method: 'atr',
            positionSize: 0,
            riskAmount: 0,
            riskPercent: 0,
            details: {},
        };
    }

    const stopDistance = atr * atrMultiplier;
    const riskAmount = equity * (riskPercent / 100);
    const units = riskAmount / stopDistance;
    const positionSize = Math.floor(units * 1000) / 1000;

    return {
        method: 'atr',
        positionSize,
        riskAmount: Math.round(riskAmount * 100) / 100,
        riskPercent,
        details: {
            atr,
            atrMultiplier,
            stopDistance: Math.round(stopDistance * 100) / 100,
            positionValue: Math.round(positionSize * pricePerUnit * 100) / 100,
        },
    };
}
