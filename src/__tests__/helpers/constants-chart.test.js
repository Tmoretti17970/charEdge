import { describe, it, expect } from 'vitest';
import {
  AXIS_WIDTH,
  TIME_AXIS_HEIGHT,
  DEFAULT_VISIBLE_BARS,
  RIGHT_PADDING_BARS,
  MAX_SCROLL_SPEED,
  MIN_VISIBLE_BARS,
  CACHE_TTL_MS,
  CACHE_MAX_ENTRIES,
  buildCacheKey,
  CHART_TYPES,
  EMOJIS,
  STORAGE_KEY,
  DEFAULT_SETTINGS,
} from '../../constants.js';

describe('Chart Constants', () => {
  describe('layout constants', () => {
    it('has reasonable axis width', () => {
      expect(AXIS_WIDTH).toBeGreaterThan(0);
      expect(AXIS_WIDTH).toBeLessThan(200);
    });

    it('has reasonable time axis height', () => {
      expect(TIME_AXIS_HEIGHT).toBeGreaterThan(0);
      expect(TIME_AXIS_HEIGHT).toBeLessThan(100);
    });

    it('has reasonable default visible bars', () => {
      expect(DEFAULT_VISIBLE_BARS).toBeGreaterThan(10);
      expect(DEFAULT_VISIBLE_BARS).toBeLessThan(500);
    });

    it('has minimum visible bars less than default', () => {
      expect(MIN_VISIBLE_BARS).toBeLessThan(DEFAULT_VISIBLE_BARS);
    });

    it('has right padding bars', () => {
      expect(RIGHT_PADDING_BARS).toBeGreaterThanOrEqual(0);
    });

    it('has max scroll speed', () => {
      expect(MAX_SCROLL_SPEED).toBeGreaterThan(0);
    });
  });

  describe('cache constants', () => {
    it('has cache TTL in milliseconds', () => {
      expect(CACHE_TTL_MS).toBe(60_000);
    });

    it('has max cache entries', () => {
      expect(CACHE_MAX_ENTRIES).toBeGreaterThan(0);
    });
  });

  describe('buildCacheKey', () => {
    it('builds key with colon separator', () => {
      expect(buildCacheKey('BTCUSDT', '1D')).toBe('BTCUSDT:1D');
      expect(buildCacheKey('AAPL', '5m')).toBe('AAPL:5m');
    });
  });

  describe('CHART_TYPES', () => {
    it('is a non-empty array', () => {
      expect(CHART_TYPES.length).toBeGreaterThan(5);
    });

    it('each type has id, label, and engineId', () => {
      for (const type of CHART_TYPES) {
        expect(type).toHaveProperty('id');
        expect(type).toHaveProperty('label');
        expect(type).toHaveProperty('engineId');
      }
    });

    it('contains candles type', () => {
      expect(CHART_TYPES.some((t) => t.id === 'candles')).toBe(true);
    });

    it('contains heikin-ashi type', () => {
      expect(CHART_TYPES.some((t) => t.id === 'heikinashi')).toBe(true);
    });
  });

  describe('EMOJIS', () => {
    it('has emoji and label for each entry', () => {
      expect(EMOJIS.length).toBeGreaterThan(0);
      for (const emoji of EMOJIS) {
        expect(emoji).toHaveProperty('e');
        expect(emoji).toHaveProperty('l');
      }
    });
  });

  describe('STORAGE_KEY', () => {
    it('is a non-empty string', () => {
      expect(typeof STORAGE_KEY).toBe('string');
      expect(STORAGE_KEY.length).toBeGreaterThan(0);
    });
  });

  describe('DEFAULT_SETTINGS', () => {
    it('has expected default values', () => {
      expect(DEFAULT_SETTINGS.defaultSymbol).toBe('BTC');
      expect(DEFAULT_SETTINGS.defaultTf).toBe('5m');
      expect(DEFAULT_SETTINGS.simpleMode).toBe(false);
      expect(DEFAULT_SETTINGS.dailyLossLimit).toBe(0);
    });

    it('has risk management defaults', () => {
      expect(DEFAULT_SETTINGS.riskPerTradePct).toBe(1.0);
      expect(DEFAULT_SETTINGS.positionSizing).toBe('fixed_pct');
      expect(DEFAULT_SETTINGS.kellyFraction).toBe(0.5);
      expect(DEFAULT_SETTINGS.riskFreeRate).toBe(0.05);
    });
  });
});
