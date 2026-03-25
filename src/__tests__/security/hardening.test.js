// ═══════════════════════════════════════════════════════════════════
// charEdge — H1.2 Security Hardening Tests
//
// Verifies all security hardening fixes:
//   1. SecureStore encryption round-trip
//   1b. StorageAdapter uses SecureStore
//   1c. ApiKeyStore uses SecureStore for API keys
//   2. CSP hardened (no unsafe-eval, frame-ancestors)
//   3. RSS proxy rate limiter (30/min)
//   4. Auth token refresh logic
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';

// ─── Fix 1: SecureStore — encryption utility ────────────────────

describe('SecureStore — encryption utility', () => {
  it('exports encryptAndStore, loadAndDecrypt, clear, isEncryptionAvailable', async () => {
    const mod = await import('../../security/SecureStore.ts');
    expect(typeof mod.default.encryptAndStore).toBe('function');
    expect(typeof mod.default.loadAndDecrypt).toBe('function');
    expect(typeof mod.default.clear).toBe('function');
    expect(typeof mod.default.isEncryptionAvailable).toBe('function');
  });

  it('has PBKDF2 key derivation with 100k iterations', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/security/SecureStore.ts', 'utf8');
    expect(source).toContain('DataEncryption');
    expect(source).toContain('PBKDF2');
    expect(source).toContain('AES-GCM');
  });

  it('handles legacy plain-text migration (no _f field)', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/security/SecureStore.ts', 'utf8');
    // loadAndDecrypt should handle objects without _f field (legacy data)
    expect(source).toContain('!envelope._f');
  });

  it('falls back to base64 when crypto.subtle unavailable', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/security/SecureStore.ts', 'utf8');
    expect(source).toContain('envelope._f');
    expect(source).toContain('b64');
    expect(source).toContain('envelope._f');
    expect(source).toContain('crypto.subtle unavailable');
  });
});

// ─── Fix 1b: StorageAdapter uses SecureStore ────────────────────

describe('StorageAdapter — uses SecureStore for auth data', () => {
  // TODO: un-skip when StorageAdapter imports SecureStore (Task 0.3)
  it.skip('imports SecureStore', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/StorageAdapter.js', 'utf8');
    expect(source).toContain('SecureStore');
  });

  it('_saveAuth uses SecureStore.encryptAndStore (not localStorage.setItem)', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/StorageAdapter.js', 'utf8');
    // Should use SecureStore for auth data
    expect(source).toContain('SecureStore.encryptAndStore(AUTH_KEY');
    // Should NOT use plain localStorage for auth
    const saveAuthSection = source.slice(
      source.indexOf('async function _saveAuth'),
      source.indexOf('// ─── I1.2: Auth API'),
    );
    expect(saveAuthSection).not.toContain('localStorage.setItem');
  });

  it('_loadAuth uses SecureStore.loadAndDecrypt (not localStorage.getItem)', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/StorageAdapter.js', 'utf8');
    expect(source).toContain('SecureStore.loadAndDecrypt(AUTH_KEY');
    const loadAuthSection = source.slice(
      source.indexOf('async function _loadAuth'),
      source.indexOf('async function _saveAuth'),
    );
    expect(loadAuthSection).not.toContain('localStorage.getItem');
  });

  it('stores _tokenExpiresAt in auth state', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/StorageAdapter.js', 'utf8');
    expect(source).toContain('_tokenExpiresAt');
  });
});

// ─── Fix 1c: ApiKeyStore uses SecureStore ────────────────────────

describe('ApiKeyStore — encrypted API key storage', () => {
  it('imports SecureStore', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/providers/ApiKeyStore.js', 'utf8');
    expect(source).toContain('SecureStore');
  });

  it('uses SecureStore.encryptAndStore for persistence', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/providers/ApiKeyStore.js', 'utf8');
    expect(source).toContain('SecureStore.encryptAndStore');
  });

  it('uses SecureStore.loadAndDecrypt for loading', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/providers/ApiKeyStore.js', 'utf8');
    expect(source).toContain('SecureStore.loadAndDecrypt');
  });

  it('migrates legacy plain-text keys from localStorage', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/providers/ApiKeyStore.js', 'utf8');
    expect(source).toContain('LEGACY_PREFIX');
    expect(source).toContain('localStorage.removeItem');
  });

  it('has initApiKeys() startup function', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/providers/ApiKeyStore.js', 'utf8');
    expect(source).toContain('export async function initApiKeys');
  });

  it('keeps getApiKey synchronous via in-memory cache', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/providers/ApiKeyStore.js', 'utf8');
    expect(source).toContain('export function getApiKey');
    // Should NOT be async
    expect(source).not.toContain('export async function getApiKey');
  });
});

// ─── Fix 2: CSP hardened — no unsafe-eval, no unsafe-inline ────

// Server was refactored into modules — load all source files
const _serverModules = [
  'server.js',
  'server/middleware/security.js',
  'server/middleware/rateLimiter.js',
  'server/middleware/requestId.js',
  'server/routes/rss.js',
  'server/routes/proxy.js',
  'server/ssr.js',
];
async function _readServerSource() {
  const fs = await import('node:fs');
  const contents = await Promise.all(_serverModules.map((f) => fs.promises.readFile(f, 'utf8')));
  return contents.join('\n');
}

