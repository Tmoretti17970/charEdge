// ═══════════════════════════════════════════════════════════════════
// charEdge — Auth Routes (TypeScript)
//
// Endpoints:
//   POST /api/auth/register  — Create account with email + password
//   POST /api/auth/login     — Authenticate and receive tokens
//   POST /api/auth/refresh   — Rotate refresh token, get new access
//   POST /api/auth/logout    — Clear refresh cookie
//   GET  /api/auth/me        — Get current user info
// ═══════════════════════════════════════════════════════════════════

import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { validate } from './schemas.ts';
import {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken,
    setRefreshCookie,
    clearRefreshCookie,
    hashPassword,
    comparePassword,
} from './auth/jwt.ts';
import { requireAuth } from './auth/rbac.ts';
import { getDb } from './db/sqlite.ts';

// ─── Zod Schemas ────────────────────────────────────────────────

const registerSchema = z.object({
    email: z.string().email().max(254).toLowerCase(),
    password: z.string().min(8).max(128),
    displayName: z.string().min(1).max(64).optional(),
}).strict();

const loginSchema = z.object({
    email: z.string().email().max(254).toLowerCase(),
    password: z.string().min(1).max(128),
}).strict();

// ─── User Table (migration-safe) ────────────────────────────────

function ensureUsersTable(): void {
    const db = getDb();
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id              TEXT PRIMARY KEY,
            email           TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash   TEXT NOT NULL,
            display_name    TEXT DEFAULT '',
            role            TEXT NOT NULL DEFAULT 'free' CHECK (role IN ('free', 'trader', 'pro', 'admin')),
            created_at      INTEGER NOT NULL,
            updated_at      INTEGER NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);
}

// ─── Router ─────────────────────────────────────────────────────

export function createAuthRouter(): Router {
    const router = Router();
    ensureUsersTable();

    // ── Register ────────────────────────────────────────────

    router.post('/register', validate(registerSchema), (req: Request, res: Response) => {
        const { email, password, displayName } = req.body;
        const db = getDb();

        // Check existing
        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existing) {
            res.status(409).json({
                ok: false,
                error: { code: 'EMAIL_TAKEN', message: 'An account with this email already exists.' },
            });
            return;
        }

        const now = Date.now();
        const id = `user_${now}_${Math.random().toString(36).slice(2, 8)}`;
        const hash = hashPassword(password);

        db.prepare(`
            INSERT INTO users (id, email, password_hash, display_name, role, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'free', ?, ?)
        `).run(id, email, hash, displayName || '', now, now);

        // Issue tokens
        const user = { id, email, role: 'free' };
        const accessToken = generateAccessToken(user);
        const refresh = generateRefreshToken(user);
        setRefreshCookie(res, refresh.token);

        res.status(201).json({
            ok: true,
            data: {
                user: { id, email, role: 'free', displayName: displayName || '' },
                accessToken,
                expiresIn: 900, // 15 minutes
            },
        });
    });

    // ── Login ───────────────────────────────────────────────

    router.post('/login', validate(loginSchema), (req: Request, res: Response) => {
        const { email, password } = req.body;
        const db = getDb();

        const row = db.prepare(
            'SELECT id, email, password_hash, display_name, role FROM users WHERE email = ?'
        ).get(email) as { id: string; email: string; password_hash: string; display_name: string; role: string } | undefined;

        if (!row || !comparePassword(password, row.password_hash)) {
            res.status(401).json({
                ok: false,
                error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
            });
            return;
        }

        const user = { id: row.id, email: row.email, role: row.role };
        const accessToken = generateAccessToken(user);
        const refresh = generateRefreshToken(user);
        setRefreshCookie(res, refresh.token);

        res.json({
            ok: true,
            data: {
                user: { id: row.id, email: row.email, role: row.role, displayName: row.display_name },
                accessToken,
                expiresIn: 900,
            },
        });
    });

    // ── Refresh ─────────────────────────────────────────────

    router.post('/refresh', (req: Request, res: Response) => {
        const refreshToken = req.cookies?.refreshToken;
        if (!refreshToken) {
            res.status(401).json({
                ok: false,
                error: { code: 'REFRESH_MISSING', message: 'Refresh token required.' },
            });
            return;
        }

        const payload = verifyRefreshToken(refreshToken);
        if (!payload) {
            clearRefreshCookie(res);
            res.status(401).json({
                ok: false,
                error: { code: 'REFRESH_INVALID', message: 'Invalid or expired refresh token.' },
            });
            return;
        }

        // Look up user to get current role
        const db = getDb();
        const row = db.prepare(
            'SELECT id, email, role FROM users WHERE id = ?'
        ).get(payload.sub) as { id: string; email: string; role: string } | undefined;

        if (!row) {
            clearRefreshCookie(res);
            res.status(401).json({
                ok: false,
                error: { code: 'USER_NOT_FOUND', message: 'User account not found.' },
            });
            return;
        }

        // Rotate: issue new tokens
        const user = { id: row.id, email: row.email, role: row.role };
        const accessToken = generateAccessToken(user);
        const newRefresh = generateRefreshToken(user);
        setRefreshCookie(res, newRefresh.token);

        res.json({
            ok: true,
            data: { accessToken, expiresIn: 900 },
        });
    });

    // ── Logout ──────────────────────────────────────────────

    router.post('/logout', (_req: Request, res: Response) => {
        clearRefreshCookie(res);
        res.json({ ok: true, data: { message: 'Logged out successfully.' } });
    });

    // ── Me (Current User) ───────────────────────────────────

    router.get('/me', requireAuth(), (req: Request, res: Response) => {
        res.json({
            ok: true,
            data: {
                id: req.user!.id,
                email: req.user!.email,
                role: req.user!.role,
            },
        });
    });

    return router;
}
