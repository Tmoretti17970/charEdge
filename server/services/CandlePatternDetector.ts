// ═══════════════════════════════════════════════════════════════════
// charEdge — Candlestick Pattern Detector (Phase D3)
//
// Server-side candlestick pattern recognition from OHLC bar data.
// Pure-function rules — no external dependencies.
//
// Patterns detected:
//   Bullish:  engulfing, hammer, morning_star, three_white_soldiers,
//             dragonfly_doji, inverted_hammer
//   Bearish:  engulfing, evening_star, three_black_crows
//   Neutral:  doji
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export interface Bar {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    time: number;
}

export type CandlePattern =
    | 'bullish_engulfing' | 'bearish_engulfing'
    | 'hammer' | 'inverted_hammer'
    | 'doji' | 'dragonfly_doji'
    | 'morning_star' | 'evening_star'
    | 'three_white_soldiers' | 'three_black_crows';

export interface PatternMatch {
    pattern: CandlePattern;
    direction: 'bullish' | 'bearish' | 'neutral';
    confidence: number;    // 0–1
    barIndex: number;      // Index of the completion bar
    description: string;
}

// ─── Helpers ────────────────────────────────────────────────────

function body(bar: Bar): number {
    return Math.abs(bar.close - bar.open);
}

function range(bar: Bar): number {
    return bar.high - bar.low || 0.0001; // Avoid division by zero
}

function isBullish(bar: Bar): boolean {
    return bar.close > bar.open;
}

function isBearish(bar: Bar): boolean {
    return bar.close < bar.open;
}

function upperWick(bar: Bar): number {
    return bar.high - Math.max(bar.open, bar.close);
}

function lowerWick(bar: Bar): number {
    return Math.min(bar.open, bar.close) - bar.low;
}

function bodyRatio(bar: Bar): number {
    return body(bar) / range(bar);
}

// ─── Pattern Rules ──────────────────────────────────────────────

function detectDoji(bars: Bar[], i: number): PatternMatch | null {
    const bar = bars[i];
    if (!bar) return null;
    if (bodyRatio(bar) < 0.1 && range(bar) > 0) {
        return {
            pattern: 'doji',
            direction: 'neutral',
            confidence: 0.6 + (0.1 - bodyRatio(bar)) * 3,
            barIndex: i,
            description: 'Doji — indecision candle, potential reversal',
        };
    }
    return null;
}

function detectDragonflyDoji(bars: Bar[], i: number): PatternMatch | null {
    const bar = bars[i];
    if (!bar) return null;
    const bRatio = bodyRatio(bar);
    const lwRatio = lowerWick(bar) / range(bar);
    const uwRatio = upperWick(bar) / range(bar);
    if (bRatio < 0.1 && lwRatio > 0.6 && uwRatio < 0.1) {
        return {
            pattern: 'dragonfly_doji',
            direction: 'bullish',
            confidence: 0.65,
            barIndex: i,
            description: 'Dragonfly Doji — bullish reversal signal at support',
        };
    }
    return null;
}

function detectHammer(bars: Bar[], i: number): PatternMatch | null {
    if (i < 1) return null;
    const bar = bars[i];
    const prev = bars[i - 1];
    if (!bar || !prev) return null;
    const lwRatio = lowerWick(bar) / range(bar);
    const bRatio = bodyRatio(bar);
    // Hammer: small body at top, long lower wick, preceded by bearish candle
    if (bRatio < 0.35 && lwRatio > 0.55 && isBearish(prev)) {
        return {
            pattern: 'hammer',
            direction: 'bullish',
            confidence: 0.7,
            barIndex: i,
            description: 'Hammer — bullish reversal after downtrend',
        };
    }
    return null;
}

function detectInvertedHammer(bars: Bar[], i: number): PatternMatch | null {
    if (i < 1) return null;
    const bar = bars[i];
    const prev = bars[i - 1];
    if (!bar || !prev) return null;
    const uwRatio = upperWick(bar) / range(bar);
    const bRatio = bodyRatio(bar);
    if (bRatio < 0.35 && uwRatio > 0.55 && isBearish(prev)) {
        return {
            pattern: 'inverted_hammer',
            direction: 'bullish',
            confidence: 0.6,
            barIndex: i,
            description: 'Inverted Hammer — potential bullish reversal',
        };
    }
    return null;
}

function detectBullishEngulfing(bars: Bar[], i: number): PatternMatch | null {
    if (i < 1) return null;
    const curr = bars[i];
    const prev = bars[i - 1];
    if (!curr || !prev) return null;
    if (isBullish(curr) && isBearish(prev)
        && curr.open <= prev.close && curr.close >= prev.open
        && body(curr) > body(prev)) {
        return {
            pattern: 'bullish_engulfing',
            direction: 'bullish',
            confidence: 0.75,
            barIndex: i,
            description: 'Bullish Engulfing — strong reversal signal',
        };
    }
    return null;
}

