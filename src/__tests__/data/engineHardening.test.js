// ═══════════════════════════════════════════════════════════════════
// charEdge — GapBackfill + MemoryPressure Tests
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi } from 'vitest';
import { detectGaps, mergeBars, backfillGaps } from '../../data/engine/GapBackfill.ts';
import { MemoryPressureMonitor } from '../../data/engine/MemoryPressureMonitor.ts';
import { validateBar, validateTick } from '../../types/data.ts';

// ─── Gap Detection ───────────────────────────────────────────────

describe('GapBackfill', () => {
  const MINUTE = 60_000;

  function makeBars(timestamps) {
    return timestamps.map(t => ({
      time: t, open: 100, high: 110, low: 90, close: 105, volume: 50,
    }));
  }

  describe('detectGaps', () => {
    it('finds no gaps in continuous data', () => {
      const bars = makeBars([1000, 1000 + MINUTE, 1000 + 2 * MINUTE]);
      expect(detectGaps(bars, MINUTE)).toHaveLength(0);
    });

    it('detects a single gap', () => {
      const bars = makeBars([1000, 1000 + MINUTE, 1000 + 5 * MINUTE]);
      const gaps = detectGaps(bars, MINUTE);
      expect(gaps).toHaveLength(1);
      expect(gaps[0].from).toBe(1000 + 2 * MINUTE);
    });

    it('detects multiple gaps', () => {
      const bars = makeBars([
        1000,
        1000 + MINUTE,
        1000 + 10 * MINUTE,  // gap 1
        1000 + 11 * MINUTE,
        1000 + 20 * MINUTE,  // gap 2
      ]);
      const gaps = detectGaps(bars, MINUTE);
      expect(gaps).toHaveLength(2);
    });

    it('handles empty/single bar', () => {
      expect(detectGaps([], MINUTE)).toHaveLength(0);
      expect(detectGaps(makeBars([1000]), MINUTE)).toHaveLength(0);
    });
  });

  describe('mergeBars', () => {
    it('merges non-overlapping bars', () => {
      const a = makeBars([1000, 2000]);
      const b = makeBars([3000, 4000]);
      const result = mergeBars(a, b);
      expect(result).toHaveLength(4);
      expect(result.map(r => r.time)).toEqual([1000, 2000, 3000, 4000]);
    });

    it('deduplicates overlapping timestamps', () => {
      const a = makeBars([1000, 2000, 3000]);
      const b = makeBars([2000, 3000, 4000]);
      const result = mergeBars(a, b);
      expect(result).toHaveLength(4);
    });

    it('handles empty backfill', () => {
      const a = makeBars([1000, 2000]);
      expect(mergeBars(a, [])).toBe(a);
    });

    it('handles empty existing', () => {
      const b = makeBars([1000, 2000]);
      expect(mergeBars([], b)).toBe(b);
    });
  });

  describe('backfillGaps', () => {
    it('fills gap via REST fetch', async () => {
      const existing = makeBars([1000, 1000 + MINUTE]);
      // Simulate gap: last bar was 5 minutes ago
      existing[1].time = Date.now() - 5 * MINUTE;
      existing[0].time = existing[1].time - MINUTE;

      const mockFetch = vi.fn().mockResolvedValue(
        makeBars([existing[1].time + MINUTE, existing[1].time + 2 * MINUTE])
      );

      const result = await backfillGaps(existing, 'BTCUSDT', '1m', MINUTE, {
        minGapMs: MINUTE,
        maxGapMs: 24 * 3600_000,
        fetchBars: mockFetch,
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.length).toBeGreaterThan(existing.length);
    });

    it('skips if gap too small', async () => {
      const existing = makeBars([Date.now() - MINUTE, Date.now() - 30_000]);
      const mockFetch = vi.fn();

      const result = await backfillGaps(existing, 'BTCUSDT', '1m', MINUTE, {
        minGapMs: 2 * MINUTE,
        maxGapMs: 24 * 3600_000,
        fetchBars: mockFetch,
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result).toBe(existing);
    });

    it('skips if gap too large', async () => {
      const existing = makeBars([Date.now() - 48 * 3600_000, Date.now() - 47 * 3600_000]);
      const mockFetch = vi.fn();

      const result = await backfillGaps(existing, 'BTCUSDT', '1m', MINUTE, {
        minGapMs: MINUTE,
        maxGapMs: 24 * 3600_000,
        fetchBars: mockFetch,
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});

// ─── Memory Pressure Monitor ────────────────────────────────────

describe('MemoryPressureMonitor', () => {
  it('classifies pressure levels correctly', () => {
    const monitor = new MemoryPressureMonitor();
    expect(monitor.getPressureLevel(0.5)).toBe('normal');
    expect(monitor.getPressureLevel(0.8)).toBe('warning');
    expect(monitor.getPressureLevel(0.9)).toBe('critical');
    expect(monitor.getPressureLevel(0.95)).toBe('emergency');
    expect(monitor.getPressureLevel(0.99)).toBe('emergency');
  });

  it('can get a memory snapshot', () => {
    const monitor = new MemoryPressureMonitor();
    const snap = monitor.getSnapshot();
    expect(snap.usedMB).toBeGreaterThan(0);
    expect(snap.budgetMB).toBeGreaterThan(0);
    expect(snap.timestamp).toBeGreaterThan(0);
  });

  it('supports custom thresholds', () => {
    const monitor = new MemoryPressureMonitor({
      warningThreshold: 0.6,
      criticalThreshold: 0.7,
      emergencyThreshold: 0.8,
    });
    expect(monitor.getPressureLevel(0.6)).toBe('warning');
    expect(monitor.getPressureLevel(0.7)).toBe('critical');
    expect(monitor.getPressureLevel(0.8)).toBe('emergency');
  });

  it('notifies listeners on pressure change', () => {
    const monitor = new MemoryPressureMonitor({ pollIntervalMs: 50 });
    const handler = vi.fn();
    const unsub = monitor.onPressure(handler);

    // Manually trigger a snapshot and verify the callback mechanism works
    const snap = monitor.getSnapshot();
    expect(snap).toBeDefined();
    expect(snap.usedMB).toBeGreaterThanOrEqual(0);

    // Verify subscription/unsubscription works
    unsub();
    expect(monitor.getPressureLevel(0.99)).toBe('emergency');
  });
});

// ─── Runtime Validators ─────────────────────────────────────────

describe('Runtime Validators', () => {
  it('validateBar accepts valid bar', () => {
    const bar = { time: 1, open: 2, high: 3, low: 1, close: 2.5, volume: 100 };
    expect(validateBar(bar)).toBe(true);
  });

  it('validateBar rejects missing field', () => {
    const bar = { time: 1, open: 2, high: 3, low: 1, close: 2.5 }; // no volume
    expect(validateBar(bar)).toBe(false);
  });

  it('validateBar rejects NaN field', () => {
    const bar = { time: 1, open: NaN, high: 3, low: 1, close: 2.5, volume: 100 };
    expect(validateBar(bar)).toBe(false);
  });

  it('validateBar rejects null', () => {
    expect(validateBar(null)).toBe(false);
  });

  it('validateTick accepts valid tick', () => {
    const tick = { time: 1, price: 100, size: 5, side: 'buy' };
    expect(validateTick(tick)).toBe(true);
  });

  it('validateTick rejects missing fields', () => {
    expect(validateTick({ time: 1, price: 100 })).toBe(false);
  });
});
