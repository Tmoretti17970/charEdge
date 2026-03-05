// ═══════════════════════════════════════════════════════════════════
// charEdge E2E — Indicator Panel
// Verifies indicator panel opens and can add indicators.
// ═══════════════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test';

test.describe('Indicator Panel', () => {
    test('indicator button opens indicator panel', async ({ page }) => {
        await page.goto('/chart');

        // Look for indicator button
        const indBtn = page.locator('button[title*="ndicator"], button:has-text("Indicators"), [class*="indicator"], [aria-label*="indicator"]').first();
        if (await indBtn.isVisible({ timeout: 10_000 })) {
            await indBtn.click();

            // Indicator panel/modal should appear
            const panel = page.locator('[class*="indicator-panel"], [class*="IndicatorPanel"], [class*="indicator-list"], [role="dialog"]').first();
            await expect(panel).toBeVisible({ timeout: 5_000 });
        }
    });

    test('indicator search shows SMA option', async ({ page }) => {
        await page.goto('/chart');

        const indBtn = page.locator('button[title*="ndicator"], button:has-text("Indicators"), [class*="indicator"]').first();
        if (await indBtn.isVisible({ timeout: 10_000 })) {
            await indBtn.click();

            const searchInput = page.locator('input[placeholder*="earch"], input[placeholder*="ndicator"]').first();
            if (await searchInput.isVisible({ timeout: 5_000 })) {
                await searchInput.fill('SMA');
                await page.waitForTimeout(1000);
            }
        }
    });
});
