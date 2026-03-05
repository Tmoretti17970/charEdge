// ═══════════════════════════════════════════════════════════════════
// Unit Tests — Product & Growth Services
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';
import { analytics, consoleBackend, noopBackend, EVENTS } from '../../../services/analytics.ts';
import type { AnalyticsBackend } from '../../../services/analytics.ts';
import { generateOpenApiSpec } from '../../../api/openapi.ts';
import { aiDisclaimer, AI_DISCLAIMER } from '../../../api/aiDisclaimer.ts';

// ─── Analytics Service ──────────────────────────────────────────

describe('Analytics Service', () => {
    it('tracks events with noop backend without errors', () => {
        analytics.init(noopBackend);
        expect(() => analytics.track(EVENTS.CHART_LOADED, { symbol: 'BTCUSDT' })).not.toThrow();
    });

    it('tracks events with console backend', () => {
        const spy = vi.spyOn(console, 'info').mockImplementation(() => { });
        analytics.init(consoleBackend);
        analytics.track(EVENTS.TRADE_LOGGED, { pnl: 100 });
        expect(spy).toHaveBeenCalledWith(
            expect.stringContaining('trade_logged'),
            expect.objectContaining({ pnl: 100 }),
        );
        spy.mockRestore();
    });

    it('respects enabled/disabled state', () => {
        const mockBackend: AnalyticsBackend = { name: 'mock', track: vi.fn() };
        analytics.init(mockBackend);
        analytics.setEnabled(false);
        analytics.track(EVENTS.CHART_LOADED);
        expect(mockBackend.track).not.toHaveBeenCalled();
        analytics.setEnabled(true);
        analytics.track(EVENTS.CHART_LOADED);
        expect(mockBackend.track).toHaveBeenCalledOnce();
    });

    it('includes global properties in events', () => {
        const mockBackend: AnalyticsBackend = { name: 'mock', track: vi.fn() };
        analytics.init(mockBackend);
        analytics.setEnabled(true);
        analytics.setGlobalProperties({ appVersion: '11.0.0' });
        analytics.track(EVENTS.INDICATOR_ADDED, { name: 'RSI' });
        expect(mockBackend.track).toHaveBeenCalledWith(
            expect.objectContaining({
                properties: expect.objectContaining({ appVersion: '11.0.0', name: 'RSI' }),
            }),
        );
    });

    it('defines all core events', () => {
        expect(Object.keys(EVENTS).length).toBeGreaterThanOrEqual(18);
        expect(EVENTS.CHART_LOADED).toBe('chart_loaded');
        expect(EVENTS.TRADE_LOGGED).toBe('trade_logged');
        expect(EVENTS.JOURNAL_WRITTEN).toBe('journal_written');
    });
});

// ─── OpenAPI Spec ───────────────────────────────────────────────

describe('OpenAPI Spec', () => {
    const spec = generateOpenApiSpec();

    it('generates valid OpenAPI 3.0 structure', () => {
        expect(spec.openapi).toBe('3.0.3');
        expect(spec.info).toBeDefined();
        expect(spec.paths).toBeDefined();
        expect(spec.components).toBeDefined();
    });

    it('includes all major route groups', () => {
        const paths = spec.paths as Record<string, unknown>;
        expect(paths['/trades']).toBeDefined();
        expect(paths['/analytics']).toBeDefined();
        expect(paths['/playbooks']).toBeDefined();
        expect(paths['/settings']).toBeDefined();
        expect(paths['/auth/login']).toBeDefined();
        expect(paths['/auth/register']).toBeDefined();
    });

    it('defines Trade schema', () => {
        const components = spec.components as Record<string, Record<string, unknown>>;
        expect(components.schemas).toHaveProperty('Trade');
    });

    it('defines security schemes', () => {
        const components = spec.components as Record<string, Record<string, unknown>>;
        expect(components.securitySchemes).toHaveProperty('apiKey');
        expect(components.securitySchemes).toHaveProperty('bearer');
    });
});

// ─── AI Disclaimer ──────────────────────────────────────────────

describe('AI Disclaimer Middleware', () => {
    it('injects disclaimer into JSON responses', () => {
        const middleware = aiDisclaimer();
        let capturedBody: Record<string, unknown> | null = null;

        const req = {} as any;
        const res = {
            json: vi.fn((body: unknown) => { capturedBody = body as Record<string, unknown>; return res; }),
        } as any;
        const next = vi.fn();

        middleware(req, res, next);
        expect(next).toHaveBeenCalled();

        // Now call res.json (which is wrapped)
        res.json({ answer: 'Buy BTC' });
        expect(capturedBody).toHaveProperty('_disclaimer', AI_DISCLAIMER);
        expect(capturedBody).toHaveProperty('_ai_generated', true);
        expect(capturedBody).toHaveProperty('answer', 'Buy BTC');
    });

    it('exports the disclaimer text', () => {
        expect(AI_DISCLAIMER).toContain('does not constitute financial advice');
        expect(AI_DISCLAIMER).toContain('consult a qualified financial advisor');
    });
});
