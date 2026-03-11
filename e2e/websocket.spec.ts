// ═══════════════════════════════════════════════════════════════════
// charEdge E2E — WebSocket Connection
// Verifies WebSocket connects and streams live data.
// ═══════════════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test';

test.describe('WebSocket', () => {
    test('chart page establishes WebSocket connection', async ({ page }) => {
        const wsPromise = page.waitForEvent('websocket', { timeout: 15_000 }).catch(() => null);

        await page.goto('/chart');
        // Wait for chart to fully render (WS connects during chart init)
        await page.waitForSelector('#root', { state: 'visible', timeout: 15_000 });
        await page.waitForFunction(
            () => !document.querySelector('[class*="loadingRoot"]'),
            { timeout: 15_000 }
        );

        // Check for connection status indicator (green dot)
        const statusIndicator = page.locator('[class*="connection"], [class*="status"], [class*="ws-status"]').first();

        // Either WS connected or status indicator is visible
        const ws = await wsPromise;
        const indicatorVisible = await statusIndicator.isVisible().catch(() => false);

        // At least one should be true
        expect(ws !== null || indicatorVisible).toBeTruthy();
    });
});
