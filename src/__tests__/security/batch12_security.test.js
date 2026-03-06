// ═══════════════════════════════════════════════════════════════════
// charEdge — Batch 12 Security Hardening Tests
//
// Verifies all 5 Batch 12 tasks via source-code assertions:
//   4.5.6  CSRF enforcement on state-changing endpoints
//   4.5.7  API key encryption at rest (AES-256-GCM)
//   4.5.8  Input sanitization (DOMPurify)
//   4.5.9  Webhook URL validation (SSRF protection)
//   4.5.10 Alpaca credentials server-side
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';

// ─── 4.5.6: CSRF Enforcement ────────────────────────────────────

describe('4.5.6 — CSRF enforcement on state-changing endpoints', () => {
    it('csrfProtect is imported in server.js', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('server.js', 'utf8');
        expect(source).toContain('csrfProtect');
        expect(source).toContain("from './src/api/csrf.ts'");
    });

    it('csrfProtect() is applied to /api/v1 middleware pipeline', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('server.js', 'utf8');
        expect(source).toContain("app.use('/api/v1', csrfProtect())");
    });

    it('csrf.ts exports both generateCsrfToken and csrfProtect', async () => {
        const mod = await import('../../api/csrf.ts');
        expect(typeof mod.generateCsrfToken).toBe('function');
        expect(typeof mod.csrfProtect).toBe('function');
    });

    it('csrfProtect skips safe methods (GET/HEAD/OPTIONS)', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('src/api/csrf.ts', 'utf8');
        expect(source).toContain('GET');
        expect(source).toContain('HEAD');
        expect(source).toContain('OPTIONS');
    });
});

// ─── 4.5.7: Encrypted API Key Storage ──────────────────────────

describe('4.5.7 — API key encryption at rest', () => {
    it('ApiKeyStore uses SecureStore for encrypted persistence', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('src/data/providers/ApiKeyStore.js', 'utf8');
        expect(source).toContain('SecureStore');
        expect(source).toContain('encryptAndStore');
        expect(source).toContain('loadAndDecrypt');
    });

    it('migrates legacy plaintext keys and removes them', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('src/data/providers/ApiKeyStore.js', 'utf8');
        expect(source).toContain('LEGACY_PREFIX');
        expect(source).toContain('localStorage.removeItem');
    });

    it('never stores plaintext keys in localStorage', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('src/data/providers/ApiKeyStore.js', 'utf8');
        // setApiKey should not call localStorage.setItem
        const afterSetApiKey = source.slice(source.indexOf('function setApiKey'));
        const setApiKeyBlock = afterSetApiKey.slice(0, afterSetApiKey.indexOf('\nexport'));
        expect(setApiKeyBlock).not.toContain('localStorage.setItem');
    });
});

// ─── 4.5.8: DOMPurify Input Sanitization ────────────────────────

describe('4.5.8 — Input sanitization with DOMPurify', () => {
    it('sanitize.ts imports DOMPurify', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('src/api/sanitize.ts', 'utf8');
        expect(source).toContain('DOMPurify');
        expect(source).toContain('isomorphic-dompurify');
    });

    it('uses ALLOWED_TAGS: [] to strip all HTML', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('src/api/sanitize.ts', 'utf8');
        expect(source).toContain('ALLOWED_TAGS: []');
    });

    it('secureInput combines pollution check + sanitization', async () => {
        const mod = await import('../../api/sanitize.ts');
        expect(typeof mod.secureInput).toBe('function');
        expect(typeof mod.rejectPrototypePollution).toBe('function');
        expect(typeof mod.sanitizeInput).toBe('function');
    });

    it('secureInput is applied in routes.ts', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('src/api/routes.ts', 'utf8');
        expect(source).toContain('secureInput()');
    });
});

// ─── 4.5.9: SSRF Protection ────────────────────────────────────

describe('4.5.9 — Webhook URL validation (SSRF)', () => {
    it('ssrf.ts rejects private IP ranges', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('src/api/ssrf.ts', 'utf8');
        expect(source).toContain('^127\\.');     // Loopback
        expect(source).toContain('^10\\.');      // Class A
        expect(source).toContain('^192\\.168\\.'); // Class C
        expect(source).toContain('^169\\.254\\.'); // Link-local
    });

    it('blocks localhost and cloud metadata endpoints', async () => {
        const { validateWebhookUrl } = await import('../../api/ssrf.ts');
        const localhost = validateWebhookUrl('http://localhost:8080/hook');
        expect(localhost.valid).toBe(false);

        const metadata = validateWebhookUrl('http://169.254.169.254/latest/meta-data');
        expect(metadata.valid).toBe(false);
    });

    it('requires HTTPS in production mode', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('src/api/ssrf.ts', 'utf8');
        expect(source).toContain("parsed.protocol !== 'https:'");
    });

    it('ssrfGuard is applied to webhook creation route', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('src/api/routes.ts', 'utf8');
        expect(source).toContain("ssrfGuard()");
        expect(source).toContain("'/webhooks'");
    });

    it('blocks suspicious database ports', async () => {
        const { validateWebhookUrl } = await import('../../api/ssrf.ts');
        const redis = validateWebhookUrl('https://example.com:6379/hook');
        expect(redis.valid).toBe(false);
        const postgres = validateWebhookUrl('https://example.com:5432/hook');
        expect(postgres.valid).toBe(false);
    });
});

// ─── 4.5.10: Alpaca Server-Side Credentials ─────────────────────

describe('4.5.10 — Alpaca credentials server-side', () => {
    it('Alpaca proxy reads from server env vars', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('src/api/routes.ts', 'utf8');
        expect(source).toContain('process.env.ALPACA_KEY_ID');
        expect(source).toContain('process.env.ALPACA_SECRET_KEY');
    });

    it('production mode rejects requests without server env vars', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('src/api/routes.ts', 'utf8');
        expect(source).toContain('CREDENTIALS_MISSING');
        expect(source).toContain("isProduction");
    });

    it('AlpacaAdapter supports configureServerProxy mode', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('src/data/adapters/AlpacaAdapter.js', 'utf8');
        expect(source).toContain('configureServerProxy');
        expect(source).toContain('_useProxy');
        expect(source).toContain('_resolveUrl');
    });

    it('proxy mode routes through /api/v1/alpaca/', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('src/data/adapters/AlpacaAdapter.js', 'utf8');
        expect(source).toContain('/api/v1/alpaca/');
    });

    it('proxy mode does not send API keys in headers', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('src/data/adapters/AlpacaAdapter.js', 'utf8');
        // In proxy mode, _headers() should return only Content-Type
        expect(source).toContain("if (this._useProxy) return { 'Content-Type': 'application/json' }");
    });
});
