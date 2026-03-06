// ═══════════════════════════════════════════════════════════════════
// charEdge — Performance Budget E2E Tests (Tasks 2.2.6, 2.2.7)
//
// Checks bundle size thresholds, LCP, CLS, and resource counts.
// Fails CI builds that exceed defined performance budgets.
//
// Run: npx playwright test e2e/performance-budget.spec.ts
// ═══════════════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test';

test.describe('Performance Budget', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#root', { state: 'visible', timeout: 15_000 });
        await page.waitForFunction(
            () => !document.querySelector('[class*="loadingRoot"]'),
            { timeout: 15_000 }
        );
    });

    test('total JS bundle < 500KB transferred', async ({ page }) => {
        // Collect all JS resource sizes
        const jsSizes = await page.evaluate(() => {
            const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
            return entries
                .filter(e => e.name.endsWith('.js') || e.name.includes('.js?'))
                .map(e => ({
                    name: e.name.split('/').pop(),
                    transferSize: e.transferSize,
                    decodedSize: e.decodedBodySize,
                }));
        });

        const totalTransferred = jsSizes.reduce((sum, r) => sum + r.transferSize, 0);
        const totalKB = totalTransferred / 1024;

        console.log(`[JS Bundle] Total: ${totalKB.toFixed(0)}KB transferred`);
        jsSizes
            .sort((a, b) => b.transferSize - a.transferSize)
            .slice(0, 5)
            .forEach(r => console.log(`  ${r.name}: ${(r.transferSize / 1024).toFixed(0)}KB`));

        // Budget: 500KB gzipped for critical path (Task 2.2.6)
        // Using 500KB as initial target, tightening to 250KB later
        expect(totalKB).toBeLessThan(500);
    });

    test('total CSS bundle < 100KB transferred', async ({ page }) => {
        const cssSizes = await page.evaluate(() => {
            const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
            return entries
                .filter(e => e.name.endsWith('.css') || e.name.includes('.css?'))
                .map(e => ({
                    name: e.name.split('/').pop(),
                    transferSize: e.transferSize,
                }));
        });

        const totalKB = cssSizes.reduce((sum, r) => sum + r.transferSize, 0) / 1024;
        console.log(`[CSS Bundle] Total: ${totalKB.toFixed(0)}KB transferred`);

        expect(totalKB).toBeLessThan(100);
    });

    test('LCP < 2500ms (Task 2.2.7)', async ({ page }) => {
        // Wait for page to fully render
        await page.waitForTimeout(3000);

        const lcp = await page.evaluate(() => {
            return new Promise<number>((resolve) => {
                const observer = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    resolve(lastEntry.startTime);
                    observer.disconnect();
                });

                // Check if LCP entries already exist
                const existing = performance.getEntriesByType('largest-contentful-paint');
                if (existing.length > 0) {
                    resolve(existing[existing.length - 1].startTime);
                    return;
                }

                observer.observe({ type: 'largest-contentful-paint', buffered: true });

                // Timeout fallback
                setTimeout(() => {
                    observer.disconnect();
                    resolve(5000); // If no LCP entry, fail with high value
                }, 5000);
            });
        });

        console.log(`[LCP] ${lcp.toFixed(0)}ms`);

        // Web Vitals: LCP should be < 2500ms for "good" rating
        // Task 2.2.7: block PRs that regress LCP > 2500ms
        expect(lcp).toBeLessThan(2500);
    });

    test('CLS < 0.1 (Task 2.2.7)', async ({ page }) => {
        // Navigate through the app to trigger potential layout shifts
        await page.waitForTimeout(2000);

        const cls = await page.evaluate(() => {
            return new Promise<number>((resolve) => {
                let clsValue = 0;
                const observer = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (!(entry as any).hadRecentInput) {
                            clsValue += (entry as any).value;
                        }
                    }
                });

                // Check existing entries
                try {
                    observer.observe({ type: 'layout-shift', buffered: true });
                } catch {
                    // layout-shift may not be supported
                    resolve(0);
                    return;
                }

                setTimeout(() => {
                    observer.disconnect();
                    resolve(clsValue);
                }, 3000);
            });
        });

        console.log(`[CLS] ${cls.toFixed(4)}`);

        // Web Vitals: CLS should be < 0.1 for "good" rating
        // Task 2.2.7: block PRs that regress CLS > 0.05
        expect(cls).toBeLessThan(0.1);
    });

    test('no more than 50 JS resources loaded', async ({ page }) => {
        await page.waitForTimeout(2000);

        const resourceCount = await page.evaluate(() => {
            const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
            return entries.filter(e => e.name.endsWith('.js') || e.name.includes('.js?')).length;
        });

        console.log(`[Resources] JS files loaded: ${resourceCount}`);

        // Too many JS files indicates poor code-splitting or missing bundling
        expect(resourceCount).toBeLessThan(50);
    });

    test('DOM node count < 3000', async ({ page }) => {
        await page.waitForTimeout(2000);

        const nodeCount = await page.evaluate(() => {
            return document.querySelectorAll('*').length;
        });

        console.log(`[DOM] Node count: ${nodeCount}`);

        // Excessive DOM nodes cause layout and render performance issues
        expect(nodeCount).toBeLessThan(3000);
    });
});
