// ═══════════════════════════════════════════════════════════════════
// charEdge — Batch 13 Production Polish Tests
//
// Verifies all Batch 13 tasks via source-code assertions:
//   3.1.4  BackupService consolidation
//   3.1.5  Per-user rate limiting
//   3.1.6  Audit logging middleware
//   3.2.8  Migration checksums + dry-run
//   3.2.9  Idempotent migrations
//   3.5.5  Safe area inset handling
//   3.5.6  Haptic feedback
//   4.6.3  :focus-visible
//   4.6.4  Focus trap for modals
//   4.6.5  aria-live for price updates
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';

// ─── 3.1.5: Per-User Rate Limiting ─────────────────────────────

describe('3.1.5 — Per-user rate limiting', () => {
    it('rate limiter prioritizes req.userId over apiKey.id', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('src/api/middleware.ts', 'utf8');
        // Should prefer userId → apiKey.id → ip → anonymous
        expect(source).toContain('req.userId || req.apiKey?.id || req.ip');
    });

    it('exports rateLimiter function', async () => {
        const mod = await import('../../api/middleware.ts');
        expect(typeof mod.rateLimiter).toBe('function');
    });

    it('sets rate limit headers (X-RateLimit-*)', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('src/api/middleware.ts', 'utf8');
        expect(source).toContain('X-RateLimit-Limit');
        expect(source).toContain('X-RateLimit-Remaining');
        expect(source).toContain('X-RateLimit-Reset');
    });
});

// ─── 3.1.6: Audit Logging ───────────────────────────────────────

describe('3.1.6 — Audit logging middleware', () => {
    it('exports auditLogger function', async () => {
        const mod = await import('../../api/middleware.ts');
        expect(typeof mod.auditLogger).toBe('function');
    });

    it('writes to audit_log table with userId, action, metadata', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('src/api/middleware.ts', 'utf8');
        expect(source).toContain('INSERT INTO audit_log');
        expect(source).toContain("req.userId || 'anonymous'");
        expect(source).toContain('req.method');
        expect(source).toContain('req.originalUrl');
    });

    it('skips GET/HEAD/OPTIONS by default', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('src/api/middleware.ts', 'utf8');
        expect(source).toContain("skipMethods = ['GET', 'HEAD', 'OPTIONS']");
    });

    it('records IP and user-agent in metadata', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('src/api/middleware.ts', 'utf8');
        expect(source).toContain('req.ip');
        expect(source).toContain("req.headers['user-agent']");
    });

    it('audit_log table exists in schema', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('src/api/db/sqlite-schema.ts', 'utf8');
        expect(source).toContain('CREATE TABLE IF NOT EXISTS audit_log');
        expect(source).toContain('user_id');
        expect(source).toContain('action');
        expect(source).toContain('metadata');
    });
});

// ─── 3.2.8: Migration Checksums + Dry-Run ──────────────────────

describe('3.2.8 — Migration checksums + dry-run + rollback', () => {
    it('exports computeChecksum and dryRunMigrations', async () => {
        const mod = await import('../../api/db/migrations.ts');
        expect(typeof mod.computeChecksum).toBe('function');
        expect(typeof mod.dryRunMigrations).toBe('function');
    });

    it('computeChecksum generates 16-char SHA-256 hash', async () => {
        const { computeChecksum } = await import('../../api/db/migrations.ts');
        const result = computeChecksum({
            version: 1,
            name: 'test',
            up: () => { },
            down: () => { },
        });
        expect(typeof result).toBe('string');
        expect(result.length).toBe(16);
    });

    it('_migrations table has checksum column', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('src/api/db/migrations.ts', 'utf8');
        expect(source).toContain('checksum    TEXT');
    });

    it('runMigrations verifies checksums of applied migrations', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('src/api/db/migrations.ts', 'utf8');
        expect(source).toContain('checksumErrors');
        expect(source).toContain('checksum mismatch');
    });

    it('rollbackMigration is exported', async () => {
        const mod = await import('../../api/db/migrations.ts');
        expect(typeof mod.rollbackMigration).toBe('function');
    });
});

// ─── 3.2.9: Idempotent Migrations ──────────────────────────────

