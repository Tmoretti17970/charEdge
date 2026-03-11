// ═══════════════════════════════════════════════════════════════════
// charEdge — NiceTicks Tests (Task 8.3.2)
//
// Unit tests for label collision avoidance:
//   1. filterOverlappingLabels (price axis)
//   2. filterOverlappingTimeLabels (time axis)
//   3. Exclusion zones
//   4. Edge cases
// ═══════════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, beforeEach } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Source Verification ────────────────────────────────────────

describe('NiceTicks — source verification', () => {
    let source;

    beforeEach(() => {
        source = fs.readFileSync(
            path.resolve(__dirname, '..', '..', 'charting_library/core/NiceTicks.ts'),
            'utf-8'
        );
    });

    it('exports filterOverlappingLabels function', () => {
        expect(source).toContain('export function filterOverlappingLabels');
    });

    it('exports filterOverlappingTimeLabels function', () => {
        expect(source).toContain('export function filterOverlappingTimeLabels');
    });

    it('exports PriceTickLabel interface', () => {
        expect(source).toContain('export interface PriceTickLabel');
    });

    it('exports TimeTickLabel interface', () => {
        expect(source).toContain('export interface TimeTickLabel');
    });

    it('exports ExclusionZone interface', () => {
        expect(source).toContain('export interface ExclusionZone');
    });

    it('uses greedy algorithm sorted by Y position', () => {
        expect(source).toContain('sort((a, b) => a.y - b.y)');
    });

    it('uses greedy algorithm sorted by X position for time', () => {
        expect(source).toContain('sort((a, b) => a.x - b.x)');
    });

    it('checks exclusion zones for price labels', () => {
        expect(source).toContain('zone.center');
        expect(source).toContain('zone.halfSize');
    });

    it('estimates label width for time labels', () => {
        expect(source).toContain('label.text.length');
    });
});

// ─── AxesStage Integration ──────────────────────────────────────

describe('NiceTicks — AxesStage integration', () => {
    let source;

    beforeEach(() => {
        source = fs.readFileSync(
            path.resolve(__dirname, '..', '..', 'charting_library/core/stages/AxesStage.ts'),
            'utf-8'
        );
    });

    it('imports NiceTicks filters', () => {
        expect(source).toContain("import { filterOverlappingLabels, filterOverlappingTimeLabels }");
    });

    it('applies collision avoidance to price labels', () => {
        expect(source).toContain('filteredPriceLabels');
        expect(source).toContain('Collision Avoidance');
    });

    it('applies collision avoidance to time labels', () => {
        expect(source).toContain('filteredTimeLabels');
    });

    it('creates exclusion zone around current price badge', () => {
        expect(source).toContain('exclusions');
        expect(source).toContain('badgeY');
    });
});

// ─── Functional Tests ───────────────────────────────────────────

describe('NiceTicks — filterOverlappingLabels functional', () => {
    let filterOverlappingLabels;

    beforeEach(async () => {
        const mod = await import('../../charting_library/core/NiceTicks.ts');
        filterOverlappingLabels = mod.filterOverlappingLabels;
    });

    it('returns empty array for empty input', () => {
        expect(filterOverlappingLabels([], 20)).toEqual([]);
    });

    it('returns single label unchanged', () => {
        const labels = [{ x: 100, y: 50, text: '100.00', fontSize: 11 }];
        expect(filterOverlappingLabels(labels, 20)).toEqual(labels);
    });

    it('keeps non-overlapping labels', () => {
        const labels = [
            { x: 100, y: 10, text: '110', fontSize: 11 },
            { x: 100, y: 50, text: '105', fontSize: 11 },
            { x: 100, y: 90, text: '100', fontSize: 11 },
        ];
        const result = filterOverlappingLabels(labels, 20);
        expect(result.length).toBe(3);
    });

    it('filters overlapping labels', () => {
        const labels = [
            { x: 100, y: 10, text: '110', fontSize: 11 },
            { x: 100, y: 15, text: '109', fontSize: 11 }, // too close
            { x: 100, y: 50, text: '105', fontSize: 11 },
            { x: 100, y: 55, text: '104', fontSize: 11 }, // too close
        ];
        const result = filterOverlappingLabels(labels, 20);
        expect(result.length).toBe(2);
        expect(result[0].text).toBe('110');
        expect(result[1].text).toBe('105');
    });

    it('respects exclusion zones', () => {
        const labels = [
            { x: 100, y: 10, text: '110', fontSize: 11 },
            { x: 100, y: 50, text: '105', fontSize: 11 }, // in exclusion zone
            { x: 100, y: 90, text: '100', fontSize: 11 },
        ];
        const exclusions = [{ center: 50, halfSize: 10 }];
        const result = filterOverlappingLabels(labels, 20, exclusions);
        expect(result.find(l => l.text === '105')).toBeUndefined();
    });
});

describe('NiceTicks — filterOverlappingTimeLabels functional', () => {
    let filterOverlappingTimeLabels;

    beforeEach(async () => {
        const mod = await import('../../charting_library/core/NiceTicks.ts');
        filterOverlappingTimeLabels = mod.filterOverlappingTimeLabels;
    });

    it('returns empty array for empty input', () => {
        expect(filterOverlappingTimeLabels([], 12)).toEqual([]);
    });

    it('returns single label unchanged', () => {
        const labels = [{ x: 100, y: 400, text: '14:00', fontSize: 10 }];
        expect(filterOverlappingTimeLabels(labels, 12)).toEqual(labels);
    });

    it('filters overlapping time labels', () => {
        const labels = [
            { x: 10, y: 400, text: '14:00', fontSize: 10 },
            { x: 20, y: 400, text: '14:05', fontSize: 10 }, // too close
            { x: 100, y: 400, text: '14:30', fontSize: 10 },
        ];
        const result = filterOverlappingTimeLabels(labels, 12);
        // First label + spaced label (20 is too close to 10)
        expect(result.length).toBe(2);
        expect(result[0].text).toBe('14:00');
        expect(result[1].text).toBe('14:30');
    });
});
