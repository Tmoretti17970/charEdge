// ═══════════════════════════════════════════════════════════════════
// charEdge — Data Retention Service (SQLite)
//
// Manages data lifecycle: archive/delete old records, monitor
// table sizes, and schedule periodic cleanup.
//
// Usage:
//   import { archiveOldAuditLogs, getTableStats } from './retention.ts';
//   archiveOldAuditLogs(db, 90);  // Delete logs older than 90 days
// ═══════════════════════════════════════════════════════════════════

import type { Database } from 'better-sqlite3';

// ─── Types ──────────────────────────────────────────────────────

export interface TableStats {
    table: string;
    rowCount: number;
    oldestRecord?: number;  // Unix ms timestamp
    newestRecord?: number;  // Unix ms timestamp
}

export interface RetentionResult {
    table: string;
    deletedRows: number;
    cutoffDate: string;
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Delete audit_log entries older than the specified number of days.
 * Returns the number of rows deleted.
 */
export function archiveOldAuditLogs(db: Database, daysToKeep: number = 90): RetentionResult {
    const cutoffMs = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    const cutoffDate = new Date(cutoffMs).toISOString();

    const result = db.prepare(
        'DELETE FROM audit_log WHERE created_at < ?'
    ).run(cutoffMs);

    if (result.changes > 0) {
        console.info(`[Retention] Deleted ${result.changes} audit_log entries older than ${daysToKeep} days`);
    }

    return {
        table: 'audit_log',
        deletedRows: result.changes,
        cutoffDate,
    };
}

/**
 * Get row counts and date ranges for all data tables.
 */
export function getTableStats(db: Database): TableStats[] {
    const tables = ['trades', 'playbooks', 'notes', 'plans', 'settings', 'audit_log'];
    const stats: TableStats[] = [];

    for (const table of tables) {
        try {
            const countRow = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };

            // Try to get date range (different tables use different timestamp columns)
            const tsCol = table === 'settings' ? 'updated_at' : 'created_at';
            let oldest: number | undefined;
            let newest: number | undefined;

            try {
                const minRow = db.prepare(`SELECT MIN(${tsCol}) as ts FROM ${table}`).get() as { ts: number | null };
                const maxRow = db.prepare(`SELECT MAX(${tsCol}) as ts FROM ${table}`).get() as { ts: number | null };
                oldest = minRow?.ts ?? undefined;
                newest = maxRow?.ts ?? undefined;
            } catch {
                // Some tables may not have the column
            }

            stats.push({
                table,
                rowCount: countRow.count,
                oldestRecord: oldest,
                newestRecord: newest,
            });
        } catch {
            stats.push({ table, rowCount: -1 });
        }
    }

    return stats;
}

/**
 * Schedule periodic retention cleanup.
 * Returns the interval ID for cleanup.
 */
export function scheduleRetention(
    db: Database,
    intervalMs: number = 24 * 60 * 60 * 1000, // Default: daily
    daysToKeep: number = 90
): ReturnType<typeof setInterval> {
    console.info(`[Retention] Scheduled every ${Math.round(intervalMs / 1000 / 60)} minutes (keep ${daysToKeep} days)`);

    return setInterval(() => {
        try {
            archiveOldAuditLogs(db, daysToKeep);
        } catch (err) {
            console.error('[Retention] Failed:', err instanceof Error ? err.message : err);
        }
    }, intervalMs);
}
