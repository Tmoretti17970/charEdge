// ═══════════════════════════════════════════════════════════════════
// charEdge — Phase 1 Render Engine Wiring Tests
//
// Verifies:
//   1.1.1 Render-on-demand (no continuous rAF)
//   1.1.2 Incremental bar append (blit-pan)
//   1.1.3 Pre-rasterize static layers (grid/axes cache)
//   1.1.4 Virtual bar window (GPU buffer management)
//   1.2.3 Zero-copy worker transfer (Transferable ArrayBuffers)
// ═══════════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, beforeEach } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── 1.1.1 Render-on-Demand ────────────────────────────────────

describe('Phase 1.1.1 — Render-on-demand (kill continuous rAF)', () => {
  let engineSource;

  beforeEach(() => {
    engineSource = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'charting_library/core/ChartEngine.ts'),
      'utf-8'
    );
  });

  it('renderLoop does NOT unconditionally call requestAnimationFrame at start', () => {
    // The old pattern was: this.raf = requestAnimationFrame(this.renderLoop)
    // as the very first line of renderLoop(). This should no longer exist.
    const renderLoopMatch = engineSource.match(/renderLoop\(\)\s*\{[\s\S]*?this\.raf\s*=\s*requestAnimationFrame\(this\.renderLoop\)/);
    expect(renderLoopMatch).toBeNull();
  });

  it('renderLoop clears raf reference at entry', () => {
    expect(engineSource).toContain('this.raf = null; // Clear pending rAF reference');
  });

  it('has _scheduleDraw() method that gates rAF scheduling', () => {
    expect(engineSource).toContain('_scheduleDraw()');
    expect(engineSource).toContain('if (!this.raf)');
  });

  it('has _needsNextFrame() method for conditional scheduling', () => {
    expect(engineSource).toContain('_needsNextFrame()');
    // Should check dirty flags
    expect(engineSource).toContain('this.state.mainDirty || this.state.topDirty');
    // Should check animation state (FormingCandleInterpolator)
    expect(engineSource).toContain('this._formingInterpolator.isDone');
    // Should check live chart types
    expect(engineSource).toContain("this.props.showHeatmap || this.props.chartType === 'footprint'");
  });

  it('constructor uses _scheduleDraw() instead of direct renderLoop()', () => {
    // The old code had: this.renderLoop(); as a direct call in constructor
    // New code should have: this._scheduleDraw();
    const constructorSection = engineSource.split('renderLoop = this.renderLoop.bind(this);')[1]?.slice(0, 200) || '';
    expect(constructorSection).toContain('this._scheduleDraw()');
    expect(constructorSection).not.toContain('this.renderLoop()');
  });

  it('markDirty() calls _scheduleDraw()', () => {
    const markDirtySection = engineSource.match(/^\s{2}markDirty\(\)[\s\S]*?\{[\s\S]*?\n\s{2}\}/m)?.[0] || '';
    expect(markDirtySection).toContain('this._scheduleDraw()');
  });

  it('setData() calls _scheduleDraw()', () => {
    // setData sets mainDirty and topDirty, then calls _scheduleDraw
    // Find the setData method body (between setData and the next method)
    const setDataStart = engineSource.indexOf('setData(bars');
    const setDataEnd = engineSource.indexOf('setIndicators(', setDataStart);
    const setDataSection = engineSource.slice(setDataStart, setDataEnd);
    expect(setDataSection).toContain('this._scheduleDraw()');
  });

  it('setIndicators() calls _scheduleDraw()', () => {
    const start = engineSource.indexOf('setIndicators(indicators');
    const end = engineSource.indexOf('setProps(', start);
    const section = engineSource.slice(start, end);
    expect(section).toContain('this._scheduleDraw()');
  });

  it('setAlerts() calls _scheduleDraw()', () => {
    const section = engineSource.match(/setAlerts\(alerts[\s\S]*?\{[\s\S]*?\n\s*\}/)?.[0] || '';
    expect(section).toContain('this._scheduleDraw()');
  });

  it('setSyncedCrosshair() calls _scheduleDraw()', () => {
    const section = engineSource.match(/setSyncedCrosshair\(data[\s\S]*?\{[\s\S]*?\n\s*\}/)?.[0] || '';
    expect(section).toContain('this._scheduleDraw()');
  });

  it('countdown uses DOM overlay instead of canvas repaint (Sprint 18 #115)', () => {
    // Sprint 18 #115: Countdown is now a DOM overlay (CountdownOverlay).
    // The setInterval only increments _countdownTick for memory pressure counting.
    // It should NOT call _scheduleDraw() or markDirty() anymore.
    const intervalSection = engineSource.match(/_countdownInterval\s*=\s*setInterval[\s\S]*?\},\s*1000\)/)?.[0] || '';
    expect(intervalSection).not.toContain('this._scheduleDraw()');
    expect(intervalSection).not.toContain('markDirty');
    // Verify CountdownOverlay is imported and instantiated
    expect(engineSource).toContain("import { CountdownOverlay }");
    expect(engineSource).toContain("new CountdownOverlay(container)");
  });

  it('renderLoop conditionally reschedules at end', () => {
    // After pipeline.execute, should check _needsNextFrame() before scheduling
    expect(engineSource).toContain('if (this._needsNextFrame())');
    // The _scheduleDraw() call should come after _needsNextFrame() check
    const endSection = engineSource.match(/_needsNextFrame\(\)\)\s*\{[\s\S]*?_scheduleDraw/)?.[0] || '';
    expect(endSection).toBeTruthy();
  });
});

