// ═══════════════════════════════════════════════════════════════════
// charEdge — Zod Validation Schemas
//
// Phase 2: Converted to TypeScript with inferred types from Zod.
//
// Every POST/PUT body is validated against these schemas before
// hitting business logic. Rejects malformed data with 400 status.
// ═══════════════════════════════════════════════════════════════════

import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

// ─── Shared Primitives ──────────────────────────────────────────

const id = z.string().uuid().or(z.string().min(1).max(64));
const symbol = z.string().min(1).max(20).regex(/^[A-Za-z0-9._\-/]+$/, 'Invalid symbol format');
const price = z.number().finite().nonnegative();
const quantity = z.number().finite().positive();
const isoDate = z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/));

// ─── Trade Schemas ──────────────────────────────────────────────

export const createTradeSchema = z.object({
    symbol: symbol,
    side: z.enum(['long', 'short']),
    entryPrice: price,
    exitPrice: price.optional(),
    quantity: quantity.optional(),
    entryDate: isoDate,
    exitDate: isoDate.optional(),
    fees: z.number().finite().nonnegative().optional(),
    pnl: z.number().finite().optional(),
    notes: z.string().max(5000).optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
    strategy: z.string().max(100).optional(),
    emotion: z.string().max(50).optional(),
    screenshots: z.array(z.string().url().or(z.string().max(500))).max(10).optional(),
}).strict();

export const updateTradeSchema = createTradeSchema.partial();

/** Inferred types from Zod schemas */
export type CreateTradeInput = z.infer<typeof createTradeSchema>;
export type UpdateTradeInput = z.infer<typeof updateTradeSchema>;

// ─── Playbook Schemas ───────────────────────────────────────────

export const createPlaybookSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(2000).optional(),
    rules: z.array(z.object({
        id: id.optional(),
        label: z.string().min(1).max(200),
        required: z.boolean().optional(),
    })).max(50).optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
}).strict();

export const updatePlaybookSchema = createPlaybookSchema.partial();

export type CreatePlaybookInput = z.infer<typeof createPlaybookSchema>;
export type UpdatePlaybookInput = z.infer<typeof updatePlaybookSchema>;

// ─── Note Schemas ───────────────────────────────────────────────

export const createNoteSchema = z.object({
    title: z.string().min(1).max(200),
    content: z.string().max(10000),
    tags: z.array(z.string().max(50)).max(20).optional(),
    mood: z.string().max(50).optional(),
    date: isoDate.optional(),
}).strict();

export const updateNoteSchema = createNoteSchema.partial();

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;

// ─── Trade Plan Schemas ─────────────────────────────────────────

export const createTradePlanSchema = z.object({
    symbol: symbol,
    direction: z.enum(['long', 'short']).optional(),
    thesis: z.string().max(2000).optional(),
    entry: z.object({
        price: price.optional(),
        condition: z.string().max(500).optional(),
    }).optional(),
    exit: z.object({
        target: price.optional(),
        stopLoss: price.optional(),
        condition: z.string().max(500).optional(),
    }).optional(),
    riskReward: z.number().finite().optional(),
    status: z.enum(['draft', 'active', 'completed', 'cancelled']).optional(),
    notes: z.string().max(5000).optional(),
}).strict();

export const updateTradePlanSchema = createTradePlanSchema.partial();

export type CreateTradePlanInput = z.infer<typeof createTradePlanSchema>;
export type UpdateTradePlanInput = z.infer<typeof updateTradePlanSchema>;

// ─── Snapshot Schemas ───────────────────────────────────────────

export const createSnapshotSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    data: z.record(z.any()).optional(),
    public: z.boolean().optional(),
}).strict();

export type CreateSnapshotInput = z.infer<typeof createSnapshotSchema>;

// ─── Webhook Schemas ────────────────────────────────────────────

export const createWebhookSchema = z.object({
    url: z.string().url().max(500),
    events: z.array(z.enum(['trade.created', 'trade.updated', 'trade.deleted'])).min(1).max(10),
    secret: z.string().min(8).max(128).optional(),
    active: z.boolean().optional(),
}).strict();

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

// ─── Billing Schemas ────────────────────────────────────────────

export const createCheckoutSchema = z.object({
    plan: z.enum(['trader', 'pro']),
    successUrl: z.string().url().max(500).optional(),
    cancelUrl: z.string().url().max(500).optional(),
}).strict();

export const portalSessionSchema = z.object({
    returnUrl: z.string().url().max(500).optional(),
}).strict();

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
export type PortalSessionInput = z.infer<typeof portalSessionSchema>;

// ─── Validation Middleware ──────────────────────────────────────

interface ValidationError {
    path: string;
    message: string;
    code: string;
}

/**
 * Create Express middleware that validates req.body against a Zod schema.
 * Returns 400 with structured error on validation failure.
 */
export function validate(schema: z.ZodSchema) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            const errors: ValidationError[] = result.error.issues.map(issue => ({
                path: issue.path.join('.'),
                message: issue.message,
                code: issue.code,
            }));
            res.status(400).json({
                ok: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Request body validation failed.',
                    details: errors,
                },
            });
            return;
        }
        req.body = result.data; // Use parsed + sanitized data
        next();
    };
}