function detectBearishEngulfing(bars: Bar[], i: number): PatternMatch | null {
    if (i < 1) return null;
    const curr = bars[i];
    const prev = bars[i - 1];
    if (!curr || !prev) return null;
    if (isBearish(curr) && isBullish(prev)
        && curr.open >= prev.close && curr.close <= prev.open
        && body(curr) > body(prev)) {
        return {
            pattern: 'bearish_engulfing',
            direction: 'bearish',
            confidence: 0.75,
            barIndex: i,
            description: 'Bearish Engulfing — strong reverish signal',
        };
    }
    return null;
}

function detectMorningStar(bars: Bar[], i: number): PatternMatch | null {
    if (i < 2) return null;
    const first = bars[i - 2];
    const second = bars[i - 1];
    const third = bars[i];
    if (!first || !second || !third) return null;
    // 1st: bearish, 2nd: small body (gap down), 3rd: bullish closing into 1st's body
    if (isBearish(first) && bodyRatio(second) < 0.3 && isBullish(third)
        && third.close > (first.open + first.close) / 2) {
        return {
            pattern: 'morning_star',
            direction: 'bullish',
            confidence: 0.8,
            barIndex: i,
            description: 'Morning Star — 3-bar bullish reversal pattern',
        };
    }
    return null;
}

function detectEveningStar(bars: Bar[], i: number): PatternMatch | null {
    if (i < 2) return null;
    const first = bars[i - 2];
    const second = bars[i - 1];
    const third = bars[i];
    if (!first || !second || !third) return null;
    if (isBullish(first) && bodyRatio(second) < 0.3 && isBearish(third)
        && third.close < (first.open + first.close) / 2) {
        return {
            pattern: 'evening_star',
            direction: 'bearish',
            confidence: 0.8,
            barIndex: i,
            description: 'Evening Star — 3-bar bearish reversal pattern',
        };
    }
    return null;
}

function detectThreeWhiteSoldiers(bars: Bar[], i: number): PatternMatch | null {
    if (i < 2) return null;
    const a = bars[i - 2];
    const b = bars[i - 1];
    const c = bars[i];
    if (!a || !b || !c) return null;
    if (isBullish(a) && isBullish(b) && isBullish(c)
        && b.close > a.close && c.close > b.close
        && body(a) > range(a) * 0.5 && body(b) > range(b) * 0.5 && body(c) > range(c) * 0.5) {
        return {
            pattern: 'three_white_soldiers',
            direction: 'bullish',
            confidence: 0.85,
            barIndex: i,
            description: 'Three White Soldiers — strong bullish continuation',
        };
    }
    return null;
}

function detectThreeBlackCrows(bars: Bar[], i: number): PatternMatch | null {
    if (i < 2) return null;
    const a = bars[i - 2];
    const b = bars[i - 1];
    const c = bars[i];
    if (!a || !b || !c) return null;
    if (isBearish(a) && isBearish(b) && isBearish(c)
        && b.close < a.close && c.close < b.close
        && body(a) > range(a) * 0.5 && body(b) > range(b) * 0.5 && body(c) > range(c) * 0.5) {
        return {
            pattern: 'three_black_crows',
            direction: 'bearish',
            confidence: 0.85,
            barIndex: i,
            description: 'Three Black Crows — strong bearish continuation',
        };
    }
    return null;
}

// ─── All Rules ──────────────────────────────────────────────────

const ALL_PATTERN_RULES = [
    detectDoji,
    detectDragonflyDoji,
    detectHammer,
    detectInvertedHammer,
    detectBullishEngulfing,
    detectBearishEngulfing,
    detectMorningStar,
    detectEveningStar,
    detectThreeWhiteSoldiers,
    detectThreeBlackCrows,
];

// ─── Detector Class ─────────────────────────────────────────────

export class CandlePatternDetector {
    /**
     * Detect all patterns in a bar array.
     * Scans only the last few bars (lookback = 3) for efficiency.
     */
    detect(bars: Bar[], lookback = 3): PatternMatch[] {
        if (!bars || bars.length < 2) return [];

        const matches: PatternMatch[] = [];
        const startIdx = Math.max(0, bars.length - lookback);

        for (let i = startIdx; i < bars.length; i++) {
            for (const rule of ALL_PATTERN_RULES) {
                const match = rule(bars, i);
                if (match) matches.push(match);
            }
        }

        // Sort by confidence descending
        matches.sort((a, b) => b.confidence - a.confidence);
        return matches;
    }

    /**
     * Detect patterns only on the most recent (last) bar.
     */
    detectLatest(bars: Bar[]): PatternMatch[] {
        return this.detect(bars, 1);
    }
}

export default CandlePatternDetector;
