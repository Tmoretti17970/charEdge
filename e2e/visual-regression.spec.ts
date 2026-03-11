// ═══════════════════════════════════════════════════════════════════
// charEdge — Visual Regression E2E Tests
//
// Screenshot baselines for key views. On first run, creates baseline
// snapshots. Subsequent runs diff against them.
//
// Update baselines: npx playwright test e2e/visual-regression.spec.ts --update-snapshots
//
// P3 C3: All waitForTimeout calls replaced with deterministic waits.
// ═══════════════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test';

/** Wait for app to be fully loaded and animations settled */
async function waitForAppReady(page) {
    await page.waitForSelector('#root', { state: 'visible', timeout: 15_000 });
    await page.waitForFunction(
        () => !document.querySelector('[class*="loadingRoot"], [class*="skeleton"], [class*="Skeleton"]'),
        { timeout: 15_000 }
    );
    // Wait for CSS animations/transitions to complete
    await page.waitForFunction(
        () => document.getAnimations().every(a => a.playState === 'finished' || a.playState === 'idle'),
        { timeout: 5_000 }
    ).catch(() => { });
}

/** Navigate via keyboard shortcut and wait for route content to render */
async function navigateToRoute(page, key: string) {
    await page.keyboard.press(key);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(
        () => !document.querySelector('[class*="loadingRoot"], [class*="skeleton"], [class*="Skeleton"]'),
        { timeout: 10_000 }
    );
    // Wait for animations to complete before screenshot
    await page.waitForFunction(
        () => document.getAnimations().every(a => a.playState === 'finished' || a.playState === 'idle'),
        { timeout: 5_000 }
    ).catch(() => { });
}

/** Wait for theme CSS to recalculate */
async function waitForThemeApplied(page) {
    await page.waitForFunction(
        () => getComputedStyle(document.documentElement).getPropertyValue('--bg-primary') !== '',
        { timeout: 3_000 }
    ).catch(() => { });
    // Wait for repaint
    await page.waitForFunction(
        () => document.getAnimations().every(a => a.playState === 'finished' || a.playState === 'idle'),
        { timeout: 3_000 }
    ).catch(() => { });
}

test.describe('Visual Regression', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await waitForAppReady(page);
    });

    test('dashboard page screenshot', async ({ page }) => {
        await navigateToRoute(page, '1');

        await expect(page).toHaveScreenshot('dashboard.png', {
            maxDiffPixelRatio: 0.02,
            fullPage: false,
        });
    });

    test('chart page screenshot', async ({ page }) => {
        await navigateToRoute(page, '2');
        // Extra wait for canvas rendering to stabilize
        await page.waitForSelector('canvas', { state: 'visible', timeout: 10_000 }).catch(() => { });

        await expect(page).toHaveScreenshot('chart.png', {
            maxDiffPixelRatio: 0.05,
            fullPage: false,
        });
    });

    test('discover page screenshot', async ({ page }) => {
        await navigateToRoute(page, '3');

        await expect(page).toHaveScreenshot('discover.png', {
            maxDiffPixelRatio: 0.02,
            fullPage: false,
        });
    });

    test('settings panel screenshot', async ({ page }) => {
        await page.keyboard.press('4');
        await page.waitForSelector(
            '[class*="settings"], [class*="Settings"], [class*="slideOver"], [class*="SlideOver"]',
            { state: 'visible', timeout: 5_000 }
        );

        await expect(page).toHaveScreenshot('settings.png', {
            maxDiffPixelRatio: 0.01,
            fullPage: false,
        });
    });

    // Mobile viewport tests
    test('dashboard mobile screenshot', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.reload();
        await waitForAppReady(page);

        await expect(page).toHaveScreenshot('dashboard-mobile.png', {
            maxDiffPixelRatio: 0.02,
            fullPage: false,
        });
    });

    // Deep Sea OLED theme tests (Task 4.9.3.2)
    test('Deep Sea OLED theme screenshot', async ({ page }) => {
        await page.evaluate(() => {
            document.documentElement.classList.remove('theme-dark', 'theme-light');
            document.documentElement.classList.add('theme-deep-sea');
        });
        await waitForThemeApplied(page);

        await expect(page).toHaveScreenshot('dashboard-deep-sea.png', {
            maxDiffPixelRatio: 0.02,
            fullPage: false,
        });
    });

    test('light theme screenshot', async ({ page }) => {
        await page.evaluate(() => {
            document.documentElement.classList.remove('theme-dark', 'theme-deep-sea');
            document.documentElement.classList.add('theme-light');
        });
        await waitForThemeApplied(page);

        await expect(page).toHaveScreenshot('dashboard-light.png', {
            maxDiffPixelRatio: 0.02,
            fullPage: false,
        });
    });
});
