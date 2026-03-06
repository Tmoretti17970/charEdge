// ═══════════════════════════════════════════════════════════════════
// charEdge v11 — API Routes (TypeScript + SQLite Persistence)
//
// RESTful endpoints for the public API. All routes are prefixed
// with /api/v1/. Authentication required via API key middleware.
//
// Data is persisted to SQLite via the repository layer.
// All in-memory Maps have been removed.
//
// Endpoints:
//   GET    /api/v1/profile            — Get own profile
//   PATCH  /api/v1/profile            — Update own profile
//   GET    /api/v1/trades             — List trades (paginated)
//   POST   /api/v1/trades             — Create trade
//   GET    /api/v1/trades/:id         — Get single trade
//   PUT    /api/v1/trades/:id         — Update trade
//   DELETE /api/v1/trades/:id         — Delete trade
//   GET    /api/v1/analytics          — Get analytics summary
//   GET    /api/v1/analytics/equity   — Equity curve data
//   GET    /api/v1/snapshots          — List feed
//   POST   /api/v1/snapshots          — Create snapshot
//   GET    /api/v1/snapshots/:id      — Get snapshot
//   DELETE /api/v1/snapshots/:id      — Delete snapshot
//   POST   /api/v1/snapshots/:id/like — Toggle like
//   GET    /api/v1/leaderboard        — Get leaderboard
//   POST   /api/v1/webhooks           — Create webhook
//   GET    /api/v1/webhooks           — List webhooks
//   DELETE /api/v1/webhooks/:id       — Delete webhook
// ═══════════════════════════════════════════════════════════════════

import { Router } from 'express';
import type { Request, Response } from 'express';
import { parsePagination, okResponse, errorResponse } from './middleware.ts';
import { getDb } from './db/sqlite.ts';
import { TradeRepository } from './db/TradeRepository.ts';
import { CrudRepository } from './db/CrudRepository.ts';
import { SettingsRepository } from './db/SettingsRepository.ts';
import {
    validate,
    createTradeSchema, updateTradeSchema,
    createPlaybookSchema, updatePlaybookSchema,
    createNoteSchema, updateNoteSchema,
    createTradePlanSchema, updateTradePlanSchema,
    createSnapshotSchema,
    createWebhookSchema,
} from './schemas.ts';
import { secureInput } from './sanitize.ts';
import { ssrfGuard } from './ssrf.ts';

// Route param types for parameterized Request
type IdParams = { id: string };
type KeyParams = { key: string };
type TargetWildcardParams = { target: string; 0: string };

// ─── Types ────────────────────────────────────────────────────────

interface SocialResult<T = unknown> {
    ok: boolean;
    data?: T;
    error?: string;
    total?: number;
}

