// ═══════════════════════════════════════════════════════════════════
// Integration Test — Auth Flow (Register → Login → Refresh → Me)
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { initSchema } from '../../../api/db/sqlite-schema.ts';
import {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    hashPassword,
    comparePassword,
} from '../../../api/auth/jwt.ts';
import { createUser, resetFactories } from '../../helpers/factories.ts';

// Set JWT_SECRET for test environment
process.env.JWT_SECRET = 'test-secret-key-for-ci-only-32chars!';

describe('Auth Flow Integration', () => {
    let db: InstanceType<typeof Database>;

    beforeEach(() => {
        db = new Database(':memory:');
        initSchema(db);
        resetFactories();

        // Create users table
        db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id              TEXT PRIMARY KEY,
                email           TEXT NOT NULL UNIQUE COLLATE NOCASE,
                password_hash   TEXT NOT NULL,
                display_name    TEXT DEFAULT '',
                role            TEXT NOT NULL DEFAULT 'free',
                created_at      INTEGER NOT NULL,
                updated_at      INTEGER NOT NULL
            );
        `);
    });

    it('registers a user with hashed password', () => {
        const user = createUser();
        const hash = hashPassword(user.password);

        const now = Date.now();
        db.prepare(`
            INSERT INTO users (id, email, password_hash, display_name, role, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(user.id, user.email, hash, user.displayName, user.role, now, now);

        const row = db.prepare('SELECT * FROM users WHERE email = ?').get(user.email) as {
            id: string; email: string; password_hash: string; role: string;
        };

        expect(row).toBeTruthy();
        expect(row.email).toBe(user.email);
        expect(row.password_hash).not.toBe(user.password); // Hashed, not plaintext
    });

    it('login: verifies password and issues tokens', () => {
        const user = createUser();
        const hash = hashPassword(user.password);

        db.prepare(`
            INSERT INTO users (id, email, password_hash, display_name, role, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(user.id, user.email, hash, user.displayName, 'trader', Date.now(), Date.now());

        // Simulate login: verify password
        const isValid = comparePassword(user.password, hash);
        expect(isValid).toBe(true);

        // Issue tokens
        const tokenUser = { id: user.id, email: user.email, role: 'trader' };
        const accessToken = generateAccessToken(tokenUser);
        const refresh = generateRefreshToken(tokenUser);

        expect(accessToken).toBeTruthy();
        expect(refresh.token).toBeTruthy();
        expect(refresh.jti).toBeTruthy();
    });

    it('access token contains correct user info', () => {
        const user = createUser({ role: 'pro' });
        const tokenUser = { id: user.id, email: user.email, role: 'pro' };
        const accessToken = generateAccessToken(tokenUser);

        const payload = verifyAccessToken(accessToken);
        expect(payload).toBeTruthy();
        expect(payload!.sub).toBe(user.id);
        expect(payload!.email).toBe(user.email);
        expect(payload!.role).toBe('pro');
        expect(payload!.type).toBe('access');
    });

    it('refresh token can be verified', () => {
        const user = createUser();
        const tokenUser = { id: user.id, email: user.email, role: 'free' };
        const refresh = generateRefreshToken(tokenUser);

        const payload = verifyRefreshToken(refresh.token);
        expect(payload).toBeTruthy();
        expect(payload!.sub).toBe(user.id);
        expect(payload!.type).toBe('refresh');
        expect(payload!.jti).toBe(refresh.jti);
    });

    it('rejects wrong password', () => {
        const user = createUser();
        const hash = hashPassword(user.password);
        const isValid = comparePassword('WrongPassword!', hash);
        expect(isValid).toBe(false);
    });

    it('rejects tampered access token', () => {
        const user = createUser();
        const tokenUser = { id: user.id, email: user.email, role: 'free' };
        const accessToken = generateAccessToken(tokenUser);

        // Tamper with the token
        const tampered = accessToken.slice(0, -5) + 'XXXXX';
        const payload = verifyAccessToken(tampered);
        expect(payload).toBeNull();
    });

    it('full flow: register → login → refresh → verify', () => {
        const user = createUser({ email: 'flow@test.com', role: 'trader' });
        const hash = hashPassword(user.password);
        const now = Date.now();

        // 1. Register
        db.prepare(`
            INSERT INTO users (id, email, password_hash, display_name, role, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(user.id, user.email, hash, user.displayName, user.role, now, now);

        // 2. Login
        const row = db.prepare('SELECT * FROM users WHERE email = ?').get(user.email) as {
            id: string; email: string; password_hash: string; role: string;
        };
        expect(comparePassword(user.password, row.password_hash)).toBe(true);

        // 3. Issue initial tokens
        const tokenUser = { id: row.id, email: row.email, role: row.role };
        const accessToken = generateAccessToken(tokenUser);
        const refresh = generateRefreshToken(tokenUser);

        // 4. Verify access — simulates GET /me
        const accessPayload = verifyAccessToken(accessToken);
        expect(accessPayload!.sub).toBe(user.id);

        // 5. Refresh — simulates POST /refresh
        const refreshPayload = verifyRefreshToken(refresh.token);
        expect(refreshPayload!.sub).toBe(user.id);

        // 6. Issue new tokens (rotation)
        const newAccess = generateAccessToken(tokenUser);
        const newRefresh = generateRefreshToken(tokenUser);
        // Verify new tokens are valid (iat may match within same second, so test validity not inequality)
        expect(verifyAccessToken(newAccess)).toBeTruthy();
        expect(newRefresh.jti).toBeTruthy();
        expect(newRefresh.jti).not.toBe(refresh.jti); // New JTI = unique per call
    });

    it('enforces email uniqueness', () => {
        const user = createUser({ email: 'dupe@test.com' });
        const hash = hashPassword(user.password);
        const now = Date.now();

        db.prepare(`
            INSERT INTO users (id, email, password_hash, display_name, role, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(user.id, user.email, hash, user.displayName, user.role, now, now);

        // Second insert should fail
        expect(() => {
            db.prepare(`
                INSERT INTO users (id, email, password_hash, display_name, role, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run('user_dupe', user.email, hash, 'Dupe', 'free', now, now);
        }).toThrow();
    });
});
