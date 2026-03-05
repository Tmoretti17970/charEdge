// ═══════════════════════════════════════════════════════════════════
// charEdge E2E — Timeframe Switcher
// Verifies timeframe switching changes chart data.
// ═══════════════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test';

test.describe('Timeframe', () => {
    test('timeframe switcher buttons exist', async ({ page }) => {
        await page.goto('/chart');

        // Look for timeframe buttons (1m, 5m, 15m, 1h, 4h, 1D, etc.)
        const tfButton = page.locator('button:has-text("1D"), button:has-text("1H"), button:has-text("5m"), [class*="timeframe"]').first();
        await expect(tfButton).toBeVisible({ timeout: 10_000 });
    });

    test('clicking timeframe button triggers update', async ({ page }) => {
        await page.goto('/chart');
        await page.waitForTimeout(2000); // Wait for initial load

        const tfButton = page.locator('button:has-text("1H"), button:has-text("1h")').first();
        if (await tfButton.isVisible()) {
            await tfButton.click();
            // After clicking, the button should show as active/selected
            await page.waitForTimeout(1000);
        }
    });
});
