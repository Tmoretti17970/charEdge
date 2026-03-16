// ═══════════════════════════════════════════════════════════════════
// charEdge — Psychology Engine v2 (Sprint 5)
//
// Behavioral pattern detection for live trading.
// Detects FOMO, tilt, averaging down, overtrading, and
// maps session energy curves. Runs in-browser, zero deps.
//
// Usage:
//   import { psychologyEngine } from './PsychologyEngine.js';
//   const result = psychologyEngine.analyze(trades, candles);
//   // result.alerts, result.sessionCurve, result.riskLevel
// ═══════════════════════════════════════════════════════════════════

// ─── Alert Types ────────────────────────────────────────────────

/**
 * @typedef {'fomo'|'tilt'|'averaging_down'|'overtrading'|'fatigue'} AlertType
 *
 * @typedef {Object} BehavioralAlert
 * @property {AlertType} type
 * @property {'low'|'mid'|'high'} severity
 * @property {string} icon
 * @property {string} title
 * @property {string} message
 * @property {number} timestamp
 */

/**
 * @typedef {Object} SessionQuality
 * @property {number} hour - Hour of day (0-23)
 * @property {number} quality - Score 0-1
 * @property {number} count - Number of trades in this hour
 */

// ─── Constants ──────────────────────────────────────────────────

const TILT_WINDOW_MS = 15 * 60 * 1000;     // 15 min
const FOMO_SPIKE_THRESHOLD = 0.02;          // 2% price spike
const FOMO_ENTRY_WINDOW_MS = 5 * 60 * 1000; // 5 min after spike
const OVERTRADE_WINDOW_MS = 60 * 60 * 1000; // 1 hour window
const OVERTRADE_MAX_TRADES = 8;             // Max trades per hour before alert
const TILT_RAPID_COUNT = 3;                 // 3 trades within tilt window
const FATIGUE_HOUR_START = 22;              // 10 PM local time
const FATIGUE_HOUR_END = 4;                 // 4 AM local time

// ─── Psychology Engine ──────────────────────────────────────────

class _PsychologyEngine {
    /**
     * Full behavioral analysis.
     *
     * @param {Array} trades - Array of trade objects { entryTime, exitTime, entryPrice, exitPrice, pnl, side, size, ... }
     * @param {Array} [candles] - Optional OHLCV candles for FOMO detection
     * @returns {{ alerts: Array, sessionCurve: Array, riskLevel: string, summary: string }}
     */
    analyze(trades, candles = []) {
        if (!trades || trades.length === 0) {
            return { alerts: [], sessionCurve: [], riskLevel: 'low', summary: 'No trades to analyze.' };
        }

        const alerts = [];

        // Run detectors
        alerts.push(...this.detectFOMO(trades, candles));
        alerts.push(...this.detectTilt(trades));
        alerts.push(...this.detectAveragingDown(trades));
        alerts.push(...this.detectOvertrading(trades));
        alerts.push(...this.detectFatigue(trades));

        // Session energy curve
        const sessionCurve = this.buildSessionCurve(trades);

        // Overall risk level
        const highAlerts = alerts.filter(a => a.severity === 'high').length;
        const midAlerts = alerts.filter(a => a.severity === 'mid').length;
        const riskLevel = highAlerts >= 2 ? 'high' : (highAlerts >= 1 || midAlerts >= 2) ? 'mid' : 'low';

        // Summary
        const summary = this._buildSummary(alerts, riskLevel);

        // Sort by severity
        const severityOrder = { high: 0, mid: 1, low: 2 };
        alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

        return { alerts, sessionCurve, riskLevel, summary };
    }

    // ─── FOMO Detector ──────────────────────────────────────────

