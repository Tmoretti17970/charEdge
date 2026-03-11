// ═══════════════════════════════════════════════════════════════════
// charEdge — Benchmark Runner Tests (Phase 3.1.1)
//
// Validates:
//   1. StressTest.generateBars produces correct bar data
//   2. StressTest.runFullBenchmark report structure + gate logic
//   3. StressTest.generateReport handles empty + populated results
//   4. AI disclaimer coverage across all AI modules
// ═══════════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, beforeAll } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readSource(relPath) {
  return fs.readFileSync(path.resolve(__dirname, '..', '..', relPath), 'utf-8');
}

// ═══════════════════════════════════════════════════════════════════
// StressTest — Data Generation
// ═══════════════════════════════════════════════════════════════════

describe('StressTest — generateBars', () => {
  let StressTest;

  beforeAll(async () => {
    ({ StressTest } = await import('../../charting_library/perf/StressTest.js'));
  });

  it('generates the requested number of bars', () => {
    const bars = StressTest.generateBars(500);
    expect(bars).toHaveLength(500);
  });

  it('each bar has OHLCV fields', () => {
    const bars = StressTest.generateBars(10);
    for (const b of bars) {
      expect(b).toHaveProperty('time');
      expect(b).toHaveProperty('open');
      expect(b).toHaveProperty('high');
      expect(b).toHaveProperty('low');
      expect(b).toHaveProperty('close');
      expect(b).toHaveProperty('volume');
      expect(b.high).toBeGreaterThanOrEqual(Math.max(b.open, b.close));
      expect(b.low).toBeLessThanOrEqual(Math.min(b.open, b.close));
    }
  });

  it('bars are in ascending time order', () => {
    const bars = StressTest.generateBars(100);
    for (let i = 1; i < bars.length; i++) {
      expect(bars[i].time).toBeGreaterThan(bars[i - 1].time);
    }
  });

  it('returns empty array for count <= 0', () => {
    expect(StressTest.generateBars(0)).toEqual([]);
    expect(StressTest.generateBars(-5)).toEqual([]);
  });

  it('is deterministic (same seed = same output)', () => {
    const a = StressTest.generateBars(50);
    const b = StressTest.generateBars(50);
    expect(a).toEqual(b);
  });
});

// ═══════════════════════════════════════════════════════════════════
// StressTest — Benchmark Report Structure
// ═══════════════════════════════════════════════════════════════════

describe('StressTest — runFullBenchmark structure', () => {
  let StressTest;

  beforeAll(async () => {
    ({ StressTest } = await import('../../charting_library/perf/StressTest.js'));
  });

  it('runFullBenchmark returns { passed, report, results }', () => {
    // Ultra-fast no-op render for unit test speed
    const noop = () => {};
    const output = StressTest.runFullBenchmark(noop, {
      tiers: [100, 200],
      durationMs: 50,
      viewportBars: 50,
    });

    expect(output).toHaveProperty('passed');
    expect(output).toHaveProperty('report');
    expect(output).toHaveProperty('results');
    expect(typeof output.passed).toBe('boolean');
    expect(Array.isArray(output.results)).toBe(true);
  });

  it('report contains gates array with verdict per tier', () => {
    const noop = () => {};
    const output = StressTest.runFullBenchmark(noop, {
      tiers: [100],
      durationMs: 50,
      viewportBars: 50,
    });

    expect(output.report).toHaveProperty('gates');
    expect(Array.isArray(output.report.gates)).toBe(true);
    for (const gate of output.report.gates) {
      expect(gate).toHaveProperty('barCount');
      expect(gate).toHaveProperty('scrollFrameMs');
      expect(gate).toHaveProperty('verdict');
    }
  });

  it('report has an overall verdict string', () => {
    const noop = () => {};
    const output = StressTest.runFullBenchmark(noop, {
      tiers: [100],
      durationMs: 50,
    });
    expect(typeof output.report.verdict).toBe('string');
    expect(output.report.verdict).toMatch(/PASS|FAIL/);
  });

  it('PERFORMANCE_GATES has entries for 1K, 10K, 100K', () => {
    const gates = StressTest.PERFORMANCE_GATES;
    expect(gates[1000]).toBeDefined();
    expect(gates[10000]).toBeDefined();
    expect(gates[100000]).toBeDefined();
    expect(gates[1000].maxFrameMs).toBe(5);
    expect(gates[10000].maxFrameMs).toBe(8);
    expect(gates[100000].maxFrameMs).toBe(12);
  });
});

