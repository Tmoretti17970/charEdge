// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Engine Integration Tests (Task 2.2.5)
//
// End-to-end pipelines verifying chart engine modules work together:
// 1. Data pipeline: generate → aggregation → merge
// 2. Template round-trip: save → load → verify
// 3. Cross-module: TimeAggregator → GapBackfill → validators
// 4. CrosshairBus pub/sub
// 5. Memory pressure monitoring
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi } from 'vitest';
import { aggregateBars, canAggregate, getDeriveableTimeframes } from '../../data/engine/TimeAggregator.ts';
import { detectGaps, mergeBars, backfillGaps } from '../../data/engine/GapBackfill.ts';
import { MemoryPressureMonitor } from '../../data/engine/MemoryPressureMonitor.ts';
import { validateBar, validateTick } from '../../types/data.ts';
import { Calc } from '../../charting_library/model/Calc.js';
import { compInd } from '../../charting_library/studies/compInd.js';
import { useTemplateStore } from '../../state/useTemplateStore.ts';

// ─── Helpers ─────────────────────────────────────────────────────

function generate1mBars(count, startPrice = 100) {
  const bars = [];
  const start = Date.UTC(2026, 0, 1, 0, 0, 0);
  let price = startPrice;
  for (let i = 0; i < count; i++) {
    const d = price * 0.001 * (Math.random() - 0.5);
    const o = price;
    const c = price + d;
    bars.push({
      time: start + i * 60_000,
      open: o,
      high: Math.max(o, c) + Math.random() * 2,
      low: Math.min(o, c) - Math.random() * 2,
      close: c,
      volume: 50 + Math.random() * 200,
    });
    price = c;
  }
  return bars;
}

// ═══════════════════════════════════════════════════════════════════
// Test Suite 1: Full Data Pipeline
// ═══════════════════════════════════════════════════════════════════

