// ═══════════════════════════════════════════════════════════════════
// charEdge — Generic CRUD Repository (SQLite)
//
// Reusable repository for playbooks, notes, and plans tables.
// Stores entity data as a JSON blob in the `data` column.
// ═══════════════════════════════════════════════════════════════════

import type { Database } from 'better-sqlite3';

// ─── Types ──────────────────────────────────────────────────────

export interface CrudItem {
    id: string;
    userId?: string;
    _createdAt?: number;
    _updatedAt?: number;
    [key: string]: unknown;
}

interface CrudRow {
    id: string;
    user_id: string;
    data: string;  // JSON
    created_at: number;
    updated_at: number;
}

// ─── Mapper ─────────────────────────────────────────────────────

function rowToItem(row: CrudRow): CrudItem {
    const parsed = JSON.parse(row.data || '{}');
    return {
        ...parsed,
        id: row.id,
        userId: row.user_id,
        _createdAt: row.created_at,
        _updatedAt: row.updated_at,
    };
}

function itemToData(item: CrudItem): string {
    // Strip internal fields before serializing
    const { id: _id, userId: _uid, _createdAt: _ca, _updatedAt: _ua, ...rest } = item;
    return JSON.stringify(rest);
}

// ─── Repository ─────────────────────────────────────────────────

export class CrudRepository {
    private db: Database;
    private table: string;

    constructor(db: Database, table: 'playbooks' | 'notes' | 'plans') {
        this.db = db;
        this.table = table;
    }

    /**
     * List all items for a user.
     */
    list(userId: string): CrudItem[] {
        const rows = this.db.prepare(
            `SELECT * FROM ${this.table} WHERE user_id = ? ORDER BY updated_at DESC`
        ).all(userId) as CrudRow[];

        return rows.map(rowToItem);
    }

    /**
     * Find a single item by ID.
     */
    findById(userId: string, itemId: string): CrudItem | null {
        const row = this.db.prepare(
            `SELECT * FROM ${this.table} WHERE id = ? AND user_id = ?`
        ).get(itemId, userId) as CrudRow | undefined;

        return row ? rowToItem(row) : null;
    }

    /**
     * Create or upsert an item.
     */
    create(userId: string, item: CrudItem): CrudItem {
        if (!item.id) throw new Error('Item must have an id');

        const now = Date.now();
        const data = itemToData(item);

        this.db.prepare(`
            INSERT INTO ${this.table} (id, user_id, data, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                data = excluded.data,
                updated_at = excluded.updated_at
        `).run(item.id, userId, data, item._createdAt || now, now);

        return this.findById(userId, item.id)!;
    }

    /**
     * Update an existing item (merge new data).
     */
    update(userId: string, itemId: string, updates: Record<string, unknown>): CrudItem | null {
        const existing = this.findById(userId, itemId);
        if (!existing) return null;

        const merged = { ...existing, ...updates, id: itemId, userId };
        const now = Date.now();
        const data = itemToData(merged as CrudItem);

        this.db.prepare(
            `UPDATE ${this.table} SET data = ?, updated_at = ? WHERE id = ? AND user_id = ?`
        ).run(data, now, itemId, userId);

        return this.findById(userId, itemId);
    }

    /**
     * Delete an item.
     */
    delete(userId: string, itemId: string): boolean {
        const result = this.db.prepare(
            `DELETE FROM ${this.table} WHERE id = ? AND user_id = ?`
        ).run(itemId, userId);

        return result.changes > 0;
    }

    /**
     * Bulk upsert items. Wrapped in a transaction.
     */
    bulkUpsert(userId: string, items: CrudItem[]): { upserted: number } {
        let upserted = 0;

        const tx = this.db.transaction((batch: CrudItem[]) => {
            for (const item of batch) {
                if (!item.id) continue;

                const now = Date.now();
                const data = itemToData(item);

                const existing = this.db.prepare(
                    `SELECT updated_at FROM ${this.table} WHERE id = ?`
                ).get(item.id) as { updated_at: number } | undefined;

                if (existing) {
                    if ((item._updatedAt || 0) > (existing.updated_at || 0)) {
                        this.db.prepare(
                            `UPDATE ${this.table} SET user_id = ?, data = ?, updated_at = ? WHERE id = ?`
                        ).run(userId, data, item._updatedAt || now, item.id);
                    }
                } else {
                    this.db.prepare(`
                        INSERT INTO ${this.table} (id, user_id, data, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?)
                    `).run(item.id, userId, data, item._createdAt || now, item._updatedAt || now);
                }
                upserted++;
            }
        });

        tx(items);
        return { upserted };
    }

    /**
     * Get items updated after a given timestamp (for sync pull).
     */
    listSince(userId: string, sinceMs: number): CrudItem[] {
        const rows = this.db.prepare(
            `SELECT * FROM ${this.table} WHERE user_id = ? AND updated_at > ? ORDER BY updated_at DESC`
        ).all(userId, sinceMs) as CrudRow[];

        return rows.map(rowToItem);
    }
}
