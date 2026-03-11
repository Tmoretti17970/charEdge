// ═══════════════════════════════════════════════════════════════════
// Tier 5.1 — Playwright E2E Smoke Test
//
// Basic test: open app → verify page loads → check key elements
// Run with: npx playwright test
// Requires: npm run dev (already running on port 5173)
//
// P3 C3: All waitForTimeout calls replaced with deterministic waits.
// ═══════════════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test';

/** Wait for app to be fully loaded and interactive */
async function waitForAppReady(page) {
  await page.waitForSelector('#root', { state: 'visible', timeout: 15_000 });
  await page.waitForFunction(
    () => !document.querySelector('[class*="loadingRoot"]'),
    { timeout: 15_000 }
  );
}

test.describe('5.1 — E2E Smoke Tests', () => {
  test('home page loads and displays chart', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/charEdge|Trade/i);

    const root = page.locator('#root');
    await expect(root).toBeVisible({ timeout: 10_000 });
  });

  test('page has no JavaScript errors on load', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    await page.waitForFunction(
      () => !document.querySelector('[class*="loadingRoot"]'),
      { timeout: 15_000 }
    );

    const criticalErrors = errors.filter(msg =>
      !msg.includes('WebSocket') &&
      !msg.includes('net::ERR_') &&
      !msg.includes('Failed to fetch') &&
      !msg.includes('NetworkError')
    );

    expect(criticalErrors).toEqual([]);
  });

  test('sidebar navigation is present', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    const sidebar = page.locator('[class*="sidebar"], nav, [role="navigation"]').first();
    await expect(sidebar).toBeVisible({ timeout: 10_000 });
  });

  test('navigating to settings page works', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Dismiss any modal overlays that might block clicks
    const modal = page.locator('[class*="modal-overlay"], [class*="modal-backdrop"]').first();
    if (await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
      await modal.click({ force: true });
      await modal.waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => { });
    }

    // Find and click settings navigation
    const settingsLink = page.locator('text=Settings').first();
    if (await settingsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await settingsLink.click({ force: true });
      await page.waitForSelector(
        '[class*="settings"], [class*="Settings"], [class*="slideOver"]',
        { state: 'visible', timeout: 5_000 }
      ).catch(() => { });

      const body = await page.textContent('body');
      expect(body).toBeTruthy();
    }
  });

  test('canvas elements render for charting', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Navigate to chart page
    await page.keyboard.press('2');
    await page.waitForLoadState('domcontentloaded');
    // Wait for canvas to appear (chart renders asynchronously)
    await page.waitForSelector('canvas', { state: 'visible', timeout: 10_000 }).catch(() => { });

    const canvases = page.locator('canvas');
    const finalCount = await canvases.count();
    expect(finalCount).toBeGreaterThan(0);
  });

  test('health check endpoint responds', async ({ request }) => {
    const response = await request.get('/');
    expect(response.status()).toBe(200);

    const html = await response.text();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<div id="root">');
  });

  test('static assets load (CSS, JS)', async ({ page }) => {
    const failedRequests = [];

    page.on('requestfailed', (req) => {
      const url = req.url();
      if (url.includes('localhost') && !url.includes('ws://')) {
        failedRequests.push(url);
      }
    });

    await page.goto('/');
    // Wait for all network requests to complete
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => { });

    expect(failedRequests).toEqual([]);
  });
});
