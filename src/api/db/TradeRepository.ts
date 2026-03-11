// ═══════════════════════════════════════════════════════════════════
// charEdge — Trade Repository (SQLite)
//
// Type-safe CRUD operations for the trades table.
// Includes filtering, cursor-based pagination, stats, and equity curve.
// ═══════════════════════════════════════════════════════════════════

import type { Database } from 'better-sqlite3';

// ─── Types ──────────────────────────────────────────────────────

export interface Trade {
    id: string;
    userId: string;
    symbol: string;
    side: 'long' | 'short';
    entryPrice: number;
    exitPrice: number | null;
    entryDate: string;
    exitDate: string | null;
    size: number;
    pnl: number | null;
    notes: string;
    tags: string[];
    setup: string;
    createdAt: number;
    updatedAt: number;
}

export interface TradeFilters {
    symbol?: string | undefined;
    side?: string | undefined;
    dateFrom?: string | undefined;
    dateTo?: string | undefined;
}

export interface PaginationOptions {
    limit?: number | undefined;
    offset?: number | undefined;
    cursor?: string | undefined;   // Trade ID for cursor-based pagination
}

export interface PaginatedResult<T> {
    data: T[];
    total: number;
    hasMore: boolean;
    nextCursor?: string;
}

export interface TradeStats {
    totalTrades: number;
    wins: number;
    losses: number;
    winRate: number;
    totalPnl: number;
    avgPnl: number;
    largestWin: number;
    largestLoss: number;
    profitFactor: number;
    avgRR?: number;
}

export interface EquityCurvePoint {
    date: string | null;
    pnl: number | null;
    cumulative: number;
    tradeId: string;
}

// ─── Raw Row Type ───────────────────────────────────────────────

interface TradeRow {
    id: string;
    user_id: string;
    symbol: string;
    side: string;
    entry_price: number;
    exit_price: number | null;
    entry_date: string;
    exit_date: string | null;
    size: number;
    pnl: number | null;
    notes: string;
    tags: string;  // JSON string
    setup: string;
    created_at: number;
    updated_at: number;
}

// ─── Mapper ─────────────────────────────────────────────────────

