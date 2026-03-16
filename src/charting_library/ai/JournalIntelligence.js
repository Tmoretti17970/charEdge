// ═══════════════════════════════════════════════════════════════════
// charEdge — Journal Intelligence (Sprint 10)
//
// AI-powered trade journaling: auto-tagging, comparisons,
// similar trade finder, weekly digest, and streak analysis.
//
// Usage:
//   import { journalIntelligence } from './JournalIntelligence.js';
//   const tags = journalIntelligence.autoTag(trade, features);
//   const digest = journalIntelligence.weeklyDigest(trades);
// ═══════════════════════════════════════════════════════════════════

// ─── Constants ──────────────────────────────────────────────────

const SETUP_TYPES = ['breakout', 'reversal', 'continuation', 'range', 'momentum', 'mean_reversion'];
const QUALITY_GRADES = ['A', 'B', 'C', 'D'];

// ─── Journal Intelligence ───────────────────────────────────────

class _JournalIntelligence {

    // ─── Auto-Tag ───────────────────────────────────────────────

    /**
     * Auto-assign tags to a trade based on market context.
     *
     * @param {Object} trade — { entryPrice, exitPrice, pnl, side, date, symbol, entryTime, exitTime, ... }
     * @param {Object} [features] — Optional FeatureExtractor output at entry time
     * @returns {{ setupType: string, quality: string, emotion: string, regime: string, tags: string[] }}
     */
    autoTag(trade, features = {}) {
        const tags = [];

        // ── Setup Type ──────────────────────────────────────────
        let setupType = 'unknown';
        const rsi = features.rsi || 50;
        const trendStrength = features.trendStrength || 0;
        const volumeRatio = features.volumeRatio || 1;

        if (Math.abs(trendStrength) > 0.6 && volumeRatio > 1.5) {
            setupType = 'breakout';
            tags.push('📊 Breakout');
        } else if (rsi < 30 || rsi > 70) {
            setupType = 'reversal';
            tags.push('🔄 Reversal');
        } else if (Math.abs(trendStrength) > 0.3) {
            setupType = 'continuation';
            tags.push('➡️ Continuation');
        } else if (Math.abs(trendStrength) < 0.15) {
            setupType = 'range';
            tags.push('📐 Range');
        } else {
            setupType = 'momentum';
            tags.push('🚀 Momentum');
        }

        // ── Quality Grade ───────────────────────────────────────
        let qualityScore = 0;

        // Volume confirmation
        if (volumeRatio > 1.3) qualityScore += 25;
        // Trend alignment
        const isLong = trade.side === 'buy' || trade.side === 'long';
        if ((isLong && trendStrength > 0.3) || (!isLong && trendStrength < -0.3)) qualityScore += 25;
        // RSI not extreme (not chasing)
        if (rsi > 25 && rsi < 75) qualityScore += 25;
        // Profitable
        if ((trade.pnl || 0) > 0) qualityScore += 25;

        const quality = qualityScore >= 75 ? 'A' : qualityScore >= 50 ? 'B' : qualityScore >= 25 ? 'C' : 'D';

        // ── Emotion Inference ───────────────────────────────────
        let emotion = 'neutral';
        const hour = trade.entryTime ? new Date(trade.entryTime).getHours() : -1;

        if (hour >= 22 || (hour >= 0 && hour < 4)) {
            emotion = 'fatigue';
            tags.push('😴 Late night');
        } else if (volumeRatio > 2.5 && rsi > 70) {
            emotion = 'fomo';
            tags.push('🏃 FOMO entry');
        }

        // ── Regime ──────────────────────────────────────────────
        const atrExpansion = features.atrExpansion || 1;
        let regime = 'normal';
        if (atrExpansion > 1.5) {
            regime = 'volatile';
            tags.push('🌊 Volatile');
        } else if (atrExpansion < 0.7) {
            regime = 'quiet';
            tags.push('🧊 Quiet');
        } else if (Math.abs(trendStrength) > 0.5) {
            regime = 'trending';
            tags.push('📈 Trending');
        }

        return { setupType, quality, emotion, regime, tags };
    }

    // ─── Compare Trades ─────────────────────────────────────────