// ─── 1.2.3 Zero-Copy Worker Transfer ───────────────────────────

describe('Phase 1.2.3 — Zero-copy worker transfer (Transferable ArrayBuffers)', () => {
  let bridgeSource;

  beforeEach(() => {
    bridgeSource = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'charting_library/core/WorkerBridge.js'),
      'utf-8'
    );
  });

  it('computeIndicators does NOT use buffer.slice(0)', () => {
    const section = bridgeSource.match(/computeIndicators[\s\S]*?\n\s*\}/m)?.[0] || '';
    expect(section).not.toContain('.buffer.slice(0)');
  });

  it('computeIndicators uses direct buffer references', () => {
    expect(bridgeSource).toContain('barBuffer.time.buffer,');
    expect(bridgeSource).toContain('barBuffer.open.buffer,');
    expect(bridgeSource).toContain('barBuffer.close.buffer,');
  });

  it('postMessage includes Transferable array', () => {
    // Should have transfer list: [data.time, data.open, ...]
    expect(bridgeSource).toContain('[data.time, data.open, data.high, data.low, data.close, data.volume]');
  });

  it('has zero-copy documentation comment', () => {
    expect(bridgeSource).toContain('Zero-copy transfer via Transferable ArrayBuffers');
  });
});

// ─── 1.1.2 Incremental Bar Append (Blit-Pan) ──────────────────