interface Trade {
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

interface CrudItem {
    id: string;
    userId?: string;
    _createdAt?: number;
    _updatedAt?: number;
    [key: string]: unknown;
}

interface WebhookEmitter {
    emit(event: string, userId: string, data: unknown): void;
    getSubscriptions(userId: string): unknown[];
    subscribe(userId: string, url: string, events: string[]): unknown;
    unsubscribe(userId: string, hookId: string): boolean;
}

interface ApiRouterServices {
    webhookEmitter?: WebhookEmitter;
    _keyStore?: unknown;
}

interface AlpacaHosts {
    [key: string]: string;
    paper: string;
    live: string;
    data: string;
}

interface SyncBody {
    trades?: Trade[];
    playbooks?: CrudItem[];
    notes?: CrudItem[];
    plans?: CrudItem[];
    settings?: Record<string, unknown>;
    since?: string;
}

interface SyncResults {
    pushed: number;
    pulled: Record<string, unknown>;
}

// ─── Social Service Stub ──────────────────────────────────────────

// Wave 0: SocialService quarantined — stub for social API endpoints
const SocialService = {
    getProfile: async (_userId: string): Promise<SocialResult> =>
        ({ ok: false, error: 'Social features are disabled in v1.0' }),
    updateProfile: async (_userId: string, _updates: Record<string, unknown>): Promise<SocialResult> =>
        ({ ok: false, error: 'Social features are disabled in v1.0' }),
    getFeed: async (_opts: { limit: number; offset: number; sortBy: string }): Promise<SocialResult> =>
        ({ ok: false, error: 'Social features are disabled in v1.0' }),
    createSnapshot: async (_data: Record<string, unknown>): Promise<SocialResult> =>
        ({ ok: false, error: 'Social features are disabled in v1.0' }),
    getSnapshot: async (_id: string): Promise<SocialResult> =>
        ({ ok: false, error: 'Social features are disabled in v1.0' }),
    deleteSnapshot: async (_id: string, _userId: string): Promise<SocialResult> =>
        ({ ok: false, error: 'Social features are disabled in v1.0' }),
    toggleLike: async (_id: string, _userId: string): Promise<SocialResult> =>
        ({ ok: false, error: 'Social features are disabled in v1.0' }),
    getLeaderboard: async (_opts: { metric: string; period: string; limit: number }): Promise<SocialResult> =>
        ({ ok: false, error: 'Social features are disabled in v1.0' }),
};

// ─── Router Factory ───────────────────────────────────────────────

export function createApiRouter(services: ApiRouterServices = {}): Router {
    const router = Router();
    const { webhookEmitter, _keyStore } = services;

    // Suppress unused variable warning — _keyStore reserved for future use
    void _keyStore;

    // ── Security: sanitize all input on mutating endpoints ──
    router.use(secureInput());

    // ── Initialize Repositories ─────────────────────────────
    const db = getDb();
    const tradeRepo = new TradeRepository(db);
    const playbookRepo = new CrudRepository(db, 'playbooks');
    const noteRepo = new CrudRepository(db, 'notes');
    const planRepo = new CrudRepository(db, 'plans');
    const settingsRepo = new SettingsRepository(db);

    // ─── Profile ────────────────────────────────────────────

    router.get('/profile', async (req: Request, res: Response) => {
        const result = await SocialService.getProfile(req.userId!);
        if (!result.ok) return errorResponse(res, 404, 'NOT_FOUND', 'Profile not found');
        okResponse(res, result.data);
    });

    router.patch('/profile', async (req: Request, res: Response) => {
        const allowed = ['username', 'displayName', 'bio', 'avatar'] as const;
        const updates: Record<string, unknown> = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }

        if (Object.keys(updates).length === 0) {
            return errorResponse(res, 400, 'BAD_REQUEST', 'No valid fields to update');
        }

        const result = await SocialService.updateProfile(req.userId!, updates);
        if (!result.ok) return errorResponse(res, 400, 'UPDATE_FAILED', result.error!);
        okResponse(res, result.data);
    });

    // ─── Trades ─────────────────────────────────────────────

    router.get('/trades', (req: Request, res: Response) => {
        const { limit, offset } = parsePagination(req.query as Record<string, string | undefined>);
        const { symbol, side, dateFrom, dateTo, cursor } = req.query as Record<string, string | undefined>;

        const result = tradeRepo.list(req.userId!, { symbol, side, dateFrom, dateTo }, { limit, offset, cursor });

        okResponse(res, result.data, {
            total: result.total,
            limit,
            offset,
            hasMore: result.hasMore,
            ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
        });
    });

    router.post('/trades', validate(createTradeSchema), (req: Request, res: Response) => {
        const { symbol, side, entryPrice, exitPrice, entryDate, exitDate, quantity, pnl, notes, tags, setup } = req.body;

        const trade = tradeRepo.create(req.userId!, {
            symbol,
            side,
            entryPrice,
            exitPrice: exitPrice ?? null,
            entryDate: entryDate || new Date().toISOString(),
            exitDate: exitDate || null,
            size: quantity ?? 1,
            pnl: pnl ?? null,
            notes: notes || '',
            tags: tags || [],
            setup: setup || '',
        });

        // Emit webhook
        if (webhookEmitter) {
            webhookEmitter.emit('trade.created', req.userId!, trade);
        }

        res.status(201).json({ ok: true, data: trade });
    });

    router.get('/trades/:id', (req: Request<IdParams>, res: Response) => {
        const trade = tradeRepo.findById(req.userId!, req.params.id);
        if (!trade) return errorResponse(res, 404, 'NOT_FOUND', 'Trade not found');
        okResponse(res, trade);
    });

    router.put('/trades/:id', validate(updateTradeSchema), (req: Request<IdParams>, res: Response) => {
        const trade = tradeRepo.update(req.userId!, req.params.id, req.body);
        if (!trade) return errorResponse(res, 404, 'NOT_FOUND', 'Trade not found');

        if (webhookEmitter) {
            webhookEmitter.emit('trade.updated', req.userId!, trade);
        }

        okResponse(res, trade);
    });

    router.delete('/trades/:id', (req: Request<IdParams>, res: Response) => {
        const deleted = tradeRepo.delete(req.userId!, req.params.id);
        if (!deleted) return errorResponse(res, 404, 'NOT_FOUND', 'Trade not found');

        if (webhookEmitter) {
            webhookEmitter.emit('trade.deleted', req.userId!, { id: req.params.id });
        }

        okResponse(res, { id: req.params.id, deleted: true });
    });

