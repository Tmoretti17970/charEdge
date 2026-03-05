// ═══════════════════════════════════════════════════════════════════
// Migration 003 — Add CHECK constraints for data integrity
//
// Adds stricter validation at the database level. Since SQLite
// can't add CHECK constraints to existing tables via ALTER TABLE,
// we create a new `_check_constraints` validation table and add
// triggers to enforce them.
// ═══════════════════════════════════════════════════════════════════

import type { Database } from 'better-sqlite3';
import { registerMigration } from '../migrations.ts';

registerMigration({
    version: 3,
    name: 'add_check_constraints',
    up(db: Database) {
        // ── Validation triggers for trades ──────────────────────
        db.exec(`
            -- Validate on INSERT
            CREATE TRIGGER IF NOT EXISTS trg_trades_insert_validate
            BEFORE INSERT ON trades
            BEGIN
                SELECT CASE
                    WHEN NEW.entry_price <= 0 THEN
                        RAISE(ABORT, 'entry_price must be positive')
                    WHEN NEW.size <= 0 THEN
                        RAISE(ABORT, 'size must be positive')
                    WHEN NEW.symbol = '' OR NEW.symbol IS NULL THEN
                        RAISE(ABORT, 'symbol is required')
                    WHEN NEW.user_id = '' OR NEW.user_id IS NULL THEN
                        RAISE(ABORT, 'user_id is required')
                END;
            END;

            -- Validate on UPDATE
            CREATE TRIGGER IF NOT EXISTS trg_trades_update_validate
            BEFORE UPDATE ON trades
            BEGIN
                SELECT CASE
                    WHEN NEW.entry_price <= 0 THEN
                        RAISE(ABORT, 'entry_price must be positive')
                    WHEN NEW.size <= 0 THEN
                        RAISE(ABORT, 'size must be positive')
                    WHEN NEW.symbol = '' OR NEW.symbol IS NULL THEN
                        RAISE(ABORT, 'symbol is required')
                    WHEN NEW.user_id = '' OR NEW.user_id IS NULL THEN
                        RAISE(ABORT, 'user_id is required')
                END;
            END;

            -- Validate settings values are not null
            CREATE TRIGGER IF NOT EXISTS trg_settings_insert_validate
            BEFORE INSERT ON settings
            BEGIN
                SELECT CASE
                    WHEN NEW.value IS NULL THEN
                        RAISE(ABORT, 'settings value cannot be null')
                    WHEN NEW.key = '' OR NEW.key IS NULL THEN
                        RAISE(ABORT, 'settings key is required')
                END;
            END;

            CREATE TRIGGER IF NOT EXISTS trg_settings_update_validate
            BEFORE UPDATE ON settings
            BEGIN
                SELECT CASE
                    WHEN NEW.value IS NULL THEN
                        RAISE(ABORT, 'settings value cannot be null')
                    WHEN NEW.key = '' OR NEW.key IS NULL THEN
                        RAISE(ABORT, 'settings key is required')
                END;
            END;
        `);
    },
    down(db: Database) {
        db.exec(`
            DROP TRIGGER IF EXISTS trg_trades_insert_validate;
            DROP TRIGGER IF EXISTS trg_trades_update_validate;
            DROP TRIGGER IF EXISTS trg_settings_insert_validate;
            DROP TRIGGER IF EXISTS trg_settings_update_validate;
        `);
    },
});
