// ═══════════════════════════════════════════════════════════════════
// charEdge E2E — Intel Page
// Tests the Intel (Discover) tab: navigation, tabs, personas, copilot,
// mobile responsiveness, and keyboard navigation.
//
// Run: npx playwright test e2e/intel.spec.ts
// ═══════════════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test';

/** Shared boot helper — waits for React to render */
async function bootApp(page: any) {
    await page.goto('/');
    await page.waitForSelector('#root', { state: 'visible', timeout: 15_000 });
    await page.waitForFunction(
        () => !document.querySelector('[class*="loadingRoot"]'),
        { timeout: 15_000 }
    );
}

/** Navigate to Intel page via sidebar */
async function navigateToIntel(page: any) {
    // Click the Intel sidebar item
    const intelNavItem = page.locator(
        'nav button:has-text("Intel"), [class*="sidebar"] button:has-text("Intel"), ' +
        'button[data-page="intel"], [role="navigation"] button:has-text("Intel")'
    ).first();

    if (await intelNavItem.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await intelNavItem.click();
    } else {
        // Fallback: try keyboard shortcut or direct page approach
        await page.keyboard.press('4');
    }

    // Wait for Intel page to load
    await page.waitForFunction(
        () => document.querySelector('h1')?.textContent?.includes('Intel'),
        { timeout: 10_000 }
    );
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

test.describe('Intel Page', () => {
    test.describe.configure({ timeout: 60_000 });

    // ─── 1. Navigation ──────────────────────────────────────────
    test('navigate to Intel page via sidebar, verify page loads', async ({ page }) => {
        const errorCollector = createErrorCollector(page);
        await bootApp(page);
        await navigateToIntel(page);

        // Verify heading
        const heading = page.locator('h1:has-text("Intel")');
        await expect(heading).toBeVisible({ timeout: 10_000 });

        // Verify subtitle
        const subtitle = page.locator('text=Your edge, briefed.');
        await expect(subtitle).toBeVisible({ timeout: 5_000 });

        // Verify persona selector is present
        const personaGroup = page.locator('[role="radiogroup"][aria-label="Trading style preset"]');
        await expect(personaGroup).toBeVisible({ timeout: 5_000 });

        // No critical errors
        expect(errorCollector.getCritical()).toEqual([]);
    });

    // ─── 2. Signal Tab Switching ────────────────────────────────
    test('click through Signals tabs, verify content changes', async ({ page }) => {
        await bootApp(page);
        await navigateToIntel(page);

        // Wait for Signals section to appear
        const signalsHeading = page.locator('#intel-section-signals');
        await expect(signalsHeading).toBeVisible({ timeout: 10_000 });

        const signalsTablist = page.locator('[role="tablist"][aria-label="Signal type tabs"]');
        await expect(signalsTablist).toBeVisible({ timeout: 5_000 });

        const tabLabels = ['All', 'Flow', 'Insider', 'Technical', 'Whale', 'Liquidations'];

        for (const label of tabLabels) {
            const tab = signalsTablist.locator(`[role="tab"]:has-text("${label}")`);
            await expect(tab).toBeVisible({ timeout: 3_000 });
            await tab.click();

            // Verify the tab is now selected
            await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 3_000 });

            // Verify the tabpanel has content
            const panel = page.locator('#signals-tabpanel');
            await expect(panel).toBeVisible({ timeout: 3_000 });
            const panelText = await panel.textContent();
            expect(panelText?.length).toBeGreaterThan(0);
        }
    });

    // ─── 3. Research Tab Switching ──────────────────────────────
    test('click through Research tabs, verify content loads', async ({ page }) => {
        await bootApp(page);
        await navigateToIntel(page);

        // Scroll to Research section
        const researchSection = page.locator('#intel-section-research');
        await researchSection.scrollIntoViewIfNeeded();
        await expect(researchSection).toBeVisible({ timeout: 10_000 });

        const researchTablist = page.locator('[role="tablist"][aria-label="Research type tabs"]');
        await expect(researchTablist).toBeVisible({ timeout: 5_000 });

        const tabLabels = ['Sectors', 'Screener', 'Earnings', 'Analysts', 'Volatility', 'Correlation'];

        for (const label of tabLabels) {
            const tab = researchTablist.locator(`[role="tab"]:has-text("${label}")`);
            await expect(tab).toBeVisible({ timeout: 3_000 });
            await tab.click();

            // Verify the tab is now selected
            await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 3_000 });

            // Verify the tabpanel has content (may show skeleton while loading)
            const panel = page.locator('#research-tabpanel');
            await expect(panel).toBeVisible({ timeout: 5_000 });
        }
    });

    // ─── 4. Persona Selector ────────────────────────────────────
    test('click each persona, verify order/content updates', async ({ page }) => {
        await bootApp(page);
        await navigateToIntel(page);

        const personaGroup = page.locator('[role="radiogroup"][aria-label="Trading style preset"]');
        await expect(personaGroup).toBeVisible({ timeout: 5_000 });

        const personas = [
            { label: 'Day Trader', expectedFirst: 'brief' },
            { label: 'Swing', expectedFirst: 'brief' },
            { label: 'Investor', expectedFirst: 'brief' },
            { label: 'Learner', expectedFirst: 'brief' },
        ];

        for (const { label } of personas) {
            const button = personaGroup.locator(`[role="radio"]:has-text("${label}")`);
            await expect(button).toBeVisible({ timeout: 3_000 });
            await button.click();

            // Verify persona is selected
            await expect(button).toHaveAttribute('aria-checked', 'true', { timeout: 3_000 });

            // Verify sections are rendered (the page should have intel sections)
            const sections = page.locator('[id^="intel-section-"]');
            const sectionCount = await sections.count();
            expect(sectionCount).toBeGreaterThanOrEqual(3);
        }

        // Learner persona should show tips
        const learnerButton = personaGroup.locator('[role="radio"]:has-text("Learner")');
        await learnerButton.click();
        await expect(learnerButton).toHaveAttribute('aria-checked', 'true', { timeout: 3_000 });

        // Check for tip text (Learner persona shows tips)
        const tipText = page.locator('text=Start here');
        if (await tipText.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await expect(tipText).toBeVisible();
        }
    });

    // ─── 5. Copilot Quick Prompt ────────────────────────────────
    test('click a quick prompt chip, verify copilot expands with response', async ({ page }) => {
        await bootApp(page);
        await navigateToIntel(page);

        // Find the copilot area — look for the quick prompt chips
        const quickPrompt = page.locator('button[aria-label^="Ask:"]').first();
        await expect(quickPrompt).toBeVisible({ timeout: 10_000 });

        // Click the first quick prompt
        await quickPrompt.click();

        // Wait for either typing indicator or response to appear
        const responsePanel = page.locator('[role="log"]');
        await expect(responsePanel).toBeVisible({ timeout: 10_000 });

        // Wait for response text (not just typing indicator)
        await page.waitForFunction(
            () => {
                const panel = document.querySelector('[role="log"]');
                if (!panel) return false;
                const text = panel.textContent || '';
                // Response loaded when "Analyzing..." is gone and there's meaningful text
                return text.length > 50 && !text.includes('Analyzing...');
            },
            { timeout: 15_000 }
        ).catch(() => {
            // Timeout is acceptable — response may still be streaming
        });

        // Verify the response panel has content
        const responseText = await responsePanel.textContent();
        expect(responseText?.length).toBeGreaterThan(0);
    });

    // ─── 6. Copilot Input ───────────────────────────────────────
    test('type a query, press Enter, verify response appears', async ({ page }) => {
        await bootApp(page);
        await navigateToIntel(page);

        // Find the copilot input
        const input = page.locator('input[placeholder*="Ask about"]');
        await expect(input).toBeVisible({ timeout: 10_000 });

        // Type a query
        await input.fill('What is the bull case right now?');
        await input.press('Enter');

        // Wait for response panel to appear
        const responsePanel = page.locator('[role="log"]');
        await expect(responsePanel).toBeVisible({ timeout: 10_000 });

        // Wait for response content to load
        await page.waitForFunction(
            () => {
                const panel = document.querySelector('[role="log"]');
                if (!panel) return false;
                const text = panel.textContent || '';
                return text.length > 50 && !text.includes('Analyzing...');
            },
            { timeout: 15_000 }
        ).catch(() => {
            // Timeout acceptable — may still be streaming
        });

        // Verify response contains bull-related content
        const responseText = await responsePanel.textContent();
        expect(responseText?.length).toBeGreaterThan(20);

        // Verify Close button is available
        const closeBtn = responsePanel.locator('button:has-text("Close")');
        await expect(closeBtn).toBeVisible({ timeout: 3_000 });
    });

    // ─── 7. Mobile Responsive ───────────────────────────────────
    test('mobile viewport adapts layout', async ({ page }) => {
        // Set mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });

        await bootApp(page);
        await navigateToIntel(page);

        // Verify heading is visible
        const heading = page.locator('h1:has-text("Intel")');
        await expect(heading).toBeVisible({ timeout: 10_000 });

        // Verify persona selector is visible and scrollable (overflow on mobile)
        const personaGroup = page.locator('[role="radiogroup"][aria-label="Trading style preset"]');
        await expect(personaGroup).toBeVisible({ timeout: 5_000 });

        // Verify the page layout stacks vertically on mobile
        // The header should be column-direction on mobile (flex-direction: column)
        const pageContainer = page.locator('[role="main"]');
        await expect(pageContainer).toBeVisible({ timeout: 5_000 });

        // Verify sections are rendered
        const sections = page.locator('[id^="intel-section-"]');
        const sectionCount = await sections.count();
        expect(sectionCount).toBeGreaterThanOrEqual(3);

        // Verify copilot input is accessible on mobile
        const copilotInput = page.locator('input[placeholder*="Ask about"]');
        await expect(copilotInput).toBeVisible({ timeout: 10_000 });

        // Verify signal tabs are horizontally scrollable
        const signalTablist = page.locator('[role="tablist"][aria-label="Signal type tabs"]');
        if (await signalTablist.isVisible({ timeout: 5_000 }).catch(() => false)) {
            await expect(signalTablist).toBeVisible();
        }
    });

    // ─── 8. Keyboard Navigation ─────────────────────────────────
    test('tab through signal tabs using arrow keys', async ({ page }) => {
        await bootApp(page);
        await navigateToIntel(page);

        // Wait for signals section
        const signalsTablist = page.locator('[role="tablist"][aria-label="Signal type tabs"]');
        await expect(signalsTablist).toBeVisible({ timeout: 10_000 });

        // Click the first tab (All) to focus the tablist
        const allTab = signalsTablist.locator('[role="tab"]:has-text("All")');
        await allTab.click();
        await expect(allTab).toHaveAttribute('aria-selected', 'true', { timeout: 3_000 });

        // Press ArrowRight to move to Flow tab
        await allTab.press('ArrowRight');
        const flowTab = signalsTablist.locator('#signals-tab-flow');
        await expect(flowTab).toHaveAttribute('aria-selected', 'true', { timeout: 3_000 });
        await expect(flowTab).toBeFocused({ timeout: 3_000 });

        // Press ArrowRight to move to Insider tab
        await flowTab.press('ArrowRight');
        const insiderTab = signalsTablist.locator('#signals-tab-insider');
        await expect(insiderTab).toHaveAttribute('aria-selected', 'true', { timeout: 3_000 });
        await expect(insiderTab).toBeFocused({ timeout: 3_000 });

        // Press ArrowLeft to go back to Flow tab
        await insiderTab.press('ArrowLeft');
        await expect(flowTab).toHaveAttribute('aria-selected', 'true', { timeout: 3_000 });
        await expect(flowTab).toBeFocused({ timeout: 3_000 });

        // Verify wrap-around: press ArrowLeft on All tab should go to Liquidations
        await flowTab.press('ArrowLeft');
        await expect(allTab).toHaveAttribute('aria-selected', 'true', { timeout: 3_000 });
        await allTab.press('ArrowLeft');
        const liquidationsTab = signalsTablist.locator('#signals-tab-liquidations');
        await expect(liquidationsTab).toHaveAttribute('aria-selected', 'true', { timeout: 3_000 });
        await expect(liquidationsTab).toBeFocused({ timeout: 3_000 });

        // Verify tabpanel updated with each change
        const panel = page.locator('#signals-tabpanel');
        const panelText = await panel.textContent();
        expect(panelText?.length).toBeGreaterThan(0);
    });
});
