// ═══════════════════════════════════════════════════════════════════
// charEdge E2E — Health Endpoint
// Verifies the /health API endpoint returns valid JSON.
// ═══════════════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test';

test.describe('Health Endpoint', () => {
    test('/health returns JSON with status ok', async ({ request }) => {
        const response = await request.get('/health');
        expect(response.ok()).toBeTruthy();

        const body = await response.json();
        expect(body.status).toBe('ok');
        expect(body.version).toBeDefined();
        expect(body.uptime).toBeGreaterThan(0);
        expect(body.memory).toBeGreaterThan(0);
        expect(body.timestamp).toBeDefined();
    });

    test('/health includes security headers info', async ({ request }) => {
        const response = await request.get('/health');
        const body = await response.json();
        expect(body.security).toBeDefined();
        expect(body.security.csp).toBe(true);
        expect(body.security.permissionsPolicy).toBe(true);
    });
});
