// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge v11.0 — Production Server
//
// Modes:
//   Development:  npm run dev        (Vite dev server, HMR)
//   Dev + SSR:    npm run dev:ssr    (This file + Vite middleware)
//   Production:   npm run build && npm run serve
// ═══════════════════════════════════════════════════════════════════

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';

// ─── Server Modules ──────────────────────────────────────────────
import { securityHeaders, cspReportHandler } from './server/middleware/security.js';
import { requestId } from './server/middleware/requestId.js';
import { httpRequestLogger } from './server/middleware/httpLogger.js';
import apiKeyStore from './server/apiKeyStore.js';
import { createRssRouter } from './server/routes/rss.js';
import { createProxyRouter } from './server/routes/proxy.js';
import { createLlmRouter } from './server/routes/llm.js';
import { setupProductionSSR, setupDevSSR } from './server/ssr.js';

// ─── API Modules ─────────────────────────────────────────────────
import { validateEnv } from './src/api/env.ts';
import { createApiRouter } from './src/api/routes.ts';
import { getDb, closeDb, pingDb } from './src/api/db/sqlite.ts';
import { getDbSize } from './src/api/db/backup.ts';
import { getCurrentVersion } from './src/api/db/migrations.ts';
import { registerBillingRoutes } from './src/api/billingRoutes.ts';
import { createAuthRouter } from './src/api/authRoutes.ts';
import {
  apiKeyAuth,
  rateLimiter,
  cors as apiCors,
  requestLogger,
  apiErrorHandler,
} from './src/api/middleware.ts';
import { generateCsrfToken, csrfProtect } from './src/api/csrf.ts';

// ─── Environment Validation (fail-fast) ───────────────────────
const env = validateEnv();

// ─── Constants ───────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = env.NODE_ENV === 'production';
const PORT = env.PORT;
const HOST = process.env.HOST || '0.0.0.0';
const log = (/** @type {string} */ msg) => process.stdout.write(msg + '\n');

// ─── Database ────────────────────────────────────────────────────
getDb(); // Initialize SQLite on startup

// ─── App Setup ───────────────────────────────────────────────────
const app = express();
app.use(cookieParser());

