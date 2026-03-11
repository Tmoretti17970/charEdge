// ═══════════════════════════════════════════════════════════════════
// charEdge — SQLite Connection (better-sqlite3)
//
// Embedded database with WAL journaling for crash-safe writes and
// concurrent reads. Zero external dependencies — runs in-process.
//
// Usage:
//   import { getDb, closeDb, pingDb } from './sqlite.ts';
//   const db = getDb();
//   db.prepare('SELECT * FROM trades WHERE user_id = ?').all(userId);
// ═══════════════════════════════════════════════════════════════════

import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initSchema } from './sqlite-schema.ts';
import { runMigrations } from './migrations.ts';
import './migrations/index.ts'; // Register all migrations

// ─── Constants ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');
const DATA_DIR = join(PROJECT_ROOT, 'data');
const DB_PATH = join(DATA_DIR, 'charedge.db');

// ─── State ──────────────────────────────────────────────────────

let _db: DatabaseType | null = null;

// ─── Public API ─────────────────────────────────────────────────

/**
 * Get or create the SQLite database connection.
 * Initializes schema on first call.
 */
export function getDb(): DatabaseType {
    if (_db) return _db;

    // Ensure data directory exists
    if (!existsSync(DATA_DIR)) {
        mkdirSync(DATA_DIR, { recursive: true });
    }

    _db = new Database(DB_PATH);

    // ── Performance & Safety Pragmas ────────────────────────
    _db.pragma('journal_mode = WAL');       // Crash-safe, concurrent reads
    _db.pragma('busy_timeout = 5000');      // Wait 5s on lock contention
    _db.pragma('foreign_keys = ON');        // Enforce FK constraints
    _db.pragma('synchronous = NORMAL');     // Good balance: speed + safety
    _db.pragma('cache_size = -64000');      // 64MB page cache
    _db.pragma('temp_store = MEMORY');      // Temp tables in memory

    // ── Schema ──────────────────────────────────────────────
    initSchema(_db);

    // ── Migrations ─────────────────────────────────────────
    const { applied, currentVersion } = runMigrations(_db);
    if (applied > 0) {
        console.info(`[DB] Applied ${applied} migration(s), now at version ${currentVersion}`);
    }

    console.info('[DB] SQLite connected:', DB_PATH);
    console.info('[DB] WAL mode enabled, foreign keys ON');

    return _db;
}

/**
 * Close the database connection.
 */
export function closeDb(): void {
    if (_db) {
        _db.close();
        _db = null;
        console.info('[DB] SQLite connection closed');
    }
}

/**
 * Check database connectivity and measure latency.
 */
export function pingDb(): { ok: boolean; latencyMs: number } {
    if (!_db) return { ok: false, latencyMs: -1 };

    const start = performance.now();
    try {
        _db.prepare('SELECT 1').get();
        return { ok: true, latencyMs: Math.round(performance.now() - start) };
    } catch {
        return { ok: false, latencyMs: Math.round(performance.now() - start) };
    }
}

/**
 * Get the path to the database file (for backup, health checks, etc.)
 */
export function getDbPath(): string {
    return DB_PATH;
}

export default getDb;
