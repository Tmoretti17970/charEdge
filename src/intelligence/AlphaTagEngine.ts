// ═══════════════════════════════════════════════════════════════════
// charEdge — AlphaTagEngine (Task 4.1.11)
//
// Auto-tags trades with active indicator signals at entry time.
// Makes the journal queryable by market condition.
//
// Tags generated: rsi-oversold, rsi-overbought, macd-bullish-cross,
// macd-bearish-cross, above-vwap, below-vwap, bb-squeeze,
// bb-upper-touch, bb-lower-touch, volume-spike, trend-up, trend-down
//
// Usage:
//   import { alphaTagEngine } from './AlphaTagEngine';
//   const tags = alphaTagEngine.generateTags(indicators, bars);
//   // → ['rsi-oversold', 'macd-bullish-cross', 'above-vwap']
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

export interface IndicatorSignal {
    name: string;
    value: number | string;
    signal?: 'buy' | 'sell' | 'neutral';
}

export interface BarData {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    time?: number;
}

export interface TagResult {
    /** Generated tags */
    tags: string[];
    /** Detailed signal breakdown for each tag */
    signals: TagSignal[];
}

export interface TagSignal {
    tag: string;
    indicator: string;
    value: number | string;
    description: string;
}

export interface TagQueryResult {
    tag: string;
    tradeCount: number;
    winCount: number;
    lossCount: number;
    winRate: number;
    avgPnL: number;
    totalPnL: number;
}

// ─── Tag Rules ──────────────────────────────────────────────────

interface TagRule {
    tag: string;
    indicator: string;
    test: (value: number, bars: BarData[]) => boolean;
    description: (value: number) => string;
}

const TAG_RULES: TagRule[] = [
    // RSI
    {
        tag: 'rsi-oversold',
        indicator: 'RSI',
        test: (v) => v <= 30,
        description: (v) => `RSI at ${v.toFixed(0)} (oversold ≤30)`,
    },
    {
        tag: 'rsi-overbought',
        indicator: 'RSI',
        test: (v) => v >= 70,
        description: (v) => `RSI at ${v.toFixed(0)} (overbought ≥70)`,
    },
    {
        tag: 'rsi-neutral',
        indicator: 'RSI',
        test: (v) => v > 40 && v < 60,
        description: (v) => `RSI at ${v.toFixed(0)} (neutral zone)`,
    },

    // MACD — signal is the histogram value
    {
        tag: 'macd-bullish',
        indicator: 'MACD',
        test: (v) => v > 0,
        description: (v) => `MACD histogram positive (${v.toFixed(4)})`,
    },
    {
        tag: 'macd-bearish',
        indicator: 'MACD',
        test: (v) => v < 0,
        description: (v) => `MACD histogram negative (${v.toFixed(4)})`,
    },

    // Bollinger Bands — value is price position within bands (0 = lower, 1 = upper)
    {
        tag: 'bb-lower-touch',
        indicator: 'BB',
        test: (v) => v <= 0.05,
        description: (v) => `Price at lower Bollinger Band (${(v * 100).toFixed(0)}%)`,
    },
    {
        tag: 'bb-upper-touch',
        indicator: 'BB',
        test: (v) => v >= 0.95,
        description: (v) => `Price at upper Bollinger Band (${(v * 100).toFixed(0)}%)`,
    },
    {
        tag: 'bb-squeeze',
        indicator: 'BB',
        test: (v) => v >= 0.4 && v <= 0.6,
        description: () => `Price in BB squeeze zone`,
    },

    // VWAP
    {
        tag: 'above-vwap',
        indicator: 'VWAP',
        test: (v) => v > 0,
        description: (v) => `Price ${v.toFixed(2)} above VWAP`,
    },
    {
        tag: 'below-vwap',
        indicator: 'VWAP',
        test: (v) => v < 0,
        description: (v) => `Price ${Math.abs(v).toFixed(2)} below VWAP`,
    },

    // EMA trend
    {
        tag: 'trend-up',
        indicator: 'EMA',
        test: (v) => v > 0,
        description: (v) => `Price ${v.toFixed(2)}% above EMA`,
    },
    {
        tag: 'trend-down',
        indicator: 'EMA',
        test: (v) => v < 0,
        description: (v) => `Price ${Math.abs(v).toFixed(2)}% below EMA`,
    },
];

