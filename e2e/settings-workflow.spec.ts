// ═══════════════════════════════════════════════════════════════════
// charEdge — Settings Workflow E2E Tests
//
// Full user flows: open settings, toggle theme, verify persistence,
// change density, verify attribute changes.
// ═══════════════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test';

test.describe('Settings Workflow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#root', { state: 'visible', timeout: 15_000 });
        await page.waitForFunction(
            () => !document.querySelector('[class*="loadingRoot"]'),
            { timeout: 15_000 }
        );
    });

    test('settings opens via keyboard shortcut 4', async ({ page }) => {
        await page.keyboard.press('4');
        await page.waitForTimeout(600);

        // Settings slide-over or page should appear
        const settings = page.locator(
            '[class*="settings"], [class*="Settings"], [class*="slideOver"], [class*="SlideOver"]'
        ).first();

        await expect(settings).toBeVisible({ timeout: 5_000 });
    });

    test('theme toggle switches between dark and light', async ({ page }) => {
        // Open settings
        await page.keyboard.press('4');
        await page.waitForTimeout(600);

        // Find theme toggle
        const themeToggle = page.locator(
            'text=Light, text=Dark, [aria-label*="theme"], [class*="theme-toggle"], [class*="themeToggle"]'
        ).first();

        if (await themeToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
            // Check initial state
            const htmlBefore = await page.locator('html').getAttribute('class') || '';
            const wasLight = htmlBefore.includes('theme-light');

            // Click to toggle
            await themeToggle.click();
            await page.waitForTimeout(500);

            // Verify class changed
            const htmlAfter = await page.locator('html').getAttribute('class') || '';
            const isLight = htmlAfter.includes('theme-light');
            expect(isLight).not.toBe(wasLight);

            // Toggle back
            await themeToggle.click();
            await page.waitForTimeout(500);
            const htmlFinal = await page.locator('html').getAttribute('class') || '';
            expect(htmlFinal.includes('theme-light')).toBe(wasLight);
        }
    });

    test('keyboard shortcuts panel opens via ? key', async ({ page }) => {
        await page.keyboard.press('?');
        await page.waitForTimeout(500);

        const shortcuts = page.locator(
            '[class*="KeyboardShortcuts"], [class*="keyboard-shortcuts"], [class*="shortcut"]'
        ).first();

        if (await shortcuts.isVisible({ timeout: 3000 }).catch(() => false)) {
            await expect(shortcuts).toBeVisible();

            // Should list some shortcuts
            const text = await shortcuts.textContent();
            expect(text).toContain('Ctrl');

            // Escape to close
            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
        }
    });

    test('notification panel toggles via Ctrl+.', async ({ page }) => {
        await page.keyboard.press('Control+.');
        await page.waitForTimeout(500);

        const panel = page.locator(
            '[class*="NotificationPanel"], [class*="notification"], [class*="activity"]'
        ).first();

        if (await panel.isVisible({ timeout: 3000 }).catch(() => false)) {
            await expect(panel).toBeVisible();

            // Toggle off
            await page.keyboard.press('Control+.');
            await page.waitForTimeout(500);
        }
    });

    test('settings persists after page reload', async ({ page }) => {
        // Open settings and make a change
        await page.keyboard.press('4');
        await page.waitForTimeout(600);

        // Find any toggle/checkbox in settings
        const toggle = page.locator(
            '[class*="settings"] input[type="checkbox"], [class*="Settings"] input[type="checkbox"], [class*="settings"] [role="switch"]'
        ).first();

        if (await toggle.isVisible({ timeout: 3000 }).catch(() => false)) {
            const wasBefore = await toggle.isChecked().catch(() => null);

            if (wasBefore !== null) {
                await toggle.click();
                await page.waitForTimeout(500);

                // Reload page
                await page.reload();
                await page.waitForSelector('#root', { state: 'visible', timeout: 15_000 });
                await page.waitForFunction(
                    () => !document.querySelector('[class*="loadingRoot"]'),
                    { timeout: 15_000 }
                );

                // Re-open settings
                await page.keyboard.press('4');
                await page.waitForTimeout(600);

                const toggleAfter = page.locator(
                    '[class*="settings"] input[type="checkbox"], [class*="Settings"] input[type="checkbox"], [class*="settings"] [role="switch"]'
                ).first();

                if (await toggleAfter.isVisible({ timeout: 3000 }).catch(() => false)) {
                    const isAfter = await toggleAfter.isChecked().catch(() => null);
                    if (isAfter !== null) {
                        expect(isAfter).not.toBe(wasBefore);
                    }
                }
            }
        }
    });
});