describe('Phase 1.1.2 — Incremental bar append (blit-pan)', () => {
  let frameStateSource, dataStageSource, pipelineSource, engineSource;

  beforeEach(() => {
    frameStateSource = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'charting_library/core/FrameState.ts'),
      'utf-8'
    );
    dataStageSource = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'charting_library/core/stages/DataStage.ts'),
      'utf-8'
    );
    pipelineSource = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'charting_library/core/RenderPipeline.ts'),
      'utf-8'
    );
    engineSource = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'charting_library/core/ChartEngine.ts'),
      'utf-8'
    );
  });

  // ─── FrameState ────────────────────────────────────────────

  it('FrameState exports CHANGED.TICK flag at bit 9', () => {
    expect(frameStateSource).toContain('TICK:');
    expect(frameStateSource).toContain('1 << 9');
  });

  it('CHANGED.ALL includes TICK (0x3FF)', () => {
    expect(frameStateSource).toContain('0x3FF');
  });

  it('FrameState.create captures isTickUpdate and lastBarClose', () => {
    expect(frameStateSource).toContain('fs.isTickUpdate');
    expect(frameStateSource).toContain('fs.lastBarClose');
  });

  it('FrameState.diff distinguishes TICK from DATA', () => {
    // Tick detection: same bar count but last bar changed
    expect(frameStateSource).toContain('CHANGED.TICK');
    // Should check isTickUpdate or lastBarClose difference
    expect(frameStateSource).toContain('this.isTickUpdate || this.lastBarClose !== prev.lastBarClose');
  });

  // ─── DataStage ─────────────────────────────────────────────

  // TODO: un-skip when DataStage imports CHANGED from FrameState (Task 2.1)
  it.skip('DataStage imports CHANGED from FrameState', () => {
    expect(dataStageSource).toContain("import { CHANGED } from '../../FrameState.ts'");
  });

  it('DataStage has tick-update fast path', () => {
    // Should detect tick-only frames via changeMask
    expect(dataStageSource).toContain('TICK-UPDATE FAST PATH');
    expect(dataStageSource).toContain('isTickOnly');
    // Should only clear last 2 bars region, not full canvas
    expect(dataStageSource).toContain('vis.slice(penultIdx)');
  });

  it('DataStage has GPU pan fast path with redrawWithPanOffset', () => {
    expect(dataStageSource).toContain('GPU PAN FAST PATH');
    expect(dataStageSource).toContain('redrawWithPanOffset');
    // Should calculate scroll delta for pan offset
    expect(dataStageSource).toContain('scrollDelta');
  });

  it('DataStage has extracted renderPriceLine helper', () => {
    expect(dataStageSource).toContain('function renderPriceLine');
    // Both fast paths and full redraw should call it
    const matches = dataStageSource.match(/renderPriceLine\(/g);
    expect(matches?.length).toBeGreaterThanOrEqual(3); // definition + tick path + blit path + full
  });

  it('DataStage full-redraw path is preserved as fallback', () => {
    expect(dataStageSource).toContain('FULL REDRAW');
    // clearRect should be scoped to chart area (cBW, mainBH) not full bitmap (bw, bh)
    expect(dataStageSource).toContain('mCtx.clearRect(0, 0, cBW, mainBH)');
  });

  // ─── RenderPipeline ────────────────────────────────────────

  it('RenderPipeline routes TICK to data stage', () => {
    expect(pipelineSource).toContain('CHANGED.TICK');
    // Data stage mask should include TICK
    const dataStageRegistration = pipelineSource.match(/addStage\('data'[\s\S]*?\)/)?.[0] || '';
    expect(dataStageRegistration).toContain('CHANGED.TICK');
  });

  it('Grid stage does NOT respond to TICK changes', () => {
    const gridStageRegistration = pipelineSource.match(/addStage\('grid'[\s\S]*?\)/)?.[0] || '';
    expect(gridStageRegistration).not.toContain('CHANGED.TICK');
  });

  // ─── ChartEngine ───────────────────────────────────────────

  it('ChartEngine tracks _tickUpdate in setData', () => {
    expect(engineSource).toContain('this._tickUpdate');
    // Tick = same bar count
    const setDataSection = engineSource.match(/setData\(bars[\s\S]*?setIndicators/)?.[0] || '';
    expect(setDataSection).toContain('_tickUpdate');
  });
});

// ─── 1.1.3 Pre-rasterize Static Layers (Grid/Axes Cache) ──────

