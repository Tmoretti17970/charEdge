// ═══════════════════════════════════════════════════════════════════
// charEdge — SQLite Schema (DDL)
//
// Defines all tables and indexes for the embedded SQLite database.
// Executed on first connection via initSchema(). Uses IF NOT EXISTS
// for safe re-runs.
// ═══════════════════════════════════════════════════════════════════

import type { Database } from 'better-sqlite3';

/**
 * Initialize all tables and indexes. Safe to call multiple times.
 */
export function initSchema(db: Database): void {
    db.exec(`
        -- ═══════════════════════════════════════════════════════════
        -- Trades
        -- ═══════════════════════════════════════════════════════════
        CREATE TABLE IF NOT EXISTS trades (
            id          TEXT PRIMARY KEY,
            user_id     TEXT NOT NULL,
            symbol      TEXT NOT NULL,
            side        TEXT NOT NULL CHECK (side IN ('long', 'short')),
            entry_price REAL NOT NULL,
            exit_price  REAL,
            entry_date  TEXT NOT NULL,
            exit_date   TEXT,
            size        REAL NOT NULL DEFAULT 1,
            pnl         REAL,
            notes       TEXT DEFAULT '',
            tags        TEXT DEFAULT '[]',
            setup       TEXT DEFAULT '',
            created_at  INTEGER NOT NULL,
            updated_at  INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_trades_user_date
            ON trades(user_id, entry_date);
        CREATE INDEX IF NOT EXISTS idx_trades_user_symbol
            ON trades(user_id, symbol);
        CREATE INDEX IF NOT EXISTS idx_trades_user_updated
            ON trades(user_id, updated_at);

        -- ═══════════════════════════════════════════════════════════
        -- Playbooks (JSON data column for flexible schema)
        -- ═══════════════════════════════════════════════════════════
        CREATE TABLE IF NOT EXISTS playbooks (
            id          TEXT PRIMARY KEY,
            user_id     TEXT NOT NULL,
            data        TEXT NOT NULL DEFAULT '{}',
            created_at  INTEGER NOT NULL,
            updated_at  INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_playbooks_user
            ON playbooks(user_id);

        -- ═══════════════════════════════════════════════════════════
        -- Notes (JSON data column for flexible schema)
        -- ═══════════════════════════════════════════════════════════
        CREATE TABLE IF NOT EXISTS notes (
            id          TEXT PRIMARY KEY,
            user_id     TEXT NOT NULL,
            data        TEXT NOT NULL DEFAULT '{}',
            created_at  INTEGER NOT NULL,
            updated_at  INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_notes_user
            ON notes(user_id);

        -- ═══════════════════════════════════════════════════════════
        -- Plans (JSON data column for flexible schema)
        -- ═══════════════════════════════════════════════════════════
        CREATE TABLE IF NOT EXISTS plans (
            id          TEXT PRIMARY KEY,
            user_id     TEXT NOT NULL,
            data        TEXT NOT NULL DEFAULT '{}',
            created_at  INTEGER NOT NULL,
            updated_at  INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_plans_user
            ON plans(user_id);

        -- ═══════════════════════════════════════════════════════════
        -- Settings (key-value per user)
        -- ═══════════════════════════════════════════════════════════
        CREATE TABLE IF NOT EXISTS settings (
            user_id     TEXT NOT NULL,
            key         TEXT NOT NULL,
            value       TEXT NOT NULL DEFAULT 'null',
            updated_at  INTEGER NOT NULL,
            PRIMARY KEY (user_id, key)
        );

        -- ═══════════════════════════════════════════════════════════
        -- Audit Log
        -- ═══════════════════════════════════════════════════════════
        CREATE TABLE IF NOT EXISTS audit_log (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     TEXT,
            action      TEXT NOT NULL,
            entity_type TEXT,
            entity_id   TEXT,
            metadata    TEXT DEFAULT '{}',
            created_at  INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_audit_user_date
            ON audit_log(user_id, created_at);
    `);
}
