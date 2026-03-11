// ═══════════════════════════════════════════════════════════════════
// charEdge — Database Connection (TypeScript)
//
// Phase 5 Task 5.1.1: PostgreSQL connection via Drizzle ORM.
// Phase 2: Converted to TypeScript.
// ═══════════════════════════════════════════════════════════════════

import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.ts';

const { Pool } = pg;

// ─── Types ──────────────────────────────────────────────────────

type DbInstance = NodePgDatabase<typeof schema>;

export interface PingResult {
    ok: boolean;
    latencyMs: number;
}

// ─── State ──────────────────────────────────────────────────────

let _db: DbInstance | null = null;
let _pool: pg.Pool | null = null;

/**
 * Get or create the database connection.
 */
export function getDb(): DbInstance | null {
    if (_db) return _db;

    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        console.warn('[DB] DATABASE_URL not set — database features will be unavailable');
        return null;
    }

    _pool = new Pool({
        connectionString: databaseUrl,
        max: parseInt(process.env.DB_POOL_MAX || '10', 10),
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
    });

    _pool.on('error', (err: Error) => {
        console.error('[DB] Unexpected pool error:', err.message);
    });

    _db = drizzle(_pool, { schema });
    console.info('[DB] Connected to PostgreSQL');
    return _db;
}

/**
 * Close the database connection pool.
 */
export async function closeDb(): Promise<void> {
    if (_pool) {
        await _pool.end();
        _pool = null;
        _db = null;
        console.info('[DB] Connection pool closed');
    }
}

/**
 * Check database connectivity.
 */
export async function pingDb(): Promise<PingResult> {
    if (!_pool) return { ok: false, latencyMs: -1 };
    const start = performance.now();
    try {
        await _pool.query('SELECT 1');
        return { ok: true, latencyMs: Math.round(performance.now() - start) };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
        return { ok: false, latencyMs: Math.round(performance.now() - start) };
    }
}

export { schema };
export default getDb;
