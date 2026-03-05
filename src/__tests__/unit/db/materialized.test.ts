// ═══════════════════════════════════════════════════════════════════
// Unit Tests — Materialized Views
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { initSchema } from '../../../api/db/sqlite-schema.ts';
import { TradeRepository } from '../../../api/db/TradeRepository.ts';
import {
    refreshDailyPnl,
    refreshWeeklyStats,
    getDailyPnl,
    getWeeklyStats,
} from '../../../api/db/materialized.ts';

const USER_ID = 'test-user';

describe('Materialized Views', () => {
    let db: InstanceType<typeof Database>;
    let repo: TradeRepository;

    beforeEach(() => {
        db = new Database(':memory:');
        initSchema(db);
        repo = new TradeRepository(db);
    });

    it('computes daily P&L from closed trades', () => {
        repo.create(USER_ID, {
            symbol: 'BTCUSDT', side: 'long', entryPrice: 42000,
            exitPrice: 43000, entryDate: '2024-01-15T09:00:00Z', exitDate: '2024-01-15T15:00:00Z',
            size: 1, pnl: 1000, notes: '', tags: [], setup: '',
        });
        repo.create(USER_ID, {
            symbol: 'ETHUSDT', side: 'short', entryPrice: 2500,
            exitPrice: 2400, entryDate: '2024-01-15T10:00:00Z', exitDate: '2024-01-15T16:00:00Z',
            size: 1, pnl: 100, notes: '', tags: [], setup: '',
        });
        repo.create(USER_ID, {
            symbol: 'BTCUSDT', side: 'long', entryPrice: 44000,
            exitPrice: 43500, entryDate: '2024-01-16T09:00:00Z', exitDate: '2024-01-16T15:00:00Z',
            size: 1, pnl: -500, notes: '', tags: [], setup: '',
        });

        const rows = refreshDailyPnl(db, USER_ID);
        expect(rows).toBe(2); // 2 distinct dates

        const daily = getDailyPnl(db, USER_ID);
        expect(daily).toHaveLength(2);
        expect(daily[0]!.date).toBe('2024-01-15');
        expect(daily[0]!.totalPnl).toBe(1100); // 1000 + 100
        expect(daily[0]!.tradeCount).toBe(2);
        expect(daily[0]!.winCount).toBe(2);

        expect(daily[1]!.date).toBe('2024-01-16');
        expect(daily[1]!.totalPnl).toBe(-500);
        expect(daily[1]!.lossCount).toBe(1);
    });

    it('filters daily P&L by date range', () => {
        repo.create(USER_ID, {
            symbol: 'BTCUSDT', side: 'long', entryPrice: 42000,
            exitPrice: 43000, entryDate: '2024-01-15T09:00:00Z', exitDate: '2024-01-15T15:00:00Z',
            size: 1, pnl: 1000, notes: '', tags: [], setup: '',
        });
        repo.create(USER_ID, {
            symbol: 'BTCUSDT', side: 'long', entryPrice: 44000,
            exitPrice: 44500, entryDate: '2024-02-01T09:00:00Z', exitDate: '2024-02-01T15:00:00Z',
            size: 1, pnl: 500, notes: '', tags: [], setup: '',
        });

        refreshDailyPnl(db, USER_ID);

        const filtered = getDailyPnl(db, USER_ID, '2024-02-01', '2024-02-28');
        expect(filtered).toHaveLength(1);
        expect(filtered[0]!.totalPnl).toBe(500);
    });

    it('computes weekly stats from daily P&L', () => {
        repo.create(USER_ID, {
            symbol: 'BTCUSDT', side: 'long', entryPrice: 42000,
            exitPrice: 43000, entryDate: '2024-01-15T09:00:00Z', exitDate: '2024-01-15T15:00:00Z',
            size: 1, pnl: 1000, notes: '', tags: [], setup: '',
        });

        refreshDailyPnl(db, USER_ID);
        const weeks = refreshWeeklyStats(db, USER_ID);
        expect(weeks).toBeGreaterThanOrEqual(1);

        const stats = getWeeklyStats(db, USER_ID);
        expect(stats.length).toBeGreaterThanOrEqual(1);
        expect(stats[0]!.totalPnl).toBe(1000);
    });

    it('returns empty arrays when no data', () => {
        expect(getDailyPnl(db, USER_ID)).toEqual([]);
        expect(getWeeklyStats(db, USER_ID)).toEqual([]);
    });

    it('is idempotent — refreshing twice produces same result', () => {
        repo.create(USER_ID, {
            symbol: 'BTCUSDT', side: 'long', entryPrice: 42000,
            exitPrice: 43000, entryDate: '2024-01-15T09:00:00Z', exitDate: '2024-01-15T15:00:00Z',
            size: 1, pnl: 1000, notes: '', tags: [], setup: '',
        });

        refreshDailyPnl(db, USER_ID);
        const first = getDailyPnl(db, USER_ID);

        refreshDailyPnl(db, USER_ID);
        const second = getDailyPnl(db, USER_ID);

        expect(first.length).toBe(second.length);
        expect(first[0]!.totalPnl).toBe(second[0]!.totalPnl);
    });
});
