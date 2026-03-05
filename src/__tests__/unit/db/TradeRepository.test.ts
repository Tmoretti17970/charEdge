// ═══════════════════════════════════════════════════════════════════
// Unit Tests — TradeRepository
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { initSchema } from '../../../api/db/sqlite-schema.ts';
import { TradeRepository } from '../../../api/db/TradeRepository.ts';

const USER_ID = 'test-user';

describe('TradeRepository', () => {
    let db: InstanceType<typeof Database>;
    let repo: TradeRepository;

    beforeEach(() => {
        db = new Database(':memory:');
        initSchema(db);
        repo = new TradeRepository(db);
    });

    afterAll(() => {
        if (db?.open) db.close();
    });

    // ── Create ──────────────────────────────────────────────

    it('creates a trade with generated ID and timestamps', () => {
        const trade = repo.create(USER_ID, {
            symbol: 'BTCUSDT',
            side: 'long',
            entryPrice: 42000,
            exitPrice: 43000,
            entryDate: '2024-01-15T09:00:00Z',
            exitDate: '2024-01-15T14:00:00Z',
            size: 0.5,
            pnl: 500,
            notes: 'Test trade',
            tags: ['breakout'],
            setup: 'Range Breakout',
        });

        expect(trade.id).toMatch(/^trade_/);
        expect(trade.userId).toBe(USER_ID);
        expect(trade.symbol).toBe('BTCUSDT');
        expect(trade.side).toBe('long');
        expect(trade.entryPrice).toBe(42000);
        expect(trade.exitPrice).toBe(43000);
        expect(trade.pnl).toBe(500);
        expect(trade.tags).toEqual(['breakout']);
        expect(trade.createdAt).toBeGreaterThan(0);
        expect(trade.updatedAt).toBeGreaterThan(0);
    });

    it('uppercases the symbol on create', () => {
        const trade = repo.create(USER_ID, {
            symbol: 'ethusdt',
            side: 'long',
            entryPrice: 2000,
            exitPrice: null,
            entryDate: '2024-01-15T09:00:00Z',
            exitDate: null,
            size: 1,
            pnl: null,
            notes: '',
            tags: [],
            setup: '',
        });

        expect(trade.symbol).toBe('ETHUSDT');
    });

    // ── Find ────────────────────────────────────────────────

    it('finds a trade by ID', () => {
        const created = repo.create(USER_ID, {
            symbol: 'BTCUSDT', side: 'long', entryPrice: 42000,
            exitPrice: null, entryDate: '2024-01-15T09:00:00Z', exitDate: null,
            size: 1, pnl: null, notes: '', tags: [], setup: '',
        });

        const found = repo.findById(USER_ID, created.id);
        expect(found).not.toBeNull();
        expect(found!.id).toBe(created.id);
    });

    it('returns null for non-existent trade', () => {
        expect(repo.findById(USER_ID, 'non-existent')).toBeNull();
    });

    it('respects user isolation', () => {
        const trade = repo.create(USER_ID, {
            symbol: 'BTCUSDT', side: 'long', entryPrice: 42000,
            exitPrice: null, entryDate: '2024-01-15T09:00:00Z', exitDate: null,
            size: 1, pnl: null, notes: '', tags: [], setup: '',
        });

        expect(repo.findById('other-user', trade.id)).toBeNull();
    });

    // ── List ────────────────────────────────────────────────

    it('lists trades with pagination', () => {
        for (let i = 0; i < 5; i++) {
            repo.create(USER_ID, {
                symbol: 'BTCUSDT', side: 'long', entryPrice: 42000 + i,
                exitPrice: null, entryDate: `2024-01-${15 + i}T09:00:00Z`, exitDate: null,
                size: 1, pnl: null, notes: '', tags: [], setup: '',
            });
        }

        const result = repo.list(USER_ID, {}, { limit: 3 });
        expect(result.data).toHaveLength(3);
        expect(result.total).toBe(5);
        expect(result.hasMore).toBe(true);
    });

    it('filters by symbol', () => {
        repo.create(USER_ID, {
            symbol: 'BTCUSDT', side: 'long', entryPrice: 42000,
            exitPrice: null, entryDate: '2024-01-15T09:00:00Z', exitDate: null,
            size: 1, pnl: null, notes: '', tags: [], setup: '',
        });
        repo.create(USER_ID, {
            symbol: 'ETHUSDT', side: 'long', entryPrice: 2000,
            exitPrice: null, entryDate: '2024-01-16T09:00:00Z', exitDate: null,
            size: 1, pnl: null, notes: '', tags: [], setup: '',
        });

        const result = repo.list(USER_ID, { symbol: 'btcusdt' });
        expect(result.data).toHaveLength(1);
        expect(result.data[0]!.symbol).toBe('BTCUSDT');
    });

    it('filters by side', () => {
        repo.create(USER_ID, {
            symbol: 'BTCUSDT', side: 'long', entryPrice: 42000,
            exitPrice: null, entryDate: '2024-01-15T09:00:00Z', exitDate: null,
            size: 1, pnl: null, notes: '', tags: [], setup: '',
        });
        repo.create(USER_ID, {
            symbol: 'BTCUSDT', side: 'short', entryPrice: 43000,
            exitPrice: null, entryDate: '2024-01-16T09:00:00Z', exitDate: null,
            size: 1, pnl: null, notes: '', tags: [], setup: '',
        });

        const result = repo.list(USER_ID, { side: 'short' });
        expect(result.data).toHaveLength(1);
        expect(result.data[0]!.side).toBe('short');
    });

    // ── Update ──────────────────────────────────────────────

    it('updates trade fields', () => {
        const trade = repo.create(USER_ID, {
            symbol: 'BTCUSDT', side: 'long', entryPrice: 42000,
            exitPrice: null, entryDate: '2024-01-15T09:00:00Z', exitDate: null,
            size: 1, pnl: null, notes: '', tags: [], setup: '',
        });

        const updated = repo.update(USER_ID, trade.id, {
            exitPrice: 43000,
            exitDate: '2024-01-15T14:00:00Z',
            pnl: 1000,
        });

        expect(updated).not.toBeNull();
        expect(updated!.exitPrice).toBe(43000);
        expect(updated!.pnl).toBe(1000);
        expect(updated!.updatedAt).toBeGreaterThanOrEqual(trade.updatedAt);
    });

    it('returns null when updating non-existent trade', () => {
        expect(repo.update(USER_ID, 'fake-id', { pnl: 100 })).toBeNull();
    });

    // ── Delete ──────────────────────────────────────────────

    it('deletes a trade', () => {
        const trade = repo.create(USER_ID, {
            symbol: 'BTCUSDT', side: 'long', entryPrice: 42000,
            exitPrice: null, entryDate: '2024-01-15T09:00:00Z', exitDate: null,
            size: 1, pnl: null, notes: '', tags: [], setup: '',
        });

        expect(repo.delete(USER_ID, trade.id)).toBe(true);
        expect(repo.findById(USER_ID, trade.id)).toBeNull();
    });

    it('returns false for non-existent delete', () => {
        expect(repo.delete(USER_ID, 'fake-id')).toBe(false);
    });

    // ── Bulk Upsert ─────────────────────────────────────────

    it('bulk upserts trades in a transaction', () => {
        const now = Date.now();
        const trades = [
            { id: 'bulk-1', userId: USER_ID, symbol: 'BTCUSDT', side: 'long' as const, entryPrice: 42000, exitPrice: null, entryDate: '2024-01-15T09:00:00Z', exitDate: null, size: 1, pnl: null, notes: '', tags: [] as string[], setup: '', createdAt: now, updatedAt: now },
            { id: 'bulk-2', userId: USER_ID, symbol: 'ETHUSDT', side: 'long' as const, entryPrice: 2000, exitPrice: null, entryDate: '2024-01-16T09:00:00Z', exitDate: null, size: 1, pnl: null, notes: '', tags: [] as string[], setup: '', createdAt: now, updatedAt: now },
        ];

        const result = repo.bulkUpsert(USER_ID, trades);
        expect(result.upserted).toBe(2);

        const listed = repo.list(USER_ID);
        expect(listed.total).toBe(2);
    });

    it('bulk upsert uses last-write-wins', () => {
        const now = Date.now();
        const trade = { id: 'lww-1', userId: USER_ID, symbol: 'BTCUSDT', side: 'long' as const, entryPrice: 42000, exitPrice: null, entryDate: '2024-01-15T09:00:00Z', exitDate: null, size: 1, pnl: null, notes: 'original', tags: [] as string[], setup: '', createdAt: now, updatedAt: now };

        repo.bulkUpsert(USER_ID, [trade]);

        // Update with newer timestamp
        const updated = { ...trade, notes: 'updated', updatedAt: now + 1000 };
        repo.bulkUpsert(USER_ID, [updated]);

        const found = repo.findById(USER_ID, 'lww-1');
        expect(found!.notes).toBe('updated');
    });

    // ── Stats ───────────────────────────────────────────────

    it('computes basic stats for closed trades', () => {
        repo.create(USER_ID, { symbol: 'BTCUSDT', side: 'long', entryPrice: 42000, exitPrice: 43000, entryDate: '2024-01-15T09:00:00Z', exitDate: '2024-01-15T14:00:00Z', size: 1, pnl: 1000, notes: '', tags: [], setup: '' });
        repo.create(USER_ID, { symbol: 'BTCUSDT', side: 'short', entryPrice: 43000, exitPrice: 43500, entryDate: '2024-01-16T09:00:00Z', exitDate: '2024-01-16T14:00:00Z', size: 1, pnl: -500, notes: '', tags: [], setup: '' });
        repo.create(USER_ID, { symbol: 'ETHUSDT', side: 'long', entryPrice: 2000, exitPrice: 2200, entryDate: '2024-01-17T09:00:00Z', exitDate: '2024-01-17T14:00:00Z', size: 1, pnl: 200, notes: '', tags: [], setup: '' });

        const stats = repo.computeStats(USER_ID);

        expect(stats.totalTrades).toBe(3);
        expect(stats.wins).toBe(2);
        expect(stats.losses).toBe(1);
        expect(stats.winRate).toBe(66.7);
        expect(stats.totalPnl).toBe(700);
        expect(stats.largestWin).toBe(1000);
        expect(stats.largestLoss).toBe(-500);
        expect(stats.profitFactor).toBe(2.4);
    });

    it('returns zeroed stats when no trades exist', () => {
        const stats = repo.computeStats(USER_ID);
        expect(stats.totalTrades).toBe(0);
        expect(stats.winRate).toBe(0);
    });

    // ── Equity Curve ────────────────────────────────────────

    it('computes cumulative equity curve', () => {
        repo.create(USER_ID, { symbol: 'BTCUSDT', side: 'long', entryPrice: 42000, exitPrice: 43000, entryDate: '2024-01-15T09:00:00Z', exitDate: '2024-01-15T14:00:00Z', size: 1, pnl: 1000, notes: '', tags: [], setup: '' });
        repo.create(USER_ID, { symbol: 'BTCUSDT', side: 'short', entryPrice: 43000, exitPrice: 43500, entryDate: '2024-01-16T09:00:00Z', exitDate: '2024-01-16T14:00:00Z', size: 1, pnl: -500, notes: '', tags: [], setup: '' });

        const curve = repo.equityCurve(USER_ID);

        expect(curve).toHaveLength(2);
        expect(curve[0]!.pnl).toBe(1000);
        expect(curve[0]!.cumulative).toBe(1000);
        expect(curve[1]!.pnl).toBe(-500);
        expect(curve[1]!.cumulative).toBe(500);
    });
});
