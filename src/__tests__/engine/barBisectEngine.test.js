import { describe, it, expect } from 'vitest';
import { barBisect, barNearest, barRange } from '../../engine/barBisect.js';

describe('barBisect (engine)', () => {
  const bars = [{ t: 1000 }, { t: 2000 }, { t: 3000 }, { t: 4000 }, { t: 5000 }];

  // ─── barBisect ──────────────────────────────────────────────
  describe('barBisect', () => {
    it('finds exact matches', () => {
      expect(barBisect(bars, 1000)).toBe(0);
      expect(barBisect(bars, 3000)).toBe(2);
      expect(barBisect(bars, 5000)).toBe(4);
    });

    it('returns bitwise complement of insertion point for misses', () => {
      const idx = barBisect(bars, 2500);
      expect(idx).toBeLessThan(0);
      expect(~idx).toBe(2); // would insert at index 2
    });

    it('handles timestamp before all bars', () => {
      const idx = barBisect(bars, 500);
      expect(idx).toBeLessThan(0);
      expect(~idx).toBe(0);
    });

    it('handles timestamp after all bars', () => {
      const idx = barBisect(bars, 6000);
      expect(idx).toBeLessThan(0);
      expect(~idx).toBe(5);
    });

    it('works with single-element array', () => {
      expect(barBisect([{ t: 100 }], 100)).toBe(0);
      const miss = barBisect([{ t: 100 }], 200);
      expect(miss).toBeLessThan(0);
    });
  });

  // ─── barNearest ─────────────────────────────────────────────
  describe('barNearest', () => {
    it('returns -1 for empty array', () => {
      expect(barNearest([], 1000)).toBe(-1);
    });

    it('returns 0 for single-element array', () => {
      expect(barNearest([{ t: 100 }], 200)).toBe(0);
    });

    it('returns exact match index', () => {
      expect(barNearest(bars, 3000)).toBe(2);
    });

    it('returns nearest bar (closer to left)', () => {
      expect(barNearest(bars, 2100)).toBe(1); // closer to 2000 than 3000
    });

    it('returns nearest bar (closer to right)', () => {
      expect(barNearest(bars, 2900)).toBe(2); // closer to 3000 than 2000
    });

    it('returns first bar when timestamp is before all', () => {
      expect(barNearest(bars, 100)).toBe(0);
    });

    it('returns last bar when timestamp is after all', () => {
      expect(barNearest(bars, 9000)).toBe(4);
    });

    it('handles exact midpoint', () => {
      // At exact midpoint (2500), prefers left (distBefore <= distAfter)
      expect(barNearest(bars, 2500)).toBe(1);
    });
  });

  // ─── barRange ───────────────────────────────────────────────
  describe('barRange', () => {
    it('returns zero count for empty array', () => {
      const result = barRange([], 1000, 3000);
      expect(result.count).toBe(0);
    });

    it('finds exact range', () => {
      const result = barRange(bars, 2000, 4000);
      expect(result.startIdx).toBe(1);
      expect(result.endIdx).toBe(3);
      expect(result.count).toBe(3);
    });

    it('handles range containing all bars', () => {
      const result = barRange(bars, 0, 10000);
      expect(result.count).toBe(5);
    });

    it('handles range outside all bars', () => {
      const result = barRange(bars, 6000, 7000);
      expect(result.count).toBe(0);
    });

    it('handles range with single match', () => {
      const result = barRange(bars, 3000, 3000);
      expect(result.count).toBe(1);
      expect(result.startIdx).toBe(2);
      expect(result.endIdx).toBe(2);
    });
  });
});
