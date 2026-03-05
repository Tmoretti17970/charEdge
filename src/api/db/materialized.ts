// ═══════════════════════════════════════════════════════════════════
// charEdge — Materialized Views (SQLite)
//
// Pre-computed analytics tables for fast dashboard rendering.
// Refreshed on trade create/update/delete instead of computing
// on every request.
//
// Usage:
//   import { refreshDailyPnl, getDailyPnl } from './materialized.ts';
//   refreshDailyPnl(db, userId);
//   const data = getDailyPnl(db, userId, '2024-01-01', '2024-12-31');
// ═══════════════════════════════════════════════════════════════════

import type { Database } from 'better-sqlite3';

// ─── Types ──────────────────────────────────────────────────────

export interface DailyPnlRow {
    userId: string;
    date: string;
    totalPnl: number;
    tradeCount: number;
    winCount: number;
    lossCount: number;
}

export interface WeeklyStatsRow {
    userId: string;
    weekStart: string;
    totalPnl: number;
    tradeCount: number;
    winRate: number;
    avgPnl: number;
    bestDay: number;
    worstDay: number;
}

// ─── Schema ─────────────────────────────────────────────────────

/**
 * Initialize materialized view tables. Safe to call multiple times.
 */
export function initMaterializedTables(db: Database): void {
    db.exec(`
        CREATE TABLE IF NOT EXISTS daily_pnl (
            user_id     TEXT NOT NULL,
            date        TEXT NOT NULL,
            total_pnl   REAL NOT NULL DEFAULT 0,
            trade_count INTEGER NOT NULL DEFAULT 0,
            win_count   INTEGER NOT NULL DEFAULT 0,
            loss_count  INTEGER NOT NULL DEFAULT 0,
            updated_at  INTEGER NOT NULL,
            PRIMARY KEY (user_id, date)
        );

        CREATE INDEX IF NOT EXISTS idx_daily_pnl_user_date
            ON daily_pnl(user_id, date);

        CREATE TABLE IF NOT EXISTS weekly_stats (
            user_id     TEXT NOT NULL,
            week_start  TEXT NOT NULL,
            total_pnl   REAL NOT NULL DEFAULT 0,
            trade_count INTEGER NOT NULL DEFAULT 0,
            win_rate    REAL NOT NULL DEFAULT 0,
            avg_pnl     REAL NOT NULL DEFAULT 0,
            best_day    REAL NOT NULL DEFAULT 0,
            worst_day   REAL NOT NULL DEFAULT 0,
            updated_at  INTEGER NOT NULL,
            PRIMARY KEY (user_id, week_start)
        );

        CREATE INDEX IF NOT EXISTS idx_weekly_stats_user
            ON weekly_stats(user_id, week_start);
    `);
}

// ─── Internal Types ─────────────────────────────────────────────

interface TradeAggRow {
    date: string;
    total_pnl: number;
    trade_count: number;
    win_count: number;
    loss_count: number;
}

interface DailyPnlDbRow {
    user_id: string;
    date: string;
    total_pnl: number;
    trade_count: number;
    win_count: number;
    loss_count: number;
}

// ─── Refresh Functions ──────────────────────────────────────────

/**
 * Recompute daily P&L from trades for a specific user.
 * Replaces all existing daily_pnl data for the user.
 */
