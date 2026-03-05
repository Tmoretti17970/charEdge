// ═══════════════════════════════════════════════════════════════════
// Migration 001 — Baseline
//
// Marks the existing schema (created by initSchema) as version 1.
// No DDL changes needed — the schema already exists.
// ═══════════════════════════════════════════════════════════════════

import type { Database } from 'better-sqlite3';
import { registerMigration } from '../migrations.ts';

registerMigration({
    version: 1,
    name: 'baseline',
    up(_db: Database) {
        // No-op: schema already exists via initSchema()
        // This migration exists to establish the baseline version
    },
    down(_db: Database) {
        // No-op: we don't drop the baseline schema
    },
});
