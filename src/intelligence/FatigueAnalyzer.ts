// ═══════════════════════════════════════════════════════════════════
// charEdge — Fatigue Analyzer (Task 4.3.8)
//
// Analyzes time-of-day and session-duration performance patterns
// to detect when a trader performs best/worst.
//
// Features:
//   - Time-of-day performance bucketing
//   - Day-of-week performance matrix
//   - Session duration vs P&L correlation
//   - Fatigue detection after extended sessions
//
// Input:  Array of trades with dates
// Output: FatigueReport
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export type TimeBucket =
    | 'pre-market'   // 00:00–09:00
    | 'open'         // 09:00–10:00
    | 'midday'       // 10:00–12:00
    | 'afternoon'    // 12:00–15:00
    | 'close'        // 15:00–16:00
    | 'after-hours'; // 16:00–24:00

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export interface TimeBucketStats {
    bucket: TimeBucket;
    tradeCount: number;
    winRate: number;
    avgPnl: number;
    totalPnl: number;
}

export interface DayStats {
    day: DayOfWeek;
    tradeCount: number;
    winRate: number;
    avgPnl: number;
    totalPnl: number;
}

export interface SessionFatiguePoint {
    /** Minute offset from first trade in session */
    minuteOffset: number;
    /** Average P&L for trades at this session duration */
    avgPnl: number;
    /** Trade count */
    count: number;
}

export interface FatigueReport {
    /** Best performing time bucket */
    bestHours: TimeBucketStats | null;
    /** Worst performing time bucket */
    worstHours: TimeBucketStats | null;
    /** All time-of-day buckets */
    hourlyBreakdown: TimeBucketStats[];
    /** Day-of-week matrix */
    weekdayMatrix: DayStats[];
    /** Session fatigue curve (P&L vs session duration) */
    sessionFatigueCurve: SessionFatiguePoint[];
    /** Minutes in session after which performance degrades */
    fatigueThreshold: number | null;
    /** Total trades analyzed */
    analyzedTrades: number;
    /** Recommendations */
    recommendations: string[];
}

// ─── Constants ──────────────────────────────────────────────────

const TIME_BUCKETS: { label: TimeBucket; start: number; end: number }[] = [
    { label: 'pre-market', start: 0, end: 9 },
    { label: 'open', start: 9, end: 10 },
    { label: 'midday', start: 10, end: 12 },
    { label: 'afternoon', start: 12, end: 15 },
    { label: 'close', start: 15, end: 16 },
    { label: 'after-hours', start: 16, end: 24 },
];

