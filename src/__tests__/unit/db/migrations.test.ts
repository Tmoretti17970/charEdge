// ═══════════════════════════════════════════════════════════════════
// Unit Tests — Migration Framework
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { initSchema } from '../../../api/db/sqlite-schema.ts';
import {
    runMigrations,
    rollbackMigration,
    getCurrentVersion,
    getAppliedMigrations,
} from '../../../api/db/migrations.ts';

// Import the real migration registrations
import '../../../api/db/migrations/index.ts';

describe('Migration Framework', () => {
    let db: InstanceType<typeof Database>;

    beforeEach(() => {
        db = new Database(':memory:');
        initSchema(db);
    });

    it('creates _migrations table on first run', () => {
        getCurrentVersion(db);
        const tables = db.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'"
        ).all();
        expect(tables).toHaveLength(1);
    });

    it('starts at version 0', () => {
        expect(getCurrentVersion(db)).toBe(0);
    });

    it('applies pending migrations in order', () => {
        const result = runMigrations(db);
        // We have 3 real migrations: baseline(1), add_trade_columns(2), add_check_constraints(3)
        expect(result.applied).toBe(3);
        expect(result.currentVersion).toBe(3);
    });

    it('is idempotent — re-running applies nothing', () => {
        runMigrations(db);
        const second = runMigrations(db);
        expect(second.applied).toBe(0);
        expect(second.currentVersion).toBe(3);
    });

    it('tracks applied migrations', () => {
        runMigrations(db);
        const applied = getAppliedMigrations(db);
        expect(applied).toHaveLength(3);
        expect(applied[0]!.name).toBe('baseline');
        expect(applied[1]!.name).toBe('add_trade_columns');
        expect(applied[2]!.name).toBe('add_check_constraints');
    });

    it('rolls back the last migration', () => {
        runMigrations(db);
        expect(getCurrentVersion(db)).toBe(3);

        const result = rollbackMigration(db);
        expect(result.rolledBack).toBe(3);
        expect(result.currentVersion).toBe(2);
    });

    it('rollback with no migrations applied returns null', () => {
        const result = rollbackMigration(db);
        expect(result.rolledBack).toBeNull();
        expect(result.currentVersion).toBe(0);
    });

    it('migration 002 adds new columns to trades table', () => {
        runMigrations(db);

        const columns = db.prepare("PRAGMA table_info('trades')").all() as { name: string }[];
        const colNames = columns.map(c => c.name);

        expect(colNames).toContain('fees');
        expect(colNames).toContain('strategy');
        expect(colNames).toContain('emotion');
        expect(colNames).toContain('screenshots');
    });

    it('migration 003 creates validation triggers', () => {
        runMigrations(db);

        const triggers = db.prepare(
            "SELECT name FROM sqlite_master WHERE type='trigger'"
        ).all() as { name: string }[];
        const triggerNames = triggers.map(t => t.name);

        expect(triggerNames).toContain('trg_trades_insert_validate');
        expect(triggerNames).toContain('trg_trades_update_validate');
        expect(triggerNames).toContain('trg_settings_insert_validate');
    });

    it('validation trigger rejects invalid trade data', () => {
        runMigrations(db);

        // Should reject entry_price <= 0
        expect(() => {
            db.prepare(`
                INSERT INTO trades (id, user_id, symbol, side, entry_price, size, entry_date, created_at, updated_at)
                VALUES ('t1', 'user1', 'BTCUSDT', 'long', 0, 1, '2024-01-01', ${Date.now()}, ${Date.now()})
            `).run();
        }).toThrow('entry_price must be positive');

        // Should reject size <= 0
        expect(() => {
            db.prepare(`
                INSERT INTO trades (id, user_id, symbol, side, entry_price, size, entry_date, created_at, updated_at)
                VALUES ('t2', 'user1', 'BTCUSDT', 'long', 42000, 0, '2024-01-01', ${Date.now()}, ${Date.now()})
            `).run();
        }).toThrow('size must be positive');
    });
});