// ═══════════════════════════════════════════════════════════════════
// StressTest — Report Generation
// ═══════════════════════════════════════════════════════════════════

describe('StressTest — generateReport', () => {
  let StressTest;

  beforeAll(async () => {
    ({ StressTest } = await import('../../charting_library/perf/StressTest.js'));
  });

  it('handles empty results gracefully', () => {
    const report = StressTest.generateReport([]);
    expect(report.results).toEqual([]);
    expect(report.summary).toBeNull();
  });

  it('sorts results by bar count ascending', () => {
    const results = [
      { barCount: 10000, ttfpMs: 2, scrollFps: 120, scrollFrameMs: 4, zoomFps: 100, zoomFrameMs: 5, computeMs: 1 },
      { barCount: 1000, ttfpMs: 1, scrollFps: 200, scrollFrameMs: 2, zoomFps: 180, zoomFrameMs: 3, computeMs: 0.5 },
    ];
    const report = StressTest.generateReport(results);
    expect(report.results[0].barCount).toBe(1000);
    expect(report.results[1].barCount).toBe(10000);
  });

  it('summary has fastest, slowest, avgTtfp, avgScrollFps', () => {
    const results = [
      { barCount: 1000, ttfpMs: 1, scrollFps: 200, scrollFrameMs: 2, zoomFps: 180, zoomFrameMs: 3, computeMs: 0.5 },
    ];
    const report = StressTest.generateReport(results);
    expect(report.summary).toHaveProperty('fastest');
    expect(report.summary).toHaveProperty('slowest');
    expect(report.summary).toHaveProperty('avgTtfp');
    expect(report.summary).toHaveProperty('avgScrollFps');
  });
});

// ═══════════════════════════════════════════════════════════════════
// AI Disclaimer Coverage (Task 2.1.2)
// ═══════════════════════════════════════════════════════════════════

describe('2.1.2 — AI disclaimer present in all AI output modules', () => {
  const AI_FILES = [
    { path: 'charting_library/ai/AIChartAnalysis.js', name: 'AIChartAnalysis' },
    { path: 'charting_library/ai/AITradeCoach.js', name: 'AITradeCoach' },
    { path: 'charting_library/ai/CoachingEngine.js', name: 'CoachingEngine' },
    { path: 'charting_library/ai/JournalSummarizer.js', name: 'JournalSummarizer' },
    { path: 'charting_library/ai/PreTradeAnalyzer.js', name: 'PreTradeAnalyzer' },
  ];

  for (const { path: filePath, name } of AI_FILES) {
    it(`${name} includes AI_DISCLAIMER in output`, () => {
      const src = readSource(filePath);
      expect(src).toContain('AI_DISCLAIMER');
      expect(src).toContain('disclaimer');
    });
  }

  it('AI_DISCLAIMER constant contains the required text', () => {
    const src = readSource('charting_library/ai/AIChartAnalysis.js');
    expect(src).toContain('Educational analysis only');
    expect(src).toContain('not financial advice');
  });

  it('AITradeCoach createDefaultGrade includes disclaimer', () => {
    const src = readSource('charting_library/ai/AITradeCoach.js');
    const defaultGradeSection = src.slice(
      src.indexOf('function createDefaultGrade'),
      src.indexOf('export { GRADE_COLORS')
    );
    expect(defaultGradeSection).toContain('disclaimer');
  });
});
