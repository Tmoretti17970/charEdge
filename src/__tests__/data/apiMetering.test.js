import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ApiMeter } from '../../data/ApiMetering.js';

describe('ApiMeter', () => {
  let meter;

  beforeEach(() => {
    meter = new ApiMeter();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('record', () => {
    it('records API calls', () => {
      meter.record('binance');
      meter.record('binance');
      expect(meter.getRate('binance')).toBe(2);
    });

    it('normalizes provider to lowercase', () => {
      meter.record('Binance');
      meter.record('BINANCE');
      expect(meter.getRate('binance')).toBe(2);
    });

    it('uses "unknown" for null/undefined provider', () => {
      meter.record(null);
      meter.record(undefined);
      expect(meter.getRate('unknown')).toBe(2);
    });
  });

  describe('getRate', () => {
    it('returns 0 for unknown provider', () => {
      expect(meter.getRate('nonexistent')).toBe(0);
    });

    it('only counts calls within the 1-minute window', () => {
      meter.record('binance');
      vi.advanceTimersByTime(61_000); // advance past 1 minute
      expect(meter.getRate('binance')).toBe(0);
    });

    it('counts calls within the window', () => {
      meter.record('polygon');
      vi.advanceTimersByTime(30_000);
      meter.record('polygon');
      expect(meter.getRate('polygon')).toBe(2);
    });
  });

  describe('getSnapshot', () => {
    it('returns snapshot sorted by callsPerMin', () => {
      meter.record('binance');
      meter.record('binance');
      meter.record('binance');
      meter.record('polygon');
      const snapshot = meter.getSnapshot();
      expect(snapshot[0].provider).toBe('binance');
      expect(snapshot[0].callsPerMin).toBe(3);
      expect(snapshot[1].provider).toBe('polygon');
    });

    it('includes totalCalls', () => {
      meter.record('binance');
      meter.record('binance');
      vi.advanceTimersByTime(61_000);
      meter.record('binance');
      const snapshot = meter.getSnapshot();
      const binance = snapshot.find((s) => s.provider === 'binance');
      expect(binance.totalCalls).toBe(3);
      expect(binance.callsPerMin).toBe(1); // only last one in window
    });
  });

  describe('getTotals', () => {
    it('aggregates across all providers', () => {
      meter.record('binance');
      meter.record('polygon');
      meter.record('polygon');
      const totals = meter.getTotals();
      expect(totals.totalCallsPerMin).toBe(3);
      expect(totals.totalLifetime).toBe(3);
    });
  });

  describe('getExceeded', () => {
    it('returns providers exceeding threshold', () => {
      for (let i = 0; i < 65; i++) meter.record('binance');
      const exceeded = meter.getExceeded(60);
      expect(exceeded).toHaveLength(1);
      expect(exceeded[0].provider).toBe('binance');
    });

    it('returns empty when under threshold', () => {
      meter.record('binance');
      expect(meter.getExceeded(60)).toHaveLength(0);
    });
  });

  describe('reset', () => {
    it('clears all counters', () => {
      meter.record('binance');
      meter.record('polygon');
      meter.reset();
      expect(meter.getRate('binance')).toBe(0);
      expect(meter.getSnapshot()).toHaveLength(0);
    });
  });
});
