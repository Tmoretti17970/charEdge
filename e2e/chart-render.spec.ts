// ═══════════════════════════════════════════════════════════════════
// charEdge E2E — Chart Rendering
// Verifies main chart page loads and renders canvas elements.
// ═══════════════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test';

test.describe('Chart', () => {
    test('chart page loads and renders canvas', async ({ page }) => {
        await page.goto('/chart');

        // Wait for at least one canvas element (WebGL chart layers)
        const canvas = page.locator('canvas').first();
        await expect(canvas).toBeVisible({ timeout: 15_000 });
    });

    test('chart has toolbar with drawing tools', async ({ page }) => {
        await page.goto('/chart');

        // Toolbar should be visible
        const toolbar = page.locator('[class*="toolbar"], [class*="Toolbar"], [role="toolbar"]').first();
        await expect(toolbar).toBeVisible({ timeout: 10_000 });
    });
});