// ─── Engine ─────────────────────────────────────────────────────

export class AlphaTagEngine {
    /**
     * Generate tags from active indicator signals and bar data.
     * Returns deduplicated tag set with signal breakdowns.
     */
    generateTags(indicators: IndicatorSignal[], bars: BarData[]): TagResult {
        const tags: string[] = [];
        const signals: TagSignal[] = [];
        const seen = new Set<string>();

        // Process indicator-based rules
        for (const ind of indicators) {
            const numVal = typeof ind.value === 'number' ? ind.value : parseFloat(ind.value as string);
            if (isNaN(numVal)) continue;

            for (const rule of TAG_RULES) {
                if (rule.indicator !== ind.name) continue;
                if (seen.has(rule.tag)) continue;

                try {
                    if (rule.test(numVal, bars)) {
                        seen.add(rule.tag);
                        tags.push(rule.tag);
                        signals.push({
                            tag: rule.tag,
                            indicator: rule.indicator,
                            value: numVal,
                            description: rule.description(numVal),
                        });
                    }
                } catch {
                    // Skip rules that throw on invalid data
                }
            }
        }

        // Volume spike detection (from bars)
        if (bars.length >= 20) {
            const recent = bars.slice(-20);
            const avgVol = recent.reduce((sum, b) => sum + b.volume, 0) / recent.length;
            const lastVol = bars[bars.length - 1].volume;
            if (avgVol > 0 && lastVol / avgVol > 2.0 && !seen.has('volume-spike')) {
                const ratio = lastVol / avgVol;
                tags.push('volume-spike');
                signals.push({
                    tag: 'volume-spike',
                    indicator: 'Volume',
                    value: ratio,
                    description: `Volume ${ratio.toFixed(1)}x above 20-bar average`,
                });
            }
        }

        // Gap detection
        if (bars.length >= 2) {
            const prev = bars[bars.length - 2];
            const curr = bars[bars.length - 1];
            const gapPct = ((curr.open - prev.close) / prev.close) * 100;
            if (Math.abs(gapPct) > 0.5) {
                const tag = gapPct > 0 ? 'gap-up' : 'gap-down';
                if (!seen.has(tag)) {
                    tags.push(tag);
                    signals.push({
                        tag,
                        indicator: 'Price',
                        value: gapPct,
                        description: `${gapPct > 0 ? 'Gap up' : 'Gap down'} ${Math.abs(gapPct).toFixed(2)}%`,
                    });
                }
            }
        }

        return { tags, signals };
    }

    /**
     * Query trade history by tag and compute per-tag statistics.
     * trades should be objects with { tags: string[], pnl: number } at minimum.
     */
    queryByTag(
        trades: Array<{ tags: string[]; pnl: number }>,
        tag: string,
    ): TagQueryResult {
        const matching = trades.filter((t) => t.tags.includes(tag));
        const wins = matching.filter((t) => t.pnl > 0);
        const losses = matching.filter((t) => t.pnl <= 0);
        const totalPnL = matching.reduce((sum, t) => sum + t.pnl, 0);

        return {
            tag,
            tradeCount: matching.length,
            winCount: wins.length,
            lossCount: losses.length,
            winRate: matching.length > 0 ? round2((wins.length / matching.length) * 100) : 0,
            avgPnL: matching.length > 0 ? round2(totalPnL / matching.length) : 0,
            totalPnL: round2(totalPnL),
        };
    }

    /**
     * Get per-tag breakdown for all tags found across a set of trades.
     */
    getAllTagStats(trades: Array<{ tags: string[]; pnl: number }>): TagQueryResult[] {
        const allTags = new Set<string>();
        for (const t of trades) {
            for (const tag of t.tags) allTags.add(tag);
        }

        return Array.from(allTags)
            .map((tag) => this.queryByTag(trades, tag))
            .sort((a, b) => b.tradeCount - a.tradeCount);
    }
}

// ─── Helpers ─────────────────────────────────────────────────────

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

// ─── Singleton ───────────────────────────────────────────────────

export const alphaTagEngine = new AlphaTagEngine();
export default alphaTagEngine;