    // ─── Analytics ──────────────────────────────────────────

    router.get('/analytics', (req: Request, res: Response) => {
        const stats = tradeRepo.computeStats(req.userId!);
        okResponse(res, stats);
    });

    router.get('/analytics/equity', (req: Request, res: Response) => {
        const curve = tradeRepo.equityCurve(req.userId!);
        okResponse(res, curve);
    });

    // ─── Snapshots (Feed) ───────────────────────────────────

    router.get('/snapshots', async (req: Request, res: Response) => {
        const { limit, offset } = parsePagination(req.query as Record<string, string | undefined>);
        const sortBy = req.query.sort === 'popular' ? 'popular' : 'recent';

        const result = await SocialService.getFeed({ limit, offset, sortBy });
        if (!result.ok) return errorResponse(res, 500, 'FETCH_FAILED', 'Could not load feed');

        okResponse(res, result.data, {
            total: result.total ?? 0,
            limit,
            offset,
            sortBy,
        });
    });

    router.post('/snapshots', validate(createSnapshotSchema), async (req: Request, res: Response) => {
        const { title, description, symbol, timeframe, chartType, indicators, tags } = req.body;

        const result = await SocialService.createSnapshot({
            authorId: req.userId!,
            title,
            description: description || '',
            symbol: String(symbol).toUpperCase(),
            timeframe: timeframe || '1d',
            chartType: chartType || 'candles',
            indicators: indicators || [],
            tags: tags || [],
        });

        if (!result.ok) return errorResponse(res, 500, 'CREATE_FAILED', 'Could not create snapshot');

        if (webhookEmitter) {
            webhookEmitter.emit('snapshot.created', req.userId!, result.data);
        }

        res.status(201).json({ ok: true, data: result.data });
    });

    router.get('/snapshots/:id', async (req: Request<IdParams>, res: Response) => {
        const result = await SocialService.getSnapshot(req.params.id);
        if (!result.ok) return errorResponse(res, 404, 'NOT_FOUND', 'Snapshot not found');
        okResponse(res, result.data);
    });

    router.delete('/snapshots/:id', async (req: Request<IdParams>, res: Response) => {
        const result = await SocialService.deleteSnapshot(req.params.id, req.userId!);
        if (!result.ok) return errorResponse(res, 404, 'NOT_FOUND', result.error!);
        okResponse(res, { id: req.params.id, deleted: true });
    });

    router.post('/snapshots/:id/like', async (req: Request<IdParams>, res: Response) => {
        const result = await SocialService.toggleLike(req.params.id, req.userId!);
        if (!result.ok) return errorResponse(res, 404, 'NOT_FOUND', result.error!);
        okResponse(res, result.data);
    });

    // ─── Leaderboard ────────────────────────────────────────

    router.get('/leaderboard', async (req: Request, res: Response) => {
        const metric = (req.query.metric as string) || 'pnl';
        const period = (req.query.period as string) || '30d';
        const limit = Math.min(parseInt((req.query.limit as string) || '20', 10) || 20, 100);

        const validMetrics = ['pnl', 'winRate', 'sharpe', 'profitFactor', 'tradeCount'];
        if (!validMetrics.includes(metric)) {
            return errorResponse(res, 400, 'BAD_REQUEST', `Invalid metric. Use: ${validMetrics.join(', ')}`);
        }

        const result = await SocialService.getLeaderboard({ metric, period, limit });
        if (!result.ok) return errorResponse(res, 500, 'FETCH_FAILED', 'Could not load leaderboard');

        okResponse(res, result.data, { metric, period });
    });

    // ─── Webhooks ───────────────────────────────────────────

    router.get('/webhooks', (req: Request, res: Response) => {
        if (!webhookEmitter) return okResponse(res, []);
        const hooks = webhookEmitter.getSubscriptions(req.userId!);
        okResponse(res, hooks);
    });

    router.post('/webhooks', validate(createWebhookSchema), ssrfGuard(), (req: Request, res: Response) => {
        if (!webhookEmitter) return errorResponse(res, 503, 'UNAVAILABLE', 'Webhook service not available');

        const { url, events } = req.body;

        const validEvents = ['trade.created', 'trade.updated', 'trade.deleted', 'snapshot.created'];
        const selectedEvents: string[] = events?.length ? events.filter((e: string) => validEvents.includes(e)) : validEvents;

        if (selectedEvents.length === 0) {
            return errorResponse(res, 400, 'BAD_REQUEST', `No valid events. Use: ${validEvents.join(', ')}`);
        }

        const hook = webhookEmitter.subscribe(req.userId!, url, selectedEvents);
        res.status(201).json({ ok: true, data: hook });
    });

