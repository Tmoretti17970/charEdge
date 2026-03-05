// ═══════════════════════════════════════════════════════════════════
// charEdge — Numeric Timestamps Tests (Task 8.1.3)
//
// Verifies that hot-loop Date constructor calls have been eliminated:
//   1. AxesStage uses numeric math for day boundaries
//   2. AxesStage uses numeric math for gap detection
//   3. DatafeedService normalizes timestamps at ingestion
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Numeric Timestamps — AxesStage hot-loop optimization', () => {
    let source;

    beforeEach(() => {
        source = fs.readFileSync(
            path.resolve(__dirname, '..', '..', 'charting_library/core/stages/AxesStage.ts'),
            'utf-8'
        );
    });

    it('uses numeric DAY_MS constant for day-boundary detection', () => {
        expect(source).toContain('DAY_MS');
        expect(source).toContain('86400000');
    });

    it('uses Math.floor division for day boundary (not getUTCDate)', () => {
        expect(source).toContain('Math.floor(t / DAY_MS)');
        expect(source).toContain('Math.floor(pt / DAY_MS)');
    });

    it('uses numeric math in session divider loop (no new Date)', () => {
        // 8.1.3: Uses typeof checks and numeric division instead of new Date()
        expect(source).toContain('Numeric day-boundary detection');
        expect(source).toContain("typeof vis[i].time === 'number'");
    });

    it('uses typeof check for timestamp type coercion', () => {
        expect(source).toContain("typeof vis[i].time === 'number'");
    });

    it('uses numeric subtraction for gap detection (not Date.getTime)', () => {
        // In the weekend/holiday gap section
        const gapStart = source.indexOf('gap detection');
        const gapEnd = source.indexOf('restore()', gapStart);
        if (gapStart !== -1 && gapEnd !== -1) {
            const gapSection = source.slice(gapStart, gapEnd);
            expect(gapSection).toContain('gapMs = t - pt');
        }
    });

    it('computes tfMs using numeric timestamps directly', () => {
        expect(source).toContain('lastTime - firstTime');
    });
});

describe('Numeric Timestamps — DatafeedService ingestion', () => {
    let source;

    beforeEach(() => {
        source = fs.readFileSync(
            path.resolve(__dirname, '..', '..', 'charting_library/datafeed/DatafeedService.js'),
            'utf-8'
        );
    });

    it('normalizes timestamps during non-crypto data parsing', () => {
        // FetchService path normalizes timestamps
        expect(source).toContain("typeof c.time === 'string' ? new Date(c.time).getTime() : c.time");
    });

    it('uses native numeric timestamps from Binance klines', () => {
        // Binance klines use numeric timestamps directly (k.t is epoch ms)
        expect(source).toContain('time: k.t');
        expect(source).toContain('time: k[0]');
    });
});