export function refreshDailyPnl(db: Database, userId: string): number {
    initMaterializedTables(db);

    const now = Date.now();
    let rowsAffected = 0;

    const tx = db.transaction(() => {
        // Clear existing data for this user
        db.prepare('DELETE FROM daily_pnl WHERE user_id = ?').run(userId);

        // Aggregate trades by date
        const rows = db.prepare(`
            SELECT
                SUBSTR(entry_date, 1, 10) as date,
                COALESCE(SUM(pnl), 0) as total_pnl,
                COUNT(*) as trade_count,
                SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as win_count,
                SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as loss_count
            FROM trades
            WHERE user_id = ? AND exit_price IS NOT NULL
            GROUP BY SUBSTR(entry_date, 1, 10)
            ORDER BY date
        `).all(userId) as TradeAggRow[];

        // Insert aggregated data
        const insert = db.prepare(`
            INSERT INTO daily_pnl (user_id, date, total_pnl, trade_count, win_count, loss_count, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const row of rows) {
            insert.run(userId, row.date, row.total_pnl, row.trade_count, row.win_count, row.loss_count, now);
            rowsAffected++;
        }
    });

    tx();
    return rowsAffected;
}

/**
 * Recompute weekly stats from daily P&L data.
 * Must be called after refreshDailyPnl.
 */
export function refreshWeeklyStats(db: Database, userId: string): number {
    initMaterializedTables(db);

    const now = Date.now();
    let rowsAffected = 0;

    const tx = db.transaction(() => {
        // Clear existing data
        db.prepare('DELETE FROM weekly_stats WHERE user_id = ?').run(userId);

        // Get all daily PnL data
        const dailyRows = db.prepare(
            'SELECT * FROM daily_pnl WHERE user_id = ? ORDER BY date'
        ).all(userId) as DailyPnlDbRow[];

        if (dailyRows.length === 0) return;

        // Group by ISO week (Monday-based)
        const weekMap = new Map<string, DailyPnlDbRow[]>();
        for (const row of dailyRows) {
            const d = new Date(row.date);
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
            const monday = new Date(d.setDate(diff));
            const weekStart = monday.toISOString().slice(0, 10);

            if (!weekMap.has(weekStart)) weekMap.set(weekStart, []);
            weekMap.get(weekStart)!.push(row);
        }

        // Insert weekly aggregations
        const insert = db.prepare(`
            INSERT INTO weekly_stats (user_id, week_start, total_pnl, trade_count, win_rate, avg_pnl, best_day, worst_day, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const [weekStart, days] of weekMap) {
            const totalPnl = days.reduce((s, d) => s + d.total_pnl, 0);
            const tradeCount = days.reduce((s, d) => s + d.trade_count, 0);
            const winCount = days.reduce((s, d) => s + d.win_count, 0);
            const winRate = tradeCount > 0 ? +((winCount / tradeCount) * 100).toFixed(1) : 0;
            const avgPnl = tradeCount > 0 ? +(totalPnl / tradeCount).toFixed(2) : 0;
            const bestDay = Math.max(...days.map(d => d.total_pnl));
            const worstDay = Math.min(...days.map(d => d.total_pnl));

            insert.run(userId, weekStart, +totalPnl.toFixed(2), tradeCount, winRate, avgPnl, +bestDay.toFixed(2), +worstDay.toFixed(2), now);
            rowsAffected++;
        }
    });

    tx();
    return rowsAffected;
}

// ─── Query Functions ────────────────────────────────────────────

/**
 * Get daily P&L data for a user within a date range.
 */
export function getDailyPnl(
    db: Database,
    userId: string,
    dateFrom?: string,
    dateTo?: string
): DailyPnlRow[] {
    initMaterializedTables(db);

    let sql = 'SELECT * FROM daily_pnl WHERE user_id = ?';
    const params: unknown[] = [userId];

    if (dateFrom) {
        sql += ' AND date >= ?';
        params.push(dateFrom);
    }
    if (dateTo) {
        sql += ' AND date <= ?';
        params.push(dateTo);
    }
    sql += ' ORDER BY date ASC';

    const rows = db.prepare(sql).all(...params) as DailyPnlDbRow[];

    return rows.map(r => ({
        userId: r.user_id,
        date: r.date,
        totalPnl: r.total_pnl,
        tradeCount: r.trade_count,
        winCount: r.win_count,
        lossCount: r.loss_count,
    }));
}

/**
 * Get weekly stats for a user.
 */
export function getWeeklyStats(db: Database, userId: string): WeeklyStatsRow[] {
    initMaterializedTables(db);

    const rows = db.prepare(
        'SELECT * FROM weekly_stats WHERE user_id = ? ORDER BY week_start ASC'
    ).all(userId) as Array<{
        user_id: string; week_start: string; total_pnl: number;
        trade_count: number; win_rate: number; avg_pnl: number;
        best_day: number; worst_day: number;
    }>;

    return rows.map(r => ({
        userId: r.user_id,
        weekStart: r.week_start,
        totalPnl: r.total_pnl,
        tradeCount: r.trade_count,
        winRate: r.win_rate,
        avgPnl: r.avg_pnl,
        bestDay: r.best_day,
        worstDay: r.worst_day,
    }));
}
