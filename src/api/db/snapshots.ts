// ═══════════════════════════════════════════════════════════════════
// charEdge — Data Versioning / Snapshots (SQLite)
//
// Point-in-time snapshots for entity rollback and debugging.
// Stores JSON snapshots of entities before destructive operations.
//
// Usage:
//   import { createEntitySnapshot, restoreEntitySnapshot } from './snapshots.ts';
//   createEntitySnapshot(db, 'trade', 'trade_123', tradeData);
//   restoreEntitySnapshot(db, snapshotId);
// ═══════════════════════════════════════════════════════════════════

import type { Database } from 'better-sqlite3';

// ─── Types ──────────────────────────────────────────────────────

export interface EntitySnapshot {
    id: number;
    entityType: string;
    entityId: string;
    data: Record<string, unknown>;
    createdAt: number;
}

interface SnapshotRow {
    id: number;
    entity_type: string;
    entity_id: string;
    data_json: string;
    created_at: number;
}

// ─── Schema ─────────────────────────────────────────────────────

/**
 * Initialize the data_snapshots table. Safe to call multiple times.
 */
export function initSnapshotsTable(db: Database): void {
    db.exec(`
        CREATE TABLE IF NOT EXISTS data_snapshots (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_type TEXT NOT NULL,
            entity_id   TEXT NOT NULL,
            data_json   TEXT NOT NULL,
            created_at  INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_snapshots_entity
            ON data_snapshots(entity_type, entity_id, created_at DESC);
    `);
}

// ─── Mapper ─────────────────────────────────────────────────────

function rowToSnapshot(row: SnapshotRow): EntitySnapshot {
    return {
        id: row.id,
        entityType: row.entity_type,
        entityId: row.entity_id,
        data: JSON.parse(row.data_json || '{}'),
        createdAt: row.created_at,
    };
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Create a point-in-time snapshot of an entity.
 */
export function createEntitySnapshot(
    db: Database,
    entityType: string,
    entityId: string,
    data: Record<string, unknown>
): EntitySnapshot {
    initSnapshotsTable(db);

    const now = Date.now();
    const result = db.prepare(`
        INSERT INTO data_snapshots (entity_type, entity_id, data_json, created_at)
        VALUES (?, ?, ?, ?)
    `).run(entityType, entityId, JSON.stringify(data), now);

    return {
        id: Number(result.lastInsertRowid),
        entityType,
        entityId,
        data,
        createdAt: now,
    };
}

/**
 * List snapshots for a specific entity, newest first.
 */
export function listEntitySnapshots(
    db: Database,
    entityType: string,
    entityId: string,
    limit: number = 20
): EntitySnapshot[] {
    initSnapshotsTable(db);

    const rows = db.prepare(`
        SELECT * FROM data_snapshots
        WHERE entity_type = ? AND entity_id = ?
        ORDER BY created_at DESC
        LIMIT ?
    `).all(entityType, entityId, limit) as SnapshotRow[];

    return rows.map(rowToSnapshot);
}

/**
 * Get a single snapshot by ID.
 */
export function getSnapshot(db: Database, snapshotId: number): EntitySnapshot | null {
    initSnapshotsTable(db);

    const row = db.prepare(
        'SELECT * FROM data_snapshots WHERE id = ?'
    ).get(snapshotId) as SnapshotRow | undefined;

    return row ? rowToSnapshot(row) : null;
}

/**
 * Delete old snapshots for an entity, keeping only the N most recent.
 */
export function pruneEntitySnapshots(
    db: Database,
    entityType: string,
    entityId: string,
    keepCount: number = 10
): number {
    initSnapshotsTable(db);

    const result = db.prepare(`
        DELETE FROM data_snapshots
        WHERE entity_type = ? AND entity_id = ?
        AND id NOT IN (
            SELECT id FROM data_snapshots
            WHERE entity_type = ? AND entity_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        )
    `).run(entityType, entityId, entityType, entityId, keepCount);

    return result.changes;
}
