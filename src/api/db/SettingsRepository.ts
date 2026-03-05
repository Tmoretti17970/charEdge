// ═══════════════════════════════════════════════════════════════════
// charEdge — Settings Repository (SQLite)
//
// Key-value store for per-user settings.
// Values are JSON-serialized for type flexibility.
// ═══════════════════════════════════════════════════════════════════

import type { Database } from 'better-sqlite3';

// ─── Types ──────────────────────────────────────────────────────

interface SettingsRow {
    user_id: string;
    key: string;
    value: string;  // JSON
    updated_at: number;
}

// ─── Repository ─────────────────────────────────────────────────

export class SettingsRepository {
    private db: Database;

    constructor(db: Database) {
        this.db = db;
    }

    /**
     * Get all settings for a user.
     */
    getAll(userId: string): Record<string, unknown> {
        const rows = this.db.prepare(
            'SELECT key, value FROM settings WHERE user_id = ?'
        ).all(userId) as SettingsRow[];

        const result: Record<string, unknown> = {};
        for (const row of rows) {
            try {
                result[row.key] = JSON.parse(row.value);
            } catch {
                result[row.key] = row.value;
            }
        }
        return result;
    }

    /**
     * Get a single setting by key.
     */
    get(userId: string, key: string): unknown | undefined {
        const row = this.db.prepare(
            'SELECT value FROM settings WHERE user_id = ? AND key = ?'
        ).get(userId, key) as SettingsRow | undefined;

        if (!row) return undefined;

        try {
            return JSON.parse(row.value);
        } catch {
            return row.value;
        }
    }

    /**
     * Check if a setting exists.
     */
    has(userId: string, key: string): boolean {
        const row = this.db.prepare(
            'SELECT 1 FROM settings WHERE user_id = ? AND key = ?'
        ).get(userId, key);

        return !!row;
    }

    /**
     * Set a single setting (upsert).
     */
    set(userId: string, key: string, value: unknown): void {
        const now = Date.now();
        const jsonValue = JSON.stringify(value);

        this.db.prepare(`
            INSERT INTO settings (user_id, key, value, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, key) DO UPDATE SET
                value = excluded.value,
                updated_at = excluded.updated_at
        `).run(userId, key, jsonValue, now);
    }

    /**
     * Delete a single setting.
     */
    delete(userId: string, key: string): boolean {
        const result = this.db.prepare(
            'DELETE FROM settings WHERE user_id = ? AND key = ?'
        ).run(userId, key);

        return result.changes > 0;
    }

    /**
     * Bulk set multiple settings. Wrapped in a transaction.
     */
    bulkSet(userId: string, settings: Record<string, unknown>): { set: number } {
        let count = 0;

        const tx = this.db.transaction((entries: [string, unknown][]) => {
            for (const [key, value] of entries) {
                this.set(userId, key, value);
                count++;
            }
        });

        tx(Object.entries(settings));
        return { set: count };
    }
}