function rowToTrade(row: TradeRow): Trade {
    return {
        id: row.id,
        userId: row.user_id,
        symbol: row.symbol,
        side: row.side as 'long' | 'short',
        entryPrice: row.entry_price,
        exitPrice: row.exit_price,
        entryDate: row.entry_date,
        exitDate: row.exit_date,
        size: row.size,
        pnl: row.pnl,
        notes: row.notes || '',
        tags: JSON.parse(row.tags || '[]'),
        setup: row.setup || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

// ─── Repository ─────────────────────────────────────────────────

export class TradeRepository {
    private db: Database;

    constructor(db: Database) {
        this.db = db;
    }

    /**
     * List trades with optional filters and pagination.
     */
    list(userId: string, filters: TradeFilters = {}, pagination: PaginationOptions = {}): PaginatedResult<Trade> {
        const { limit = 50, _offset = 0 } = pagination;
        const conditions: string[] = ['user_id = ?'];
        const params: unknown[] = [userId];

        if (filters.symbol) {
            conditions.push('LOWER(symbol) = LOWER(?)');
            params.push(filters.symbol);
        }
        if (filters.side) {
            conditions.push('side = ?');
            params.push(filters.side);
        }
        if (filters.dateFrom) {
            conditions.push('entry_date >= ?');
            params.push(filters.dateFrom);
        }
        if (filters.dateTo) {
            conditions.push('entry_date <= ?');
            params.push(filters.dateTo);
        }

        // Cursor-based pagination
        if (pagination.cursor) {
            const cursorRow = this.db.prepare(
                'SELECT entry_date, id FROM trades WHERE id = ?'
            ).get(pagination.cursor) as { entry_date: string; id: string } | undefined;

            if (cursorRow) {
                conditions.push('(entry_date < ? OR (entry_date = ? AND id < ?))');
                params.push(cursorRow.entry_date, cursorRow.entry_date, cursorRow.id);
            }
        }

        const where = conditions.join(' AND ');

        // Count total matching
        const countRow = this.db.prepare(
            `SELECT COUNT(*) as count FROM trades WHERE ${where}`
        ).get(...params) as { count: number };
        const total = countRow?.count ?? 0;

        // Fetch page
        const rows = this.db.prepare(
            `SELECT * FROM trades WHERE ${where}
             ORDER BY entry_date DESC, id DESC
             LIMIT ?`
        ).all(...params, limit + 1) as TradeRow[];

        const hasMore = rows.length > limit;
        const pageRows = hasMore ? rows.slice(0, limit) : rows;
        const data = pageRows.map(rowToTrade);

        const result: PaginatedResult<Trade> = { data, total, hasMore };
        if (hasMore && pageRows.length > 0) {
            result.nextCursor = pageRows[pageRows.length - 1]!.id;
        }

        return result;
    }

    /**
     * Find a single trade by ID.
     */
    findById(userId: string, tradeId: string): Trade | null {
        const row = this.db.prepare(
            'SELECT * FROM trades WHERE id = ? AND user_id = ?'
        ).get(tradeId, userId) as TradeRow | undefined;

        return row ? rowToTrade(row) : null;
    }

    /**
     * Create a new trade.
     */
    create(userId: string, input: Omit<Trade, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Trade {
        const now = Date.now();
        const id = `trade_${now}_${Math.random().toString(36).slice(2, 6)}`;

        this.db.prepare(`
            INSERT INTO trades (id, user_id, symbol, side, entry_price, exit_price,
                               entry_date, exit_date, size, pnl, notes, tags, setup,
                               created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, userId, String(input.symbol).toUpperCase(), input.side,
            input.entryPrice, input.exitPrice ?? null,
            input.entryDate || new Date().toISOString(), input.exitDate ?? null,
            input.size ?? 1, input.pnl ?? null,
            input.notes || '', JSON.stringify(input.tags || []),
            input.setup || '', now, now
        );

        return this.findById(userId, id)!;
    }

    /**
     * Update an existing trade (partial update).
     */
    update(userId: string, tradeId: string, fields: Partial<Trade>): Trade | null {
        const existing = this.findById(userId, tradeId);
        if (!existing) return null;

        const mutable: (keyof Trade)[] = [
            'symbol', 'side', 'entryPrice', 'exitPrice', 'entryDate',
            'exitDate', 'size', 'pnl', 'notes', 'tags', 'setup',
        ];

        const columnMap: Record<string, string> = {
            symbol: 'symbol', side: 'side', entryPrice: 'entry_price',
            exitPrice: 'exit_price', entryDate: 'entry_date', exitDate: 'exit_date',
            size: 'size', pnl: 'pnl', notes: 'notes', tags: 'tags', setup: 'setup',
        };

        const sets: string[] = [];
        const params: unknown[] = [];

        for (const key of mutable) {
            if (fields[key] !== undefined) {
                sets.push(`${columnMap[key]} = ?`);
                params.push(key === 'tags' ? JSON.stringify(fields[key]) : fields[key]);
            }
        }

        if (sets.length === 0) return existing;

        sets.push('updated_at = ?');
        params.push(Date.now());
        params.push(tradeId, userId);

        this.db.prepare(
            `UPDATE trades SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`
        ).run(...params);

        return this.findById(userId, tradeId);
    }

    /**
     * Delete a trade.
     */
    delete(userId: string, tradeId: string): boolean {
        const result = this.db.prepare(
            'DELETE FROM trades WHERE id = ? AND user_id = ?'
        ).run(tradeId, userId);

        return result.changes > 0;
    }

    /**
     * Create a trade and log to audit_log in a single transaction.
     * Ensures both operations succeed or both are rolled back.
     */
    createWithAudit(userId: string, input: Omit<Trade, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Trade {
        const now = Date.now();
        const id = `trade_${now}_${Math.random().toString(36).slice(2, 6)}`;

        const tx = this.db.transaction(() => {
            this.db.prepare(`
                INSERT INTO trades (id, user_id, symbol, side, entry_price, exit_price,
                                   entry_date, exit_date, size, pnl, notes, tags, setup,
                                   created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                id, userId, String(input.symbol).toUpperCase(), input.side,
                input.entryPrice, input.exitPrice ?? null,
                input.entryDate || new Date().toISOString(), input.exitDate ?? null,
                input.size ?? 1, input.pnl ?? null,
                input.notes || '', JSON.stringify(input.tags || []),
                input.setup || '', now, now
            );

            this.db.prepare(`
                INSERT INTO audit_log (user_id, action, entity_type, entity_id, metadata, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(userId, 'trade.created', 'trade', id, JSON.stringify({
                symbol: String(input.symbol).toUpperCase(),
                side: input.side,
                entryPrice: input.entryPrice,
            }), now);
        });

        tx();
        return this.findById(userId, id)!;
    }

    /**
     * Delete a trade with audit logging in a single transaction.
     */
    deleteWithAudit(userId: string, tradeId: string): boolean {
        let deleted = false;

        const tx = this.db.transaction(() => {
            const result = this.db.prepare(
                'DELETE FROM trades WHERE id = ? AND user_id = ?'
            ).run(tradeId, userId);
            deleted = result.changes > 0;

            if (deleted) {
                this.db.prepare(`
                    INSERT INTO audit_log (user_id, action, entity_type, entity_id, metadata, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                `).run(userId, 'trade.deleted', 'trade', tradeId, '{}', Date.now());
            }
        });

        tx();
        return deleted;
    }

    /**
     * Bulk upsert trades (used by sync). Wrapped in a transaction.
     */
    bulkUpsert(userId: string, trades: Trade[]): { upserted: number } {
        let upserted = 0;

        const upsertTx = this.db.transaction((items: Trade[]) => {
            for (const trade of items) {
                if (!trade.id) continue;

                const existing = this.db.prepare(
                    'SELECT updated_at FROM trades WHERE id = ?'
                ).get(trade.id) as { updated_at: number } | undefined;

                if (existing) {
                    // Only update if newer
                    if ((trade.updatedAt || 0) > (existing.updated_at || 0)) {
                        this.db.prepare(`
                            UPDATE trades SET user_id = ?, symbol = ?, side = ?,
                                entry_price = ?, exit_price = ?, entry_date = ?, exit_date = ?,
                                size = ?, pnl = ?, notes = ?, tags = ?, setup = ?,
                                updated_at = ?
                            WHERE id = ?
                        `).run(
                            userId, trade.symbol, trade.side,
                            trade.entryPrice, trade.exitPrice,
                            trade.entryDate, trade.exitDate,
                            trade.size, trade.pnl, trade.notes,
                            JSON.stringify(trade.tags || []),
                            trade.setup, trade.updatedAt || Date.now(),
                            trade.id
                        );
                    }
                } else {
                    this.db.prepare(`
                        INSERT INTO trades (id, user_id, symbol, side, entry_price, exit_price,
                                           entry_date, exit_date, size, pnl, notes, tags, setup,
                                           created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(
                        trade.id, userId, trade.symbol, trade.side,
                        trade.entryPrice, trade.exitPrice,
                        trade.entryDate, trade.exitDate,
                        trade.size, trade.pnl, trade.notes || '',
                        JSON.stringify(trade.tags || []),
                        trade.setup || '',
                        trade.createdAt || Date.now(),
                        trade.updatedAt || Date.now()
                    );
                }
                upserted++;
            }
        });

        upsertTx(trades);
        return { upserted };
    }

    /**
     * Get trades updated after a given timestamp (for sync pull).
     */
    listSince(userId: string, sinceMs: number): Trade[] {
        const rows = this.db.prepare(
            'SELECT * FROM trades WHERE user_id = ? AND updated_at > ? ORDER BY entry_date DESC'
        ).all(userId, sinceMs) as TradeRow[];

        return rows.map(rowToTrade);
    }

    /**
     * Compute basic stats for closed trades.
     */
    computeStats(userId: string): TradeStats {
        const rows = this.db.prepare(
            'SELECT * FROM trades WHERE user_id = ? AND exit_price IS NOT NULL'
        ).all(userId) as TradeRow[];

        const trades = rows.map(rowToTrade);

        if (trades.length === 0) {
            return {
                totalTrades: 0, wins: 0, losses: 0, winRate: 0,
                totalPnl: 0, avgPnl: 0, largestWin: 0, largestLoss: 0,
                profitFactor: 0, avgRR: 0,
            };
        }

        const wins = trades.filter(t => (t.pnl || 0) > 0);
        const losses = trades.filter(t => (t.pnl || 0) < 0);
        const totalPnl = trades.reduce((s, t) => s + (t.pnl || 0), 0);
        const grossProfit = wins.reduce((s, t) => s + (t.pnl || 0), 0);
        const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.pnl || 0), 0));

        return {
            totalTrades: trades.length,
            wins: wins.length,
            losses: losses.length,
            winRate: +((wins.length / trades.length) * 100).toFixed(1),
            totalPnl: +totalPnl.toFixed(2),
            avgPnl: +(totalPnl / trades.length).toFixed(2),
            largestWin: wins.length > 0 ? +Math.max(...wins.map(t => t.pnl!)).toFixed(2) : 0,
            largestLoss: losses.length > 0 ? +Math.min(...losses.map(t => t.pnl!)).toFixed(2) : 0,
            profitFactor: grossLoss > 0 ? +(grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? Infinity : 0,
        };
    }

    /**
     * Compute equity curve from closed trades.
     */
    equityCurve(userId: string): EquityCurvePoint[] {
        const rows = this.db.prepare(`
            SELECT * FROM trades
            WHERE user_id = ? AND pnl IS NOT NULL
            ORDER BY COALESCE(exit_date, entry_date) ASC
        `).all(userId) as TradeRow[];

        let cumulative = 0;
        return rows.map(row => {
            cumulative += row.pnl || 0;
            return {
                date: row.exit_date || row.entry_date,
                pnl: row.pnl,
                cumulative,
                tradeId: row.id,
            };
        });
    }
}
