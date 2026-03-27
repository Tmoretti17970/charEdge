import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  classifyTimeframe,
  getTimeRemaining,
  filterByTimeframe,
  countByTimeframe,
} from '../../data/services/TimeClassifier.js';

describe('TimeClassifier', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── classifyTimeframe ──────────────────────────────────────
  describe('classifyTimeframe', () => {
    it('returns "oneOff" for null/undefined closeDate', () => {
      expect(classifyTimeframe(null)).toBe('oneOff');
      expect(classifyTimeframe(undefined)).toBe('oneOff');
    });

    it('returns "oneOff" for past dates', () => {
      expect(classifyTimeframe('2025-06-14T12:00:00Z')).toBe('oneOff');
    });

    it('classifies 5-minute window', () => {
      expect(classifyTimeframe('2025-06-15T12:04:00Z')).toBe('5min');
    });

    it('classifies 15-minute window', () => {
      expect(classifyTimeframe('2025-06-15T12:10:00Z')).toBe('15min');
    });

    it('classifies hourly window', () => {
      expect(classifyTimeframe('2025-06-15T12:45:00Z')).toBe('hourly');
    });

    it('classifies daily window', () => {
      expect(classifyTimeframe('2025-06-15T22:00:00Z')).toBe('daily');
    });

    it('classifies weekly window', () => {
      expect(classifyTimeframe('2025-06-20T12:00:00Z')).toBe('weekly');
    });

    it('classifies monthly window', () => {
      expect(classifyTimeframe('2025-07-10T12:00:00Z')).toBe('monthly');
    });

    it('classifies yearly window', () => {
      expect(classifyTimeframe('2026-01-15T12:00:00Z')).toBe('yearly');
    });

    it('classifies far-future as oneOff', () => {
      expect(classifyTimeframe('2028-06-15T12:00:00Z')).toBe('oneOff');
    });
  });

  // ─── getTimeRemaining ───────────────────────────────────────
  describe('getTimeRemaining', () => {
    it('returns null for null closeDate', () => {
      expect(getTimeRemaining(null)).toBeNull();
    });

    it('returns "Closed" for past dates', () => {
      expect(getTimeRemaining('2025-06-14T12:00:00Z')).toBe('Closed');
    });

    it('returns minutes format for < 60 minutes', () => {
      expect(getTimeRemaining('2025-06-15T12:30:00Z')).toBe('30m');
    });

    it('returns hours + minutes format for < 24 hours', () => {
      const result = getTimeRemaining('2025-06-15T15:30:00Z');
      expect(result).toBe('3h 30m');
    });

    it('returns days format for < 7 days', () => {
      expect(getTimeRemaining('2025-06-18T12:00:00Z')).toBe('3d');
    });

    it('returns weeks format for < 30 days', () => {
      expect(getTimeRemaining('2025-07-01T12:00:00Z')).toBe('2w');
    });

    it('returns months format for < 365 days', () => {
      expect(getTimeRemaining('2025-10-15T12:00:00Z')).toBe('4mo');
    });

    it('returns years format for >= 365 days', () => {
      expect(getTimeRemaining('2027-06-15T12:00:00Z')).toBe('2y');
    });
  });

  // ─── filterByTimeframe ──────────────────────────────────────
  describe('filterByTimeframe', () => {
    const markets = [
      { id: 1, timeframe: 'daily' },
      { id: 2, timeframe: 'weekly' },
      { id: 3, timeframe: 'daily' },
      { id: 4, timeframe: 'monthly' },
    ];

    it('returns all markets when bucketId is "all"', () => {
      expect(filterByTimeframe(markets, 'all')).toEqual(markets);
    });

    it('filters by specific timeframe', () => {
      expect(filterByTimeframe(markets, 'daily')).toHaveLength(2);
      expect(filterByTimeframe(markets, 'weekly')).toHaveLength(1);
    });

    it('returns empty array when no matches', () => {
      expect(filterByTimeframe(markets, '5min')).toHaveLength(0);
    });
  });

  // ─── countByTimeframe ───────────────────────────────────────
  describe('countByTimeframe', () => {
    it('counts markets by timeframe buckets', () => {
      const markets = [{ timeframe: 'daily' }, { timeframe: 'daily' }, { timeframe: 'weekly' }];
      const counts = countByTimeframe(markets);
      expect(counts.all).toBe(3);
      expect(counts.daily).toBe(2);
      expect(counts.weekly).toBe(1);
    });

    it('uses "oneOff" for markets without timeframe', () => {
      const markets = [{ id: 1 }, { id: 2 }];
      const counts = countByTimeframe(markets);
      expect(counts.oneOff).toBe(2);
    });

    it('handles empty array', () => {
      const counts = countByTimeframe([]);
      expect(counts.all).toBe(0);
    });
  });
});
