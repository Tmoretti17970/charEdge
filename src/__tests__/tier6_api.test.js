// ═══════════════════════════════════════════════════════════════════
// Tier 6.1 — Backend API v1 Tests
//
// Tests the API routes, middleware, and server integration.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';

describe('6.1 — API Routes (routes.js)', () => {
  let routesSource;

  beforeEach(async () => {
    routesSource = await fs.promises.readFile('src/api/routes.js', 'utf8');
  });

  // ── Factory Pattern ────────────────────────────────────────

  it('exports createApiRouter factory function', () => {
    expect(routesSource).toContain('export function createApiRouter');
  });

  it('creates Router from express', () => {
    expect(routesSource).toContain("import { Router } from 'express'");
  });

  // ── Trade CRUD ─────────────────────────────────────────────

  it('has GET /trades with pagination', () => {
    expect(routesSource).toContain("router.get('/trades'");
    expect(routesSource).toContain('parsePagination');
  });

  it('has POST /trades with validation', () => {
    expect(routesSource).toContain("router.post('/trades'");
    expect(routesSource).toContain('symbol, side, entryPrice');
  });

  it('has PUT /trades/:id', () => {
    expect(routesSource).toContain("router.put('/trades/:id'");
  });

  it('has DELETE /trades/:id', () => {
    expect(routesSource).toContain("router.delete('/trades/:id'");
  });

  // ── Analytics ──────────────────────────────────────────────

  it('has /analytics endpoint with stats', () => {
    expect(routesSource).toContain("router.get('/analytics'");
    expect(routesSource).toContain('computeBasicStats');
  });

  it('has /analytics/equity endpoint', () => {
    expect(routesSource).toContain("router.get('/analytics/equity'");
    expect(routesSource).toContain('cumulative');
  });

  // ── Playbooks / Notes / Plans CRUD ─────────────────────────

  it('has mountCRUD factory function', () => {
    expect(routesSource).toContain('function mountCRUD(path, store)');
  });

  it('mounts /playbooks CRUD', () => {
    expect(routesSource).toContain("mountCRUD('/playbooks'");
  });

  it('mounts /notes CRUD', () => {
    expect(routesSource).toContain("mountCRUD('/notes'");
  });

  it('mounts /plans CRUD', () => {
    expect(routesSource).toContain("mountCRUD('/plans'");
  });

  it('CRUD factory has bulk upsert', () => {
    expect(routesSource).toContain('`${path}/bulk`');
    expect(routesSource).toContain('upserted');
  });

  it('CRUD factory does upsert (replace if exists)', () => {
    expect(routesSource).toContain('Upsert — replace if exists');
  });

  // ── Settings (key-value) ───────────────────────────────────

  it('has GET /settings', () => {
    expect(routesSource).toContain("router.get('/settings'");
  });

  it('has GET /settings/:key', () => {
    expect(routesSource).toContain("router.get('/settings/:key'");
  });

  it('has PUT /settings/:key', () => {
    expect(routesSource).toContain("router.put('/settings/:key'");
  });

  it('has DELETE /settings/:key', () => {
    expect(routesSource).toContain("router.delete('/settings/:key'");
  });

  // ── Bulk Sync ──────────────────────────────────────────────

  it('has POST /sync endpoint', () => {
    expect(routesSource).toContain("router.post('/sync'");
  });

  it('sync accepts trades, playbooks, notes, plans, settings', () => {
    expect(routesSource).toContain('trades: clientTrades, playbooks, notes, plans, settings, since');
  });

  it('sync uses last-write-wins conflict resolution', () => {
    // Check for timestamp comparison in the sync handler
    expect(routesSource).toContain('updatedAt || 0) >');
  });

  it('sync returns pushed count and pulled data', () => {
    expect(routesSource).toContain('results.pushed');
    expect(routesSource).toContain('results.pulled');
  });

  it('sync supports since parameter for incremental pull', () => {
    expect(routesSource).toContain('sinceMs');
    expect(routesSource).toContain('new Date(since).getTime()');
  });

  // ── Alpaca Proxy ───────────────────────────────────────────

  it('has Alpaca API proxy route', () => {
    expect(routesSource).toContain("router.all('/alpaca/:target/*'");
  });

  it('proxy supports paper, live, data targets', () => {
    expect(routesSource).toContain("paper: 'https://paper-api.alpaca.markets'");
    expect(routesSource).toContain("live: 'https://api.alpaca.markets'");
    expect(routesSource).toContain("data: 'https://data.alpaca.markets'");
  });

  it('proxy forwards APCA API key headers', () => {
    expect(routesSource).toContain("'apca-api-key-id'");
    expect(routesSource).toContain("'apca-api-secret-key'");
  });

  it('proxy has 15s timeout', () => {
    expect(routesSource).toContain('AbortSignal.timeout(15_000)');
  });

  // ── Helpers ────────────────────────────────────────────────

  it('has getUserTrades helper', () => {
    expect(routesSource).toContain('function getUserTrades');
  });

  it('has getUserItems helper', () => {
    expect(routesSource).toContain('function getUserItems');
  });

  it('has findUserItem helper', () => {
    expect(routesSource).toContain('function findUserItem');
  });

  it('has computeBasicStats helper', () => {
    expect(routesSource).toContain('function computeBasicStats');
    expect(routesSource).toContain('profitFactor');
  });
});