    /**
     * Detect FOMO entries — trades placed immediately after large price moves.
     * @param {Array} trades
     * @param {Array} candles
     * @returns {Array}
     */
    detectFOMO(trades, candles) {
        const alerts = [];
        if (!candles || candles.length < 10) return alerts;

        for (const trade of trades) {
            const entryTime = trade.entryTime || trade.time;
            if (!entryTime) continue;

            // Find candles just before the entry
            const nearCandles = candles.filter(c => {
                const diff = entryTime - c.time;
                return diff >= 0 && diff <= FOMO_ENTRY_WINDOW_MS;
            });

            for (const candle of nearCandles) {
                const move = Math.abs(candle.close - candle.open) / (candle.open || 1);
                if (move >= FOMO_SPIKE_THRESHOLD) {
                    const direction = candle.close > candle.open ? 'bullish' : 'bearish';
                    alerts.push({
                        type: 'fomo',
                        severity: move > 0.05 ? 'high' : 'mid',
                        icon: '🏃',
                        title: 'FOMO Entry Detected',
                        message: `You entered after a ${(move * 100).toFixed(1)}% ${direction} spike — chasing price reduces edge`,
                        timestamp: entryTime,
                    });
                    break; // One alert per trade
                }
            }
        }

        return alerts;
    }

    // ─── Tilt Detector v2 ───────────────────────────────────────

    /**
     * Multi-factor tilt detection: rapid trades + after losses + increasing size.
     * @param {Array} trades
     * @returns {Array}
     */
    detectTilt(trades) {
        const alerts = [];
        const sorted = [...trades].sort((a, b) => (a.entryTime || a.time || 0) - (b.entryTime || b.time || 0));

        for (let i = 1; i < sorted.length; i++) {
            const current = sorted[i];
            const currentTime = current.entryTime || current.time || 0;

            // Find recent trades within tilt window
            const recentLosses = [];
            let rapidCount = 0;
            let sizeIncreasing = false;

            for (let j = i - 1; j >= 0; j--) {
                const prev = sorted[j];
                const prevTime = prev.exitTime || prev.entryTime || prev.time || 0;
                if (currentTime - prevTime > TILT_WINDOW_MS) break;

                rapidCount++;
                if ((prev.pnl || 0) < 0) recentLosses.push(prev);

                // Check if current trade size > previous
                if (j === i - 1 && current.size && prev.size && current.size > prev.size * 1.2) {
                    sizeIncreasing = true;
                }
            }

            // Multi-factor tilt: rapid trades after losses
            if (rapidCount >= TILT_RAPID_COUNT && recentLosses.length >= 2) {
                const totalLoss = recentLosses.reduce((s, t) => s + (t.pnl || 0), 0);
                alerts.push({
                    type: 'tilt',
                    severity: sizeIncreasing ? 'high' : 'mid',
                    icon: '🔴',
                    title: 'Tilt Detected',
                    message: `${rapidCount} trades in ${TILT_WINDOW_MS / 60000}min after ${recentLosses.length} losses ($${Math.abs(totalLoss).toFixed(2)})${sizeIncreasing ? ' — with increasing size' : ''}`,
                    timestamp: currentTime,
                });
            }
        }

        return alerts;
    }

    // ─── Averaging Down Detector ────────────────────────────────

    /**
     * Detect averaging-down behavior: adding to losing positions.
     * @param {Array} trades
     * @returns {Array}
     */
    detectAveragingDown(trades) {
        const alerts = [];
        const sorted = [...trades].sort((a, b) => (a.entryTime || a.time || 0) - (b.entryTime || b.time || 0));

        // Group by symbol
        const openBySymbol = {};
        for (const trade of sorted) {
            const sym = trade.symbol || trade.pair || 'unknown';
            if (!openBySymbol[sym]) openBySymbol[sym] = [];

            // Check if this is adding to a losing position
            const existing = openBySymbol[sym];
            if (existing.length > 0) {
                const avgEntry = existing.reduce((s, t) => s + (t.entryPrice || 0), 0) / existing.length;
                const currentEntry = trade.entryPrice || 0;
                const isLong = trade.side === 'buy' || trade.side === 'long';

                // Adding below avg entry for longs, or above for shorts
                if ((isLong && currentEntry < avgEntry * 0.98) || (!isLong && currentEntry > avgEntry * 1.02)) {
                    const drop = Math.abs(currentEntry - avgEntry) / (avgEntry || 1);
                    alerts.push({
                        type: 'averaging_down',
                        severity: drop > 0.05 ? 'high' : 'mid',
                        icon: '⬇️',
                        title: 'Averaging Down',
                        message: `Added to ${sym} position ${(drop * 100).toFixed(1)}% ${isLong ? 'below' : 'above'} avg entry — increases exposure to a losing trade`,
                        timestamp: trade.entryTime || trade.time,
                    });
                }
            }

            existing.push(trade);
        }

        return alerts;
    }

