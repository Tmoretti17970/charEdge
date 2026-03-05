// ═══════════════════════════════════════════════════════════════════
// Unit Tests — SQLite Connection
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, afterAll } from 'vitest';
import Database from 'better-sqlite3';

describe('SQLite Connection Module', () => {
    // Test with in-memory DB to avoid file system side effects
    const db = new Database(':memory:');

    afterAll(() => db.close());

    it('opens an in-memory database', () => {
        expect(db.open).toBe(true);
    });

    it('supports WAL journal mode (returns memory for :memory: db)', () => {
        const result = db.pragma('journal_mode = WAL');
        // In-memory databases cannot use WAL, they return 'memory'
        expect(result).toEqual([{ journal_mode: 'memory' }]);
    });

    it('supports foreign keys', () => {
        db.pragma('foreign_keys = ON');
        const result = db.pragma('foreign_keys');
        expect(result).toEqual([{ foreign_keys: 1 }]);
    });

    it('supports busy timeout', () => {
        db.pragma('busy_timeout = 5000');
        const result = db.pragma('busy_timeout');
        // better-sqlite3 returns { timeout: N } not { busy_timeout: N }
        expect(result).toEqual([{ timeout: 5000 }]);
    });

    it('executes SELECT 1 for health check', () => {
        const row = db.prepare('SELECT 1 as ok').get();
        expect(row).toEqual({ ok: 1 });
    });
});