describe('6.1 — API Middleware (middleware.js)', () => {
  let middlewareSource;

  beforeEach(async () => {
    middlewareSource = await fs.promises.readFile('src/api/middleware.js', 'utf8');
  });

  it('exports apiKeyAuth middleware', () => {
    expect(middlewareSource).toContain('export function apiKeyAuth');
    expect(middlewareSource).toContain('x-api-key');
  });

  it('exports rateLimiter middleware', () => {
    expect(middlewareSource).toContain('export function rateLimiter');
    expect(middlewareSource).toContain('X-RateLimit-Limit');
  });

  it('exports cors middleware', () => {
    expect(middlewareSource).toContain('export function cors');
    expect(middlewareSource).toContain('Access-Control-Allow-Origin');
  });

  it('exports requestLogger', () => {
    expect(middlewareSource).toContain('export function requestLogger');
  });

  it('exports apiErrorHandler', () => {
    expect(middlewareSource).toContain('export function apiErrorHandler');
  });

  it('exports parsePagination and response helpers', () => {
    expect(middlewareSource).toContain('export function parsePagination');
    expect(middlewareSource).toContain('export function okResponse');
    expect(middlewareSource).toContain('export function errorResponse');
  });
});

describe('6.1 — Server API Mount (server.js)', () => {
  let serverSource;

  beforeEach(async () => {
    serverSource = await fs.promises.readFile('server.js', 'utf8');
  });

  it('imports createApiRouter', () => {
    expect(serverSource).toContain("import { createApiRouter } from './src/api/routes.js'");
  });

  it('imports middleware stack', () => {
    expect(serverSource).toContain("import {");
    expect(serverSource).toContain('apiKeyAuth');
    expect(serverSource).toContain('rateLimiter');
    expect(serverSource).toContain('requestLogger');
    expect(serverSource).toContain('apiErrorHandler');
  });

  it('mounts JSON parser on /api/v1', () => {
    expect(serverSource).toContain("app.use('/api/v1', express.json(");
  });

  it('mounts middleware stack on /api/v1', () => {
    expect(serverSource).toContain("app.use('/api/v1', apiCors()");
    expect(serverSource).toContain("app.use('/api/v1', rateLimiter(");
    expect(serverSource).toContain("app.use('/api/v1', apiKeyAuth(");
    expect(serverSource).toContain("app.use('/api/v1', requestLogger()");
  });

  it('mounts API router on /api/v1', () => {
    expect(serverSource).toContain("app.use('/api/v1', createApiRouter(");
  });

  it('mounts error handler on /api/v1', () => {
    expect(serverSource).toContain("app.use('/api/v1', apiErrorHandler()");
  });

  it('has in-memory API key store for self-hosted mode', () => {
    expect(serverSource).toContain('_apiKeyStore');
    expect(serverSource).toContain('validate(key)');
    expect(serverSource).toContain('create(userId)');
  });

  it('auto-creates dev API key in development', () => {
    expect(serverSource).toContain("_apiKeyStore.create('dev-user')");
    expect(serverSource).toContain('Dev API key');
  });

  it('has /health endpoint', () => {
    expect(serverSource).toContain('/health');
  });
});
