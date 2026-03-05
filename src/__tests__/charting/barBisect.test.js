// ═══════════════════════════════════════════════════════════════════
// Tests for BarBisect — binary search utilities
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
    barBisectLeft,
    barBisectRight,
    barNearest,
    barRange,
    barIndexOf,
} from '../../charting_library/core/BarBisect.ts';

// Simulated bar timestamps (sorted, 1-minute intervals starting at 1000)
const TIMES = new Float64Array([1000, 1060, 1120, 1180, 1240, 1300, 1360, 1420, 1480, 1540]);

describe('barBisectLeft', () => {
    it('finds exact match at start', () => {
        expect(barBisectLeft(TIMES, 1000)).toBe(0);
    });

    it('finds exact match in middle', () => {
        expect(barBisectLeft(TIMES, 1240)).toBe(4);
    });

    it('finds exact match at end', () => {
        expect(barBisectLeft(TIMES, 1540)).toBe(9);
    });

    it('returns 0 for value before all', () => {
        expect(barBisectLeft(TIMES, 500)).toBe(0);
    });

    it('returns length for value after all', () => {
        expect(barBisectLeft(TIMES, 9999)).toBe(10);
    });

    it('returns insertion point between values', () => {
        expect(barBisectLeft(TIMES, 1100)).toBe(2); // Between 1060 and 1120
    });

    it('works with plain number array', () => {
        const arr = [10, 20, 30, 40, 50];
        expect(barBisectLeft(arr, 25)).toBe(2);
    });

    it('handles empty array', () => {
        expect(barBisectLeft(new Float64Array([]), 100)).toBe(0);
    });

    it('handles single element', () => {
        expect(barBisectLeft(new Float64Array([100]), 100)).toBe(0);
        expect(barBisectLeft(new Float64Array([100]), 50)).toBe(0);
        expect(barBisectLeft(new Float64Array([100]), 150)).toBe(1);
    });
});

describe('barBisectRight', () => {
    it('returns index after exact match', () => {
        expect(barBisectRight(TIMES, 1000)).toBe(1);
        expect(barBisectRight(TIMES, 1240)).toBe(5);
    });

    it('same as left for non-matching values', () => {
        expect(barBisectRight(TIMES, 1100)).toBe(2);
    });
});

describe('barNearest', () => {
    it('finds exact match', () => {
        expect(barNearest(TIMES, 1240)).toBe(4);
    });

    it('finds nearest when between two bars', () => {
        expect(barNearest(TIMES, 1250)).toBe(4); // Closer to 1240 than 1300
        expect(barNearest(TIMES, 1290)).toBe(5); // Closer to 1300 than 1240
    });

    it('returns 0 for value before all', () => {
        expect(barNearest(TIMES, 0)).toBe(0);
    });

    it('returns last for value after all', () => {
        expect(barNearest(TIMES, 99999)).toBe(9);
    });

    it('returns -1 for empty array', () => {
        expect(barNearest(new Float64Array([]), 100)).toBe(-1);
    });

    it('respects length parameter', () => {
        expect(barNearest(TIMES, 1540, 5)).toBe(4); // Only search first 5
    });
});

describe('barRange', () => {
    it('finds exact range', () => {
        expect(barRange(TIMES, 1120, 1300)).toEqual([2, 6]);
    });

    it('handles non-exact boundaries', () => {
        expect(barRange(TIMES, 1100, 1310)).toEqual([2, 6]);
    });

    it('returns [0, length] for full range', () => {
        expect(barRange(TIMES, 0, 99999)).toEqual([0, 10]);
    });

    it('returns empty range for out-of-bounds', () => {
        const [s, e] = barRange(TIMES, 5000, 6000);
        expect(e - s).toBe(0);
    });
});

describe('barIndexOf', () => {
    it('finds exact timestamp', () => {
        expect(barIndexOf(TIMES, 1240)).toBe(4);
    });

    it('returns -1 for non-existing timestamp', () => {
        expect(barIndexOf(TIMES, 1250)).toBe(-1);
    });

    it('finds first element', () => {
        expect(barIndexOf(TIMES, 1000)).toBe(0);
    });

    it('finds last element', () => {
        expect(barIndexOf(TIMES, 1540)).toBe(9);
    });
});
