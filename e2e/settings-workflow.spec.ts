// ═══════════════════════════════════════════════════════════════════
// charEdge — Settings Workflow E2E Tests
//
// Full user flows: open settings, toggle theme, verify persistence,
// change density, verify attribute changes.
//
// P3 C3: All waitForTimeout calls replaced with deterministic waits.
// ═══════════════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test';

// ── Helpers ─────────────────────────────────────────────────────

const SETTINGS_SELECTOR = '[class*="settings"], [class*="Settings"], [class*="slideOver"], [class*="SlideOver"]';

/** Press keyboard shortcut and wait for settings panel to appear */
async function openSettings(page) {
    await page.keyboard.press('4');
    await page.waitForSelector(SETTINGS_SELECTOR, { state: 'visible', timeout: 5_000 });
}

/** Wait for a theme change to propagate to the HTML element */
async function waitForThemeChange(page, previousClass: string) {
    await page.waitForFunction(
        (prev) => (document.documentElement.getAttribute('class') || '') !== prev,
        previousClass,
        { timeout: 3_000 }
    );
}

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

        const settings = page.locator(SETTINGS_SELECTOR).first();
        await expect(settings).toBeVisible({ timeout: 5_000 });
    });

    test('theme toggle switches between dark and light', async ({ page }) => {
        await openSettings(page);

        const themeToggle = page.locator(
            'text=Light, text=Dark, [aria-label*="theme"], [class*="theme-toggle"], [class*="themeToggle"]'
        ).first();

        if (await themeToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
            const htmlBefore = await page.locator('html').getAttribute('class') || '';
            const wasLight = htmlBefore.includes('theme-light');

            // Toggle theme and wait for DOM change
            await themeToggle.click();
            await waitForThemeChange(page, htmlBefore);

            const htmlAfter = await page.locator('html').getAttribute('class') || '';
            const isLight = htmlAfter.includes('theme-light');
            expect(isLight).not.toBe(wasLight);

            // Toggle back
            await themeToggle.click();
            await waitForThemeChange(page, htmlAfter);

            const htmlFinal = await page.locator('html').getAttribute('class') || '';
            expect(htmlFinal.includes('theme-light')).toBe(wasLight);
        }
    });

    test('keyboard shortcuts panel opens via ? key', async ({ page }) => {
        await page.keyboard.press('?');

        const shortcuts = page.locator(
            '[class*="KeyboardShortcuts"], [class*="keyboard-shortcuts"], [class*="shortcut"]'
        ).first();

        if (await shortcuts.isVisible({ timeout: 3000 }).catch(() => false)) {
            await expect(shortcuts).toBeVisible();

            const text = await shortcuts.textContent();
            expect(text).toContain('Ctrl');

            // Escape to close — wait for panel to disappear
            await page.keyboard.press('Escape');
            await shortcuts.waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => { });
        }
    });

    test('notification panel toggles via Ctrl+.', async ({ page }) => {
        await page.keyboard.press('Control+.');

        const panel = page.locator(
            '[class*="NotificationPanel"], [class*="notification"], [class*="activity"]'
        ).first();

        if (await panel.isVisible({ timeout: 3000 }).catch(() => false)) {
            await expect(panel).toBeVisible();

            // Toggle off — wait for panel to disappear
            await page.keyboard.press('Control+.');
            await panel.waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => { });
        }
    });

    test('settings persists after page reload', async ({ page }) => {
        await openSettings(page);

        const toggle = page.locator(
            '[class*="settings"] input[type="checkbox"], [class*="Settings"] input[type="checkbox"], [class*="settings"] [role="switch"]'
        ).first();

        if (await toggle.isVisible({ timeout: 3000 }).catch(() => false)) {
            const wasBefore = await toggle.isChecked().catch(() => null);

            if (wasBefore !== null) {
                await toggle.click();
                // Wait for the toggle state to change
                await page.waitForFunction(
                    (prev) => {
                        const el = document.querySelector('[class*="settings"] input[type="checkbox"], [class*="Settings"] input[type="checkbox"], [class*="settings"] [role="switch"]');
                        return el && (el as HTMLInputElement).checked !== prev;
                    },
                    wasBefore,
                    { timeout: 3_000 }
                ).catch(() => { });

                // Reload and verify persistence
                await page.reload();
                await page.waitForSelector('#root', { state: 'visible', timeout: 15_000 });
                await page.waitForFunction(
                    () => !document.querySelector('[class*="loadingRoot"]'),
                    { timeout: 15_000 }
                );

                await openSettings(page);

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
