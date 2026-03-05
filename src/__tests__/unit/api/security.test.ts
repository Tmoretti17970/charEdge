// ═══════════════════════════════════════════════════════════════════
// Unit Tests — SSRF Protection
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { validateWebhookUrl } from '../../../api/ssrf.ts';

describe('SSRF Protection', () => {
    it('accepts valid HTTPS URLs', () => {
        const result = validateWebhookUrl('https://example.com/webhook');
        expect(result.valid).toBe(true);
    });

    it('rejects HTTP URLs by default', () => {
        const result = validateWebhookUrl('http://example.com/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('HTTPS');
    });

    it('rejects localhost', () => {
        const result = validateWebhookUrl('https://localhost/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('blocked');
    });

    it('rejects loopback IP (127.0.0.1)', () => {
        const result = validateWebhookUrl('https://127.0.0.1/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('private');
    });

    it('rejects private IPs (10.x)', () => {
        expect(validateWebhookUrl('https://10.0.0.1/webhook').valid).toBe(false);
    });

    it('rejects private IPs (192.168.x)', () => {
        expect(validateWebhookUrl('https://192.168.1.1/webhook').valid).toBe(false);
    });

    it('rejects private IPs (172.16.x)', () => {
        expect(validateWebhookUrl('https://172.16.0.1/webhook').valid).toBe(false);
    });

    it('rejects AWS/GCP metadata endpoint', () => {
        const result = validateWebhookUrl('https://169.254.169.254/latest/meta-data');
        expect(result.valid).toBe(false);
    });

    it('rejects invalid URLs', () => {
        const result = validateWebhookUrl('not-a-url');
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('Invalid');
    });

    it('rejects suspicious ports (Redis 6379)', () => {
        const result = validateWebhookUrl('https://example.com:6379/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('suspicious port');
    });

    it('accepts HTTP when allowHttp is set (non-production)', () => {
        const result = validateWebhookUrl('http://example.com/webhook', { allowHttp: true });
        expect(result.valid).toBe(true);
    });
});
