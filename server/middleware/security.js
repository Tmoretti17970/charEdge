// @ts-check
/* eslint-disable no-undef */
// ═══════════════════════════════════════════════════════════════════
// charEdge — Security Headers Middleware
// CSP, HSTS, X-Frame-Options, X-Content-Type-Options, XSS, Referrer,
// Report-To (modern CSP reporting), Permissions-Policy (expanded)
// ═══════════════════════════════════════════════════════════════════

import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ─── CSP Violation Log ──────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(__dirname, '..', '..', 'logs');
const CSP_LOG = join(LOG_DIR, 'csp-violations.jsonl');

/** @param {object} entry */
function _logCspViolation(entry) {
  try {
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(CSP_LOG, JSON.stringify(entry) + '\n');
  } catch {
    // Fallback to console if file system fails
    console.warn('[CSP Violation]', JSON.stringify(entry));
  }
}

// ─── Expanded Permissions-Policy ────────────────────────────────
const PERMISSIONS_POLICY = [
  'camera=()',
  'microphone=()',
  'geolocation=()',
  'payment=()',
  'usb=()',
  'bluetooth=()',
  'serial=()',
  'hid=()',
  'midi=()',
  'screen-wake-lock=(self)',
  'display-capture=()',
].join(', ');

/**
 * Security headers middleware.
 * @param {{ isProduction: boolean }} opts
 * @returns {import('express').RequestHandler}
 */
export function securityHeaders({ isProduction }) {
  return (req, res, next) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    // Prevent MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // XSS protection (legacy browsers)
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // #25: CORS — restrict cross-origin access
    const origin = req.headers.origin;
    if (isProduction) {
      // Production: only allow same-origin (no CORS header = same-origin only)
      // If a production domain is configured, whitelist it explicitly:
      const prodOrigin = process.env.CORS_ORIGIN;
      if (prodOrigin && origin === prodOrigin) {
        res.setHeader('Access-Control-Allow-Origin', prodOrigin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      }
    } else {
      // Dev: allow Vite dev server ports
      const devOrigins = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'];
      if (origin && devOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      }
    }

    // Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    // Expanded Permissions-Policy (Batch 16: 4.5.4)
    res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);

    // Sprint 10 #79: Vary: Origin for correct CORS caching
    // Without this, CDN/proxy caches may serve a response with the wrong
    // Access-Control-Allow-Origin header to a different origin.
    res.setHeader('Vary', 'Origin');

    // HSTS — enforce HTTPS (production only)
    if (isProduction) {
      res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    }

    // Report-To header (modern CSP reporting spec)
    res.setHeader(
      'Report-To',
      JSON.stringify({
        group: 'csp-endpoint',
        max_age: 86400,
        endpoints: [{ url: '/api/csp-report' }],
      }),
    );

    // #21: Generate per-request CSP nonce for inline scripts
    const nonce = crypto.randomUUID().replace(/-/g, '');
    res.locals.cspNonce = nonce;

    // CSP directives — shared between enforcement and report-only
    const cspDirectives = [
      `default-src 'self'`,
      `script-src 'self' 'nonce-${nonce}'`,
      `style-src 'self' 'unsafe-inline'`,
      `font-src 'self' data:`,
      `img-src 'self' data: blob: https:`,
      `connect-src 'self' https://api.binance.com https://data-api.binance.vision wss://stream.binance.com:9443 wss://stream.binance.us:9443 wss://data-stream.binance.vision https://api.coingecko.com https://pro-api.coingecko.com https://min-api.cryptocompare.com https://query1.finance.yahoo.com https://query2.finance.yahoo.com https://api.polygon.io wss://socket.polygon.io https://financialmodelingprep.com https://hermes.pyth.network https://benchmarks.pyth.network https://api.coincap.io wss://ws.coincap.io https://api.llama.fi https://coins.llama.fi https://data.alpaca.markets https://paper-api.alpaca.markets https://api.alpaca.markets wss://stream.data.alpaca.markets https://api.groq.com https://generativelanguage.googleapis.com https://huggingface.co https://*.huggingface.co https://raw.githubusercontent.com https://*.supabase.co wss://*.supabase.co https://*.sentry.io wss://ws.kraken.com https://api.kraken.com https://data.sec.gov https://efts.sec.gov https://api.stlouisfed.org https://api.frankfurter.dev https://api.alternative.me https://apewisdom.io https://finnhub.io wss://ws.finnhub.io https://api.whale-alert.io https://api.etherscan.io`,
      `worker-src 'self' blob:`,
      // Sprint 10 #81: Block Flash/Java plugin content
      `object-src 'none'`,
      `manifest-src 'self'`,
      `base-uri 'self'`,
      `form-action 'self'`,
      `frame-ancestors 'none'`,
      `upgrade-insecure-requests`,
      `report-uri /api/csp-report`,
      `report-to csp-endpoint`,
    ].join('; ');

    if (isProduction) {
      // Enforce CSP in production
      res.setHeader('Content-Security-Policy', cspDirectives);
    } else {
      // Sprint 10 #75: Report-Only in dev — catches violations without
      // breaking the app, giving developers a heads-up before production.
      res.setHeader('Content-Security-Policy-Report-Only', cspDirectives);
    }

    next();
  };
}

/**
 * CSP violation report handler.
 * Logs to structured JSONL file + console for production audit trail.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export function cspReportHandler(req, res) {
  // Sprint 10 #80: Reject oversized CSP reports (DoS prevention)
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > 4096) {
    return res.status(413).end();
  }

  const report = req.body?.['csp-report'] || req.body;
  if (report) {
    const entry = {
      blockedUri: report['blocked-uri'],
      violatedDirective: report['violated-directive'],
      documentUri: report['document-uri'],
      sourceFile: report['source-file'],
      lineNumber: report['line-number'],
      statusCode: report['status-code'],
      timestamp: new Date().toISOString(),
      ip: req.ip || req.socket?.remoteAddress,
      userAgent: req.get('user-agent'),
    };

    // Structured file log (production audit trail)
    _logCspViolation(entry);

    // Also console.warn for dev visibility
    console.warn(
      '[CSP Violation]',
      JSON.stringify({
        blockedUri: entry.blockedUri,
        violatedDirective: entry.violatedDirective,
        documentUri: entry.documentUri,
        timestamp: entry.timestamp,
      }),
    );
  }
  res.status(204).end();
}
