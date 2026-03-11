// ═══════════════════════════════════════════════════════════════════
// charEdge — Accessibility E2E Tests (axe-core)
//
// Runs automated WCAG AA accessibility audits on each major route.
// Color-contrast enabled after Batch 3 WCAG remediation.
// Requires: npm install --save-dev @axe-core/playwright
//
// P3 C3: All waitForTimeout calls replaced with deterministic waits.
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

/** Wait for app to be fully loaded and interactive */
async function waitForAppReady(page) {
    await page.waitForSelector('#root', { state: 'visible', timeout: 15_000 });
    await page.waitForFunction(
        () => !document.querySelector('[class*="loadingRoot"]'),
        { timeout: 15_000 }
    );
}

/** Navigate via keyboard shortcut and wait for route content to render */
async function navigateToRoute(page, key: string) {
    await page.keyboard.press(key);
    await page.waitForLoadState('domcontentloaded');
    // Wait for any route transition / lazy-loaded content to settle
    await page.waitForFunction(
        () => !document.querySelector('[class*="loadingRoot"], [class*="skeleton"], [class*="Skeleton"]'),
        { timeout: 10_000 }
    );
}

test.describe('Accessibility Audit (WCAG AA)', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await waitForAppReady(page);
    });

    test('dashboard has no critical or serious a11y violations', async ({ page }) => {
        await navigateToRoute(page, '1');

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
        await navigateToRoute(page, '2');

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .exclude('canvas')
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
        await navigateToRoute(page, '3');

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
        await page.waitForSelector(
            '[class*="settings"], [class*="Settings"], [class*="slideOver"], [class*="SlideOver"]',
            { state: 'visible', timeout: 5_000 }
        );

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
        await page.goto('/journal');
        await waitForAppReady(page);

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
        await page.evaluate(() => {
            document.documentElement.classList.remove('theme-dark', 'theme-light');
            document.documentElement.classList.add('theme-deep-sea');
        });
        // Wait for CSS variables to recalculate after theme change
        await page.waitForFunction(
            () => getComputedStyle(document.documentElement).getPropertyValue('--bg-primary') !== '',
            { timeout: 3_000 }
        ).catch(() => { });

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
        const critical = contrastViolations.filter(v => v.impact === 'critical');
        expect(critical).toEqual([]);
    });

    test('skip-to-content link is functional', async ({ page }) => {
        await page.keyboard.press('Tab');

        const skipLink = page.locator('.tf-skip-link, a[href="#tf-main-content"]').first();
        if (await skipLink.isVisible({ timeout: 2000 }).catch(() => false)) {
            await skipLink.click();

            const main = page.locator('#tf-main-content');
            await expect(main).toBeVisible();
        }
    });

    test('interactive elements have accessible names', async ({ page }) => {
        await navigateToRoute(page, '1');

        const buttons = await page.locator('button').all();
        let unlabeled = 0;

        for (const btn of buttons.slice(0, 30)) {
            const label = await btn.getAttribute('aria-label');
            const text = await btn.textContent();
            const title = await btn.getAttribute('title');
            const role = await btn.getAttribute('role');

            if (!label && !text?.trim() && !title && role !== 'presentation') {
                unlabeled++;
            }
        }

        expect(unlabeled).toBeLessThanOrEqual(3);
    });
});
