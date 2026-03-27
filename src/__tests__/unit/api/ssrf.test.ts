import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateWebhookUrl } from '../../../api/ssrf';

describe('SSRF Protection', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
  });

  describe('validateWebhookUrl', () => {
    it('accepts valid HTTPS URLs', () => {
      const result = validateWebhookUrl('https://example.com/webhook');
      expect(result.valid).toBe(true);
    });

    it('rejects invalid URLs', () => {
      const result = validateWebhookUrl('not-a-url');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Invalid URL');
    });

    it('rejects HTTP in production', () => {
      const result = validateWebhookUrl('http://example.com/webhook');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('HTTPS');
    });

    it('rejects localhost', () => {
      const result = validateWebhookUrl('https://localhost/webhook');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('blocked host');
    });

    it('rejects 0.0.0.0', () => {
      const result = validateWebhookUrl('https://0.0.0.0/webhook');
      expect(result.valid).toBe(false);
    });

    it('rejects loopback IPs (127.x.x.x)', () => {
      const result = validateWebhookUrl('https://127.0.0.1/webhook');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('private');
    });

    it('rejects private Class A IPs (10.x.x.x)', () => {
      const result = validateWebhookUrl('https://10.0.0.1/webhook');
      expect(result.valid).toBe(false);
    });

    it('rejects private Class B IPs (172.16-31.x.x)', () => {
      const result = validateWebhookUrl('https://172.16.0.1/webhook');
      expect(result.valid).toBe(false);
    });

    it('rejects private Class C IPs (192.168.x.x)', () => {
      const result = validateWebhookUrl('https://192.168.1.1/webhook');
      expect(result.valid).toBe(false);
    });

    it('rejects AWS metadata endpoint', () => {
      const result = validateWebhookUrl('https://169.254.169.254/latest/meta-data');
      expect(result.valid).toBe(false);
    });

    it('rejects GCP metadata endpoint', () => {
      const result = validateWebhookUrl('https://metadata.google.internal/computeMetadata');
      expect(result.valid).toBe(false);
    });

    it('rejects link-local IPs (169.254.x.x)', () => {
      const result = validateWebhookUrl('https://169.254.1.1/webhook');
      expect(result.valid).toBe(false);
    });

    it('rejects suspicious database ports', () => {
      const result = validateWebhookUrl('https://example.com:6379/webhook');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('suspicious port');
    });

    it('rejects MySQL port', () => {
      expect(validateWebhookUrl('https://example.com:3306/').valid).toBe(false);
    });

    it('rejects PostgreSQL port', () => {
      expect(validateWebhookUrl('https://example.com:5432/').valid).toBe(false);
    });

    it('rejects MongoDB port', () => {
      expect(validateWebhookUrl('https://example.com:27017/').valid).toBe(false);
    });

    it('accepts standard HTTPS port', () => {
      expect(validateWebhookUrl('https://example.com:443/webhook').valid).toBe(true);
    });

    it('allows HTTP with allowHttp option in non-production', () => {
      vi.stubEnv('NODE_ENV', 'development');
      const result = validateWebhookUrl('http://example.com/webhook', { allowHttp: true });
      expect(result.valid).toBe(true);
    });

    it('rejects HTTP with allowHttp in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const result = validateWebhookUrl('http://example.com/webhook', { allowHttp: true });
      expect(result.valid).toBe(false);
    });

    it('rejects IPv6 loopback', () => {
      const result = validateWebhookUrl('https://[::1]/webhook');
      expect(result.valid).toBe(false);
    });
  });
});