describe('Phase 1.1.3 — Pre-rasterize static layers (grid/axes cache)', () => {
  let gridSource, axesSource;

  beforeEach(() => {
    gridSource = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'charting_library/core/stages/GridStage.ts'),
      'utf-8'
    );
    axesSource = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'charting_library/core/stages/AxesStage.ts'),
      'utf-8'
    );
  });

  // ─── GridStage ──────────────────────────────────────────────

  it('GridStage has _gridCache module-level variable', () => {
    expect(gridSource).toContain('let _gridCache');
    expect(gridSource).toContain("key: ''");
  });

  it('GridStage builds cache key from rendering inputs', () => {
    expect(gridSource).toContain('function _gridCacheKey');
    // Key should include dimensions + theme + viewport inputs
    expect(gridSource).toContain('fs.bitmapWidth');
    expect(gridSource).toContain('fs.symbol');
  });

  it('GridStage uses drawImage() on cache hit', () => {
    expect(gridSource).toContain('CACHE HIT');
    expect(gridSource).toContain('gCtx.drawImage(_gridCache.canvas, 0, 0)');
  });

  it('GridStage renders to offscreen canvas on cache miss', () => {
    expect(gridSource).toContain('Cache Miss');
    expect(gridSource).toContain('OffscreenCanvas');
    // Should render to oCtx (offscreen context)
    expect(gridSource).toContain('oCtx.fillStyle');
    expect(gridSource).toContain('oCtx.fillRect');
  });

  it('GridStage exports invalidateGridCache()', () => {
    expect(gridSource).toContain('export function invalidateGridCache');
  });

  // ─── AxesStage ─────────────────────────────────────────────

  it('AxesStage has _axesCache module-level variable', () => {
    expect(axesSource).toContain('let _axesCache');
    expect(axesSource).toContain("key: ''");
  });

  it('AxesStage uses drawImage() for cached static labels', () => {
    expect(axesSource).toContain('CACHE HIT');
    expect(axesSource).toContain('mCtx.drawImage(_axesCache.canvas, 0, 0)');
  });

  it('AxesStage always renders dynamic price badge fresh (not cached)', () => {
    expect(axesSource).toContain('DYNAMIC ELEMENTS');
    expect(axesSource).toContain('Current Price Badge');
    // Price badge should use mCtx directly, not oCtx
    const dynamicSection = axesSource.split('DYNAMIC ELEMENTS')[1] || '';
    expect(dynamicSection).toContain('mCtx.fillText(badgeStr');
  });

  it('AxesStage exports invalidateAxesCache()', () => {
    expect(axesSource).toContain('export function invalidateAxesCache');
  });
});

// ─── 1.1.4 Virtual Bar Window (GPU Buffer Management) ──────────

describe('Phase 1.1.4 — Virtual bar window (GPU buffer management)', () => {
  let rendererSource;

  beforeEach(() => {
    rendererSource = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'charting_library/renderers/WebGLRenderer.ts'),
      'utf-8'
    ) + '\n' + fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'charting_library/renderers/CandleRenderer.ts'),
      'utf-8'
    );
  });

  it('defines GPU_WINDOW_SIZE constant', () => {
    expect(rendererSource).toContain('const GPU_WINDOW_SIZE');
    expect(rendererSource).toContain('2048');
  });

  it('_ensureCapacity clamps to GPU_WINDOW_SIZE', () => {
    expect(rendererSource).toContain('Math.min(count, GPU_WINDOW_SIZE)');
  });

  it('_ensureCapacity returns the capped count', () => {
    expect(rendererSource).toContain('return capped');
  });

  it('tracks GPU window stats for perf dashboard', () => {
    expect(rendererSource).toContain('_gpuWindowStats');
    expect(rendererSource).toContain('uploaded');
    expect(rendererSource).toContain('windowSize: GPU_WINDOW_SIZE');
  });

  it('drawCandles clamps bar count to GPU window', () => {
    expect(rendererSource).toContain('maxBars');
    expect(rendererSource).toContain('barCount');
    expect(rendererSource).toContain('Math.min(bars.length, maxBars)');
  });
});
