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
        const req = { body } as any;
        const res = {} as any;
        let called = false;
        const next = () => { called = true; };

        sanitizeInput()(req, res, next);

        expect(called).toBe(true);
        expect(req.body.notes).toBe('alert("xss")Hello');
        expect(req.body.notes).not.toContain('<script>');
        expect(req.body.title).toBe('Bold');
    });

    it('strips javascript: URIs', async () => {
        const { sanitizeInput } = await import('../../../api/sanitize.ts');

        const req = { body: { url: 'javascript:alert(1)' } } as any;
        const res = {} as any;
        const next = () => { };

        sanitizeInput()(req, res, next);
        expect(req.body.url).not.toMatch(/javascript:/i);
    });

    it('strips inline event handlers', async () => {
        const { sanitizeInput } = await import('../../../api/sanitize.ts');

        const req = { body: { notes: 'hello onclick=evil() world' } } as any;
        const res = {} as any;
        const next = () => { };

        sanitizeInput()(req, res, next);
        expect(req.body.notes).not.toMatch(/onclick/i);
    });

    it('preserves non-string values', async () => {
        const { sanitizeInput } = await import('../../../api/sanitize.ts');

        const req = { body: { price: 42000, active: true, tags: ['crypto'] } } as any;
        const res = {} as any;
        const next = () => { };

        sanitizeInput()(req, res, next);
        expect(req.body.price).toBe(42000);
        expect(req.body.active).toBe(true);
        expect(req.body.tags).toEqual(['crypto']);
    });

    it('handles nested objects', async () => {
        const { sanitizeInput } = await import('../../../api/sanitize.ts');

        const req = { body: { entry: { condition: '<img onerror=hack()>Buy signal' } } } as any;
        const res = {} as any;
        const next = () => { };

        sanitizeInput()(req, res, next);
        expect(req.body.entry.condition).toBe('Buy signal');
    });
});

describe('Prototype Pollution Filter', () => {
    it('rejects __proto__ key', async () => {
        const { rejectPrototypePollution } = await import('../../../api/sanitize.ts');

        const req = { body: JSON.parse('{"__proto__": {"isAdmin": true}}'), query: {} } as any;
        let statusCode = 0;
        let jsonBody: any;
        const res = {
            status: (code: number) => { statusCode = code; return res; },
            json: (body: any) => { jsonBody = body; },
            headersSent: false,
        } as any;
        const next = () => { };

        rejectPrototypePollution()(req, res, next);
        expect(statusCode).toBe(400);
        expect(jsonBody.error.code).toBe('PROTOTYPE_POLLUTION');
    });

    it('rejects constructor key', async () => {
        const { rejectPrototypePollution } = await import('../../../api/sanitize.ts');

        const req = { body: { nested: { constructor: { prototype: {} } } }, query: {} } as any;
        let statusCode = 0;
        let jsonBody: any;
        const res = {
            status: (code: number) => { statusCode = code; return res; },
            json: (body: any) => { jsonBody = body; },
            headersSent: false,
        } as any;
        const next = () => { };

        rejectPrototypePollution()(req, res, next);
        expect(statusCode).toBe(400);
        expect(jsonBody.error.code).toBe('PROTOTYPE_POLLUTION');
    });

    it('passes clean objects', async () => {
        const { rejectPrototypePollution } = await import('../../../api/sanitize.ts');

        const req = { body: { symbol: 'BTC', price: 42000 }, query: {} } as any;
        const res = {} as any;
        let called = false;
        const next = () => { called = true; };

        rejectPrototypePollution()(req, res, next);
        expect(called).toBe(true);
    });
});
