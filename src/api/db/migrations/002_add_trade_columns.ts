// ═══════════════════════════════════════════════════════════════════
// Migration 002 — Add fees and strategy columns to trades
//
// Adds columns that the Zod schema already validates for (fees,
// strategy, emotion, screenshots) but were missing from the
// SQLite DDL.
// ═══════════════════════════════════════════════════════════════════

import type { Database } from 'better-sqlite3';
import { registerMigration } from '../migrations.ts';

registerMigration({
    version: 2,
    name: 'add_trade_columns',
    up(db: Database) {
        // SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN,
        // so we check the table info first
        const columns = db.prepare("PRAGMA table_info('trades')").all() as { name: string }[];
        const existingCols = new Set(columns.map(c => c.name));

        if (!existingCols.has('fees')) {
            db.exec("ALTER TABLE trades ADD COLUMN fees REAL DEFAULT 0");
        }
        if (!existingCols.has('strategy')) {
            db.exec("ALTER TABLE trades ADD COLUMN strategy TEXT DEFAULT ''");
        }
        if (!existingCols.has('emotion')) {
            db.exec("ALTER TABLE trades ADD COLUMN emotion TEXT DEFAULT ''");
        }
        if (!existingCols.has('screenshots')) {
            db.exec("ALTER TABLE trades ADD COLUMN screenshots TEXT DEFAULT '[]'");
        }
    },
    down(db: Database) {
        // SQLite doesn't support DROP COLUMN before 3.35.0
        // For safety, we recreate the table without the new columns
        db.exec(`
            CREATE TABLE IF NOT EXISTS trades_backup AS
                SELECT id, user_id, symbol, side, entry_price, exit_price,
                       entry_date, exit_date, size, pnl, notes, tags, setup,
                       created_at, updated_at
                FROM trades;
            DROP TABLE trades;
            CREATE TABLE trades (
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
            INSERT INTO trades SELECT * FROM trades_backup;
            DROP TABLE trades_backup;
            CREATE INDEX IF NOT EXISTS idx_trades_user_date ON trades(user_id, entry_date);
            CREATE INDEX IF NOT EXISTS idx_trades_user_symbol ON trades(user_id, symbol);
            CREATE INDEX IF NOT EXISTS idx_trades_user_updated ON trades(user_id, updated_at);
        `);
    },
});
