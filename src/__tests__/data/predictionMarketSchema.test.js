import { describe, it, expect } from 'vitest';
import {
  CATEGORIES,
  SOURCES,
  MARKET_TYPES,
  MARKET_STATUSES,
  CATEGORY_CONFIG,
  SOURCE_CONFIG,
  TIME_BUCKETS,
  validateMarket,
  createMarket,
  getLeadingOutcome,
  getLeadingDelta,
  isBinaryMarket,
  formatVolume,
  formatMultiplier,
  timeToClose,
} from '../../data/schemas/PredictionMarketSchema.js';

describe('PredictionMarketSchema', () => {
  // ─── Constants ──────────────────────────────────────────────
  describe('constants', () => {
    it('CATEGORIES contains expected entries', () => {
      expect(CATEGORIES).toContain('crypto');
      expect(CATEGORIES).toContain('politics');
      expect(CATEGORIES).toContain('finance');
      expect(CATEGORIES.length).toBeGreaterThan(10);
    });

    it('SOURCES contains known platforms', () => {
      expect(SOURCES).toContain('kalshi');
      expect(SOURCES).toContain('polymarket');
      expect(SOURCES).toContain('metaculus');
    });

    it('MARKET_TYPES has binary, multi, scalar', () => {
      expect(MARKET_TYPES).toEqual(['binary', 'multi', 'scalar']);
    });

    it('MARKET_STATUSES has expected values', () => {
      expect(MARKET_STATUSES).toEqual(['open', 'closed', 'resolved', 'voided']);
    });

    it('CATEGORY_CONFIG has config for each category', () => {
      for (const cat of CATEGORIES) {
        if (cat === 'trending' || cat === 'new') continue;
        expect(CATEGORY_CONFIG[cat]).toBeDefined();
        expect(CATEGORY_CONFIG[cat]).toHaveProperty('label');
        expect(CATEGORY_CONFIG[cat]).toHaveProperty('color');
      }
    });

    it('SOURCE_CONFIG has config for each known source', () => {
      for (const src of ['kalshi', 'polymarket', 'metaculus', 'manifold', 'drift']) {
        expect(SOURCE_CONFIG[src]).toHaveProperty('label');
        expect(SOURCE_CONFIG[src]).toHaveProperty('badge');
      }
    });

    it('TIME_BUCKETS has expected structure', () => {
      expect(TIME_BUCKETS.length).toBeGreaterThan(5);
      expect(TIME_BUCKETS[0].id).toBe('all');
    });
  });

  // ─── validateMarket ─────────────────────────────────────────
  describe('validateMarket', () => {
    const validMarket = {
      id: 'kalshi-test',
      source: 'kalshi',
      question: 'Will it rain?',
      category: 'climate',
      outcomes: [
        { label: 'Yes', probability: 60 },
        { label: 'No', probability: 40 },
      ],
      marketType: 'binary',
      url: 'https://kalshi.com/test',
    };

    it('validates a correct market', () => {
      expect(validateMarket(validMarket)).toEqual({ valid: true });
    });

    it('rejects missing required fields', () => {
      const result = validateMarket({ question: 'Test' });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects invalid probability range', () => {
      const result = validateMarket({
        ...validMarket,
        outcomes: [{ label: 'Yes', probability: 150 }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('probability'))).toBe(true);
    });

    it('rejects empty outcomes array', () => {
      const result = validateMarket({ ...validMarket, outcomes: [] });
      expect(result.valid).toBe(false);
    });

    it('rejects invalid source', () => {
      const result = validateMarket({ ...validMarket, source: 'fakeSource' });
      expect(result.valid).toBe(false);
    });

    it('rejects invalid marketType', () => {
      const result = validateMarket({ ...validMarket, marketType: 'invalid' });
      expect(result.valid).toBe(false);
    });

    it('rejects outcomes missing label', () => {
      const result = validateMarket({
        ...validMarket,
        outcomes: [{ probability: 50 }],
      });
      expect(result.valid).toBe(false);
    });
  });

  // ─── createMarket ──────────────────────────────────────────
  describe('createMarket', () => {
    it('creates a market with defaults', () => {
      const market = createMarket({
        id: 'test-1',
        source: 'kalshi',
        question: 'Test?',
        url: 'https://example.com',
        outcomes: [{ label: 'Yes', probability: 60 }],
      });
      expect(market.category).toBe('other');
      expect(market.marketType).toBe('binary');
      expect(market.status).toBe('open');
      expect(market.volume24h).toBe(0);
      expect(market.relatedTickers).toEqual([]);
      expect(market.tags).toEqual([]);
    });

    it('preserves provided values', () => {
      const market = createMarket({
        id: 'test-2',
        source: 'polymarket',
        question: 'Bitcoin?',
        url: 'https://poly.com',
        category: 'crypto',
        volume24h: 50000,
        outcomes: [{ label: 'Yes', probability: 70, volume: 1000 }],
      });
      expect(market.category).toBe('crypto');
      expect(market.volume24h).toBe(50000);
      expect(market.outcomes[0].volume).toBe(1000);
    });
  });

  // ─── getLeadingOutcome ──────────────────────────────────────
  describe('getLeadingOutcome', () => {
    it('returns outcome with highest probability', () => {
      const market = {
        outcomes: [
          { label: 'No', probability: 30 },
          { label: 'Yes', probability: 70 },
        ],
      };
      expect(getLeadingOutcome(market).label).toBe('Yes');
    });

    it('returns null for no outcomes', () => {
      expect(getLeadingOutcome({ outcomes: [] })).toBeNull();
      expect(getLeadingOutcome({})).toBeNull();
    });
  });

  // ─── getLeadingDelta ────────────────────────────────────────
  describe('getLeadingDelta', () => {
    it('computes delta from previousProbability', () => {
      const market = {
        outcomes: [{ label: 'Yes', probability: 70, previousProbability: 60 }],
      };
      expect(getLeadingDelta(market)).toBe(10);
    });

    it('returns 0 for no outcomes', () => {
      expect(getLeadingDelta({})).toBe(0);
    });
  });

  // ─── isBinaryMarket ─────────────────────────────────────────
  describe('isBinaryMarket', () => {
    it('returns true for binary marketType', () => {
      expect(isBinaryMarket({ marketType: 'binary' })).toBe(true);
    });

    it('returns true for 2 outcomes', () => {
      expect(isBinaryMarket({ marketType: 'multi', outcomes: [{}, {}] })).toBe(true);
    });

    it('returns false for multi with 3+ outcomes', () => {
      expect(isBinaryMarket({ marketType: 'multi', outcomes: [{}, {}, {}] })).toBe(false);
    });
  });

  // ─── formatVolume ───────────────────────────────────────────
  describe('formatVolume', () => {
    it('formats billions', () => expect(formatVolume(1_500_000_000)).toBe('$1.50B'));
    it('formats millions', () => expect(formatVolume(2_500_000)).toBe('$2.50M'));
    it('formats thousands', () => expect(formatVolume(42_000)).toBe('$42.0K'));
    it('formats small values', () => expect(formatVolume(500)).toBe('$500'));
  });

  // ─── formatMultiplier ───────────────────────────────────────
  describe('formatMultiplier', () => {
    it('formats multiplier', () => expect(formatMultiplier(3.5)).toBe('3.50x'));
    it('returns null for 0 or 1', () => {
      expect(formatMultiplier(0)).toBeNull();
      expect(formatMultiplier(1)).toBeNull();
    });
  });

  // ─── timeToClose ────────────────────────────────────────────
  describe('timeToClose', () => {
    it('returns null for no close date', () => expect(timeToClose(null)).toBeNull());
    it('returns "Closed" for past dates', () => expect(timeToClose('2020-01-01')).toBe('Closed'));
  });
});
