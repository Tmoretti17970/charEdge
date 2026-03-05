// ═══════════════════════════════════════════════════════════════════
// charEdge — Versioned Migration Framework (SQLite)
//
// Applies numbered migrations in order. Each migration has an up()
// and down() function. The `_migrations` table tracks which have
// been applied.
//
// Usage:
//   import { runMigrations, rollbackMigration } from './migrations.ts';
//   const db = getDb();
//   runMigrations(db);          // Apply all pending
//   rollbackMigration(db);      // Revert the last one
// ═══════════════════════════════════════════════════════════════════

import type { Database } from 'better-sqlite3';

// ─── Types ──────────────────────────────────────────────────────

export interface Migration {
    version: number;
    name: string;
    up: (db: Database) => void;
    down: (db: Database) => void;
}

interface MigrationRow {
    version: number;
    name: string;
    applied_at: number;
}

// ─── Migration Registry ────────────────────────────────────────

const migrations: Migration[] = [];

/**
 * Register a migration. Migrations must be registered in order.
 */
export function registerMigration(migration: Migration): void {
    migrations.push(migration);
    migrations.sort((a, b) => a.version - b.version);
}

// ─── Core API ───────────────────────────────────────────────────

/**
 * Ensure the migrations tracking table exists.
 */
function ensureMigrationsTable(db: Database): void {
    db.exec(`
        CREATE TABLE IF NOT EXISTS _migrations (
            version     INTEGER PRIMARY KEY,
            name        TEXT NOT NULL,
            applied_at  INTEGER NOT NULL
        );
    `);
}

/**
 * Get the current schema version (highest applied migration).
 */
export function getCurrentVersion(db: Database): number {
    ensureMigrationsTable(db);
    const row = db.prepare(
        'SELECT MAX(version) as version FROM _migrations'
    ).get() as { version: number | null } | undefined;
    return row?.version ?? 0;
}

/**
 * Get list of applied migrations.
 */
export function getAppliedMigrations(db: Database): MigrationRow[] {
    ensureMigrationsTable(db);
    return db.prepare(
        'SELECT * FROM _migrations ORDER BY version ASC'
    ).all() as MigrationRow[];
}

/**
 * Run all pending migrations in order. Returns count of applied.
 */
export function runMigrations(db: Database): { applied: number; currentVersion: number } {
    ensureMigrationsTable(db);

    const currentVersion = getCurrentVersion(db);
    const pending = migrations.filter(m => m.version > currentVersion);

    if (pending.length === 0) {
        return { applied: 0, currentVersion };
    }

    let applied = 0;
    let lastVersion = currentVersion;

    for (const migration of pending) {
        const tx = db.transaction(() => {
            migration.up(db);
            db.prepare(
                'INSERT INTO _migrations (version, name, applied_at) VALUES (?, ?, ?)'
            ).run(migration.version, migration.name, Date.now());
        });

        try {
            tx();
            applied++;
            lastVersion = migration.version;
            console.info(`[Migration] Applied: ${migration.version} — ${migration.name}`);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[Migration] FAILED at version ${migration.version}: ${message}`);
            throw err; // Stop on first failure
        }
    }

    return { applied, currentVersion: lastVersion };
}

/**
 * Rollback the most recently applied migration.
 * Returns the version that was rolled back, or null if nothing to rollback.
 */
export function rollbackMigration(db: Database): { rolledBack: number | null; currentVersion: number } {
    ensureMigrationsTable(db);

    const currentVersion = getCurrentVersion(db);
    if (currentVersion === 0) {
        return { rolledBack: null, currentVersion: 0 };
    }

    const migration = migrations.find(m => m.version === currentVersion);
    if (!migration) {
        console.warn(`[Migration] No migration found for version ${currentVersion} — cannot rollback`);
        return { rolledBack: null, currentVersion };
    }

    const tx = db.transaction(() => {
        migration.down(db);
        db.prepare('DELETE FROM _migrations WHERE version = ?').run(currentVersion);
    });

    try {
        tx();
        const newVersion = getCurrentVersion(db);
        console.info(`[Migration] Rolled back: ${currentVersion} — ${migration.name}`);
        return { rolledBack: currentVersion, currentVersion: newVersion };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[Migration] Rollback FAILED for version ${currentVersion}: ${message}`);
        throw err;
    }
}
