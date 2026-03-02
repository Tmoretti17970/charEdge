// ═══════════════════════════════════════════════════════════════════
// charEdge — Robustness Module Tests
// Tests for AdapterCircuitBreaker and DataValidator.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateCandle,
  validateCandleArray,
  detectGaps,
  deduplicateCandles,
} from '../data/engine/infra/DataValidator.js';
import {
  withCircuitBreaker,
  getCircuitState,
  resetCircuit,
  resetAllCircuits,
  STATE,
} from '../data/engine/infra/AdapterCircuitBreaker.js';

// ─────────────────────────────────────────────────────────────────
// DataValidator
// ─────────────────────────────────────────────────────────────────

describe('DataValidator', () => {
  describe('validateCandle', () => {
    it('accepts a valid candle', () => {
      const result = validateCandle({
        time: '2024-01-15T00:00:00.000Z',
        open: 100, high: 110, low: 95, close: 105, volume: 5000,
      });
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('rejects null/undefined input', () => {
      expect(validateCandle(null).valid).toBe(false);
      expect(validateCandle(undefined).valid).toBe(false);
    });

    it('rejects invalid timestamp', () => {
      const result = validateCandle({
        time: 'not-a-date', open: 100, high: 110, low: 95, close: 105, volume: 0,
      });
      expect(result.valid).toBe(false);
      expect(result.issues[0]).toContain('timestamp');
    });

    it('rejects future timestamps (> now + 1 day)', () => {
      const futureDate = new Date(Date.now() + 2 * 86_400_000).toISOString();
      const result = validateCandle({
        time: futureDate, open: 100, high: 110, low: 95, close: 105, volume: 0,
      });
      expect(result.valid).toBe(false);
      expect(result.issues[0]).toContain('future');
    });

    it('rejects negative prices', () => {
      const result = validateCandle({
        time: '2024-01-15T00:00:00.000Z', open: -5, high: 110, low: 95, close: 105, volume: 0,
      });
      expect(result.valid).toBe(false);
      expect(result.issues[0]).toContain('negative');
    });

    it('rejects non-number price fields', () => {
      const result = validateCandle({
        time: '2024-01-15T00:00:00.000Z', open: 'abc', high: 110, low: 95, close: 105, volume: 0,
      });
      expect(result.valid).toBe(false);
    });

    it('swaps high < low (fixable)', () => {
      const result = validateCandle({
        time: '2024-01-15T00:00:00.000Z', open: 100, high: 90, low: 110, close: 105, volume: 0,
      });
      expect(result.valid).toBe(true);
      expect(result.candle.high).toBe(110);
      expect(result.candle.low).toBe(90);
      expect(result.issues[0]).toContain('swapped');
    });

    it('zeroes negative volume (fixable)', () => {
      const result = validateCandle({
        time: '2024-01-15T00:00:00.000Z', open: 100, high: 110, low: 95, close: 105, volume: -500,
      });
      expect(result.valid).toBe(true);
      expect(result.candle.volume).toBe(0);
      expect(result.issues[0]).toContain('volume');
    });

    it('rejects all-zero candles', () => {
      const result = validateCandle({
        time: '2024-01-15T00:00:00.000Z', open: 0, high: 0, low: 0, close: 0, volume: 0,
      });
      expect(result.valid).toBe(false);
      expect(result.issues[0]).toContain('zero');
    });
  });

  describe('validateCandleArray', () => {
    it('filters invalid candles and keeps valid ones', () => {
      const input = [
        { time: '2024-01-15T00:00:00.000Z', open: 100, high: 110, low: 95, close: 105, volume: 1000 },
        null,
        { time: '2024-01-15T01:00:00.000Z', open: -5, high: 110, low: 95, close: 105, volume: 0 },
        { time: '2024-01-15T02:00:00.000Z', open: 106, high: 112, low: 100, close: 108, volume: 500 },
      ];
      const result = validateCandleArray(input);
      expect(result).toHaveLength(2);
    });

    it('returns empty array for non-array input', () => {
      expect(validateCandleArray(null)).toEqual([]);
      expect(validateCandleArray('string')).toEqual([]);
    });
  });

  describe('detectGaps', () => {
    it('detects gaps in candle data', () => {
      const bars = [
        { time: '2024-01-15T00:00:00.000Z' },
        { time: '2024-01-15T01:00:00.000Z' },
        // 3-hour gap (missing 02:00 and 03:00)
        { time: '2024-01-15T04:00:00.000Z' },
        { time: '2024-01-15T05:00:00.000Z' },
      ];
      const gaps = detectGaps(bars, 3_600_000); // 1h interval
      expect(gaps).toHaveLength(1);
      expect(gaps[0].afterIndex).toBe(1);
      expect(gaps[0].gapMs).toBe(3 * 3_600_000);
    });

    it('returns empty for no gaps', () => {
      const bars = [
        { time: '2024-01-15T00:00:00.000Z' },
        { time: '2024-01-15T01:00:00.000Z' },
        { time: '2024-01-15T02:00:00.000Z' },
      ];
      const gaps = detectGaps(bars, 3_600_000);
      expect(gaps).toHaveLength(0);
    });

    it('handles edge cases', () => {
      expect(detectGaps([], 1000)).toEqual([]);
      expect(detectGaps(null, 1000)).toEqual([]);
      expect(detectGaps([{ time: '2024-01-01' }], 1000)).toEqual([]);
    });
  });

  describe('deduplicateCandles', () => {
    it('removes duplicate timestamps, keeps last', () => {
      const bars = [
        { time: '2024-01-15T00:00:00.000Z', close: 100 },
        { time: '2024-01-15T01:00:00.000Z', close: 200 },
        { time: '2024-01-15T00:00:00.000Z', close: 150 }, // duplicate, should replace
        { time: '2024-01-15T02:00:00.000Z', close: 300 },
      ];
      const result = deduplicateCandles(bars);
      expect(result).toHaveLength(3);
      expect(result[0].close).toBe(150); // last-write wins
    });

    it('returns sorted by time', () => {
      const bars = [
        { time: '2024-01-15T02:00:00.000Z', close: 300 },
        { time: '2024-01-15T00:00:00.000Z', close: 100 },
        { time: '2024-01-15T01:00:00.000Z', close: 200 },
      ];
      const result = deduplicateCandles(bars);
      expect(result[0].close).toBe(100);
      expect(result[1].close).toBe(200);
      expect(result[2].close).toBe(300);
    });

    it('handles empty input', () => {
      expect(deduplicateCandles([])).toEqual([]);
      expect(deduplicateCandles(null)).toEqual([]);
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// AdapterCircuitBreaker
// ─────────────────────────────────────────────────────────────────

describe('AdapterCircuitBreaker', () => {
  beforeEach(() => {
    resetAllCircuits();
  });

  it('passes through in CLOSED state', async () => {
    const result = await withCircuitBreaker('test-adapter', () => Promise.resolve([1, 2, 3]));
    expect(result).toEqual([1, 2, 3]);
    expect(getCircuitState('test-adapter').state).toBe(STATE.CLOSED);
  });

  it('returns null when fetch returns null (but stays CLOSED initially)', async () => {
    const result = await withCircuitBreaker('test-null', () => Promise.resolve(null));
    expect(result).toBeNull();
    // With only 1 failure in window, should still be CLOSED (threshold is 50% with 3+ calls)
    expect(getCircuitState('test-null').state).toBe(STATE.CLOSED);
  });

  it('trips to OPEN after enough failures', async () => {
    // Need at least 3 calls and 50% failure rate
    for (let i = 0; i < 4; i++) {
      await withCircuitBreaker('trip-test', () => Promise.resolve(null));
    }
    expect(getCircuitState('trip-test').state).toBe(STATE.OPEN);
  });

  it('short-circuits to null when OPEN and cooldown not elapsed', async () => {
    // Trip the breaker
    for (let i = 0; i < 4; i++) {
      await withCircuitBreaker('open-test', () => Promise.resolve(null));
    }
    expect(getCircuitState('open-test').state).toBe(STATE.OPEN);

    // Should return null without calling fetch
    let fetchCalled = false;
    const result = await withCircuitBreaker('open-test', () => {
      fetchCalled = true;
      return Promise.resolve([1]);
    });
    expect(result).toBeNull();
    expect(fetchCalled).toBe(false);
  });

  it('handles fetch errors gracefully', async () => {
    const result = await withCircuitBreaker('error-test', () => {
      throw new Error('network error');
    });
    expect(result).toBeNull();
  });

  it('resetCircuit clears state', async () => {
    // Create some state
    await withCircuitBreaker('reset-test', () => Promise.resolve([1]));
    expect(getCircuitState('reset-test').state).toBe(STATE.CLOSED);
    resetCircuit('reset-test');
    // After reset, should be fresh CLOSED
    expect(getCircuitState('reset-test').state).toBe(STATE.CLOSED);
    expect(getCircuitState('reset-test').consecutiveTrips).toBe(0);
  });

  it('getCircuitState returns expected shape', () => {
    const state = getCircuitState('new-adapter');
    expect(state).toHaveProperty('state', STATE.CLOSED);
    expect(state).toHaveProperty('failureRate');
    expect(state).toHaveProperty('cooldownMs');
    expect(state).toHaveProperty('consecutiveTrips');
  });
});