    /**
     * Side-by-side trade comparison with narrative.
     *
     * @param {Object} tradeA
     * @param {Object} tradeB
     * @returns {{ comparison: Object, narrative: string }}
     */
    compareTrades(tradeA, tradeB) {
        const metrics = {
            pnl: { a: tradeA.pnl || 0, b: tradeB.pnl || 0 },
            holdTime: {
                a: this._holdTimeMinutes(tradeA),
                b: this._holdTimeMinutes(tradeB),
            },
            rr: {
                a: this._estimateRR(tradeA),
                b: this._estimateRR(tradeB),
            },
        };

        // Build narrative
        const parts = [];
        if (metrics.pnl.a > metrics.pnl.b) {
            parts.push(`Trade A was ${metrics.pnl.a > 0 ? 'more profitable' : 'less costly'} ($${metrics.pnl.a.toFixed(2)} vs $${metrics.pnl.b.toFixed(2)}).`);
        } else {
            parts.push(`Trade B performed better ($${metrics.pnl.b.toFixed(2)} vs $${metrics.pnl.a.toFixed(2)}).`);
        }

        if (Math.abs(metrics.holdTime.a - metrics.holdTime.b) > 30) {
            const longer = metrics.holdTime.a > metrics.holdTime.b ? 'A' : 'B';
            parts.push(`Trade ${longer} was held ${Math.abs(metrics.holdTime.a - metrics.holdTime.b).toFixed(0)}min longer.`);
        }

        if (metrics.rr.a !== metrics.rr.b) {
            const better = metrics.rr.a > metrics.rr.b ? 'A' : 'B';
            parts.push(`Trade ${better} had a better risk-reward ratio.`);
        }

        return { comparison: metrics, narrative: parts.join(' ') };
    }

    // ─── Find Similar ───────────────────────────────────────────

    /**
     * Find past trades with a similar setup.
     *
     * @param {Object} trade — target trade
     * @param {Array} allTrades — historical trades
     * @param {number} [maxResults=5]
     * @returns {Array} Similar trades sorted by similarity
     */
    findSimilar(trade, allTrades, maxResults = 5) {
        if (!allTrades || allTrades.length < 2) return [];

        const target = {
            symbol: (trade.symbol || '').toUpperCase(),
            side: trade.side || '',
            pnl: trade.pnl || 0,
            holdMinutes: this._holdTimeMinutes(trade),
        };

        const scored = allTrades
            .filter(t => t !== trade && t.id !== trade.id)
            .map(t => {
                let similarity = 0;
                // Same symbol
                if ((t.symbol || '').toUpperCase() === target.symbol) similarity += 3;
                // Same side
                if (t.side === target.side) similarity += 2;
                // Similar hold time (within 2×)
                const hm = this._holdTimeMinutes(t);
                if (hm > 0 && target.holdMinutes > 0) {
                    const ratio = Math.min(hm, target.holdMinutes) / Math.max(hm, target.holdMinutes);
                    similarity += ratio * 2;
                }
                // Similar outcome direction
                if ((t.pnl || 0) > 0 === target.pnl > 0) similarity += 1;

                return { trade: t, similarity };
            })
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, maxResults);

