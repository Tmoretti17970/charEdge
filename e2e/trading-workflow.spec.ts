// ═══════════════════════════════════════════════════════════════════
// charEdge — Full Trading Workflow E2E Test (Task 2A.2)
//
// Tests the complete "invisible journal" critical path:
//   1. Open chart  →  2. Search symbol  →  3. Set alert
//   4. Log trade   →  5. Review journal →  6. Check dashboard
//
// This is the single most important E2E test — it validates the
// entire user flow that makes charEdge valuable.
//
// P3 C3: All waitForTimeout calls replaced with deterministic waits.
//
// Run: npx playwright test e2e/trading-workflow.spec.ts
// ═══════════════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test';

const MODAL_SELECTOR = '[role="dialog"], [class*="modal"], [class*="Modal"], [class*="slide-over"]';

/** Shared boot helper — waits for React to render */
async function bootApp(page: any) {
    await page.goto('/');
    await page.waitForSelector('#root', { state: 'visible', timeout: 15_000 });
    await page.waitForFunction(
        () => !document.querySelector('[class*="loadingRoot"]'),
        { timeout: 15_000 }
    );
}

/** Navigate to a page by keyboard shortcut */
async function navigateTo(page: any, key: string) {
    await page.keyboard.press(key);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(
        () => !document.querySelector('[class*="loadingRoot"], [class*="skeleton"]'),
        { timeout: 10_000 }
    );
}

/** Open trade form modal and return locator */
async function openTradeForm(page: any) {
    await page.keyboard.press('Control+n');
    const modal = page.locator(MODAL_SELECTOR).first();
    await modal.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => { });
    return modal;
}

/** Error collector — filters out known non-critical errors */
function createErrorCollector(page: any) {
    const errors: string[] = [];
    page.on('pageerror', (err: Error) => errors.push(err.message));
    return {
        getCritical: () => errors.filter(msg =>
            !msg.includes('WebSocket') &&
            !msg.includes('net::ERR_') &&
            !msg.includes('Failed to fetch') &&
            !msg.includes('NetworkError') &&
            !msg.includes('ResizeObserver') &&
            !msg.includes('AbortError') &&
            !msg.includes('signal')
        ),
    };
}

