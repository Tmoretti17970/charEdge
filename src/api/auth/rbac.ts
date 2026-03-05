// ═══════════════════════════════════════════════════════════════════
// charEdge — RBAC Middleware (TypeScript)
//
// Phase 5 Task 5.1.4: Role-based access control for API routes.
// Phase 2: Converted to TypeScript.
//
// Roles: free < trader < pro < admin
// ═══════════════════════════════════════════════════════════════════

import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from './jwt.ts';

// ─── Types ──────────────────────────────────────────────────────

export type Role = 'free' | 'trader' | 'pro' | 'admin';

export interface AuthUser {
    id: string;
    email: string;
    role: Role;
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}

// Role hierarchy (higher index = more permissions)
export const ROLE_LEVELS: Record<Role, number> = { free: 0, trader: 1, pro: 2, admin: 3 };

/**
 * Middleware: Require a valid JWT access token.
 * Attaches decoded user to `req.user`.
 */
export function requireAuth() {
    return (req: Request, res: Response, next: NextFunction): void => {
        const authHeader = req.headers.authorization;

        if (!authHeader?.startsWith('Bearer ')) {
            res.status(401).json({
                ok: false,
                error: { code: 'AUTH_REQUIRED', message: 'Authorization header with Bearer token required.' },
            });
            return;
        }

        const token = authHeader.slice(7);
        const payload = verifyAccessToken(token);

        if (!payload) {
            res.status(401).json({
                ok: false,
                error: { code: 'TOKEN_INVALID', message: 'Invalid or expired access token.' },
            });
            return;
        }

        req.user = {
            id: payload.sub,
            email: payload.email || '',
            role: (payload.role as Role) || 'free',
        };

        next();
    };
}

/**
 * Middleware: Require a minimum role level.
 * Must be used AFTER requireAuth().
 */
export function requireRole(minRole: Role) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({
                ok: false,
                error: { code: 'AUTH_REQUIRED', message: 'Authentication required.' },
            });
            return;
        }

        const userLevel = ROLE_LEVELS[req.user.role] ?? 0;
        const requiredLevel = ROLE_LEVELS[minRole] ?? 0;

        if (userLevel < requiredLevel) {
            res.status(403).json({
                ok: false,
                error: {
                    code: 'INSUFFICIENT_ROLE',
                    message: `This endpoint requires ${minRole} role or higher.`,
                    requiredRole: minRole,
                    currentRole: req.user.role,
                },
            });
            return;
        }

        next();
    };
}

/**
 * Middleware: Require the user to own the resource.
 * Checks req.params.userId === req.user.id (or admin override).
 */
export function requireOwner() {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({
                ok: false,
                error: { code: 'AUTH_REQUIRED', message: 'Authentication required.' },
            });
            return;
        }

        const resourceOwner = req.params.userId || (req.body as Record<string, unknown>)?.userId;
        if (req.user.role === 'admin' || req.user.id === resourceOwner) {
            next();
            return;
        }

        res.status(403).json({
            ok: false,
            error: { code: 'FORBIDDEN', message: 'You can only access your own resources.' },
        });
    };
}

export default { requireAuth, requireRole, requireOwner, ROLE_LEVELS };
