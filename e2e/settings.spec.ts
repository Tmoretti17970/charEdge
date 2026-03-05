// ═══════════════════════════════════════════════════════════════════
// charEdge E2E — Settings Page
// Verifies settings page loads with toggles and preferences.
// ═══════════════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test';

test.describe('Settings', () => {
    test('settings page loads', async ({ page }) => {
        await page.goto('/settings');

        // Should show settings content
        const heading = page.locator('h1, h2, [class*="settings"]').first();
        await expect(heading).toBeVisible({ timeout: 10_000 });
    });

    test('settings has theme toggle', async ({ page }) => {
        await page.goto('/settings');

        // Look for theme/appearance toggle
        const themeToggle = page.locator('[class*="theme"], [class*="Theme"], button:has-text("Dark"), button:has-text("Light"), [class*="appearance"]').first();
        await expect(themeToggle).toBeVisible({ timeout: 10_000 });
    });
});