    router.delete('/webhooks/:id', (req: Request<IdParams>, res: Response) => {
        if (!webhookEmitter) return errorResponse(res, 503, 'UNAVAILABLE', 'Webhook service not available');

        const removed = webhookEmitter.unsubscribe(req.userId!, req.params.id);
        if (!removed) return errorResponse(res, 404, 'NOT_FOUND', 'Webhook not found');
        okResponse(res, { id: req.params.id, deleted: true });
    });

    // ─── Playbooks / Notes / Plans CRUD ─────────────────────

    function mountCRUD(
        path: string,
        repo: CrudRepository,
        schemas?: { create?: import('zod').ZodSchema; update?: import('zod').ZodSchema },
    ): void {
        router.get(path, (req: Request, res: Response) => {
            const items = repo.list(req.userId!);
            okResponse(res, items, { count: items.length });
        });

        const createMiddlewares = schemas?.create ? [validate(schemas.create)] : [];
        router.post(path, ...createMiddlewares, (req: Request, res: Response) => {
            const item: CrudItem = req.body;
            if (!item || !item.id) return errorResponse(res, 400, 'BAD_REQUEST', 'Missing id field');
            item.userId = req.userId!;
            // Upsert — replace if exists
            const saved = repo.create(req.userId!, item);
            res.status(201).json({ ok: true, data: saved });
        });

        router.get(`${path}/:id`, (req: Request<IdParams>, res: Response) => {
            const item = repo.findById(req.userId!, req.params.id);
            if (!item) return errorResponse(res, 404, 'NOT_FOUND', 'Not found');
            okResponse(res, item);
        });

        const updateMiddlewares = schemas?.update ? [validate(schemas.update)] : [];
        router.put(`${path}/:id`, ...updateMiddlewares, (req: Request<IdParams>, res: Response) => {
            const item = repo.findById(req.userId!, req.params.id);
            if (!item) return errorResponse(res, 404, 'NOT_FOUND', 'Not found');
            const updated = repo.update(req.userId!, req.params.id, req.body);
            okResponse(res, updated);
        });

        router.delete(`${path}/:id`, (req: Request<IdParams>, res: Response) => {
            const deleted = repo.delete(req.userId!, req.params.id);
            if (!deleted) return errorResponse(res, 404, 'NOT_FOUND', 'Not found');
            okResponse(res, { id: req.params.id, deleted: true });
        });

        router.post(`${path}/bulk`, (req: Request, res: Response) => {
            const items: CrudItem[] | undefined = req.body?.items;
            if (!Array.isArray(items)) return errorResponse(res, 400, 'BAD_REQUEST', 'Missing items array');
            const result = repo.bulkUpsert(req.userId!, items);
            res.json({ ok: true, upserted: result.upserted });
        });
    }

    mountCRUD('/playbooks', playbookRepo, { create: createPlaybookSchema, update: updatePlaybookSchema });
    mountCRUD('/notes', noteRepo, { create: createNoteSchema, update: updateNoteSchema });
    mountCRUD('/plans', planRepo, { create: createTradePlanSchema, update: updateTradePlanSchema });

    // ─── Settings (key-value) ──────────────────────────────

    router.get('/settings', (req: Request, res: Response) => {
        const userSettings = settingsRepo.getAll(req.userId!);
        okResponse(res, userSettings);
    });

    router.get('/settings/:key', (req: Request<KeyParams>, res: Response) => {
        if (!settingsRepo.has(req.userId!, req.params.key)) {
            return errorResponse(res, 404, 'NOT_FOUND', 'Setting not found');
        }
        const value = settingsRepo.get(req.userId!, req.params.key);
        okResponse(res, { key: req.params.key, value });
    });

    router.put('/settings/:key', (req: Request<KeyParams>, res: Response) => {
        const { value } = req.body;
        if (value === undefined) return errorResponse(res, 400, 'BAD_REQUEST', 'Missing value field');  // Settings are dynamic; Zod can't validate arbitrary KV
        settingsRepo.set(req.userId!, req.params.key, value);
        okResponse(res, { key: req.params.key, value });
    });

    router.delete('/settings/:key', (req: Request<KeyParams>, res: Response) => {
        settingsRepo.delete(req.userId!, req.params.key);
        res.status(204).end();
    });

    // ─── Bulk Sync ─────────────────────────────────────────

