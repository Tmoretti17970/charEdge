// ═══════════════════════════════════════════════════════════════════
// charEdge — Batch 16: Launch Blockers Test Suite
//
// Covers all 10 tasks in Batch 16:
//   16.1  EncryptedStore activation in AppBoot
//   16.2  SRI hashes (sriHelper.js)
//   16.3  CSP reporting (Report-To header + JSONL)
//   16.4  Permissions-Policy (expanded)
//   16.5  security.txt + SECURITY.md
//   16.6  Color contrast enforcement (contrastEnforcer.ts)
//   16.7  Chart keyboard navigation (ChartKeyboardNav.jsx)
//   16.8  BackupService (unified strategy pattern)
//   16.9  Push notifications (PushManager.js + sw.js)
//   16.10 Skill-adaptive onboarding (coachmarkRegistry + onboardingSlice)
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { describe, it, expect, beforeEach } from 'vitest';

// Project root — two levels up from src/__tests__/security/
const ROOT = resolve(__dirname, '..', '..', '..');
const SRC = join(ROOT, 'src');

// ─── 16.1 EncryptedStore Activation ─────────────────────────────

describe('16.1 — EncryptedStore Activation', () => {
    it('AppBoot.js imports EncryptedStore and initApiKeys', () => {
        const src = readFileSync(join(SRC, 'AppBoot.js'), 'utf8');
        expect(src).toContain("import { encryptedStore } from './data/EncryptedStore.js'");
        expect(src).toContain("import { initApiKeys } from './data/providers/ApiKeyStore.js'");
    });

    it('AppBoot.js calls encryptedStore.init() in Promise.all', () => {
        const src = readFileSync(join(SRC, 'AppBoot.js'), 'utf8');
        expect(src).toContain('encryptedStore.init()');
        expect(src).toContain('initApiKeys()');
    });

    it('EncryptedStore.js exports init method', async () => {
        const mod = await import('../../data/EncryptedStore.js');
        const store = mod.encryptedStore || mod.default;
        expect(store).toBeDefined();
        expect(typeof store.init).toBe('function');
    });
});

// ─── 16.2 SRI Hashes ────────────────────────────────────────────

describe('16.2 — SRI Helper', () => {
    it('exports generateSRI, validateSRI, fetchAndHash, auditMissingSRI', async () => {
        const mod = await import('../../security/sriHelper.js');
        expect(typeof mod.generateSRI).toBe('function');
        expect(typeof mod.validateSRI).toBe('function');
        expect(typeof mod.fetchAndHash).toBe('function');
        expect(typeof mod.auditMissingSRI).toBe('function');
    });

    it('auditMissingSRI detects external scripts missing integrity', async () => {
        const { auditMissingSRI } = await import('../../security/sriHelper.js');
        const html = `
      <script src="https://cdn.example.com/lib.js"></script>
      <script src="https://cdn.example.com/safe.js" integrity="sha384-abc"></script>
      <link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet">
    `;
        const missing = auditMissingSRI(html);
        expect(missing).toContain('https://cdn.example.com/lib.js');
        expect(missing).not.toContain('https://cdn.example.com/safe.js');
        expect(missing).toContain('https://fonts.googleapis.com/css2?family=Inter');
    });

    it('auditMissingSRI returns empty array when no external scripts exist', async () => {
        const { auditMissingSRI } = await import('../../security/sriHelper.js');
        const indexHtml = readFileSync(join(ROOT, 'index.html'), 'utf8');
        const missing = auditMissingSRI(indexHtml);
        expect(missing).toEqual([]);
    });
});

// ─── 16.3 CSP Reporting ─────────────────────────────────────────

describe('16.3 — CSP Reporting Enhancement', () => {
    it('security.js contains Report-To header', () => {
        const src = readFileSync(join(ROOT, 'server/middleware/security.js'), 'utf8');
        expect(src).toContain('Report-To');
        expect(src).toContain('csp-endpoint');
        expect(src).toContain('report-to csp-endpoint');
    });

    it('security.js has structured JSONL logging function', () => {
        const src = readFileSync(join(ROOT, 'server/middleware/security.js'), 'utf8');
        expect(src).toContain('csp-violations.jsonl');
        expect(src).toContain('_logCspViolation');
        expect(src).toContain('appendFileSync');
    });
});

// ─── 16.4 Permissions-Policy ────────────────────────────────────

describe('16.4 — Expanded Permissions-Policy', () => {
    const requiredPolicies = ['camera=()', 'microphone=()', 'geolocation=()', 'payment=()', 'usb=()', 'bluetooth=()'];

    it('security.js has expanded permissions', () => {
        const src = readFileSync(join(ROOT, 'server/middleware/security.js'), 'utf8');
        for (const policy of requiredPolicies) {
            expect(src).toContain(policy);
        }
    });

    it('vercel.json has expanded permissions', () => {
        const src = readFileSync(join(ROOT, 'vercel.json'), 'utf8');
        for (const policy of requiredPolicies) {
            expect(src).toContain(policy);
        }
    });

    it('_headers file has expanded permissions', () => {
        const src = readFileSync(join(ROOT, 'public/_headers'), 'utf8');
        for (const policy of requiredPolicies) {
            expect(src).toContain(policy);
        }
    });
});

