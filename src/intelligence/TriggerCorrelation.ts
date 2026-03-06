// ═══════════════════════════════════════════════════════════════════
// charEdge — Trigger-Map Correlation Engine (Task 4.12.12)
//
// Correlates logged triggers × time-of-day × market volatility
// with loss trades. Surfaces top-3 trigger→loss patterns per week
// and predicts self-sabotage clusters.
//
// Input:  Array of trades with TradeSchema psychological fields
//         (triggers[], fomo, impulse, clarity, preMood, postMood)
// Output: TriggerCorrelationReport
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export type TimeOfDay = 'pre-market' | 'open' | 'midday' | 'afternoon' | 'close' | 'after-hours';

export interface TriggerPattern {
    /** The trigger string (e.g. "fatigue", "drawdown streak") */
    trigger: string;
    /** Number of times this trigger appeared with a loss */
    lossCount: number;
    /** Total times this trigger was logged */
    totalCount: number;
    /** Loss rate when this trigger is present */
    lossRate: number;
    /** Average P&L when this trigger is present */
    avgPnl: number;
    /** Total cost attributed to this trigger */
    totalCost: number;
    /** Most frequent time-of-day when this trigger → loss occurs */
    peakTimeOfDay: TimeOfDay;
    /** Severity: 'critical' | 'warning' | 'info' */
    severity: 'critical' | 'warning' | 'info';
}

export interface SabotageCluster {
    /** Time window label, e.g. "Tuesdays 2PM-4PM" */
    label: string;
    /** Triggers most active in this cluster */
    triggers: string[];
    /** Loss count in this cluster */
    lossCount: number;
    /** Confidence 0-1 */
    confidence: number;
    /** Recommendation */
    recommendation: string;
}

export interface TriggerCorrelationReport {
    /** Top trigger→loss patterns, sorted by total cost descending */
    topPatterns: TriggerPattern[];
    /** Predicted self-sabotage time clusters */
    clusters: SabotageCluster[];
    /** Overall score 0-100 (100 = no trigger-correlated losses) */
    triggerDisciplineScore: number;
    /** Number of trades analyzed */
    analyzedTrades: number;
    /** Number of trades with at least one trigger logged */
    tradesWithTriggers: number;
    /** Analysis period */
    period: { from: string; to: string };
}

// ─── Trade Input Shape ──────────────────────────────────────────

/** Minimal trade shape needed for trigger correlation */
export interface TradeLike {
    id: string;
    date: string;                    // ISO 8601
    pnl: number;
    triggers?: string[];
    fomo?: number | null;
    impulse?: number | null;
    clarity?: number | null;
    preMood?: number | null;
    postMood?: number | null;
    symbol?: string;
    tags?: string[];
}

// ─── Constants ──────────────────────────────────────────────────

