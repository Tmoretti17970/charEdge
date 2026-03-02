import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Imports ────────────────────────────────────────────────────
import { RenderProfiler } from '../charting_library/perf/RenderProfiler.js';
import { StressTest } from '../charting_library/perf/StressTest.js';
import { QualityBenchmark } from '../charting_library/perf/QualityBenchmark.js';
import { ChartPerfMonitor } from '../charting_library/core/ChartPerfMonitor.js';

// ═══════════════════════════════════════════════════════════════════
// RenderProfiler Tests
// ═══════════════════════════════════════════════════════════════════

describe('RenderProfiler', () => {
  let profiler;

  beforeEach(() => {
    profiler = new RenderProfiler({ maxFrames: 5 });
  });

  it('starts with empty frames', () => {
    expect(profiler.getLastFrame()).toBeNull();
    expect(profiler.getFrames()).toEqual([]);
    expect(profiler.getSummary().frameCount).toBe(0);
  });

  it('records a complete frame', () => {
    profiler.beginFrame();
    profiler.beginStage('grid');
    profiler.endStage('grid');
    profiler.beginStage('data');
    profiler.endStage('data');
    profiler.trackDrawCall();
    profiler.trackDrawCall();
    profiler.trackBufferUpload();
    profiler.endFrame();

    const last = profiler.getLastFrame();
    expect(last).not.toBeNull();
    expect(last.totalMs).toBeGreaterThanOrEqual(0);
    expect(last.drawCalls).toBe(2);
    expect(last.bufferUploads).toBe(1);
    expect(last.stages.grid).toBeDefined();
    expect(last.stages.grid.durationMs).toBeGreaterThanOrEqual(0);
    expect(last.stages.data).toBeDefined();
  });

  it('ring buffer evicts old frames', () => {
    for (let i = 0; i < 8; i++) {
      profiler.beginFrame();
      profiler.endFrame();
    }

    // maxFrames = 5, so only 5 remain
    expect(profiler.getFrames().length).toBe(5);
  });

  it('getSummary computes averages correctly', () => {
    for (let i = 0; i < 3; i++) {
      profiler.beginFrame();
      profiler.trackDrawCall();
      profiler.beginStage('grid');
      profiler.endStage('grid');
      profiler.endFrame();
    }

    const summary = profiler.getSummary();
    expect(summary.frameCount).toBe(3);
    expect(summary.avgTotalMs).toBeGreaterThanOrEqual(0);
    expect(summary.avgDrawCalls).toBe(1);
    expect(summary.stageAvgs.grid).toBeGreaterThanOrEqual(0);
  });

  it('exportJSON produces serializable output', () => {
    profiler.beginFrame();
    profiler.beginStage('data');
    profiler.endStage('data');
    profiler.endFrame();

    const json = profiler.exportJSON();
    expect(json.exportedAt).toBeDefined();
    expect(json.maxFrames).toBe(5);
    expect(json.frames.length).toBe(1);
    expect(json.frames[0].stages.data).toBeGreaterThanOrEqual(0);

    // Verify it's truly JSON-serializable
    const str = JSON.stringify(json);
    expect(() => JSON.parse(str)).not.toThrow();
  });

  it('reset clears all data', () => {
    profiler.beginFrame();
    profiler.endFrame();
    profiler.reset();

    expect(profiler.getFrames()).toEqual([]);
    expect(profiler.getLastFrame()).toBeNull();
    expect(profiler.getSummary().frameCount).toBe(0);
  });

  it('dispose releases resources', () => {
    profiler.beginFrame();
    profiler.endFrame();
    profiler.dispose();

    expect(profiler.getFrames()).toEqual([]);
    expect(profiler.gpuTimingAvailable).toBe(false);
  });

  it('state change tracking works', () => {
    profiler.beginFrame();
    profiler.trackStateChange();
    profiler.trackStateChange();
    profiler.trackStateChange();
    profiler.endFrame();

    expect(profiler.getLastFrame().stateChanges).toBe(3);
  });

  it('initGPUTiming returns false without GL', () => {
    expect(profiler.initGPUTiming(null)).toBe(false);
    expect(profiler.gpuTimingAvailable).toBe(false);
  });

  it('beginStage/endStage are no-ops when frame not active', () => {
    profiler.beginStage('grid');
    profiler.endStage('grid');
    // No error, no frame recorded
    expect(profiler.getLastFrame()).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════
// StressTest Tests
// ═══════════════════════════════════════════════════════════════════

describe('StressTest', () => {
  it('generateBars creates correct number of bars', () => {
    const bars = StressTest.generateBars(100);
    expect(bars.length).toBe(100);

    for (const b of bars) {
      expect(b.open).toBeGreaterThan(0);
      expect(b.high).toBeGreaterThanOrEqual(Math.max(b.open, b.close));
      expect(b.low).toBeLessThanOrEqual(Math.min(b.open, b.close));
      expect(b.volume).toBeGreaterThan(0);
      expect(b.time).toBeGreaterThan(0);
    }
  });

  it('generateBars returns empty for count <= 0', () => {
    expect(StressTest.generateBars(0)).toEqual([]);
    expect(StressTest.generateBars(-5)).toEqual([]);
  });

  it('generateBars produces deterministic output (seeded)', () => {
    const a = StressTest.generateBars(50);
    const b = StressTest.generateBars(50);
    expect(a[0].open).toBe(b[0].open);
    expect(a[49].close).toBe(b[49].close);
  });

  it('generateBars respects custom options', () => {
    const bars = StressTest.generateBars(10, {
      startPrice: 50000,
      baseVolume: 500,
      intervalMs: 300000,
    });
    expect(bars[0].open).toBe(50000);
    expect(bars[1].time - bars[0].time).toBe(300000);
  });

  it('measure returns valid result object', () => {
    const st = new StressTest();
    const bars = StressTest.generateBars(500);
    const renderFn = vi.fn();

    const result = st.measure(bars, renderFn, {
      durationMs: 100,
      viewportBars: 50,
    });

    expect(result.barCount).toBe(500);
    expect(result.ttfpMs).toBeGreaterThanOrEqual(0);
    expect(result.scrollFps).toBeGreaterThan(0);
    expect(result.zoomFps).toBeGreaterThan(0);
    expect(result.computeMs).toBeGreaterThanOrEqual(0);
    expect(result.timestamp).toBeGreaterThan(0);
    expect(renderFn).toHaveBeenCalled();
  });

  it('measure accumulates results', () => {
    const st = new StressTest();
    const renderFn = vi.fn();

    st.measure(StressTest.generateBars(100), renderFn, { durationMs: 50 });
    st.measure(StressTest.generateBars(200), renderFn, { durationMs: 50 });

    expect(st.getResults().length).toBe(2);
  });

  it('generateReport creates sorted comparison', () => {
    const results = [
      { barCount: 1000, ttfpMs: 2, scrollFps: 60, scrollFrameMs: 16, zoomFps: 55, zoomFrameMs: 18, computeMs: 1 },
      { barCount: 100, ttfpMs: 0.5, scrollFps: 60, scrollFrameMs: 16, zoomFps: 60, zoomFrameMs: 16, computeMs: 0.1 },
    ];

    const report = StressTest.generateReport(results);
    expect(report.results.length).toBe(2);
    expect(report.results[0].barCount).toBe(100); // sorted ascending
    expect(report.results[1].barCount).toBe(1000);
    expect(report.summary.fastest).toBe(100);
    expect(report.summary.slowest).toBe(1000);
  });

  it('generateReport handles empty input', () => {
    const report = StressTest.generateReport([]);
    expect(report.results).toEqual([]);
    expect(report.summary).toBeNull();
  });

  it('reset clears results', () => {
    const st = new StressTest();
    st.measure(StressTest.generateBars(50), vi.fn(), { durationMs: 50 });
    st.reset();
    expect(st.getResults()).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// QualityBenchmark Tests
// ═══════════════════════════════════════════════════════════════════

describe('QualityBenchmark', () => {
  function makeImageData(w, h, fill = 0) {
    const data = new Uint8ClampedArray(w * h * 4);
    if (fill) data.fill(fill);
    return { width: w, height: h, data };
  }

  it('captureSnapshot from raw ImageData', () => {
    const qb = new QualityBenchmark();
    const source = makeImageData(10, 10, 128);
    const snap = qb.captureSnapshot(source, { name: 'test', dpr: 2 });

    expect(snap.name).toBe('test');
    expect(snap.width).toBe(10);
    expect(snap.height).toBe(10);
    expect(snap.config.dpr).toBe(2);
    expect(snap.data.length).toBe(400);
    expect(snap.timestamp).toBeGreaterThan(0);
  });

  it('captureSnapshot stores a copy (not a reference)', () => {
    const qb = new QualityBenchmark();
    const source = makeImageData(2, 2, 100);
    const snap = qb.captureSnapshot(source);

    // Modify original
    source.data[0] = 255;
    expect(snap.data[0]).toBe(100); // snapshot is unchanged
  });

  it('captureSnapshot throws on invalid source', () => {
    const qb = new QualityBenchmark();
    expect(() => qb.captureSnapshot(null)).toThrow();
    expect(() => qb.captureSnapshot(42)).toThrow();
  });

  it('compareSnapshots: identical images pass', () => {
    const a = { width: 2, height: 2, data: new Uint8ClampedArray([100, 100, 100, 255, 100, 100, 100, 255, 100, 100, 100, 255, 100, 100, 100, 255]) };
    const b = { width: 2, height: 2, data: new Uint8ClampedArray(a.data) };

    const result = QualityBenchmark.compareSnapshots(a, b);
    expect(result.mse).toBe(0);
    expect(result.maxDelta).toBe(0);
    expect(result.diffPixelCount).toBe(0);
    expect(result.pass).toBe(true);
  });

  it('compareSnapshots: different images fail', () => {
    const a = { width: 2, height: 2, data: new Uint8ClampedArray(16).fill(0) };
    const b = { width: 2, height: 2, data: new Uint8ClampedArray(16).fill(255) };

    const result = QualityBenchmark.compareSnapshots(a, b);
    expect(result.mse).toBeGreaterThan(0);
    expect(result.maxDelta).toBe(255);
    expect(result.diffPixelCount).toBe(4);
    expect(result.pass).toBe(false);
  });

  it('compareSnapshots: size mismatch fails', () => {
    const a = { width: 2, height: 2, data: new Uint8ClampedArray(16) };
    const b = { width: 4, height: 4, data: new Uint8ClampedArray(64) };

    const result = QualityBenchmark.compareSnapshots(a, b);
    expect(result.pass).toBe(false);
    expect(result.mse).toBe(Infinity);
  });

  it('compareSnapshots: null inputs fail', () => {
    expect(QualityBenchmark.compareSnapshots(null, null).pass).toBe(false);
    expect(QualityBenchmark.compareSnapshots(null, { width: 1, height: 1, data: new Uint8ClampedArray(4) }).pass).toBe(false);
  });

  it('compareSnapshots: empty (0×0) passes', () => {
    const a = { width: 0, height: 0, data: new Uint8ClampedArray(0) };
    const b = { width: 0, height: 0, data: new Uint8ClampedArray(0) };
    expect(QualityBenchmark.compareSnapshots(a, b).pass).toBe(true);
  });

  it('compareSnapshots: respects custom thresholds', () => {
    // Use a 10x10 image with 1 pixel changed — diffRatio = 1% (within default 0.5%? no, 1% > 0.5%)
    // Use a large-enough image so the ratio is under threshold
    const size = 10 * 10; // 100 pixels
    const dataA = new Uint8ClampedArray(size * 4).fill(100);
    const dataB = new Uint8ClampedArray(dataA);
    dataB[0] = 101; // Change 1 channel of 1 pixel

    const a = { width: 10, height: 10, data: dataA };
    const b = { width: 10, height: 10, data: dataB };

    // Lenient thresholds should pass (1 pixel out of 100 = 1%, MSE tiny, maxDelta = 1)
    const pass = QualityBenchmark.compareSnapshots(a, b, { diffPixelRatio: 0.02, mseThreshold: 1, maxDeltaThreshold: 5 });
    expect(pass.pass).toBe(true);

    // Strict thresholds should fail
    const fail = QualityBenchmark.compareSnapshots(a, b, { maxDeltaThreshold: 0 });
    expect(fail.pass).toBe(false);
  });

  it('runBatch matches by name and reports results', () => {
    const qb = new QualityBenchmark();
    const golden = [
      { name: 'test1', width: 1, height: 1, data: new Uint8ClampedArray([0, 0, 0, 255]) },
      { name: 'test2', width: 1, height: 1, data: new Uint8ClampedArray([100, 100, 100, 255]) },
    ];
    const current = [
      { name: 'test1', width: 1, height: 1, data: new Uint8ClampedArray([0, 0, 0, 255]) },
      // test2 is missing
    ];

    const batch = qb.runBatch(golden, current);
    expect(batch.results.length).toBe(2);
    expect(batch.results[0].pass).toBe(true);
    expect(batch.results[1].pass).toBe(false);
    expect(batch.results[1].error).toBe('missing');
    expect(batch.allPassed).toBe(false);
  });

  it('getSnapshots returns all captured', () => {
    const qb = new QualityBenchmark();
    qb.captureSnapshot(makeImageData(2, 2), { name: 'a' });
    qb.captureSnapshot(makeImageData(2, 2), { name: 'b' });
    expect(qb.getSnapshots().length).toBe(2);
  });

  it('getSnapshotByName finds by name', () => {
    const qb = new QualityBenchmark();
    qb.captureSnapshot(makeImageData(2, 2), { name: 'target' });
    expect(qb.getSnapshotByName('target')).not.toBeNull();
    expect(qb.getSnapshotByName('nonexistent')).toBeNull();
  });

  it('reset clears snapshots', () => {
    const qb = new QualityBenchmark();
    qb.captureSnapshot(makeImageData(2, 2));
    qb.reset();
    expect(qb.getSnapshots()).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// ChartPerfMonitor (Phase 5 Enhancements) Tests
// ═══════════════════════════════════════════════════════════════════

describe('ChartPerfMonitor - Phase 5 Enhancements', () => {
  let monitor;

  beforeEach(() => {
    monitor = new ChartPerfMonitor();
  });

  it('initGPUTiming returns false without GL', () => {
    expect(monitor.initGPUTiming(null)).toBe(false);
    expect(monitor.gpuTimingSupported).toBe(false);
  });

  it('initGPUTiming detects extension availability', () => {
    const mockGL = {
      getExtension: vi.fn(() => ({ TIME_ELAPSED_EXT: 0x88BF, GPU_DISJOINT_EXT: 0x8FBB })),
    };
    expect(monitor.initGPUTiming(mockGL)).toBe(true);
    expect(monitor.gpuTimingSupported).toBe(true);
  });

  it('GPU query methods are no-ops without init', () => {
    // Should not throw
    monitor.beginGPUQuery();
    monitor.endGPUQuery();
    expect(monitor.readGPUTime()).toBeNull();
  });

  it('beginStage/endStage tracks stage timings', () => {
    monitor.beginStage('grid');
    // Small delay simulation
    const start = performance.now();
    while (performance.now() - start < 1) { /* busy wait */ }
    monitor.endStage('grid');

    const timings = monitor.getStageTimings();
    expect(timings.grid).toBeGreaterThanOrEqual(0);
  });

  it('endStage without beginStage is a no-op', () => {
    monitor.endStage('unknown');
    expect(monitor.getStageTimings().unknown).toBeUndefined();
  });

  it('memory tracking accumulates', () => {
    monitor.trackBufferAllocation(1024);
    monitor.trackBufferAllocation(2048);
    monitor.trackTextureMemory(4096);
    monitor.trackCanvasMemory(8192);

    const mem = monitor.getMemoryStats();
    expect(mem.bufferAllocations).toBe(3072);
    expect(mem.textureMemoryBytes).toBe(4096);
    expect(mem.canvasMemoryBytes).toBe(8192);
  });

  it('getReport includes Phase 5 fields', () => {
    monitor.beginStage('data');
    monitor.endStage('data');
    monitor.trackBufferAllocation(512);

    const report = monitor.getReport();
    expect(report.gpuTimeMs).toBeNull(); // No GPU init
    expect(report.stageTimings).toBeDefined();
    expect(report.stageTimings.data).toBeGreaterThanOrEqual(0);
    expect(report.memory).toBeDefined();
    expect(report.memory.bufferAllocations).toBe(512);

    // Backward compat: original fields still present
    expect(report.fps).toBeDefined();
    expect(report.avgFrameTime).toBeDefined();
    expect(report.metrics).toBeDefined();
    expect(report.diagnostics).toBeDefined();
  });

  it('reset clears Phase 5 state', () => {
    monitor.beginStage('grid');
    monitor.endStage('grid');
    monitor.trackBufferAllocation(1024);
    monitor.trackTextureMemory(2048);

    monitor.reset();

    expect(monitor.getStageTimings()).toEqual({});
    expect(monitor.getMemoryStats().bufferAllocations).toBe(0);
    expect(monitor.getMemoryStats().textureMemoryBytes).toBe(0);
  });

  it('trackRender still works (backward compat)', () => {
    monitor.trackRender('drawCalls', 5);
    expect(monitor.metrics.drawCalls).toBe(5);
    monitor.trackRender('nonExistent', 99);
    expect(monitor.metrics.nonExistent).toBeUndefined();
  });
});