    router.post('/sync', (req: Request, res: Response) => {
        const { trades: clientTrades, playbooks, notes, plans, settings, since } = (req.body || {}) as SyncBody;
        const results: SyncResults = { pushed: 0, pulled: {} };
        const sinceMs = since ? new Date(since).getTime() : 0;

        // Push trades
        if (Array.isArray(clientTrades)) {
            const { upserted } = tradeRepo.bulkUpsert(req.userId!, clientTrades);
            results.pushed += upserted;
        }

        // Push playbooks, notes, plans
        const collections: Record<string, CrudRepository> = {
            playbooks: playbookRepo,
            notes: noteRepo,
            plans: planRepo,
        };
        for (const [name, repo] of Object.entries(collections)) {
            const items: CrudItem[] | undefined = (req.body as Record<string, CrudItem[]>)?.[name];
            if (Array.isArray(items)) {
                const { upserted } = repo.bulkUpsert(req.userId!, items);
                results.pushed += upserted;
            }
        }

        // Push settings
        if (settings && typeof settings === 'object') {
            const { set: count } = settingsRepo.bulkSet(req.userId!, settings);
            results.pushed += count;
        }

        // Pull — return items updated after `since`
        if (sinceMs > 0) {
            results.pulled.trades = tradeRepo.listSince(req.userId!, sinceMs);
            for (const [name, repo] of Object.entries(collections)) {
                results.pulled[name] = repo.listSince(req.userId!, sinceMs);
            }
        } else {
            const tradeResult = tradeRepo.list(req.userId!, {}, { limit: 10000 });
            results.pulled.trades = tradeResult.data;
            for (const [name, repo] of Object.entries(collections)) {
                results.pulled[name] = repo.list(req.userId!);
            }
        }
        results.pulled.settings = settingsRepo.getAll(req.userId!);

        okResponse(res, results);
    });

    // ─── Alpaca API Proxy ──────────────────────────────────
    // Proxy to Alpaca Markets REST API for production (CORS)

    const ALPACA_HOSTS: AlpacaHosts = {
        paper: 'https://paper-api.alpaca.markets',
        live: 'https://api.alpaca.markets',
        data: 'https://data.alpaca.markets',
    };

    router.all('/alpaca/:target/*', async (req: Request<TargetWildcardParams>, res: Response) => {
        const { target } = req.params;
        const base = ALPACA_HOSTS[target];
        if (!base) return errorResponse(res, 400, 'BAD_REQUEST', `Invalid target: ${target}. Use paper, live, or data`);

        const alpacaPath = req.params[0] || '';

        // ── Credential Resolution (server-side preferred) ───────
        // Production: ALWAYS use server-side env vars (never accept from client)
        // Development: fall back to client headers for paper trading convenience
        const serverKeyId = process.env.ALPACA_KEY_ID;
        const serverSecret = process.env.ALPACA_SECRET_KEY;
        const isProduction = process.env.NODE_ENV === 'production';

        let keyId: string | undefined;
        let secretKey: string | undefined;

        if (serverKeyId && serverSecret) {
            // Server-side credentials take priority
            keyId = serverKeyId;
            secretKey = serverSecret;
        } else if (!isProduction) {
            // Development fallback: accept from client headers (paper trading only)
            keyId = req.headers['apca-api-key-id'] as string | undefined;
            secretKey = req.headers['apca-api-secret-key'] as string | undefined;
        }

        if (!keyId || !secretKey) {
            const msg = isProduction
                ? 'Alpaca credentials not configured on server. Set ALPACA_KEY_ID and ALPACA_SECRET_KEY.'
                : 'Missing APCA-API-KEY-ID or APCA-API-SECRET-KEY headers (or set ALPACA_KEY_ID/ALPACA_SECRET_KEY env vars).';
            return errorResponse(res, 400, 'CREDENTIALS_MISSING', msg);
        }

        try {
            const url = `${base}/${alpacaPath}${(req as Request & { _parsedUrl?: { search?: string } })._parsedUrl?.search || ''}`;
            const fetchOpts: RequestInit = {
                method: req.method,
                headers: {
                    'APCA-API-KEY-ID': keyId,
                    'APCA-API-SECRET-KEY': secretKey,
                    'Content-Type': 'application/json',
                },
                signal: AbortSignal.timeout(15_000),
            };

            if (req.method !== 'GET' && req.method !== 'DELETE' && req.body) {
                fetchOpts.body = JSON.stringify(req.body);
            }

            const upstream = await fetch(url, fetchOpts);

            res.status(upstream.status);
            if (upstream.status === 204) return res.end();

            const contentType = upstream.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                res.json(await upstream.json());
            } else {
                res.send(await upstream.text());
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            errorResponse(res, 502, 'PROXY_ERROR', `Alpaca proxy error: ${message}`);
        }
    });

    return router;
}
