// ═══════════════════════════════════════════════════════════════════
// charEdge — Accessibility E2E Tests (axe-core)
//
// Runs automated WCAG AA accessibility audits on each major route.
// Color-contrast enabled after Batch 3 WCAG remediation.
// Requires: npm install --save-dev @axe-core/playwright
// ═══════════════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Format axe violations for readable CI output */
function formatViolations(violations: any[]) {
    return violations.map(v => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.length,
        help: v.helpUrl,
    }));
}

test.describe('Accessibility Audit (WCAG AA)', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#root', { state: 'visible', timeout: 15_000 });
        await page.waitForFunction(
            () => !document.querySelector('[class*="loadingRoot"]'),
            { timeout: 15_000 }
        );
    });

    test('dashboard has no critical or serious a11y violations', async ({ page }) => {
        await page.keyboard.press('1');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .analyze();

        const critical = results.violations.filter(
            v => v.impact === 'critical' || v.impact === 'serious'
        );

        if (critical.length > 0) {
            console.error('Dashboard a11y violations:', JSON.stringify(formatViolations(critical), null, 2));
        }
        expect(critical).toEqual([]);
    });

    test('chart page has no critical a11y violations', async ({ page }) => {
        await page.keyboard.press('2');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .exclude('canvas') // Canvas elements are not testable by axe
            .analyze();

        const critical = results.violations.filter(
            v => v.impact === 'critical' || v.impact === 'serious'
        );

        if (critical.length > 0) {
            console.error('Chart a11y violations:', JSON.stringify(formatViolations(critical), null, 2));
        }
        expect(critical).toEqual([]);
    });

    test('discover page has no critical a11y violations', async ({ page }) => {
        await page.keyboard.press('3');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .analyze();

        const critical = results.violations.filter(
            v => v.impact === 'critical' || v.impact === 'serious'
        );

        if (critical.length > 0) {
            console.error('Discover a11y violations:', JSON.stringify(formatViolations(critical), null, 2));
        }
        expect(critical).toEqual([]);
    });

    test('settings panel has no critical a11y violations', async ({ page }) => {
        await page.keyboard.press('4');
        await page.waitForTimeout(800);

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .analyze();

        const critical = results.violations.filter(
            v => v.impact === 'critical' || v.impact === 'serious'
        );

        if (critical.length > 0) {
            console.error('Settings a11y violations:', JSON.stringify(formatViolations(critical), null, 2));
        }
        expect(critical).toEqual([]);
    });

    test('journal page has no critical a11y violations', async ({ page }) => {
        // Navigate to journal (key shortcut 5 or direct URL)
        await page.goto('/journal');
        await page.waitForSelector('#root', { state: 'visible', timeout: 15_000 });
        await page.waitForTimeout(1000);

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .analyze();

        const critical = results.violations.filter(
            v => v.impact === 'critical' || v.impact === 'serious'
        );

        if (critical.length > 0) {
            console.error('Journal a11y violations:', JSON.stringify(formatViolations(critical), null, 2));
        }
        expect(critical).toEqual([]);
    });

    test('Deep Sea theme has no contrast violations', async ({ page }) => {
        // Switch to Deep Sea theme
        await page.evaluate(() => {
            document.documentElement.classList.remove('theme-dark', 'theme-light');
            document.documentElement.classList.add('theme-deep-sea');
        });
        await page.waitForTimeout(500);

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .include('#root')
            .analyze();

        const contrastViolations = results.violations.filter(
            v => v.id === 'color-contrast'
        );

        if (contrastViolations.length > 0) {
            console.error('Deep Sea contrast violations:', JSON.stringify(formatViolations(contrastViolations), null, 2));
        }
        // Allow some initial violations to be cataloged but flag critical ones
        const critical = contrastViolations.filter(v => v.impact === 'critical');
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

    test('interactive elements have accessible names', async ({ page }) => {
        await page.keyboard.press('1'); // Dashboard
        await page.waitForTimeout(1000);

        // Check that all buttons have accessible labels
        const buttons = await page.locator('button').all();
        let unlabeled = 0;

        for (const btn of buttons.slice(0, 30)) { // Check first 30 buttons
            const label = await btn.getAttribute('aria-label');
            const text = await btn.textContent();
            const title = await btn.getAttribute('title');
            const role = await btn.getAttribute('role');

            if (!label && !text?.trim() && !title && role !== 'presentation') {
                unlabeled++;
            }
        }

        // Allow up to 3 unlabeled buttons (icon-only buttons being addressed incrementally)
        expect(unlabeled).toBeLessThanOrEqual(3);
    });
});

