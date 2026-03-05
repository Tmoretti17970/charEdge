// ═══════════════════════════════════════════════════════════════════
// Unit Tests — CrudRepository
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { initSchema } from '../../../api/db/sqlite-schema.ts';
import { CrudRepository } from '../../../api/db/CrudRepository.ts';

const USER_ID = 'test-user';

describe('CrudRepository', () => {
    let db: InstanceType<typeof Database>;
    let repo: CrudRepository;

    beforeEach(() => {
        db = new Database(':memory:');
        initSchema(db);
        repo = new CrudRepository(db, 'playbooks');
    });

    afterAll(() => {
        if (db?.open) db.close();
    });

    // ── Create ──────────────────────────────────────────────

    it('creates an item and stores data as JSON', () => {
        const item = repo.create(USER_ID, {
            id: 'pb-1',
            name: 'Range Breakout',
            description: 'Enter on breakout',
            rules: [{ label: 'Wait for close' }],
        });

        expect(item.id).toBe('pb-1');
        expect(item.userId).toBe(USER_ID);
        expect(item.name).toBe('Range Breakout');
        expect(item.rules).toEqual([{ label: 'Wait for close' }]);
        expect(item._createdAt).toBeGreaterThan(0);
    });

    it('upserts on conflict (replaces existing)', () => {
        repo.create(USER_ID, { id: 'pb-1', name: 'Original' });
        repo.create(USER_ID, { id: 'pb-1', name: 'Updated' });

        const item = repo.findById(USER_ID, 'pb-1');
        expect(item!.name).toBe('Updated');
    });

    it('throws on missing id', () => {
        expect(() => repo.create(USER_ID, { id: '' })).toThrow();
    });

    // ── Find ────────────────────────────────────────────────

    it('finds item by ID', () => {
        repo.create(USER_ID, { id: 'pb-1', name: 'Test' });
        const found = repo.findById(USER_ID, 'pb-1');
        expect(found).not.toBeNull();
        expect(found!.name).toBe('Test');
    });

    it('returns null for non-existent', () => {
        expect(repo.findById(USER_ID, 'nope')).toBeNull();
    });

    it('isolates by user', () => {
        repo.create(USER_ID, { id: 'pb-1', name: 'Test' });
        expect(repo.findById('other-user', 'pb-1')).toBeNull();
    });

    // ── List ────────────────────────────────────────────────

    it('lists all items for a user', () => {
        repo.create(USER_ID, { id: 'pb-1', name: 'One' });
        repo.create(USER_ID, { id: 'pb-2', name: 'Two' });
        repo.create('other-user', { id: 'pb-3', name: 'Other' });

        const items = repo.list(USER_ID);
        expect(items).toHaveLength(2);
    });

    // ── Update ──────────────────────────────────────────────

    it('updates an item with merge', () => {
        repo.create(USER_ID, { id: 'pb-1', name: 'Original', tier: 'gold' });
        const updated = repo.update(USER_ID, 'pb-1', { name: 'Updated' });

        expect(updated!.name).toBe('Updated');
        // Merged: tier should still exist
        expect(updated!.tier).toBe('gold');
    });

    it('returns null when updating non-existent', () => {
        expect(repo.update(USER_ID, 'fake', { name: 'X' })).toBeNull();
    });

    // ── Delete ──────────────────────────────────────────────

    it('deletes an item', () => {
        repo.create(USER_ID, { id: 'pb-1', name: 'Delete Me' });
        expect(repo.delete(USER_ID, 'pb-1')).toBe(true);
        expect(repo.findById(USER_ID, 'pb-1')).toBeNull();
    });

    it('returns false for non-existent delete', () => {
        expect(repo.delete(USER_ID, 'nope')).toBe(false);
    });

    // ── Bulk Upsert ─────────────────────────────────────────

    it('bulk upserts items in a transaction', () => {
        const items = [
            { id: 'pb-1', name: 'One', _updatedAt: Date.now() },
            { id: 'pb-2', name: 'Two', _updatedAt: Date.now() },
        ];

        const result = repo.bulkUpsert(USER_ID, items);
        expect(result.upserted).toBe(2);
        expect(repo.list(USER_ID)).toHaveLength(2);
    });

    // ── Works with different tables ─────────────────────────

    it('works with notes table', () => {
        const noteRepo = new CrudRepository(db, 'notes');
        noteRepo.create(USER_ID, { id: 'n-1', title: 'My Note', content: 'Hello' });
        const note = noteRepo.findById(USER_ID, 'n-1');
        expect(note!.title).toBe('My Note');
    });

    it('works with plans table', () => {
        const planRepo = new CrudRepository(db, 'plans');
        planRepo.create(USER_ID, { id: 'p-1', symbol: 'BTCUSDT', thesis: 'Bullish' });
        const plan = planRepo.findById(USER_ID, 'p-1');
        expect(plan!.symbol).toBe('BTCUSDT');
    });
});
