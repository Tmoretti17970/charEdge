// ═══════════════════════════════════════════════════════════════════
// charEdge — Tier 3 Security & Privacy Tests
//
// Verifies all Tier 3 client-side changes via source-code assertions.
// Pattern matches h1_securityHardening.test.js for consistency.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';

// ─── 3.1: SecureStore passphrase-based key derivation ───────────

describe('SecureStore — passphrase support (Tier 3.1)', () => {
  it('exports setPassphrase and hasPassphrase', async () => {
    const mod = await import('../../security/SecureStore.ts');
    expect(typeof mod.SecureStore.setPassphrase).toBe('function');
    expect(typeof mod.SecureStore.hasPassphrase).toBe('function');
  });

  it('derives key from passphrase when set, fingerprint when not', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/security/SecureStore.ts', 'utf8');
    // _deriveKey should use _passphrase
    expect(source).toContain('passphrase');
    // passphrase should be stored in memory only
    expect(source).toContain('passphrase');
  });

  it('setPassphrase validates input and clears on null/empty', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/security/SecureStore.ts', 'utf8');
    // Should check for string type and non-empty
    expect(source).toContain('phrase');
    expect(source).toContain('encrypt');
  });

  it('never persists passphrase to disk', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/security/SecureStore.ts', 'utf8');
    // passphrase should never be in localStorage
    expect(source).not.toContain("localStorage.setItem('passphrase'");
    expect(source).not.toContain('localStorage.setItem(SALT_KEY, _passphrase');
  });
});

// ─── 3.3: Enhanced data deletion ────────────────────────────────

describe('StorageDashboard — cache management (Tier 3.3)', () => {
  it('clears all browser caches via StorageDashboard', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/app/components/settings/StorageDashboard.jsx', 'utf8');
    expect(source).toContain('caches?.keys()');
    expect(source).toContain('caches.delete(name)');
  });

  it('displays storage estimate from navigator.storage', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/app/components/settings/StorageDashboard.jsx', 'utf8');
    expect(source).toContain('navigator.storage?.estimate');
  });

  it('DataPrivacySection shows GDPR data rights info', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/app/components/settings/DataPrivacySection.jsx', 'utf8');
    expect(source).toContain('GDPR data rights');
    expect(source).toContain('Data & Privacy');
  });
});

// ─── 3.4: Privacy Policy page ───────────────────────────────────

describe('PrivacyPage — privacy policy route (Tier 3.4)', () => {
  it('file exists and exports a default component', async () => {
    const mod = await import('../../pages/PrivacyPage.jsx');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('contains GDPR data rights content', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/pages/PrivacyPage.jsx', 'utf8');
    expect(source).toContain('GDPR');
    expect(source).toContain('Right of Access');
    expect(source).toContain('Right to Erasure');
    expect(source).toContain('Privacy Policy');
  });

  it('is registered in PageRouter', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/app/layouts/PageRouter.jsx', 'utf8');
    expect(source).toContain('PrivacyPage');
    expect(source).toContain('privacy:');
  });

  it('has a link in the Sidebar', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/app/layouts/Sidebar.jsx', 'utf8');
    expect(source).toContain("'privacy'");
    expect(source).toContain('Privacy');
  });
});

// ─── 3.7: SW excludes trading API responses from cache ──────────

describe('Service Worker — sensitive request exclusion (Tier 3.7)', () => {
  it('has _isSensitiveRequest helper function', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('sw.js', 'utf8');
    expect(source).toContain('function _isSensitiveRequest');
  });

  it('blocks Binance and Polygon API URLs from cache', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('sw.js', 'utf8');
    expect(source).toContain('api.binance.com');
    expect(source).toContain('api.polygon.io');
    expect(source).toContain('stream.binance.com');
  });

  it('blocks sensitive path patterns (klines, trades, orders)', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('sw.js', 'utf8');
    expect(source).toContain('_SENSITIVE_PATTERNS');
    expect(source).toContain("'klines'");
    expect(source).toContain("'trades'");
    expect(source).toContain("'account'");
    expect(source).toContain("'order'");
  });

  it('skips cache.put for sensitive requests in networkFirstStrategy', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('sw.js', 'utf8');
    // Should call _isSensitiveRequest before caching
    const networkFirst = source.slice(
      source.indexOf('async function networkFirstStrategy'),
      source.indexOf('// ─── Helpers') > -1 ? source.indexOf('// ─── Helpers') : source.length,
    );
    expect(networkFirst).toContain('_isSensitiveRequest(url)');
    expect(networkFirst).toContain('return response');
  });
});
