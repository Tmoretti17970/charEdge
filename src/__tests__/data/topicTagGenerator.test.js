import { describe, it, expect } from 'vitest';
import {
  generateTags,
  generateSubcategories,
  filterByTag,
  filterByTags,
} from '../../data/services/TopicTagGenerator.js';

describe('TopicTagGenerator', () => {
  // ─── generateTags ───────────────────────────────────────────
  describe('generateTags', () => {
    it('returns empty array for null/empty markets', () => {
      expect(generateTags(null)).toEqual([]);
      expect(generateTags([])).toEqual([]);
    });

    it('extracts crypto tags from questions', () => {
      const markets = [
        { question: 'Will Bitcoin reach $100k?', tags: [] },
        { question: 'ETH to flip BTC?', tags: ['crypto'] },
      ];
      const tags = generateTags(markets);
      const btcTag = tags.find((t) => t.tag === 'Bitcoin');
      expect(btcTag).toBeDefined();
      expect(btcTag.count).toBeGreaterThanOrEqual(1);
      expect(btcTag.category).toBe('crypto');
    });

    it('extracts politics tags', () => {
      const markets = [
        { question: 'Will Trump win the 2024 election?', tags: [] },
        { question: 'Trump tariff impact on markets', tags: [] },
      ];
      const tags = generateTags(markets);
      const trumpTag = tags.find((t) => t.tag === 'Trump');
      expect(trumpTag).toBeDefined();
      expect(trumpTag.count).toBe(2);
    });

    it('extracts economy tags from keywords', () => {
      const markets = [
        { question: 'Will the Fed cut rates in June?', tags: [] },
        { question: 'CPI inflation above 3%?', tags: [] },
      ];
      const tags = generateTags(markets);
      expect(tags.some((t) => t.tag === 'Fed Rates')).toBe(true);
      expect(tags.some((t) => t.tag === 'Inflation')).toBe(true);
    });

    it('includes tags from market.tags array', () => {
      const markets = [{ question: 'Random question', tags: ['bitcoin', 'defi'] }];
      const tags = generateTags(markets);
      expect(tags.some((t) => t.tag === 'Bitcoin')).toBe(true);
      expect(tags.some((t) => t.tag === 'DeFi')).toBe(true);
    });

    it('sorts tags by count descending', () => {
      const markets = [
        { question: 'Bitcoin price question', tags: [] },
        { question: 'Bitcoin another question', tags: [] },
        { question: 'Tesla stock prediction', tags: [] },
      ];
      const tags = generateTags(markets);
      for (let i = 1; i < tags.length; i++) {
        expect(tags[i].count).toBeLessThanOrEqual(tags[i - 1].count);
      }
    });
  });

  // ─── generateSubcategories ──────────────────────────────────
  describe('generateSubcategories', () => {
    it('returns empty for null/empty markets', () => {
      expect(generateSubcategories(null, 'crypto')).toEqual([]);
      expect(generateSubcategories([], 'crypto')).toEqual([]);
    });

    it('generates subcategory counts', () => {
      const markets = [
        { subcategory: 'DeFi' },
        { subcategory: 'DeFi' },
        { subcategory: 'Layer 2' },
        { subcategory: null },
      ];
      const subs = generateSubcategories(markets, 'crypto');
      expect(subs).toHaveLength(2);
      expect(subs[0].sub).toBe('DeFi');
      expect(subs[0].count).toBe(2);
    });

    it('sorts by count descending', () => {
      const markets = [{ subcategory: 'A' }, { subcategory: 'B' }, { subcategory: 'B' }, { subcategory: 'B' }];
      const subs = generateSubcategories(markets, 'all');
      expect(subs[0].sub).toBe('B');
      expect(subs[0].count).toBe(3);
    });
  });

  // ─── filterByTag ────────────────────────────────────────────
  describe('filterByTag', () => {
    const markets = [
      { question: 'Bitcoin to $100k?', tags: [] },
      { question: 'Ethereum merge impact', tags: [] },
      { question: 'Fed rate decision', tags: [] },
    ];

    it('filters by known tag', () => {
      const result = filterByTag(markets, 'Bitcoin');
      expect(result).toHaveLength(1);
      expect(result[0].question).toContain('Bitcoin');
    });

    it('returns all markets for unknown tag', () => {
      const result = filterByTag(markets, 'NonexistentTag');
      expect(result).toEqual(markets);
    });
  });

  // ─── filterByTags (multiple, AND logic) ─────────────────────
  describe('filterByTags', () => {
    it('returns original markets for empty tags', () => {
      const markets = [{ question: 'Bitcoin test', tags: [] }];
      expect(filterByTags(markets, [])).toEqual(markets);
      expect(filterByTags(markets, null)).toEqual(markets);
    });

    it('applies AND logic for multiple tags', () => {
      const markets = [
        { question: 'Bitcoin and ethereum are crypto', tags: [] },
        { question: 'Only bitcoin here', tags: [] },
      ];
      const result = filterByTags(markets, ['Bitcoin', 'Ethereum']);
      expect(result).toHaveLength(1);
      expect(result[0].question).toContain('ethereum');
    });
  });
});
