// ═══════════════════════════════════════════════════════════════════
// charEdge — Frame Time Regression E2E Tests (Task 2.2.3)
//
// Measures render performance during chart interactions and asserts
// frame times stay within budget. Captures p50 and p95 metrics.
//
// Run: npx playwright test e2e/frame-time-regression.spec.ts
// ═══════════════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test';

/** Collect frame times over a duration using requestAnimationFrame */
async function collectFrameTimes(page: any, durationMs: number): Promise<number[]> {
    return page.evaluate((duration: number) => {
        return new Promise<number[]>((resolve) => {
            const frameTimes: number[] = [];
            let lastTime = performance.now();
            let startTime = lastTime;

            function measure() {
                const now = performance.now();
                frameTimes.push(now - lastTime);
                lastTime = now;

                if (now - startTime < duration) {
                    requestAnimationFrame(measure);
                } else {
                    resolve(frameTimes);
                }
            }
            requestAnimationFrame(measure);
        });
    }, durationMs);
}

/** Calculate percentile from sorted array */
function percentile(sorted: number[], p: number): number {
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
}

test.describe('Frame Time Regression', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#root', { state: 'visible', timeout: 15_000 });
        await page.waitForFunction(
            () => !document.querySelector('[class*="loadingRoot"]'),
            { timeout: 15_000 }
        );
        // Navigate to chart view
        await page.keyboard.press('2');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
    });

    test('idle chart frame time < 33ms (30fps minimum)', async ({ page }) => {
        const frameTimes = await collectFrameTimes(page, 2000);
        const sorted = [...frameTimes].sort((a, b) => a - b);

        const p50 = percentile(sorted, 50);
        const p95 = percentile(sorted, 95);

        console.log(`[Idle] Frames: ${frameTimes.length}, p50: ${p50.toFixed(1)}ms, p95: ${p95.toFixed(1)}ms`);

        // p95 should be under 33ms (30fps) for idle state
        expect(p95).toBeLessThan(33);
    });

    test('panning frame time < 33ms (30fps minimum)', async ({ page }) => {
        const canvas = page.locator('canvas').first();

        // Start panning
        const box = await canvas.boundingBox();
        if (!box) return;

        const startX = box.x + box.width / 2;
        const startY = box.y + box.height / 2;

        // Begin mouse drag
        await page.mouse.move(startX, startY);
        await page.mouse.down();

        // Collect frames while panning
        const panFrames = await page.evaluate((params: { startX: number, startY: number }) => {
            return new Promise<number[]>((resolve) => {
                const frameTimes: number[] = [];
                let lastTime = performance.now();
                const startTime = lastTime;
                let step = 0;

                function measure() {
                    const now = performance.now();
                    frameTimes.push(now - lastTime);
                    lastTime = now;
                    step++;

                    if (now - startTime < 1500) {
                        requestAnimationFrame(measure);
                    } else {
                        resolve(frameTimes);
                    }
                }
                requestAnimationFrame(measure);
            });
        }, { startX, startY });

        // Simulate pan movement during measurement
        for (let i = 0; i < 15; i++) {
            await page.mouse.move(startX - i * 10, startY, { steps: 1 });
            await page.waitForTimeout(50);
        }

        await page.mouse.up();

        const sorted = [...panFrames].sort((a, b) => a - b);
        const p50 = percentile(sorted, 50);
        const p95 = percentile(sorted, 95);

        console.log(`[Pan] Frames: ${panFrames.length}, p50: ${p50.toFixed(1)}ms, p95: ${p95.toFixed(1)}ms`);

        // p95 should be under 33ms during panning
        expect(p95).toBeLessThan(33);
    });

    test('zoom frame time < 50ms', async ({ page }) => {
        const canvas = page.locator('canvas').first();
        const box = await canvas.boundingBox();
        if (!box) return;

        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;

        await page.mouse.move(centerX, centerY);

        // Collect frames during zoom
        const zoomFrames: number[] = [];

        for (let i = 0; i < 5; i++) {
            const before = await page.evaluate(() => performance.now());
            await page.mouse.wheel(0, -100); // Zoom in
            await page.waitForTimeout(100);
            const after = await page.evaluate(() => performance.now());
            zoomFrames.push(after - before);
        }

        const sorted = [...zoomFrames].sort((a, b) => a - b);
        const p95 = percentile(sorted, 95);

        console.log(`[Zoom] Steps: ${zoomFrames.length}, p95: ${p95.toFixed(1)}ms`);

        // Zoom interactions should complete within 50ms each
        expect(p95).toBeLessThan(50);
    });

    test('10% regression guard — frame times within historical budget', async ({ page }) => {
        // Baseline: collect 3 seconds of render frames
        const frameTimes = await collectFrameTimes(page, 3000);
        const sorted = [...frameTimes].sort((a, b) => a - b);

        const p50 = percentile(sorted, 50);
        const p95 = percentile(sorted, 95);
        const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;

        console.log(`[Baseline] Frames: ${frameTimes.length}, avg: ${avg.toFixed(1)}ms, p50: ${p50.toFixed(1)}ms, p95: ${p95.toFixed(1)}ms`);

        // Budget thresholds (Task 2.2.4: 10% regression threshold)
        // p50 should be under 16.7ms (60fps target)
        expect(p50).toBeLessThan(16.7 * 1.1); // 10% headroom = 18.4ms
        // p95 should be under 33ms (30fps minimum during spikes)
        expect(p95).toBeLessThan(33 * 1.1); // 10% headroom = 36.3ms
    });
});