const TIME_BUCKETS: { label: TimeOfDay; start: number; end: number }[] = [
    { label: 'pre-market', start: 0, end: 9 },
    { label: 'open', start: 9, end: 10 },
    { label: 'midday', start: 10, end: 12 },
    { label: 'afternoon', start: 12, end: 15 },
    { label: 'close', start: 15, end: 16 },
    { label: 'after-hours', start: 16, end: 24 },
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Helpers ────────────────────────────────────────────────────

function getTimeOfDay(date: Date): TimeOfDay {
    const hour = date.getHours();
    for (const bucket of TIME_BUCKETS) {
        if (hour >= bucket.start && hour < bucket.end) return bucket.label;
    }
    return 'after-hours';
}

function getDayOfWeek(date: Date): string {
    return DAY_NAMES[date.getDay()];
}

function deriveTriggers(trade: TradeLike): string[] {
    const triggers = [...(trade.triggers || [])];

    // Derive implicit triggers from psychological dimensions
    if (trade.fomo != null && trade.fomo >= 7) triggers.push('high-fomo');
    if (trade.impulse != null && trade.impulse >= 7) triggers.push('high-impulse');
    if (trade.clarity != null && trade.clarity <= 3) triggers.push('low-clarity');
    if (trade.preMood != null && trade.preMood <= 3) triggers.push('bad-mood');

    return [...new Set(triggers)]; // deduplicate
}

// ─── Engine ─────────────────────────────────────────────────────

export function analyzeTriggerCorrelation(
    trades: TradeLike[],
    options: { topN?: number } = {}
): TriggerCorrelationReport {
    const topN = options.topN ?? 3;

    if (trades.length === 0) {
        return {
            topPatterns: [],
            clusters: [],
            triggerDisciplineScore: 100,
            analyzedTrades: 0,
            tradesWithTriggers: 0,
            period: { from: '', to: '' },
        };
    }

    // Sort trades chronologically
    const sorted = [...trades].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const period = {
        from: sorted[0].date,
        to: sorted[sorted.length - 1].date,
    };

    // ─── Phase 1: Trigger → Loss Correlation ─────────────────
    const triggerStats = new Map<string, {
        lossCount: number;
        totalCount: number;
        totalPnl: number;
        timeBuckets: Map<TimeOfDay, number>;
    }>();

    let tradesWithTriggers = 0;

    for (const trade of sorted) {
        const triggers = deriveTriggers(trade);
        if (triggers.length === 0) continue;
        tradesWithTriggers++;

        const isLoss = trade.pnl < 0;
        const date = new Date(trade.date);
        const tod = getTimeOfDay(date);

        for (const trigger of triggers) {
            let stat = triggerStats.get(trigger);
            if (!stat) {
                stat = { lossCount: 0, totalCount: 0, totalPnl: 0, timeBuckets: new Map<TimeOfDay, number>() };
                triggerStats.set(trigger, stat);
            }

            stat.totalCount++;
            stat.totalPnl += trade.pnl;
            if (isLoss) {
                stat.lossCount++;
                stat.timeBuckets.set(tod, (stat.timeBuckets.get(tod) || 0) + 1);
            }
        }
    }

    // ─── Phase 2: Build Patterns ─────────────────────────────
    const patterns: TriggerPattern[] = [];

    for (const [trigger, stat] of triggerStats) {
        const lossRate = stat.totalCount > 0 ? stat.lossCount / stat.totalCount : 0;
        const avgPnl = stat.totalCount > 0 ? stat.totalPnl / stat.totalCount : 0;
        const totalCost = stat.totalPnl < 0 ? Math.abs(stat.totalPnl) : 0;

        // Find peak time-of-day for losses with this trigger
        let peakTod: TimeOfDay = 'midday';
        let peakCount = 0;
        for (const [tod, count] of stat.timeBuckets) {
            if (count > peakCount) {
                peakCount = count;
                peakTod = tod;
            }
        }

        const severity: TriggerPattern['severity'] =
            lossRate >= 0.7 ? 'critical' :
                lossRate >= 0.5 ? 'warning' : 'info';

        patterns.push({
            trigger,
            lossCount: stat.lossCount,
            totalCount: stat.totalCount,
            lossRate,
            avgPnl,
            totalCost,
            peakTimeOfDay: peakTod,
            severity,
        });
    }

    // Sort by total cost descending, take topN
    patterns.sort((a, b) => b.totalCost - a.totalCost);
    const topPatterns = patterns.slice(0, topN);

    // ─── Phase 3: Cluster Detection ──────────────────────────
    // Group losses by (day-of-week, time-of-day) and find concentrations
    const clusterMap = new Map<string, {
        day: string;
        tod: TimeOfDay;
        triggers: Map<string, number>;
        lossCount: number;
    }>();

    for (const trade of sorted) {
        if (trade.pnl >= 0) continue; // only losses
        const triggers = deriveTriggers(trade);
        if (triggers.length === 0) continue;

        const date = new Date(trade.date);
        const day = getDayOfWeek(date);
        const tod = getTimeOfDay(date);
        const key = `${day}-${tod}`;

        let cluster = clusterMap.get(key);
        if (!cluster) {
            cluster = { day, tod, triggers: new Map<string, number>(), lossCount: 0 };
            clusterMap.set(key, cluster);
        }

        cluster.lossCount++;
        for (const t of triggers) {
            cluster.triggers.set(t, (cluster.triggers.get(t) || 0) + 1);
        }
    }

    // Only report clusters with ≥2 losses
    const clusters: SabotageCluster[] = [];
    const totalLosses = sorted.filter(t => t.pnl < 0).length;

    for (const [, cluster] of clusterMap) {
        if (cluster.lossCount < 2) continue;

        const confidence = Math.min(cluster.lossCount / Math.max(totalLosses, 1), 1);
        const topTriggers = [...cluster.triggers.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([t]) => t);

        const todLabel = cluster.tod.replace(/-/g, ' ');
        clusters.push({
            label: `${cluster.day}s ${todLabel}`,
            triggers: topTriggers,
            lossCount: cluster.lossCount,
            confidence,
            recommendation: `Consider avoiding trades on ${cluster.day}s during ${todLabel} — ${cluster.lossCount} trigger-driven losses detected.`,
        });
    }

    clusters.sort((a, b) => b.lossCount - a.lossCount);

    // ─── Phase 4: Discipline Score ───────────────────────────
    // Higher score = fewer trigger-correlated losses
    const triggerLossCount = patterns.reduce((sum, p) => sum + p.lossCount, 0);
    const triggerDisciplineScore = tradesWithTriggers > 0
        ? Math.round(Math.max(0, 100 - (triggerLossCount / tradesWithTriggers) * 100))
        : 100;

    return {
        topPatterns,
        clusters,
        triggerDisciplineScore,
        analyzedTrades: trades.length,
        tradesWithTriggers,
        period,
    };
}

export default analyzeTriggerCorrelation;