const DAY_MAP: DayOfWeek[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Trade Shape ────────────────────────────────────────────────

export interface TradeLike {
    id: string;
    date: string;
    pnl: number;
}

// ─── Helpers ────────────────────────────────────────────────────

function getTimeBucket(date: Date): TimeBucket {
    const hour = date.getHours();
    for (const b of TIME_BUCKETS) {
        if (hour >= b.start && hour < b.end) return b.label;
    }
    return 'after-hours';
}

function getDayOfWeek(date: Date): DayOfWeek {
    return DAY_MAP[date.getDay()];
}

// ─── Engine ─────────────────────────────────────────────────────

export function analyzeFatigue(trades: TradeLike[]): FatigueReport {
    if (trades.length === 0) {
        return {
            bestHours: null,
            worstHours: null,
            hourlyBreakdown: [],
            weekdayMatrix: [],
            sessionFatigueCurve: [],
            fatigueThreshold: null,
            analyzedTrades: 0,
            recommendations: [],
        };
    }

    const sorted = [...trades].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // ─── Time-of-day bucketing ───────────────────────────────
    const hourlyMap = new Map<TimeBucket, { wins: number; total: number; pnl: number }>();
    for (const b of TIME_BUCKETS) {
        hourlyMap.set(b.label, { wins: 0, total: 0, pnl: 0 });
    }

    for (const trade of sorted) {
        const date = new Date(trade.date);
        const bucket = getTimeBucket(date);
        const stats = hourlyMap.get(bucket)!;
        stats.total++;
        stats.pnl += trade.pnl;
        if (trade.pnl > 0) stats.wins++;
    }

    const hourlyBreakdown: TimeBucketStats[] = [];
    for (const [bucket, stats] of hourlyMap) {
        if (stats.total === 0) continue;
        hourlyBreakdown.push({
            bucket,
            tradeCount: stats.total,
            winRate: stats.wins / stats.total,
            avgPnl: stats.pnl / stats.total,
            totalPnl: stats.pnl,
        });
    }

    // ─── Day-of-week matrix ──────────────────────────────────
    const dayMap = new Map<DayOfWeek, { wins: number; total: number; pnl: number }>();
    for (const d of DAY_MAP) {
        dayMap.set(d, { wins: 0, total: 0, pnl: 0 });
    }

    for (const trade of sorted) {
        const date = new Date(trade.date);
        const day = getDayOfWeek(date);
        const stats = dayMap.get(day)!;
        stats.total++;
        stats.pnl += trade.pnl;
        if (trade.pnl > 0) stats.wins++;
    }

    const weekdayMatrix: DayStats[] = [];
    for (const [day, stats] of dayMap) {
        if (stats.total === 0) continue;
        weekdayMatrix.push({
            day,
            tradeCount: stats.total,
            winRate: stats.wins / stats.total,
            avgPnl: stats.pnl / stats.total,
            totalPnl: stats.pnl,
        });
    }

    // ─── Session fatigue ─────────────────────────────────────
    // Group trades into "sessions" (trades within 4h of each other)
    const SESSION_GAP_MS = 4 * 60 * 60 * 1000;
    const sessions: TradeLike[][] = [];
    let currentSession: TradeLike[] = [];

    for (const trade of sorted) {
        const t = new Date(trade.date).getTime();
        if (currentSession.length === 0) {
            currentSession.push(trade);
        } else {
            const lastT = new Date(currentSession[currentSession.length - 1].date).getTime();
            if (t - lastT > SESSION_GAP_MS) {
                sessions.push(currentSession);
                currentSession = [trade];
            } else {
                currentSession.push(trade);
            }
        }
    }
    if (currentSession.length > 0) sessions.push(currentSession);

    // Build fatigue curve: P&L by minutes-since-session-start
    const fatigueBuckets = new Map<number, { pnl: number; count: number }>();
    const BUCKET_SIZE_MIN = 30; // 30-minute buckets

    for (const session of sessions) {
        if (session.length < 2) continue;
        const sessionStart = new Date(session[0].date).getTime();

        for (const trade of session) {
            const minuteOffset = Math.floor(
                (new Date(trade.date).getTime() - sessionStart) / 60000
            );
            const bucketKey = Math.floor(minuteOffset / BUCKET_SIZE_MIN) * BUCKET_SIZE_MIN;
            const entry = fatigueBuckets.get(bucketKey) || { pnl: 0, count: 0 };
            entry.pnl += trade.pnl;
            entry.count++;
            fatigueBuckets.set(bucketKey, entry);
        }
    }

    const sessionFatigueCurve: SessionFatiguePoint[] = [...fatigueBuckets.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([offset, data]) => ({
            minuteOffset: offset,
            avgPnl: data.count > 0 ? data.pnl / data.count : 0,
            count: data.count,
        }));

    // Detect fatigue threshold: first point where avgPnl goes consistently negative
    let fatigueThreshold: number | null = null;
    for (let i = 1; i < sessionFatigueCurve.length; i++) {
        const point = sessionFatigueCurve[i];
        if (point.avgPnl < 0 && point.count >= 2) {
            fatigueThreshold = point.minuteOffset;
            break;
        }
    }

    // ─── Best/worst hours ────────────────────────────────────
    const activeBuckets = hourlyBreakdown.filter(h => h.tradeCount >= 2);
    const bestHours = activeBuckets.length > 0
        ? activeBuckets.reduce((a, b) => a.avgPnl > b.avgPnl ? a : b)
        : null;
    const worstHours = activeBuckets.length > 0
        ? activeBuckets.reduce((a, b) => a.avgPnl < b.avgPnl ? a : b)
        : null;

    // ─── Recommendations ─────────────────────────────────────
    const recommendations: string[] = [];

    if (bestHours && worstHours && bestHours.bucket !== worstHours.bucket) {
        recommendations.push(
            `Your best performance is during "${bestHours.bucket}" (${(bestHours.winRate * 100).toFixed(0)}% win rate, avg $${bestHours.avgPnl.toFixed(0)}). Consider focusing trading during this window.`
        );
        if (worstHours.avgPnl < 0) {
            recommendations.push(
                `Avoid trading during "${worstHours.bucket}" — avg P&L is -$${Math.abs(worstHours.avgPnl).toFixed(0)} with ${(worstHours.winRate * 100).toFixed(0)}% win rate.`
            );
        }
    }

    if (fatigueThreshold !== null) {
        const hours = Math.round(fatigueThreshold / 60);
        recommendations.push(
            `Performance degrades after ${hours > 0 ? `${hours}h` : `${fatigueThreshold}min`} in a session. Consider taking a break or stopping at that point.`
        );
    }

    const worstDay = weekdayMatrix.length > 0
        ? weekdayMatrix.reduce((a, b) => a.avgPnl < b.avgPnl ? a : b)
        : null;
    if (worstDay && worstDay.avgPnl < 0 && worstDay.tradeCount >= 3) {
        recommendations.push(
            `${worstDay.day}s are your worst day — avg P&L $${worstDay.avgPnl.toFixed(0)} over ${worstDay.tradeCount} trades.`
        );
    }

    return {
        bestHours,
        worstHours,
        hourlyBreakdown,
        weekdayMatrix,
        sessionFatigueCurve,
        fatigueThreshold,
        analyzedTrades: trades.length,
        recommendations,
    };
}

export default analyzeFatigue;