if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// ─── Middleware Pipeline ─────────────────────────────────────────
app.use(securityHeaders({ isProduction }));
app.use(requestId());
app.post('/api/csp-report', express.json({ type: 'application/csp-report' }), cspReportHandler);
app.use(compression({
  level: 6, threshold: 1024, filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));
app.use(httpRequestLogger());

// ─── Health Check ────────────────────────────────────────────────
app.get('/health', (req, res) => {
  const dbPing = pingDb();
  res.json({
    status: 'ok',
    version: '11.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage().rss,
    timestamp: new Date().toISOString(),
    security: { csp: true, permissionsPolicy: true, hsts: isProduction },
    database: { connected: dbPing.ok, latencyMs: dbPing.latencyMs },
  });
});

// ─── Deep Health Check ───────────────────────────────────────────
app.get('/health/deep', (req, res) => {
  const db = getDb();
  const results = {
    status: 'ok',
    version: '11.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: {
      connected: false,
      readWrite: false,
      latencyMs: -1,
      sizeBytes: 0,
      schemaVersion: 0,
      tables: /** @type {Record<string, number>} */ ({}),
    },
  };

  // ── Ping ──────────────────────────────────────────────────
  const ping = pingDb();
  results.database.connected = ping.ok;
  results.database.latencyMs = ping.latencyMs;

  // ── Read/Write Verification ───────────────────────────────
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS _health_check (
        id INTEGER PRIMARY KEY,
        ts INTEGER NOT NULL
      );
    `);
    const now = Date.now();
    db.prepare('INSERT OR REPLACE INTO _health_check (id, ts) VALUES (1, ?)').run(now);
    const row = /** @type {{ ts: number } | undefined} */ (
      db.prepare('SELECT ts FROM _health_check WHERE id = 1').get()
    );
    db.prepare('DELETE FROM _health_check WHERE id = 1').run();
    results.database.readWrite = row?.ts === now;
  } catch {
    results.database.readWrite = false;
  }

  // ── Metadata ──────────────────────────────────────────────
  try {
    results.database.sizeBytes = getDbSize();
    results.database.schemaVersion = getCurrentVersion(db);
  } catch {
    // Non-critical — continue
  }

  // ── Table Row Counts ──────────────────────────────────────
  // Allowlist: only these table names may appear in the interpolated SQL.
  // better-sqlite3 does not support parameterized identifiers, so this
  // guard prevents SQL injection if the array is ever populated from input.
  const ALLOWED_TABLES = new Set(['trades', 'playbooks', 'notes', 'plans', 'settings', 'audit_log']);
  const tables = ['trades', 'playbooks', 'notes', 'plans', 'settings', 'audit_log'];
  for (const table of tables) {
    if (!ALLOWED_TABLES.has(table)) continue;
    try {
      const row = /** @type {{ count: number } | undefined} */ (
        db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get()
      );
      results.database.tables[table] = row?.count ?? 0;
    } catch {
      results.database.tables[table] = -1;
    }
  }

  results.status = results.database.connected && results.database.readWrite ? 'ok' : 'degraded';
  res.status(results.status === 'ok' ? 200 : 503).json(results);
});

// ─── Proxy Routes ────────────────────────────────────────────────
app.use(createRssRouter());
app.use(createProxyRouter());
app.use(express.json({ limit: '64kb' }));  // JSON body for LLM proxy
app.use(createLlmRouter());

// ─── Auth Routes (no API key required) ─────────────────────────────
app.use('/api/auth', express.json({ limit: '64kb' }));
app.use('/api/auth', createAuthRouter());

// ─── API v1 ──────────────────────────────────────────────────────
if (!isProduction) {
  const devKey = apiKeyStore.create('dev-user');
  log(`[API] Dev API key: ${devKey.id}`);
}

// CORS: lock to specific origins in production
const corsOrigins = isProduction
  ? (process.env.CORS_ORIGINS || '').split(',').filter(Boolean)
  : ['*'];

app.use('/api/v1', express.json({ limit: '1mb' }));
app.use('/api/v1', apiCors({ origins: corsOrigins }));
app.use('/api/v1', rateLimiter({ windowMs: 60_000, max: 120 }));
app.use('/api/v1', apiKeyAuth(apiKeyStore));
app.use('/api/v1', csrfProtect());
app.use('/api/v1', requestLogger());
app.use('/api/v1', createApiRouter({ _keyStore: apiKeyStore }));
app.use('/api/v1', apiErrorHandler());

// ─── CSRF + Billing ─────────────────────────────────────────────
app.get('/api/csrf-token', generateCsrfToken);
app.use('/api/billing', (req, res, next) => {
  if (req.path === '/webhook') return next();
  express.json()(req, res, next);
});
registerBillingRoutes(app);

// ─── SSR / Static ────────────────────────────────────────────────
if (isProduction) {
  await setupProductionSSR(app, __dirname);
} else {
  await setupDevSSR(app, __dirname);
}

// ─── Start Server ────────────────────────────────────────────────
const server = app.listen(PORT, HOST, () => {
  const mode = isProduction ? '\x1b[32mproduction\x1b[0m' : '\x1b[33mdevelopment\x1b[0m';
  log('');
  log('  ╔══════════════════════════════════════════╗');
  log('  ║            charEdge v11.0                ║');
  log('  ╚══════════════════════════════════════════╝');
  log('');
  log(`  → Mode:    ${mode}`);
  log(`  → Local:   \x1b[36mhttp://localhost:${PORT}\x1b[0m`);
  log(`  → Network: \x1b[36mhttp://${HOST}:${PORT}\x1b[0m`);
  log('');
  if (!isProduction) {
    log('  \x1b[90mHMR enabled. Edit files and see changes instantly.\x1b[0m');
    log('');
  }
});

// ─── A4: Server-Side Alert Evaluation Loop ───────────────────────
// Scaffolded adapters for the AlertEvaluationLoop. The loop runs at
// 5-second intervals. To activate, populate alertPriceCache from a
// real-time data source (e.g., WebSocket price feed handler).
// ─────────────────────────────────────────────────────────────────
let alertLoop = null;
try {
  const { startAlertLoop } = await import('./server/services/AlertEvaluationLoop.ts');
  const { PushNotificationService } = await import('./server/services/PushNotificationService.ts');
  const { WebhookDelivery } = await import('./server/services/WebhookDelivery.ts');
  const { VolumeSpikeDetector } = await import('./server/services/VolumeSpikeDetector.ts');
  const { CandlePatternDetector } = await import('./server/services/CandlePatternDetector.ts');
  const { MultiTimeframeEvaluator } = await import('./server/services/MultiTimeframeEvaluator.ts');

  // In-memory price cache — update this from your WebSocket feed
  const alertPriceCache = {};

  // In-memory server alert store — sync from client via API in Phase C
  const serverAlerts = [];

  // C1: Webhook configs — users register via POST /api/alerts/webhook
  const webhookConfigs = [];

  const pushService = new PushNotificationService();
  const webhookService = new WebhookDelivery();

  // D1/D2/D3: Smart alert services
  const volumeDetector = new VolumeSpikeDetector();
  const patternDetector = new CandlePatternDetector();
  const mtfEvaluator = new MultiTimeframeEvaluator();

  // D1: Log volume spikes
  volumeDetector.on('volume:spike', (spike) => {
    log(`  \x1b[33m⚡ Volume spike: ${spike.symbol} ${spike.ratio}x avg\x1b[0m`);
  });

  // D2: Log multi-TF triggers
  mtfEvaluator.on('mtf:triggered', (evt) => {
    log(`  \x1b[33m⚡ MTF alert: ${evt.symbol} (${evt.alertId})\x1b[0m`);
  });

  alertLoop = startAlertLoop(
    // Price provider adapter
    { getLatestPrices: () => ({ ...alertPriceCache }) },
    // Alert store adapter
    {
      getActiveAlerts: () => serverAlerts.filter((a) => a.active),
      triggerAlert: (id) => {
        const alert = serverAlerts.find((a) => a.id === id);
        if (alert) {
          alert.active = alert.repeating || false;
          alert.triggeredAt = new Date().toISOString();
          // C1: Fire webhooks for triggered alert
          const price = alertPriceCache[alert.symbol] || 0;
          for (const config of webhookConfigs) {
            webhookService.deliver(config, alert, price).catch(() => {});
          }
        }
      },
      updateLastPrice: (id, price) => {
        const alert = serverAlerts.find((a) => a.id === id);
        if (alert) alert._lastPrice = price;
      },
    },
    // Push service adapter
    {
      sendAlertNotification: async (userId, alert, price) => {
        await pushService.sendAlertNotification(userId, alert, price);
      },
    },
  );

  log('  \x1b[32m✓ Alert evaluation loop started (5s cadence)\x1b[0m');
  log(`  \x1b[32m✓ Smart services: VolumeSpikeDetector, CandlePatternDetector (${patternDetector ? '10 patterns' : '0'}), MultiTimeframeEvaluator\x1b[0m`);
} catch (err) {
  log(`  \x1b[33m⚠ Alert evaluation loop not started: ${err.message}\x1b[0m`);
}

// ─── Graceful Shutdown ───────────────────────────────────────────
function shutdown(signal) {
  log(`\n\x1b[33m${signal} received. Shutting down gracefully...\x1b[0m`);
  if (alertLoop) alertLoop.stop();
  server.close(() => {
    closeDb();
    log('\x1b[32m✓ Server closed\x1b[0m');
    process.exit(0);
  });
  setTimeout(() => {
    closeDb();
    process.stderr.write('\x1b[31m✗ Forced shutdown after timeout\x1b[0m\n');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => {
  process.stderr.write(`\x1b[31mUnhandled Promise Rejection:\x1b[0m ${err}\n`);
  // Exit so the process manager restarts cleanly — continuing in unknown state risks serving corrupt responses
  shutdown('unhandledRejection');
});
process.on('uncaughtException', (err) => {
  process.stderr.write(`\x1b[31mUncaught Exception:\x1b[0m ${err}\n`);
  process.exit(1);
});
