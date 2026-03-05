// ═══════════════════════════════════════════════════════════════════
// Unit Tests — Data Retention
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { initSchema } from '../../../api/db/sqlite-schema.ts';
import { archiveOldAuditLogs, getTableStats } from '../../../api/db/retention.ts';

const USER_ID = 'test-user';

describe('Data Retention', () => {
    let db: InstanceType<typeof Database>;

    beforeEach(() => {
        db = new Database(':memory:');
        initSchema(db);
    });

    it('deletes audit logs older than threshold', () => {
        const now = Date.now();
        const oldMs = now - (100 * 24 * 60 * 60 * 1000); // 100 days ago
        const recentMs = now - (10 * 24 * 60 * 60 * 1000); // 10 days ago

        db.prepare(`
            INSERT INTO audit_log (user_id, action, entity_type, entity_id, created_at)
            VALUES (?, 'trade.created', 'trade', 'old-1', ?)
        `).run(USER_ID, oldMs);

        db.prepare(`
            INSERT INTO audit_log (user_id, action, entity_type, entity_id, created_at)
            VALUES (?, 'trade.created', 'trade', 'recent-1', ?)
        `).run(USER_ID, recentMs);

        const result = archiveOldAuditLogs(db, 90);
        expect(result.deletedRows).toBe(1);

        // Recent one should still exist
        const remaining = db.prepare('SELECT COUNT(*) as count FROM audit_log').get() as { count: number };
        expect(remaining.count).toBe(1);
    });

    it('returns 0 when nothing to delete', () => {
        const result = archiveOldAuditLogs(db, 90);
        expect(result.deletedRows).toBe(0);
    });

    it('gets table stats', () => {
        const stats = getTableStats(db);
        expect(stats.length).toBeGreaterThanOrEqual(6);
        expect(stats.every(s => s.rowCount >= 0)).toBe(true);
    });
});
