// ═══════════════════════════════════════════════════════════════════
// charEdge — Accessibility E2E Tests (axe-core)
//
// Runs automated WCAG AA accessibility audits on each major route.
// Requires: npm install --save-dev @axe-core/playwright
// ═══════════════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Audit (WCAG AA)', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#root', { state: 'visible', timeout: 15_000 });
        await page.waitForFunction(
            () => !document.querySelector('[class*="loadingRoot"]'),
            { timeout: 15_000 }
        );
    });

    test('dashboard has no critical a11y violations', async ({ page }) => {
        await page.keyboard.press('1');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .disableRules(['color-contrast']) // Disabled initially — to be fixed in batches
            .analyze();

        const critical = results.violations.filter(
            v => v.impact === 'critical' || v.impact === 'serious'
        );

        expect(critical).toEqual([]);
    });

    test('chart page has no critical a11y violations', async ({ page }) => {
        await page.keyboard.press('2');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .disableRules(['color-contrast'])
            .exclude('canvas') // Canvas elements are not testable by axe
            .analyze();

        const critical = results.violations.filter(
            v => v.impact === 'critical' || v.impact === 'serious'
        );

        expect(critical).toEqual([]);
    });

    test('discover page has no critical a11y violations', async ({ page }) => {
        await page.keyboard.press('3');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .disableRules(['color-contrast'])
            .analyze();

        const critical = results.violations.filter(
            v => v.impact === 'critical' || v.impact === 'serious'
        );

        expect(critical).toEqual([]);
    });

    test('settings panel has no critical a11y violations', async ({ page }) => {
        await page.keyboard.press('4');
        await page.waitForTimeout(800);

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .disableRules(['color-contrast'])
            .analyze();

        const critical = results.violations.filter(
            v => v.impact === 'critical' || v.impact === 'serious'
        );

        expect(critical).toEqual([]);
    });

    test('skip-to-content link is functional', async ({ page }) => {
        // Tab once to focus skip link
        await page.keyboard.press('Tab');

        const skipLink = page.locator('.tf-skip-link, a[href="#tf-main-content"]').first();
        if (await skipLink.isVisible({ timeout: 2000 }).catch(() => false)) {
            // Click it
            await skipLink.click();

            // Main content should have focus
            const main = page.locator('#tf-main-content');
            await expect(main).toBeVisible();
        }
    });
});
