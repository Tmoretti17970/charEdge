// ═══════════════════════════════════════════════════════════════════
// Unit Tests — SettingsRepository
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { initSchema } from '../../../api/db/sqlite-schema.ts';
import { SettingsRepository } from '../../../api/db/SettingsRepository.ts';

const USER_ID = 'test-user';

describe('SettingsRepository', () => {
    let db: InstanceType<typeof Database>;
    let repo: SettingsRepository;

    beforeEach(() => {
        db = new Database(':memory:');
        initSchema(db);
        repo = new SettingsRepository(db);
    });

    afterAll(() => {
        if (db?.open) db.close();
    });

    // ── Set / Get ───────────────────────────────────────────

    it('sets and gets a string value', () => {
        repo.set(USER_ID, 'theme', 'dark');
        expect(repo.get(USER_ID, 'theme')).toBe('dark');
    });

    it('sets and gets a number value', () => {
        repo.set(USER_ID, 'riskPerTrade', 0.02);
        expect(repo.get(USER_ID, 'riskPerTrade')).toBe(0.02);
    });

    it('sets and gets a boolean value', () => {
        repo.set(USER_ID, 'notifications', true);
        expect(repo.get(USER_ID, 'notifications')).toBe(true);
    });

    it('sets and gets an object value', () => {
        const layout = { showVolume: true, showGrid: false };
        repo.set(USER_ID, 'chartLayout', layout);
        expect(repo.get(USER_ID, 'chartLayout')).toEqual(layout);
    });

    it('returns undefined for non-existent key', () => {
        expect(repo.get(USER_ID, 'nonexistent')).toBeUndefined();
    });

    // ── Upsert ──────────────────────────────────────────────

    it('updates on conflict (upsert)', () => {
        repo.set(USER_ID, 'theme', 'light');
        repo.set(USER_ID, 'theme', 'dark');
        expect(repo.get(USER_ID, 'theme')).toBe('dark');
    });

    // ── Has ─────────────────────────────────────────────────

    it('checks if a key exists', () => {
        repo.set(USER_ID, 'theme', 'dark');
        expect(repo.has(USER_ID, 'theme')).toBe(true);
        expect(repo.has(USER_ID, 'missing')).toBe(false);
    });

    // ── GetAll ──────────────────────────────────────────────

    it('gets all settings for a user', () => {
        repo.set(USER_ID, 'theme', 'dark');
        repo.set(USER_ID, 'lang', 'en');
        repo.set(USER_ID, 'fontSize', 14);

        const all = repo.getAll(USER_ID);
        expect(all).toEqual({
            theme: 'dark',
            lang: 'en',
            fontSize: 14,
        });
    });

    it('returns empty object for non-existent user', () => {
        expect(repo.getAll('nobody')).toEqual({});
    });

    // ── Delete ──────────────────────────────────────────────

    it('deletes a setting', () => {
        repo.set(USER_ID, 'theme', 'dark');
        expect(repo.delete(USER_ID, 'theme')).toBe(true);
        expect(repo.get(USER_ID, 'theme')).toBeUndefined();
    });

    it('returns false for non-existent delete', () => {
        expect(repo.delete(USER_ID, 'missing')).toBe(false);
    });

    // ── Bulk Set ────────────────────────────────────────────

    it('bulk sets multiple settings in a transaction', () => {
        const result = repo.bulkSet(USER_ID, {
            theme: 'dark',
            lang: 'en',
            riskPerTrade: 0.02,
        });

        expect(result.set).toBe(3);
        expect(repo.get(USER_ID, 'theme')).toBe('dark');
        expect(repo.get(USER_ID, 'lang')).toBe('en');
        expect(repo.get(USER_ID, 'riskPerTrade')).toBe(0.02);
    });

    // ── User Isolation ──────────────────────────────────────

    it('isolates settings by user', () => {
        repo.set(USER_ID, 'theme', 'dark');
        repo.set('other-user', 'theme', 'light');

        expect(repo.get(USER_ID, 'theme')).toBe('dark');
        expect(repo.get('other-user', 'theme')).toBe('light');
    });
});
