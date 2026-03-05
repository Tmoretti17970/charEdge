// ═══════════════════════════════════════════════════════════════════
// charEdge — SQLite Backup Utility
//
// Uses better-sqlite3's built-in .backup() API for safe, online
// backups without locking the database.
//
// Usage:
//   import { backupDatabase, scheduleBackups } from './backup.ts';
//   await backupDatabase();                    // one-off backup
//   scheduleBackups(24 * 60 * 60 * 1000);     // daily
// ═══════════════════════════════════════════════════════════════════

import { existsSync, mkdirSync, readdirSync, unlinkSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb, getDbPath } from './sqlite.ts';

// ─── Constants ──────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');
const BACKUP_DIR = join(PROJECT_ROOT, 'data', 'backups');
const MAX_BACKUPS = 7; // Keep last 7 backups

// ─── Public API ─────────────────────────────────────────────────

/**
 * Create a backup of the SQLite database.
 * Returns the path to the backup file.
 */
export async function backupDatabase(destDir?: string): Promise<string> {
    const dir = destDir || BACKUP_DIR;

    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupPath = join(dir, `charedge-${timestamp}.db`);

    const db = getDb();
    await db.backup(backupPath);

    console.info(`[Backup] Created: ${backupPath}`);

    // Prune old backups
    pruneOldBackups(dir);

    return backupPath;
}

/**
 * Schedule periodic backups.
 * Returns the interval ID for cleanup.
 */
export function scheduleBackups(intervalMs: number = 24 * 60 * 60 * 1000): ReturnType<typeof setInterval> {
    console.info(`[Backup] Scheduled every ${Math.round(intervalMs / 1000 / 60)} minutes`);

    return setInterval(async () => {
        try {
            await backupDatabase();
        } catch (err) {
            console.error('[Backup] Failed:', err instanceof Error ? err.message : err);
        }
    }, intervalMs);
}

/**
 * Get the current database file size in bytes.
 */
export function getDbSize(): number {
    const dbPath = getDbPath();
    try {
        return statSync(dbPath).size;
    } catch {
        return 0;
    }
}

// ─── Internal ───────────────────────────────────────────────────

function pruneOldBackups(dir: string): void {
    try {
        const files = readdirSync(dir)
            .filter(f => f.startsWith('charedge-') && f.endsWith('.db'))
            .sort()
            .reverse();

        // Delete files beyond the limit
        for (const file of files.slice(MAX_BACKUPS)) {
            const filePath = join(dir, file);
            unlinkSync(filePath);
            console.info(`[Backup] Pruned old backup: ${file}`);
        }
    } catch {
        // Non-critical — log and continue
    }
}
