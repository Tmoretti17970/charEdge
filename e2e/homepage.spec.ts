// ═══════════════════════════════════════════════════════════════════
// charEdge E2E — Homepage Load
// Verifies landing page loads with hero section and feature cards.
// ═══════════════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
    test('landing page loads with hero and features', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/charEdge/i);

        // Hero section should be visible
        const hero = page.locator('.landing-hero, [class*="hero"], h1').first();
        await expect(hero).toBeVisible({ timeout: 10_000 });

        // Feature cards section
        const features = page.locator('.landing-features, [class*="features"]').first();
        await expect(features).toBeVisible({ timeout: 5_000 });
    });

    test('navigation links are present', async ({ page }) => {
        await page.goto('/');
        // Should have some navigation
        const nav = page.locator('nav, [role="navigation"], header').first();
        await expect(nav).toBeVisible({ timeout: 5_000 });
    });
});
