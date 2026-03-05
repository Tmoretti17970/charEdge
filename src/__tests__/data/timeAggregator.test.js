// ═══════════════════════════════════════════════════════════════════
// charEdge — TimeAggregator Tests
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { aggregateBars, canAggregate, getAggregationRatio, getDeriveableTimeframes, alignTimestamp, TF_DURATION_MS } from '../../data/engine/TimeAggregator.ts';

// ─── Helpers ─────────────────────────────────────────────────────

function make1mBars(count, startPrice = 40000) {
  const bars = [];
  const now = Date.UTC(2026, 0, 1, 0, 0, 0); // 2026-01-01 00:00 UTC
  let price = startPrice;
  for (let i = 0; i < count; i++) {
    const change = price * 0.001 * (Math.random() - 0.5);
    const open = price;
    const close = price + change;
    bars.push({
      time: now + i * 60_000,
      open,
      high: Math.max(open, close) + Math.random() * 10,
      low: Math.min(open, close) - Math.random() * 10,
      close,
      volume: 10 + Math.random() * 100,
    });
    price = close;
  }
  return bars;
}

// ─── Core Aggregation Tests ──────────────────────────────────────

describe('TimeAggregator', () => {
  describe('aggregateBars', () => {
    it('aggregates 60 × 1m bars into 1 × 1h bar', () => {
      const bars = make1mBars(60);
      const result = aggregateBars(bars, '1h');

      expect(result).toHaveLength(1);
      expect(result[0].open).toBe(bars[0].open);
      expect(result[0].close).toBe(bars[59].close);
      expect(result[0].high).toBeGreaterThanOrEqual(Math.max(...bars.map(b => b.high)));
      expect(result[0].low).toBeLessThanOrEqual(Math.min(...bars.map(b => b.low)));
    });

    it('aggregates 300 × 1m bars into 5 × 1h bars', () => {
      const bars = make1mBars(300);
      const result = aggregateBars(bars, '1h');

      expect(result).toHaveLength(5);
      // Each hourly bar should cover 60 source bars
      for (const hBar of result) {
        expect(hBar.open).toBeDefined();
        expect(hBar.close).toBeDefined();
        expect(hBar.volume).toBeGreaterThan(0);
      }
    });

    it('aggregates 1m into 5m correctly', () => {
      const bars = make1mBars(25);
      const result = aggregateBars(bars, '5m');

      expect(result).toHaveLength(5);
      // First 5m bar should use bars[0..4]
      expect(result[0].open).toBe(bars[0].open);
      expect(result[0].close).toBe(bars[4].close);
    });

    it('aggregates 1m into 15m correctly', () => {
      const bars = make1mBars(60);
      const result = aggregateBars(bars, '15m');

      expect(result).toHaveLength(4);
    });

    it('preserves OHLCV semantics', () => {
      const bars = make1mBars(10);
      // Inject a known extreme
      bars[5].high = 99999;
      bars[7].low = 1;

      const result = aggregateBars(bars, '5m');
      // Second 5m bar contains bars[5..9]
      expect(result[1].high).toBe(99999);
      expect(result[1].low).toBe(1);
    });

    it('handles empty input', () => {
      expect(aggregateBars([], '1h')).toHaveLength(0);
    });

    it('handles unknown timeframe gracefully', () => {
      const bars = make1mBars(10);
      const result = aggregateBars(bars, 'invalid');
      expect(result).toBe(bars); // passthrough
    });

    it('handles single bar', () => {
      const bars = make1mBars(1);
      const result = aggregateBars(bars, '5m');
      expect(result).toHaveLength(1);
      expect(result[0].open).toBe(bars[0].open);
    });

    it('aggregates 1440 × 1m bars into 1 × 1D bar', () => {
      const bars = make1mBars(1440);
      const result = aggregateBars(bars, '1D');

      expect(result).toHaveLength(1);
      const totalVolume = bars.reduce((s, b) => s + b.volume, 0);
      expect(Math.abs(result[0].volume - totalVolume)).toBeLessThan(0.01);
    });

    it('is fast: 100K bars → 1h in < 50ms', () => {
      const bars = make1mBars(100_000);
      const start = performance.now();
      const result = aggregateBars(bars, '1h');
      const elapsed = performance.now() - start;

      expect(result.length).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(50);
      console.log(`⚡ 100K→1h aggregation: ${elapsed.toFixed(1)}ms → ${result.length} bars`);
    });
  });

  describe('canAggregate', () => {
    it('1m → 5m = true', () => expect(canAggregate('1m', '5m')).toBe(true));
    it('1m → 1h = true', () => expect(canAggregate('1m', '1h')).toBe(true));
    it('1m → 1D = true', () => expect(canAggregate('1m', '1D')).toBe(true));
    it('5m → 1h = true', () => expect(canAggregate('5m', '1h')).toBe(true));
    it('1h → 1m = false', () => expect(canAggregate('1h', '1m')).toBe(false));
    it('1m → 1m = false', () => expect(canAggregate('1m', '1m')).toBe(false));
    it('1m → 7m = false (not evenly divisible)', () => expect(canAggregate('1m', '7m')).toBe(false));
  });

  describe('getAggregationRatio', () => {
    it('1m → 5m = 5', () => expect(getAggregationRatio('1m', '5m')).toBe(5));
    it('1m → 1h = 60', () => expect(getAggregationRatio('1m', '1h')).toBe(60));
    it('1m → 4h = 240', () => expect(getAggregationRatio('1m', '4h')).toBe(240));
    it('1m → 1D = 1440', () => expect(getAggregationRatio('1m', '1D')).toBe(1440));
  });

  describe('getDeriveableTimeframes', () => {
    it('1m can derive many TFs', () => {
      const tfs = getDeriveableTimeframes('1m');
      expect(tfs).toContain('5m');
      expect(tfs).toContain('15m');
      expect(tfs).toContain('1h');
      expect(tfs).toContain('4h');
      expect(tfs).toContain('1D');
    });

    it('1h can derive higher TFs', () => {
      const tfs = getDeriveableTimeframes('1h');
      expect(tfs).toContain('4h');
      expect(tfs).toContain('1D');
      expect(tfs).not.toContain('5m');
    });
  });

  describe('alignTimestamp', () => {
    it('aligns to 5m boundary', () => {
      const ts = Date.UTC(2026, 0, 1, 12, 37, 0);
      const aligned = alignTimestamp(ts, TF_DURATION_MS['5m']);
      const d = new Date(aligned);
      expect(d.getUTCMinutes()).toBe(35);
    });

    it('aligns to 1h boundary', () => {
      const ts = Date.UTC(2026, 0, 1, 12, 37, 0);
      const aligned = alignTimestamp(ts, TF_DURATION_MS['1h']);
      const d = new Date(aligned);
      expect(d.getUTCMinutes()).toBe(0);
      expect(d.getUTCHours()).toBe(12);
    });

    it('aligns to daily boundary', () => {
      const ts = Date.UTC(2026, 0, 1, 12, 37, 0);
      const aligned = alignTimestamp(ts, TF_DURATION_MS['1D']);
      const d = new Date(aligned);
      expect(d.getUTCHours()).toBe(0);
      expect(d.getUTCMinutes()).toBe(0);
    });
  });
});