describe('Chart Engine Integration: Data Pipeline', () => {
  it('1m bars → aggregate 5m → compute SMA → validate all bars', () => {
    // Step 1: Generate 1m data
    const minuteBars = generate1mBars(100);
    expect(minuteBars).toHaveLength(100);
    minuteBars.forEach(b => expect(validateBar(b)).toBe(true));

    // Step 2: Aggregate to 5m
    const fiveMinBars = aggregateBars(minuteBars, '5m');
    expect(fiveMinBars).toHaveLength(20);
    fiveMinBars.forEach(b => expect(validateBar(b)).toBe(true));

    // Step 3: Compute indicator on aggregated data
    const closes = fiveMinBars.map(b => b.close);
    const sma10 = Calc.sma(closes, 10);
    expect(sma10.length).toBe(fiveMinBars.length);

    // First 9 should be null (not enough data), rest should be numbers
    const validSma = sma10.filter(v => v !== null);
    expect(validSma.length).toBeGreaterThan(0);
    validSma.forEach(v => {
      expect(typeof v).toBe('number');
      expect(Number.isFinite(v)).toBe(true);
    });
  });

  it('1m → 1h → detect gaps → backfill → merge produces clean dataset', async () => {
    // Step 1: Generate 1h of 1m bars, with a gap
    const part1 = generate1mBars(30);     // 0-29 minutes
    const part2 = generate1mBars(20);     // shifted ahead
    const gapStart = part1[part1.length - 1].time;

    // Create a 10-minute gap
    part2.forEach((b, i) => {
      b.time = gapStart + (i + 10) * 60_000;
    });

    const gappedBars = [...part1, ...part2];

    // Step 2: Detect the gap
    const gaps = detectGaps(gappedBars, 60_000);
    expect(gaps.length).toBeGreaterThanOrEqual(1);

    // Step 3: Simulate backfill
    const backfillData = generate1mBars(8);
    backfillData.forEach((b, i) => {
      b.time = gapStart + (i + 1) * 60_000;
    });

    // Step 4: Merge
    const merged = mergeBars(gappedBars, backfillData);
    expect(merged.length).toBeGreaterThanOrEqual(gappedBars.length);

    // Verify sorted order
    for (let i = 1; i < merged.length; i++) {
      expect(merged[i].time).toBeGreaterThanOrEqual(merged[i - 1].time);
    }

    // Step 5: Aggregate merged data to 5m — should produce clean result
    const fiveMinBars = aggregateBars(merged, '5m');
    expect(fiveMinBars.length).toBeGreaterThan(0);
    fiveMinBars.forEach(b => expect(validateBar(b)).toBe(true));
  });

  it('derives all timeframes from 1m and validates each', () => {
    const minuteBars = generate1mBars(1440); // 1 day of data
    const deriveableTFs = getDeriveableTimeframes('1m');

    expect(deriveableTFs.length).toBeGreaterThan(5);

    for (const tf of deriveableTFs.slice(0, 6)) { // Test first 6 to avoid duplicates
      if (!canAggregate('1m', tf)) continue;
      const aggregated = aggregateBars(minuteBars, tf);
      expect(aggregated.length).toBeGreaterThan(0);

      // Each bar must be valid
      aggregated.forEach(b => {
        expect(validateBar(b, `aggregate-${tf}`)).toBe(true);
        expect(b.high).toBeGreaterThanOrEqual(b.low);
        expect(b.volume).toBeGreaterThan(0);
      });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// Test Suite 2: Indicator Chain on Aggregated Data
// ═══════════════════════════════════════════════════════════════════

describe('Chart Engine Integration: Indicator Chain', () => {
  it('computes multi-indicator stack on aggregated data', () => {
    const minuteBars = generate1mBars(300); // 5 hours
    const hourlyBars = aggregateBars(minuteBars, '1h');

    expect(hourlyBars.length).toBe(5);

    // Run indicator stack
    const smaResult = compInd('sma', hourlyBars, { period: 3 });
    const rsiResult = compInd('rsi', hourlyBars, { period: 3 });
    const bollResult = compInd('bollinger', hourlyBars, { period: 3, stdDev: 2 });

    expect(smaResult).toBeDefined();
    expect(rsiResult).toBeDefined();
    expect(bollResult).toBeDefined();
  });

  it('Calc functions work on aggregated closes', () => {
    const minuteBars = generate1mBars(600);
    const fifteenMinBars = aggregateBars(minuteBars, '15m');

    const closes = fifteenMinBars.map(b => b.close);
    expect(closes.length).toBe(40);

    // Run Calc engine
    const ema = Calc.ema(closes, 10);
    const rsi = Calc.rsi(closes, 14);
    const macd = Calc.macd(closes, 12, 26, 9);

    expect(ema.length).toBe(closes.length);
    expect(rsi.length).toBe(closes.length);
    expect(macd).toBeDefined();

    // RSI should be in valid range
    const validRsi = rsi.filter(v => v !== null);
    validRsi.forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Test Suite 3: Template Round-Trip
// ═══════════════════════════════════════════════════════════════════

describe('Chart Engine Integration: Template Round-Trip', () => {
  it('saves and restores chart template with indicators', () => {
    // Reset store
    useTemplateStore.getState().resetTemplates();

    const indicators = [
      { type: 'sma', params: { period: 20 } },
      { type: 'rsi', params: { period: 14 } },
    ];

    // Save template using actual API: saveTemplate(name, { indicators, chartType, ... })
    const id = useTemplateStore.getState().saveTemplate(
      'Integration Test Template',
      { indicators, chartType: 'candlestick', timeframe: '1h' },
    );
    expect(id).toBeTruthy();

    // Verify round-trip
    const saved = useTemplateStore.getState().getTemplate(id);
    expect(saved).not.toBeNull();
    expect(saved.name).toBe('Integration Test Template');
    expect(saved.chartType).toBe('candlestick');
    expect(saved.timeframe).toBe('1h');
    expect(saved.indicators.length).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Test Suite 4: Memory Monitor + Data Lifecycle
// ═══════════════════════════════════════════════════════════════════

describe('Chart Engine Integration: Memory Lifecycle', () => {
  it('monitors memory during heavy data operations', () => {
    const monitor = new MemoryPressureMonitor();
    const snapBefore = monitor.getSnapshot();

    // Simulate heavy data operation
    const heavyData = generate1mBars(50_000);
    const aggregated = aggregateBars(heavyData, '1h');
    const closes = aggregated.map(b => b.close);
    const _sma = Calc.sma(closes, 20);

    const snapAfter = monitor.getSnapshot();

    expect(snapBefore.usedMB).toBeGreaterThan(0);
    expect(snapAfter.usedMB).toBeGreaterThan(0);

    // Verify data integrity wasn't corrupted
    expect(aggregated.length).toBeGreaterThan(0);
    aggregated.forEach(b => expect(validateBar(b)).toBe(true));
  });
});

// ═══════════════════════════════════════════════════════════════════
// Test Suite 5: Validation at Data Boundaries
// ═══════════════════════════════════════════════════════════════════

describe('Chart Engine Integration: Data Boundary Validation', () => {
  it('validates bar shapes at every pipeline stage', () => {
    // Stage 1: Raw generation
    const raw = generate1mBars(120);
    raw.forEach(b => expect(validateBar(b, 'raw')).toBe(true));

    // Stage 2: After sort
    const sorted = [...raw].sort((a, b) => a.time - b.time);
    sorted.forEach(b => expect(validateBar(b, 'sorted')).toBe(true));

    // Stage 3: After aggregation
    const agg = aggregateBars(sorted, '5m');
    agg.forEach(b => expect(validateBar(b, 'aggregated')).toBe(true));

    // Stage 4: After merge
    const extra = generate1mBars(10);
    extra.forEach((b, i) => { b.time = sorted[sorted.length - 1].time + (i + 1) * 60_000; });
    const merged = mergeBars(sorted, extra);
    merged.forEach(b => expect(validateBar(b, 'merged')).toBe(true));

    // Ensure no data corruption
    expect(merged.length).toBe(sorted.length + extra.length);
  });

  it('rejects invalid bars at pipeline entry', () => {
    expect(validateBar(null, 'null-check')).toBe(false);
    expect(validateBar({ time: 1, open: NaN, high: 2, low: 0, close: 1, volume: 10 }, 'nan-check')).toBe(false);
    expect(validateBar({ time: 1, open: 2, high: 3, low: 1, close: 2 }, 'missing-volume')).toBe(false);
  });

  it('validates ticks at adapter boundary', () => {
    const validTick = { time: Date.now(), price: 100, size: 5, side: 'buy' };
    const invalidTick = { time: Date.now(), price: 100 };

    expect(validateTick(validTick, 'adapter')).toBe(true);
    expect(validateTick(invalidTick, 'adapter')).toBe(false);
    expect(validateTick(null)).toBe(false);
  });
});
