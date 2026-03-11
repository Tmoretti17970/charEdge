// ═══════════════════════════════════════════════════════════════════
// charEdge — Cross-Browser Smoke Tests (Task 2A.8)
//
// Lightweight tests designed to pass on Chromium, Firefox, AND WebKit.
// Focus: core rendering, navigation, and interaction — NOT WebGPU
// features (which are Chromium-only for now).
//
// P3 C3: All waitForTimeout calls replaced with deterministic waits.
//
// Run all browsers:
//   npx playwright test e2e/cross-browser.spec.ts
//
// Run specific browser:
//   npx playwright test e2e/cross-browser.spec.ts --project=firefox
// ═══════════════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test';

/** Boot helper — works across all engines */
async function boot(page: any) {
    await page.goto('/');
    await page.waitForSelector('#root', { state: 'visible', timeout: 15_000 });
    await page.waitForFunction(
        () => !document.querySelector('[class*="loadingRoot"]'),
        { timeout: 15_000 }
    );
}

/** Navigate via keyboard shortcut and wait for route to render */
async function navigateToRoute(page: any, key: string) {
    await page.keyboard.press(key);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(
        () => !document.querySelector('[class*="loadingRoot"], [class*="skeleton"]'),
        { timeout: 10_000 }
    );
}

test.describe('Cross-Browser Smoke', () => {

    test('app boots and renders root', async ({ page }) => {
        await boot(page);
        const root = page.locator('#root');
        await expect(root).toBeVisible();
        const text = await root.textContent();
        expect(text!.length).toBeGreaterThan(0);
    });

    test('sidebar navigation renders', async ({ page }) => {
        await boot(page);
        const sidebar = page.locator(
            'nav, [class*="sidebar"], [class*="Sidebar"], [class*="nav-rail"]'
        ).first();
        await expect(sidebar).toBeVisible({ timeout: 5_000 });
    });

    test('keyboard shortcuts navigate pages', async ({ page }) => {
        await boot(page);

        // Press '2' for Charts
        await navigateToRoute(page, '2');

        const main = page.locator('#tf-main-content, main, [class*="chart"]').first();
        await expect(main).toBeVisible({ timeout: 10_000 });

        // Press '1' for Home
        await navigateToRoute(page, '1');
        await expect(main).toBeVisible({ timeout: 5_000 });
    });

    test('chart canvas renders (2D fallback)', async ({ page }) => {
        await boot(page);
        await navigateToRoute(page, '2');

        // Canvas should exist — may be WebGPU on Chrome or 2D on Firefox/Safari
        const canvas = page.locator('canvas').first();
        if (await canvas.isVisible({ timeout: 10_000 }).catch(() => false)) {
            const box = await canvas.boundingBox();
            expect(box).toBeTruthy();
            expect(box!.width).toBeGreaterThan(100);
            expect(box!.height).toBeGreaterThan(100);
        }
    });

    test('modals open and close', async ({ page }) => {
        await boot(page);

        // Try opening trade form via Ctrl+N
        await page.keyboard.press('Control+n');

        const modal = page.locator(
            '[role="dialog"], [class*="modal"], [class*="Modal"]'
        ).first();

        if (await modal.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await expect(modal).toBeVisible();

            // Close via Escape — wait for modal to disappear
            await page.keyboard.press('Escape');
            await expect(modal).not.toBeVisible({ timeout: 3_000 });
        }
    });

    test('theme/design tokens render consistently', async ({ page }) => {
        await boot(page);

        const bgColor = await page.evaluate(() => {
            const root = document.documentElement;
            return getComputedStyle(root).backgroundColor;
        });
        expect(bgColor).toBeTruthy();
    });

    test('no console errors on boot', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (err: Error) => errors.push(err.message));

        await boot(page);
        // Wait for all network activity to settle
        await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => { });

        const critical = errors.filter(msg =>
            !msg.includes('WebSocket') &&
            !msg.includes('net::ERR_') &&
            !msg.includes('Failed to fetch') &&
            !msg.includes('NetworkError') &&
            !msg.includes('ResizeObserver') &&
            !msg.includes('AbortError') &&
            !msg.includes('signal') &&
            !msg.includes('WebGPU') &&
            !msg.includes('GPU') &&
            !msg.includes('requestAdapter')
        );

        expect(critical).toEqual([]);
    });

    test('responsive: content reflows at narrow width', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        await boot(page);

        const root = page.locator('#root');
        await expect(root).toBeVisible();

        const mainContent = page.locator('#tf-main-content, main').first();
        if (await mainContent.isVisible({ timeout: 5_000 }).catch(() => false)) {
            const box = await mainContent.boundingBox();
            expect(box!.width).toBeGreaterThan(300);
        }
    });
});
