// ═══════════════════════════════════════════════════════════════════
// Unit Tests — Input Sanitization (no supertest dependency)
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';

// Test the sanitization functions directly instead of via HTTP
describe('Sanitize Functions', () => {
    it('strips HTML tags from strings', async () => {
        const { sanitizeInput } = await import('../../../api/sanitize.ts');

        // Create a fake request object
        const body = { notes: '<script>alert("xss")</script>Hello', title: '<b>Bold</b>' };
        const req = { body } as unknown;
        const res = {} as unknown;
        let called = false;
        const next = () => { called = true; };

        sanitizeInput()(req, res, next);

        expect(called).toBe(true);
        // DOMPurify correctly strips <script> tags AND their content
        expect(req.body.notes).toBe('Hello');
        expect(req.body.notes).not.toContain('<script>');
        expect(req.body.title).toBe('Bold');
    });

    it('strips javascript: URIs', async () => {
        const { sanitizeInput } = await import('../../../api/sanitize.ts');

        const req = { body: { url: 'javascript:alert(1)' } } as unknown;
        const res = {} as unknown;
        const next = () => { };

        sanitizeInput()(req, res, next);
        expect(req.body.url).not.toMatch(/javascript:/i);
    });

    it('strips inline event handlers', async () => {
        const { sanitizeInput } = await import('../../../api/sanitize.ts');

        const req = { body: { notes: 'hello onclick=evil() world' } } as unknown;
        const res = {} as unknown;
        const next = () => { };

        sanitizeInput()(req, res, next);
        expect(req.body.notes).not.toMatch(/onclick/i);
    });

    it('preserves non-string values', async () => {
        const { sanitizeInput } = await import('../../../api/sanitize.ts');

        const req = { body: { price: 42000, active: true, tags: ['crypto'] } } as unknown;
        const res = {} as unknown;
        const next = () => { };

        sanitizeInput()(req, res, next);
        expect(req.body.price).toBe(42000);
        expect(req.body.active).toBe(true);
        expect(req.body.tags).toEqual(['crypto']);
    });

    it('handles nested objects', async () => {
        const { sanitizeInput } = await import('../../../api/sanitize.ts');

        const req = { body: { entry: { condition: '<img onerror=hack()>Buy signal' } } } as unknown;
        const res = {} as unknown;
        const next = () => { };

        sanitizeInput()(req, res, next);
        expect(req.body.entry.condition).toBe('Buy signal');
    });
});

describe('Prototype Pollution Filter', () => {
    it('rejects __proto__ key', async () => {
        const { rejectPrototypePollution } = await import('../../../api/sanitize.ts');

        const req = { body: JSON.parse('{"__proto__": {"isAdmin": true}}'), query: {} } as unknown;
        let statusCode = 0;
        let jsonBody: unknown;
        const res = {
            status: (code: number) => { statusCode = code; return res; },
            json: (body: unknown) => { jsonBody = body; },
            headersSent: false,
        } as unknown;
        const next = () => { };

        rejectPrototypePollution()(req, res, next);
        expect(statusCode).toBe(400);
        expect(jsonBody.error.code).toBe('PROTOTYPE_POLLUTION');
    });

    it('rejects constructor key', async () => {
        const { rejectPrototypePollution } = await import('../../../api/sanitize.ts');

        const req = { body: { nested: { constructor: { prototype: {} } } }, query: {} } as unknown;
        let statusCode = 0;
        let jsonBody: unknown;
        const res = {
            status: (code: number) => { statusCode = code; return res; },
            json: (body: unknown) => { jsonBody = body; },
            headersSent: false,
        } as unknown;
        const next = () => { };

        rejectPrototypePollution()(req, res, next);
        expect(statusCode).toBe(400);
        expect(jsonBody.error.code).toBe('PROTOTYPE_POLLUTION');
    });

    it('passes clean objects', async () => {
        const { rejectPrototypePollution } = await import('../../../api/sanitize.ts');

        const req = { body: { symbol: 'BTC', price: 42000 }, query: {} } as unknown;
        const res = {} as unknown;
        let called = false;
        const next = () => { called = true; };

        rejectPrototypePollution()(req, res, next);
        expect(called).toBe(true);
    });
});
