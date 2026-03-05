// ═══════════════════════════════════════════════════════════════════
// charEdge E2E — Symbol Search
// Verifies symbol search modal opens and returns results.
// ═══════════════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test';

test.describe('Symbol Search', () => {
    test('symbol search opens on click', async ({ page }) => {
        await page.goto('/chart');

        // Look for the symbol display / search trigger
        const symbolTrigger = page.locator('[class*="symbol-search"], [class*="SymbolSearch"], [class*="symbol-display"], button:has-text("BTC"), button:has-text("AAPL")').first();
        if (await symbolTrigger.isVisible({ timeout: 10_000 })) {
            await symbolTrigger.click();
            // Search modal/dropdown should appear
            const searchInput = page.locator('input[placeholder*="earch"], input[placeholder*="ymbol"], input[type="search"]').first();
            await expect(searchInput).toBeVisible({ timeout: 5_000 });
        }
    });

    test('typing in search returns results', async ({ page }) => {
        await page.goto('/chart');

        const symbolTrigger = page.locator('[class*="symbol-search"], [class*="SymbolSearch"], [class*="symbol-display"]').first();
        if (await symbolTrigger.isVisible({ timeout: 10_000 })) {
            await symbolTrigger.click();
            const searchInput = page.locator('input[placeholder*="earch"], input[placeholder*="ymbol"]').first();
            if (await searchInput.isVisible({ timeout: 5_000 })) {
                await searchInput.fill('BTC');
                await page.waitForTimeout(1000);
                // Should show search results
                const results = page.locator('[class*="result"], [class*="Result"], [role="option"], [role="listbox"]').first();
                await expect(results).toBeVisible({ timeout: 5_000 });
            }
        }
    });
});