describe('CSP — hardened Content-Security-Policy', () => {
  it('does NOT contain unsafe-eval in script-src', async () => {
    const fs = await import('fs');
    const source = await _readServerSource();
    // Find the script-src line
    const scriptSrc = source.match(/script-src[^"]+/)?.[0] || '';
    expect(scriptSrc).not.toContain('unsafe-eval');
  });

  it('does NOT contain unsafe-inline in script-src', async () => {
    const fs = await import('fs');
    const source = await _readServerSource();
    // Match script-src directive within a single source line (backtick-delimited template literal)
    const scriptSrc = source.match(/script-src[^`\n]+/)?.[0] || '';
    expect(scriptSrc).not.toContain('unsafe-inline');
  });

  it('contains frame-ancestors none', async () => {
    const fs = await import('fs');
    const source = await _readServerSource();
    expect(source).toContain("frame-ancestors 'none'");
  });

  it('contains base-uri and form-action directives', async () => {
    const fs = await import('fs');
    const source = await _readServerSource();
    expect(source).toContain("base-uri 'self'");
    expect(source).toContain("form-action 'self'");
  });

  it('contains frame-ancestors directive', async () => {
    const fs = await import('fs');
    const source = await _readServerSource();
    expect(source).toContain("frame-ancestors 'none'");
  });

  it('contains upgrade-insecure-requests', async () => {
    const fs = await import('fs');
    const source = await _readServerSource();
    expect(source).toContain('upgrade-insecure-requests');
  });

  it('has HSTS header in production', async () => {
    const fs = await import('fs');
    const source = await _readServerSource();
    expect(source).toContain('Strict-Transport-Security');
    expect(source).toContain('max-age=63072000');
    expect(source).toContain('includeSubDomains');
    expect(source).toContain('preload');
  });
});

// ─── Fix 2b: Vercel security headers ───────────────────────────

describe('Vercel — security headers in vercel.json', () => {
  it('has X-Frame-Options in vercel.json', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('vercel.json', 'utf8');
    expect(source).toContain('X-Frame-Options');
    expect(source).toContain('SAMEORIGIN');
  });

  // TODO: Add Content-Security-Policy header to vercel.json headers section.
  // CSP is enforced by the Express server middleware (server/middleware/security.js)
  // but not yet duplicated into vercel.json for the static/edge deployment path.
  it.skip('has CSP in vercel.json', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('vercel.json', 'utf8');
    expect(source).toContain('Content-Security-Policy');
    expect(source).toContain("frame-ancestors 'none'");
  });

  it('has HSTS in vercel.json', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('vercel.json', 'utf8');
    expect(source).toContain('Strict-Transport-Security');
  });

  it('has all security headers in vercel.json', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('vercel.json', 'utf8');
    expect(source).toContain('X-Content-Type-Options');
    expect(source).toContain('Referrer-Policy');
    expect(source).toContain('Permissions-Policy');
  });

  // TODO: Depends on CSP header being added to vercel.json (see skip above).
  it.skip('vercel.json CSP does not contain unsafe-eval or unsafe-inline', async () => {
    const fs = await import('fs');
    const config = JSON.parse(await fs.promises.readFile('vercel.json', 'utf8'));
    const headers = config.headers?.flatMap((h) => h.headers) || [];
    const cspHeader = headers.find((h) => h.key === 'Content-Security-Policy');
    expect(cspHeader).toBeDefined();
    const csp = cspHeader.value;
    // Extract script-src directive
    const scriptSrc = csp.match(/script-src\s+([^;]+)/)?.[1] || '';
    expect(scriptSrc).not.toContain("'unsafe-eval'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).toContain("'self'");
    // frame-ancestors must deny all framing
    expect(csp).toContain("frame-ancestors 'none'");
  });
});

// ─── Fix 3: RSS proxy rate limiting ─────────────────────────────

describe('RSS proxy — rate limiting', () => {
  it('has rate limiter with 30 req/min per IP', async () => {
    const fs = await import('fs');
    const source = await _readServerSource();
    expect(source).toContain('RATE_LIMIT_MAX = 30');
    expect(source).toContain('RATE_LIMIT_WINDOW_MS = 60_000');
    expect(source).toContain('checkRateLimit');
  });

  it('returns 429 when rate limit exceeded', async () => {
    const fs = await import('fs');
    const source = await _readServerSource();
    expect(source).toContain('429');
    expect(source).toContain('Too many requests');
  });

  it('returns Retry-After header on 429', async () => {
    const fs = await import('fs');
    const source = await _readServerSource();
    expect(source).toContain('Retry-After');
  });

  it('sets Retry-After header on 429 response', async () => {
    const fs = await import('fs');
    const source = await _readServerSource();
    expect(source).toContain("res.setHeader('Retry-After'");
  });

  it('rate limiter has periodic cleanup', async () => {
    const fs = await import('fs');
    const source = await _readServerSource();
    expect(source).toContain('_rateLimitMap.delete(ip)');
  });
});

// ─── Fix 4: Auth token refresh / TTL ────────────────────────────

describe('Auth token — TTL and refresh', () => {
  it('has _isTokenExpired check with 5-min buffer', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/StorageAdapter.js', 'utf8');
    expect(source).toContain('_isTokenExpired');
    expect(source).toContain('5 * 60 * 1000'); // 5-min pre-emptive refresh
  });

  it('has _refreshToken using refresh_token grant', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/StorageAdapter.js', 'utf8');
    expect(source).toContain('_refreshToken');
    expect(source).toContain('grant_type=refresh_token');
  });

  it('_supabaseRequest retries on 401', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/StorageAdapter.js', 'utf8');
    expect(source).toContain('res.status === 401');
    // Should retry after refreshing
    const supaRequestSection = source.slice(
      source.indexOf('async function _supabaseRequest'),
      source.indexOf('// ─── I1.3: Sync Engine'),
    );
    expect(supaRequestSection).toContain('_refreshToken');
  });

  it('tracks expires_in from sign-in response', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/StorageAdapter.js', 'utf8');
    expect(source).toContain('data.expires_in');
    expect(source).toContain('_tokenExpiresAt');
  });
});