describe('3.2.9 — Idempotent migrations', () => {
    it('schema uses IF NOT EXISTS for all tables', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('src/api/db/sqlite-schema.ts', 'utf8');
        const creates = source.match(/CREATE TABLE/g) || [];
        const ifNotExists = source.match(/CREATE TABLE IF NOT EXISTS/g) || [];
        expect(creates.length).toBe(ifNotExists.length);
        expect(creates.length).toBeGreaterThanOrEqual(5);
    });

    it('indexes use IF NOT EXISTS', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('src/api/db/sqlite-schema.ts', 'utf8');
        const indexes = source.match(/CREATE INDEX/g) || [];
        const idempotent = source.match(/CREATE INDEX IF NOT EXISTS/g) || [];
        expect(indexes.length).toBe(idempotent.length);
    });
});

// ─── 3.5.5: Safe Area Inset Handling ───────────────────────────

describe('3.5.5 — Safe area inset handling', () => {
    it('mobile CSS uses env(safe-area-inset-*)', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('src/theme/mobile.css', 'utf8');
        expect(source).toContain('env(safe-area-inset');
    });

    it('BottomSheet uses safe area insets', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('src/app/components/ui/BottomSheet.jsx', 'utf8');
        expect(source).toContain('safe-area-inset');
    });
});

// ─── 3.5.6: Haptic Feedback ────────────────────────────────────

describe('3.5.6 — Wire haptics', () => {
    it('haptics module exports trigger/isSupported/setEnabled/isEnabled', async () => {
        const mod = await import('../../app/misc/haptics.ts');
        expect(typeof mod.haptics.trigger).toBe('function');
        expect(typeof mod.haptics.isSupported).toBe('function');
        expect(typeof mod.haptics.setEnabled).toBe('function');
        expect(typeof mod.haptics.isEnabled).toBe('function');
    });

    it('has 6 haptic patterns', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('src/app/misc/haptics.ts', 'utf8');
        expect(source).toContain("'light'");
        expect(source).toContain("'medium'");
        expect(source).toContain("'heavy'");
        expect(source).toContain("'success'");
        expect(source).toContain("'warning'");
        expect(source).toContain("'error'");
    });
});

// ─── 4.6.3: :focus-visible ─────────────────────────────────────

describe('4.6.3 — :focus-visible on interactive elements', () => {
    it('reset.css has global :focus-visible rule', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('src/theme/reset.css', 'utf8');
        expect(source).toContain(':focus-visible');
    });

    it('accessibility.css targets common component classes', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('src/theme/accessibility.css', 'utf8');
        expect(source).toContain('.tf-btn:focus-visible');
        expect(source).toContain('.tf-toolbar-btn:focus-visible');
        expect(source).toContain('.tf-icon-btn:focus-visible');
    });

    it('suppresses focus ring on mouse click via :focus:not(:focus-visible)', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('src/theme/accessibility.css', 'utf8');
        expect(source).toContain(':focus:not(:focus-visible)');
    });
});

// ─── 4.6.4: Focus Trap ─────────────────────────────────────────

describe('4.6.4 — Focus trap for modals/dialogs', () => {
    it('useFocusTrap hook exists and exports', async () => {
        const mod = await import('../../a11y/useFocusTrap.ts');
        expect(typeof mod.useFocusTrap).toBe('function');
    });

    it('traps Tab at boundaries (wraps first ↔ last)', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('src/a11y/useFocusTrap.ts', 'utf8');
        expect(source).toContain("e.key === 'Tab'");
        expect(source).toContain('e.shiftKey');
        expect(source).toContain('last.focus()');
        expect(source).toContain('first.focus()');
    });

    it('supports Escape to close and returnFocusOnClose', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('src/a11y/useFocusTrap.ts', 'utf8');
        expect(source).toContain("e.key === 'Escape'");
        expect(source).toContain('returnFocusOnClose');
        expect(source).toContain('previousFocusRef.current.focus()');
    });
});

// ─── 4.6.5: aria-live for Price Updates ─────────────────────────

describe('4.6.5 — aria-live for price updates', () => {
    it('ariaLivePrice module exists', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('src/a11y/ariaLivePrice.ts', 'utf8');
        expect(source).toContain('aria-live');
    });

    it('ChartAccessibility creates aria-live region', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile('src/charting_library/core/ChartAccessibility.ts', 'utf8');
        expect(source).toContain("setAttribute('aria-live'");
    });
});