        return scored;
    }

    // ─── Weekly Digest ──────────────────────────────────────────

    /**
     * Enhanced weekly report with pattern → outcome correlations.
     *
     * @param {Array} trades — all trades
     * @returns {Object} Weekly digest
     */
    weeklyDigest(trades) {
        if (!trades || trades.length === 0) {
            return { tradeCount: 0, narrative: 'No trades to analyze.', sections: [] };
        }

        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const weekTrades = trades.filter(t => t.date && new Date(t.date) >= weekAgo);

        if (weekTrades.length === 0) {
            return { tradeCount: 0, narrative: 'No trades this week.', sections: [] };
        }

        const sections = [];

        // ── Consistency ─────────────────────────────────────────
        const dailyBuckets = {};
        for (const t of weekTrades) {
            const day = (t.date || '').slice(0, 10);
            if (!dailyBuckets[day]) dailyBuckets[day] = [];
            dailyBuckets[day].push(t);
        }
        const activeDays = Object.keys(dailyBuckets).length;
        const avgTradesPerDay = weekTrades.length / Math.max(activeDays, 1);

        sections.push({
            title: 'Consistency',
            icon: '📅',
            items: [
                `Traded ${activeDays} of 7 days`,
                `Avg ${avgTradesPerDay.toFixed(1)} trades/day`,
                avgTradesPerDay > 8 ? '⚠️ Possible overtrading' : '✅ Healthy frequency',
            ],
        });

        // ── Best/Worst ──────────────────────────────────────────
        const sorted = [...weekTrades].sort((a, b) => (b.pnl || 0) - (a.pnl || 0));
        const best = sorted[0];
        const worst = sorted[sorted.length - 1];

        sections.push({
            title: 'Highlights',
            icon: '⭐',
            items: [
                `Best: ${best.symbol || '?'} ${(best.side || '').toUpperCase()} → $${(best.pnl || 0).toFixed(2)}`,
                `Worst: ${worst.symbol || '?'} ${(worst.side || '').toUpperCase()} → $${(worst.pnl || 0).toFixed(2)}`,
            ],
        });

        // ── Setup Analysis ──────────────────────────────────────
        const bySetup = {};
        for (const t of weekTrades) {
            const setup = t.setup || t.tags?.[0] || 'untagged';
            if (!bySetup[setup]) bySetup[setup] = { count: 0, pnl: 0, wins: 0 };
            bySetup[setup].count++;
            bySetup[setup].pnl += t.pnl || 0;
            if ((t.pnl || 0) > 0) bySetup[setup].wins++;
        }

        const setupItems = Object.entries(bySetup)
            .sort(([, a], [, b]) => b.pnl - a.pnl)
            .slice(0, 3)
            .map(([name, data]) => {
                const wr = data.count > 0 ? ((data.wins / data.count) * 100).toFixed(0) : '0';
                return `${name}: ${data.count} trades, ${wr}% WR, $${data.pnl.toFixed(2)}`;
            });

        if (setupItems.length > 0) {
            sections.push({ title: 'Setup Breakdown', icon: '📊', items: setupItems });
        }

        // ── Streak Analysis ─────────────────────────────────────
        const streaks = this._analyzeStreaks(weekTrades);
        if (streaks.maxWin >= 3 || streaks.maxLoss >= 3) {
            sections.push({
                title: 'Streaks',
                icon: '🔥',
                items: [
                    streaks.maxWin >= 3 ? `🔥 ${streaks.maxWin}-win streak` : null,
                    streaks.maxLoss >= 3 ? `❄️ ${streaks.maxLoss}-loss streak` : null,
                ].filter(Boolean),
            });
        }

        // Build narrative
        const netPnl = weekTrades.reduce((s, t) => s + (t.pnl || 0), 0);
        const winRate = weekTrades.length > 0
            ? ((weekTrades.filter(t => (t.pnl || 0) > 0).length / weekTrades.length) * 100).toFixed(0)
            : 0;
        const narrative = `This week: ${weekTrades.length} trades, ${winRate}% win rate, $${netPnl.toFixed(2)} P&L across ${activeDays} days.`;

        return {
            tradeCount: weekTrades.length,
            netPnl: Math.round(netPnl * 100) / 100,
            winRate: Number(winRate),
            activeDays,
            narrative,
            sections,
        };
    }

    // ─── Streak Analysis ────────────────────────────────────────

    /**
     * Detect and analyze winning/losing streaks.
     *
     * @param {Array} trades
     * @returns {{ maxWin: number, maxLoss: number, currentStreak: number }}
     */
    _analyzeStreaks(trades) {
        let maxWin = 0, maxLoss = 0, currentWin = 0, currentLoss = 0;
        const sorted = [...trades].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

        for (const t of sorted) {
            if ((t.pnl || 0) > 0) {
                currentWin++;
                currentLoss = 0;
                maxWin = Math.max(maxWin, currentWin);
            } else {
                currentLoss++;
                currentWin = 0;
                maxLoss = Math.max(maxLoss, currentLoss);
            }
        }

        const lastPnl = sorted.length > 0 ? (sorted[sorted.length - 1].pnl || 0) : 0;
        const currentStreak = lastPnl > 0 ? currentWin : -currentLoss;

        return { maxWin, maxLoss, currentStreak };
    }

    // ─── Helpers ─────────────────────────────────────────────────

    _holdTimeMinutes(trade) {
        if (trade.entryTime && trade.exitTime) {
            return (new Date(trade.exitTime) - new Date(trade.entryTime)) / 60000;
        }
        return trade.barsHeld ? trade.barsHeld * 5 : 0; // Estimate 5min per bar
    }

    _estimateRR(trade) {
        if (!trade.entryPrice || !trade.exitPrice) return 0;
        const move = Math.abs(trade.exitPrice - trade.entryPrice);
        const risk = trade.stopLoss ? Math.abs(trade.entryPrice - trade.stopLoss) : move;
        return risk > 0 ? move / risk : 0;
    }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const journalIntelligence = new _JournalIntelligence();
export { _JournalIntelligence as JournalIntelligence };
export default journalIntelligence;