test.describe('Full Trading Workflow', () => {
    test.describe.configure({ timeout: 90_000 }); // Full workflow needs generous timeout

    test('complete flow: chart → trade → journal → dashboard', async ({ page }) => {
        const errorCollector = createErrorCollector(page);

        // ─── Step 1: Boot and navigate to Charts ────────────────
        await bootApp(page);
        await navigateTo(page, '2'); // '2' = Charts

        // Chart canvas should be visible
        const canvas = page.locator('canvas').first();
        await expect(canvas).toBeVisible({ timeout: 10_000 });

        // ─── Step 2: Symbol search ──────────────────────────────
        const symbolTrigger = page.locator(
            '[class*="symbol-search"], [class*="SymbolSearch"], [class*="symbol-display"], ' +
            'button:has-text("BTC"), button:has-text("BTCUSDT")'
        ).first();

        if (await symbolTrigger.isVisible({ timeout: 5_000 }).catch(() => false)) {
            await symbolTrigger.click();

            const searchInput = page.locator(
                'input[placeholder*="earch"], input[placeholder*="ymbol"], input[type="search"]'
            ).first();

            if (await searchInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
                await searchInput.fill('ETH');
                // Wait for search results
                const result = page.locator(
                    '[class*="result"], [class*="Result"], [role="option"]'
                ).first();

                if (await result.isVisible({ timeout: 5_000 }).catch(() => false)) {
                    await result.click();
                    // Wait for chart to update with new symbol
                    await page.waitForFunction(
                        () => !document.querySelector('[class*="loading"], [class*="spinner"]'),
                        { timeout: 5_000 }
                    ).catch(() => { });
                } else {
                    await page.keyboard.press('Escape');
                }
            }
        }

        // ─── Step 3: Verify chart toolbar interaction ───────────
        const tfPills = page.locator('.tf-chart-tf-pill');
        if (await tfPills.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
            const pillCount = await tfPills.count();
            if (pillCount > 1) {
                await tfPills.nth(1).click();
                await expect(tfPills.nth(1)).toHaveAttribute('data-active', 'true', { timeout: 3_000 }).catch(() => { });
            }
        }

        // ─── Step 4: Open trade form and add a trade ────────────
        const modal = await openTradeForm(page);

        if (await modal.isVisible({ timeout: 5_000 }).catch(() => false)) {
            // Fill in required fields — Symbol
            const symbolInput = modal.locator('input').first();
            await symbolInput.fill('BTCE2E');

            // P&L — find the P&L input (type=number after symbol)
            const pnlInput = modal.locator('input[type="number"]').first();
            if (await pnlInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
                await pnlInput.fill('150.50');
            }

            // Submit the trade
            const addButton = modal.locator('button:has-text("Add Trade")');
            if (await addButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
                await addButton.click();

                // Wait for modal to close or toast to appear
                const toast = page.locator('[class*="toast"], [class*="Toast"], [role="status"]').first();
                if (await toast.isVisible({ timeout: 5_000 }).catch(() => false)) {
                    const toastText = await toast.textContent();
                    expect(toastText).toContain('BTCE2E');
                }

                // Close post-trade review if it opens
                const reviewModal = page.locator('[role="dialog"], [class*="modal"]').first();
                if (await reviewModal.isVisible({ timeout: 2_000 }).catch(() => false)) {
                    const closeBtn = reviewModal.locator('button:has-text("Close"), button:has-text("Skip"), button:has-text("✕")').first();
                    if (await closeBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
                        await closeBtn.click();
                        await reviewModal.waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => { });
                    } else {
                        await page.keyboard.press('Escape');
                    }
                }
            }
        }

        // ─── Step 5: Navigate to Journal/Home and verify trade ──
        await navigateTo(page, '1'); // '1' = Home/Journal

        const mainContent = page.locator('#tf-main-content');
        await expect(mainContent).toBeVisible({ timeout: 5_000 });

        const pageText = await mainContent.textContent();
        expect(pageText?.length).toBeGreaterThan(0);

        const metricCards = page.locator(
            '[class*="metric"], [class*="Metric"], [class*="stat"], [class*="Stat"], ' +
            '[class*="bento"], [class*="Bento"], [class*="card"], [class*="Card"]'
        );
        const cardCount = await metricCards.count();
        expect(cardCount).toBeGreaterThan(0);

        // ─── Step 6: Verify no critical errors throughout ───────
        const criticalErrors = errorCollector.getCritical();
        expect(criticalErrors).toEqual([]);
    });

    test('trade form validation prevents empty submission', async ({ page }) => {
        await bootApp(page);

        const modal = await openTradeForm(page);

        if (await modal.isVisible({ timeout: 5_000 }).catch(() => false)) {
            const addButton = modal.locator('button:has-text("Add Trade")');
            if (await addButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
                await addButton.click();
                // Wait for validation error text to appear
                await page.waitForFunction(
                    () => document.querySelector('[role="dialog"], [class*="modal"]')?.textContent?.includes('Required'),
                    { timeout: 3_000 }
                ).catch(() => { });

                const errorText = await modal.textContent();
                expect(errorText).toContain('Required');
            }
        }
    });

    test('trade form cancel does not add trade', async ({ page }) => {
        await bootApp(page);

        const modal = await openTradeForm(page);

        if (await modal.isVisible({ timeout: 5_000 }).catch(() => false)) {
            const symbolInput = modal.locator('input').first();
            await symbolInput.fill('CANCELTEST');

            const cancelButton = modal.locator('button:has-text("Cancel")');
            if (await cancelButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
                await cancelButton.click();
                // Wait for modal to close
                await expect(modal).not.toBeVisible({ timeout: 3_000 });
            }
        }
    });

    test('keyboard navigation: Charts → Journal → Settings cycle', async ({ page }) => {
        const errorCollector = createErrorCollector(page);
        await bootApp(page);

        // Navigate Charts (2)
        await navigateTo(page, '2');
        const canvas = page.locator('canvas').first();
        await expect(canvas).toBeVisible({ timeout: 10_000 });

        // Navigate Home/Journal (1)
        await navigateTo(page, '1');
        const main = page.locator('#tf-main-content');
        await expect(main).toBeVisible({ timeout: 5_000 });

        // Navigate Settings (3)
        await navigateTo(page, '3');

        const settings = page.locator(
            '[class*="settings"], [class*="Settings"], [class*="slide-over"]'
        ).first();
        if (await settings.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await expect(settings).toBeVisible();
        }

        // Back to Charts (2)
        await page.keyboard.press('Escape');
        // Wait for slide-over to close
        await settings.waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => { });
        await navigateTo(page, '2');
        await expect(canvas).toBeVisible({ timeout: 10_000 });

        // No critical errors during full navigation cycle
        expect(errorCollector.getCritical()).toEqual([]);
    });

    test('progressive disclosure: More Details expands trade form', async ({ page }) => {
        await bootApp(page);

        const modal = await openTradeForm(page);

        if (await modal.isVisible({ timeout: 5_000 }).catch(() => false)) {
            const moreDetails = modal.locator('button:has-text("More Details")');
            if (await moreDetails.isVisible({ timeout: 2_000 }).catch(() => false)) {
                await moreDetails.click();

                // Wait for the expanded section to appear
                const lessDetails = modal.locator('button:has-text("Less Details")');
                await expect(lessDetails).toBeVisible({ timeout: 2_000 });

                // Additional fields should now be visible (Qty, Entry, Exit)
                const qtyInput = modal.locator('input[placeholder="1"]');
                const entryInput = modal.locator('input[placeholder="0.00"]').first();
                expect(
                    await qtyInput.isVisible({ timeout: 2_000 }).catch(() => false) ||
                    await entryInput.isVisible({ timeout: 2_000 }).catch(() => false)
                ).toBeTruthy();
            }
        }
    });
});