    // ─── Overtrading Detector ───────────────────────────────────

    /**
     * Detect overtrading: too many trades in a short window.
     * @param {Array} trades
     * @returns {Array}
     */
    detectOvertrading(trades) {
        const alerts = [];
        const times = trades.map(t => t.entryTime || t.time || 0).sort((a, b) => a - b);

        for (let i = 0; i < times.length; i++) {
            const windowEnd = times[i] + OVERTRADE_WINDOW_MS;
            let count = 0;
            for (let j = i; j < times.length && times[j] <= windowEnd; j++) {
                count++;
            }

            if (count >= OVERTRADE_MAX_TRADES) {
                alerts.push({
                    type: 'overtrading',
                    severity: count >= OVERTRADE_MAX_TRADES * 1.5 ? 'high' : 'mid',
                    icon: '⚡',
                    title: 'Overtrading',
                    message: `${count} trades in 1 hour — high-frequency trading erodes edge and increases commission drag`,
                    timestamp: times[i],
                });
                // Skip ahead to avoid duplicate alerts
                while (i < times.length - 1 && times[i + 1] <= windowEnd) i++;
            }
        }

        return alerts;
    }

    // ─── Fatigue Detector ───────────────────────────────────────

    /**
     * Detect late-night trading (fatigue risk).
     * @param {Array} trades
     * @returns {Array}
     */
    detectFatigue(trades) {
        const alerts = [];
        const lateTrades = [];

        for (const trade of trades) {
            const time = trade.entryTime || trade.time;
            if (!time) continue;
            const hour = new Date(time).getHours();
            if (hour >= FATIGUE_HOUR_START || hour < FATIGUE_HOUR_END) {
                lateTrades.push(trade);
            }
        }

        if (lateTrades.length >= 3) {
            const totalPnl = lateTrades.reduce((s, t) => s + (t.pnl || 0), 0);
            alerts.push({
                type: 'fatigue',
                severity: lateTrades.length >= 5 ? 'high' : 'low',
                icon: '😴',
                title: 'Late Night Trading',
                message: `${lateTrades.length} trades between 10PM–4AM (P&L: $${totalPnl.toFixed(2)}) — decision quality drops with fatigue`,
                timestamp: Date.now(),
            });
        }

        return alerts;
    }

    // ─── Session Energy Curve ───────────────────────────────────

    /**
     * Build session quality curve by hour of day.
     * @param {Array} trades
     * @returns {Array<{hour: number, quality: number, count: number}>}
     */
    buildSessionCurve(trades) {
        const hourBuckets = {};
        for (let h = 0; h < 24; h++) {
            hourBuckets[h] = { wins: 0, count: 0, totalPnl: 0 };
        }

        for (const trade of trades) {
            const time = trade.entryTime || trade.time;
            if (!time) continue;
            const hour = new Date(time).getHours();
            const bucket = hourBuckets[hour];
            bucket.count++;
            bucket.totalPnl += trade.pnl || 0;
            if ((trade.pnl || 0) > 0) bucket.wins++;
        }

        return Array.from({ length: 24 }, (_, h) => {
            const b = hourBuckets[h];
            const winRate = b.count > 0 ? b.wins / b.count : 0;
            const avgR = b.count > 0 ? b.totalPnl / b.count : 0;
            // Quality = normalized(winRate × sign(avgR))
            const quality = b.count >= 2 ? winRate * (avgR >= 0 ? 1 : 0.5) : 0;
            return { hour: h, quality: Math.round(quality * 100) / 100, count: b.count };
        });
    }

    // ─── Helpers ─────────────────────────────────────────────────

    _buildSummary(alerts, riskLevel) {
        if (alerts.length === 0) return '✅ No behavioral issues detected — clean session.';
        const counts = {};
        for (const a of alerts) {
            counts[a.type] = (counts[a.type] || 0) + 1;
        }
        const parts = Object.entries(counts).map(([type, count]) => `${count} ${type.replace('_', ' ')}`);
        const riskEmoji = riskLevel === 'high' ? '🔴' : riskLevel === 'mid' ? '🟡' : '🟢';
        return `${riskEmoji} ${alerts.length} behavioral alerts: ${parts.join(', ')}`;
    }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const psychologyEngine = new _PsychologyEngine();
export { _PsychologyEngine as PsychologyEngine };
export default psychologyEngine;
