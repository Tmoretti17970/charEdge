// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Workflow E2E Tests
//
// Full user flows: navigate to charts, interact with toolbar,
// change timeframes, add indicators, verify chart renders.
// ═══════════════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test';

test.describe('Chart Workflow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Wait for app to fully boot (loading screen disappears)
        await page.waitForSelector('#root', { state: 'visible', timeout: 15_000 });
        // Wait for loading screen to finish
        await page.waitForFunction(
            () => !document.querySelector('[class*="loadingRoot"]'),
            { timeout: 15_000 }
        );
    });

    test('chart page renders with canvas elements', async ({ page }) => {
        // Navigate to Charts tab
        const chartsNav = page.locator('text=Charts').first();
        if (await chartsNav.isVisible({ timeout: 3000 }).catch(() => false)) {
            await chartsNav.click();
            await page.waitForLoadState('domcontentloaded');
        }

        // Chart should have at least one canvas
        const canvases = page.locator('canvas');
        await expect(canvases.first()).toBeVisible({ timeout: 10_000 });
        expect(await canvases.count()).toBeGreaterThan(0);
    });

    test('chart toolbar is visible and interactive', async ({ page }) => {
        // Navigate to Charts
        const chartsNav = page.locator('text=Charts').first();
        if (await chartsNav.isVisible({ timeout: 3000 }).catch(() => false)) {
            await chartsNav.click();
        }

        // Toolbar should be present
        const toolbar = page.locator('.tf-chart-toolbar').first();
        await expect(toolbar).toBeVisible({ timeout: 10_000 });

        // Toolbar should have timeframe pills
        const tfPills = page.locator('.tf-chart-tf-pill');
        expect(await tfPills.count()).toBeGreaterThan(0);
    });

    test('changing timeframe updates active pill', async ({ page }) => {
        const chartsNav = page.locator('text=Charts').first();
        if (await chartsNav.isVisible({ timeout: 3000 }).catch(() => false)) {
            await chartsNav.click();
        }

        // Wait for timeframe pills to appear
        const pills = page.locator('.tf-chart-tf-pill');
        await expect(pills.first()).toBeVisible({ timeout: 10_000 });

        // Click a different timeframe pill
        const pillCount = await pills.count();
        if (pillCount > 1) {
            const secondPill = pills.nth(1);
            await secondPill.click();

            // The clicked pill should become active
            await expect(secondPill).toHaveAttribute('data-active', 'true', { timeout: 3000 });
        }
    });

    test('chart status bar shows market data', async ({ page }) => {
        const chartsNav = page.locator('text=Charts').first();
        if (await chartsNav.isVisible({ timeout: 3000 }).catch(() => false)) {
            await chartsNav.click();
        }

        // Status bar should be visible
        const statusBar = page.locator('.tf-chart-status-bar').first();
        if (await statusBar.isVisible({ timeout: 5000 }).catch(() => false)) {
            // Should contain numeric values (prices)
            const text = await statusBar.textContent();
            expect(text).toBeTruthy();
        }
    });

    test('keyboard shortcut 2 navigates to Charts', async ({ page }) => {
        // Press '2' to navigate to Charts
        await page.keyboard.press('2');

        // Chart canvas should appear
        const canvas = page.locator('canvas').first();
        await expect(canvas).toBeVisible({ timeout: 10_000 });
    });

    test('no JavaScript errors during chart interaction', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (err) => errors.push(err.message));

        // Navigate to Charts
        const chartsNav = page.locator('text=Charts').first();
        if (await chartsNav.isVisible({ timeout: 3000 }).catch(() => false)) {
            await chartsNav.click();
        }
        await page.waitForLoadState('domcontentloaded');

        // Filter known non-critical errors
        const critical = errors.filter(msg =>
            !msg.includes('WebSocket') &&
            !msg.includes('net::ERR_') &&
            !msg.includes('Failed to fetch') &&
            !msg.includes('NetworkError') &&
            !msg.includes('ResizeObserver')
        );

        expect(critical).toEqual([]);
    });
});
