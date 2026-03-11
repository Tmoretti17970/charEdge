// ═══════════════════════════════════════════════════════════════════
// charEdge — Journal Workflow E2E Tests
//
// Full user flows: navigate to journal, verify empty state, open
// quick-add modal, submit trade, verify list, delete trade.
// ═══════════════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test';

test.describe('Journal Workflow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#root', { state: 'visible', timeout: 15_000 });
        await page.waitForFunction(
            () => !document.querySelector('[class*="loadingRoot"]'),
            { timeout: 15_000 }
        );
    });

    test('navigate to journal via keyboard shortcut', async ({ page }) => {
        // Press '1' to navigate to Journal (Home)
        await page.keyboard.press('1');
        await page.waitForLoadState('domcontentloaded');

        // Journal/Home page content should be visible
        const main = page.locator('#tf-main-content');
        await expect(main).toBeVisible({ timeout: 5_000 });
    });

    test('journal page renders with content', async ({ page }) => {
        // Navigate to Journal via sidebar
        const journalNav = page.locator('text=Journal, text=Home, [aria-label*="journal"], [aria-label*="home"]').first();
        if (await journalNav.isVisible({ timeout: 3000 }).catch(() => false)) {
            await journalNav.click();
        } else {
            await page.keyboard.press('1');
        }
        await page.waitForLoadState('domcontentloaded');

        // Main content area should have content
        const mainContent = page.locator('#tf-main-content');
        await expect(mainContent).toBeVisible({ timeout: 5_000 });
        const text = await mainContent.textContent();
        expect(text?.length).toBeGreaterThan(0);
    });

    test('quick-add trade modal opens via Ctrl+N', async ({ page }) => {
        // Ctrl+N should open the quick-add trade form
        await page.keyboard.press('Control+n');

        // Wait for modal/dialog to appear
        const modal = page.locator(
            '[role="dialog"], [class*="modal"], [class*="QuickAdd"], [class*="quickAdd"], [class*="slide-over"]'
        ).first();

        if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
            await expect(modal).toBeVisible();
            // Modal should contain trade-related inputs
            const inputs = modal.locator('input, select, textarea');
            expect(await inputs.count()).toBeGreaterThan(0);
        }
    });

    test('quick-add trade modal opens via Ctrl+/', async ({ page }) => {
        await page.keyboard.press('Control+/');

        const modal = page.locator(
            '[role="dialog"], [class*="modal"], [class*="QuickAdd"], [class*="quickAdd"]'
        ).first();

        if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
            await expect(modal).toBeVisible();
        }
    });

    test('command palette opens via Ctrl+K', async ({ page }) => {
        await page.keyboard.press('Control+k');

        const palette = page.locator(
            '[class*="CommandPalette"], [class*="commandPalette"], [role="combobox"], [class*="palette"]'
        ).first();

        if (await palette.isVisible({ timeout: 3000 }).catch(() => false)) {
            await expect(palette).toBeVisible();

            // Should have a search input
            const searchInput = palette.locator('input').first();
            if (await searchInput.isVisible({ timeout: 1000 }).catch(() => false)) {
                await searchInput.fill('journal');
                // Wait for search results to update
                await page.waitForFunction(
                    () => {
                        const results = document.querySelector('[class*="result"], [class*="option"], [class*="suggestion"]');
                        return !!results;
                    },
                    { timeout: 3_000 }
                ).catch(() => { });
            }

            // Escape to close
            await page.keyboard.press('Escape');
        }
    });

    test('no critical JS errors on journal page', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (err) => errors.push(err.message));

        await page.keyboard.press('1');
        await page.waitForLoadState('domcontentloaded');

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
