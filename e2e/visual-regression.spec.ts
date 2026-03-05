// ═══════════════════════════════════════════════════════════════════
// charEdge — Visual Regression E2E Tests
//
// Screenshot baselines for key views. On first run, creates baseline
// snapshots. Subsequent runs diff against them.
//
// Update baselines: npx playwright test e2e/visual-regression.spec.ts --update-snapshots
// ═══════════════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#root', { state: 'visible', timeout: 15_000 });
        await page.waitForFunction(
            () => !document.querySelector('[class*="loadingRoot"]'),
            { timeout: 15_000 }
        );
        // Wait for animations to settle
        await page.waitForTimeout(1500);
    });

    test('dashboard page screenshot', async ({ page }) => {
        await page.keyboard.press('1');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        await expect(page).toHaveScreenshot('dashboard.png', {
            maxDiffPixelRatio: 0.02,
            fullPage: false,
        });
    });

    test('chart page screenshot', async ({ page }) => {
        await page.keyboard.press('2');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000); // Extra time for chart rendering

        await expect(page).toHaveScreenshot('chart.png', {
            maxDiffPixelRatio: 0.05, // Chart data changes, allow more tolerance
            fullPage: false,
        });
    });

    test('discover page screenshot', async ({ page }) => {
        await page.keyboard.press('3');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        await expect(page).toHaveScreenshot('discover.png', {
            maxDiffPixelRatio: 0.02,
            fullPage: false,
        });
    });

    test('settings panel screenshot', async ({ page }) => {
        await page.keyboard.press('4');
        await page.waitForTimeout(800);

        await expect(page).toHaveScreenshot('settings.png', {
            maxDiffPixelRatio: 0.01,
            fullPage: false,
        });
    });

    // Mobile viewport tests
    test('dashboard mobile screenshot', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.reload();
        await page.waitForSelector('#root', { state: 'visible', timeout: 15_000 });
        await page.waitForFunction(
            () => !document.querySelector('[class*="loadingRoot"]'),
            { timeout: 15_000 }
        );
        await page.waitForTimeout(1500);

        await expect(page).toHaveScreenshot('dashboard-mobile.png', {
            maxDiffPixelRatio: 0.02,
            fullPage: false,
        });
    });
});