// ─── 16.5 security.txt + SECURITY.md ────────────────────────────

describe('16.5 — Bug Bounty / security.txt', () => {
    it('security.txt exists and contains required fields', () => {
        const path = join(ROOT, 'public/.well-known/security.txt');
        expect(existsSync(path)).toBe(true);
        const content = readFileSync(path, 'utf8');
        expect(content).toContain('Contact:');
        expect(content).toContain('Expires:');
        expect(content).toContain('Preferred-Languages:');
        expect(content).toContain('Canonical:');
    });

    it('SECURITY.md exists and contains disclosure policy', () => {
        const path = join(ROOT, 'public/SECURITY.md');
        expect(existsSync(path)).toBe(true);
        const content = readFileSync(path, 'utf8');
        expect(content).toContain('Reporting Vulnerabilities');
        expect(content).toContain('Safe Harbor');
    });
});

// ─── 16.6 Contrast Enforcement ──────────────────────────────────

describe('16.6 — WCAG AA Contrast Enforcement', () => {
    let contrastModule;

    beforeEach(async () => {
        contrastModule = await import('../../a11y/contrastEnforcer');
    });

    it('exports required functions', () => {
        expect(typeof contrastModule.relativeLuminance).toBe('function');
        expect(typeof contrastModule.contrastRatio).toBe('function');
        expect(typeof contrastModule.enforceContrast).toBe('function');
        expect(typeof contrastModule.meetsAA).toBe('function');
        expect(typeof contrastModule.meetsAALarge).toBe('function');
        expect(typeof contrastModule.auditContrast).toBe('function');
    });

    it('correctly identifies passing contrast (white on black = 21:1)', () => {
        const ratio = contrastModule.contrastRatio('#ffffff', '#000000');
        expect(ratio).toBeCloseTo(21, 0);
        expect(contrastModule.meetsAA('#ffffff', '#000000')).toBe(true);
    });

    it('correctly identifies failing contrast (gray on gray)', () => {
        // Two similar grays — should fail 4.5:1
        expect(contrastModule.meetsAA('#888888', '#999999')).toBe(false);
    });

    it('enforceContrast adjusts low-contrast colors to meet ratio', () => {
        // Gray on dark background — original fails, enforced should pass
        const adjusted = contrastModule.enforceContrast('#555555', '#111111', 4.5);
        const ratio = contrastModule.contrastRatio(adjusted, '#111111');
        expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('enforceContrast returns original when already passing', () => {
        const original = '#ffffff';
        const result = contrastModule.enforceContrast(original, '#000000', 4.5);
        expect(result).toBe(original);
    });

    it('auditContrast returns only failing pairs', () => {
        const pairs = [
            { name: 'white-on-black', fg: '#ffffff', bg: '#000000' },
            { name: 'gray-on-gray', fg: '#888888', bg: '#999999' },
        ];
        const failures = contrastModule.auditContrast(pairs);
        expect(failures.length).toBe(1);
        expect(failures[0].name).toBe('gray-on-gray');
    });

    it('charEdge dark theme t1/bg passes WCAG AA', () => {
        // t1 = #ececef, bg = #08090a
        const passes = contrastModule.meetsAA('#ececef', '#08090a');
        expect(passes).toBe(true);
    });

    it('charEdge light theme t1/bg passes WCAG AA', () => {
        // t1 = #111318, bg = #f8f8fa
        const passes = contrastModule.meetsAA('#111318', '#f8f8fa');
        expect(passes).toBe(true);
    });
});

// ─── 16.7 Chart Keyboard Navigation ────────────────────────────

describe('16.7 — Chart Keyboard Navigation', () => {
    it('ChartKeyboardNav.jsx exports a default component', async () => {
        const mod = await import('../../app/components/chart/ChartKeyboardNav.jsx');
        expect(mod.default).toBeDefined();
        expect(typeof mod.default).toBe('function');
    });

    it('source contains ARIA live region for screen reader', () => {
        const src = readFileSync(join(SRC, 'app/components/chart/ChartKeyboardNav.jsx'), 'utf8');
        expect(src).toContain('aria-live="assertive"');
        expect(src).toContain('role="status"');
    });

    it('source handles ArrowLeft, ArrowRight, Tab, Enter, Escape', () => {
        const src = readFileSync(join(SRC, 'app/components/chart/ChartKeyboardNav.jsx'), 'utf8');
        expect(src).toContain("'ArrowRight'");
        expect(src).toContain("'ArrowLeft'");
        expect(src).toContain("'Tab'");
        expect(src).toContain("'Enter'");
        expect(src).toContain("'Escape'");
    });
});

// ─── 16.8 Unified BackupService ─────────────────────────────────

describe('16.8 — Unified BackupService', () => {
    it('exports backupService singleton with required methods', async () => {
        const mod = await import('../../data/BackupService.js');
        const svc = mod.backupService || mod.default;
        expect(svc).toBeDefined();
        expect(typeof svc.backup).toBe('function');
        expect(typeof svc.restore).toBe('function');
        expect(typeof svc.listBackups).toBe('function');
        expect(typeof svc.getStatus).toBe('function');
        expect(typeof svc.disconnect).toBe('function');
    });

    it('exports LS_BACKUP_KEYS as a non-empty array', async () => {
        const mod = await import('../../data/BackupService.js');
        expect(Array.isArray(mod.LS_BACKUP_KEYS)).toBe(true);
        expect(mod.LS_BACKUP_KEYS.length).toBeGreaterThan(0);
    });

    it('returns error for unknown strategy', async () => {
        const mod = await import('../../data/BackupService.js');
        const svc = mod.backupService;
        const result = await svc.backup('nonexistent');
        expect(result.ok).toBe(false);
        expect(result.error).toContain('Unknown strategy');
    });
});

// ─── 16.9 Push Notifications ────────────────────────────────────

describe('16.9 — PWA Push Notifications', () => {
    it('PushManager.js exports pushManager singleton', async () => {
        const mod = await import('../../app/misc/PushManager.js');
        expect(mod.pushManager).toBeDefined();
        expect(typeof mod.pushManager.requestPermission).toBe('function');
        expect(typeof mod.pushManager.subscribe).toBe('function');
        expect(typeof mod.pushManager.unsubscribe).toBe('function');
        expect(typeof mod.pushManager.getPermission).toBe('function');
        expect(typeof mod.pushManager.getSubscriptionStatus).toBe('function');
        expect(typeof mod.pushManager.showLocalNotification).toBe('function');
    });

    it('getSubscriptionStatus returns expected shape', async () => {
        const { pushManager } = await import('../../app/misc/PushManager.js');
        const status = pushManager.getSubscriptionStatus();
        expect(status).toHaveProperty('supported');
        expect(status).toHaveProperty('permission');
        expect(status).toHaveProperty('subscribed');
        expect(typeof status.supported).toBe('boolean');
    });

    it('sw.js contains push event handler', () => {
        const src = readFileSync(join(ROOT, 'sw.js'), 'utf8');
        expect(src).toContain("addEventListener('push'");
        expect(src).toContain("addEventListener('notificationclick'");
        expect(src).toContain('showNotification');
    });
});

// ─── 16.10 Skill-Adaptive Onboarding ────────────────────────────

describe('16.10 — Skill-Adaptive Onboarding', () => {
    it('coachmarkRegistry exports COACHMARKS and getCoachmarksForLevel', async () => {
        const mod = await import('../../config/coachmarkRegistry');
        expect(Array.isArray(mod.COACHMARKS)).toBe(true);
        expect(mod.COACHMARKS.length).toBeGreaterThan(0);
        expect(typeof mod.getCoachmarksForLevel).toBe('function');
        expect(typeof mod.getCoachmarkById).toBe('function');
    });

    it('beginner level returns only beginner coachmarks', async () => {
        const { getCoachmarksForLevel } = await import('../../config/coachmarkRegistry');
        const tips = getCoachmarksForLevel('beginner');
        expect(tips.length).toBeGreaterThan(0);
        tips.forEach(t => expect(t.skillLevel).toBe('beginner'));
    });

    it('intermediate level returns beginner + intermediate coachmarks', async () => {
        const { getCoachmarksForLevel } = await import('../../config/coachmarkRegistry');
        const tips = getCoachmarksForLevel('intermediate');
        const levels = new Set(tips.map(t => t.skillLevel));
        expect(levels.has('beginner')).toBe(true);
        expect(levels.has('intermediate')).toBe(true);
        expect(levels.has('advanced')).toBe(false);
    });

    it('advanced level returns all coachmarks', async () => {
        const { getCoachmarksForLevel, COACHMARKS } = await import('../../config/coachmarkRegistry');
        const tips = getCoachmarksForLevel('advanced');
        expect(tips.length).toBe(COACHMARKS.length);
    });

    it('coachmarks are sorted by priority', async () => {
        const { getCoachmarksForLevel } = await import('../../config/coachmarkRegistry');
        const tips = getCoachmarksForLevel('advanced');
        for (let i = 1; i < tips.length; i++) {
            expect(tips[i].priority >= tips[i - 1].priority).toBe(true);
        }
    });

    it('onboardingSlice.ts has skillLevel state and setSkillLevel action', () => {
        const src = readFileSync(join(SRC, 'state/user/onboardingSlice.ts'), 'utf8');
        expect(src).toContain("skillLevel: 'beginner'");
        expect(src).toContain('setSkillLevel');
        expect(src).toContain('getVisibleCoachmarks');
        expect(src).toContain('getCoachmarksForLevel');
    });

    it('onboardingToJSON includes skillLevel', () => {
        const src = readFileSync(join(SRC, 'state/user/onboardingSlice.ts'), 'utf8');
        expect(src).toMatch(/onboardingToJSON.*{[^}]*skillLevel/s);
    });
});
