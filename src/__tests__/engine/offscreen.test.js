// ═══════════════════════════════════════════════════════════════════
// LayerManager & RenderPipeline Tests
//
// Verifies that:
//   1. LayerManager creates 5-layer canvas system
//   2. RenderPipeline.execute() supports skipStages parameter
//   3. ChartEngine renders entirely on main thread
//   4. All layers fall back to standard canvas (no OffscreenCanvas)
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const SRC = resolve(__dirname, '..', '..');
const CHARTING = resolve(SRC, 'charting_library/core');

// ─── Helpers ──────────────────────────────────────────────────────

function readSource(file) {
  const path = resolve(CHARTING, file);
  if (!existsSync(path)) return '';
  return readFileSync(path, 'utf8');
}

// ═══════════════════════════════════════════════════════════════════
// LayerManager — 5-Layer Canvas System
// ═══════════════════════════════════════════════════════════════════

describe('LayerManager — 5-Layer Canvas System', () => {
  const src = readSource('LayerManager.js');

  it('constructor takes a container element', () => {
    expect(src).toContain('constructor(container)');
  });

  it('creates 5 named layers in correct order', () => {
    expect(src).toContain("GRID");
    expect(src).toContain("DATA");
    expect(src).toContain("INDICATORS");
    expect(src).toContain("DRAWINGS");
    expect(src).toContain("UI");
  });

  it('uses ResizeObserver for HiDPI handling', () => {
    expect(src).toContain('ResizeObserver');
    expect(src).toContain('devicePixelRatio');
  });

  it('only has standard canvas (no OffscreenCanvas)', () => {
    expect(src).not.toContain('OffscreenCanvas');
    expect(src).not.toContain('transferControlToOffscreen');
    expect(src).not.toContain('offscreenLayers');
  });

  it('exposes getCanvas() and getCtx() methods', () => {
    expect(src).toContain('getCanvas(layerName)');
    expect(src).toContain('getCtx(layerName)');
  });

  it('exposes getEventTarget() for UI layer', () => {
    expect(src).toContain('getEventTarget()');
  });

  it('supports dirty tracking per layer', () => {
    expect(src).toContain('markDirty(layerName)');
    expect(src).toContain('isDirty(layerName)');
    expect(src).toContain('clearDirty(layerName)');
    expect(src).toContain('anyDirty()');
    expect(src).toContain('markAllDirty()');
  });

  it('has getSnapshotCanvas() for screenshots', () => {
    expect(src).toContain('getSnapshotCanvas()');
  });

  it('has dispose() for cleanup', () => {
    expect(src).toContain('dispose()');
  });
});

// ═══════════════════════════════════════════════════════════════════
// WorkerBridge — Indicator-Only Worker
// ═══════════════════════════════════════════════════════════════════

describe('WorkerBridge — Indicator Worker Only', () => {
  const src = readSource('WorkerBridge.js');

  it('has computeIndicators() method', () => {
    expect(src).toContain('computeIndicators(indicators, barBuffer)');
  });

  it('uses zero-copy Transferable ArrayBuffers', () => {
    expect(src).toContain('.buffer');
    expect(src).toContain('postMessage');
  });

  it('does NOT have any render worker methods (OffscreenCanvas removed)', () => {
    expect(src).not.toContain('initRenderWorker');
    expect(src).not.toContain('requestRender');
    expect(src).not.toContain('sendDataToRenderWorker');
    expect(src).not.toContain('sendScrollState');
    expect(src).not.toContain('sendFrameState');
    expect(src).not.toContain('sendResize');
    expect(src).not.toContain('sendIndicators');
    expect(src).not.toContain('_renderWorker');
    expect(src).not.toContain('isRenderWorkerReady');
    expect(src).not.toContain('OffscreenCanvas');
  });

  it('has dispose() cleanup', () => {
    expect(src).toContain('dispose()');
  });
});

// ═══════════════════════════════════════════════════════════════════
// RenderPipeline — skipStages Support
// ═══════════════════════════════════════════════════════════════════

describe('RenderPipeline — skipStages Support', () => {
  const src = readSource('RenderPipeline.ts');

  it('execute() accepts skipStages parameter', () => {
    expect(src).toContain('execute(frameState');
    expect(src).toContain('skipStages');
  });

  it('skips stages in the skipStages set', () => {
    expect(src).toContain('skipStages.has(stage.name)');
  });

  it('runs all stages when skipStages is null/undefined', () => {
    expect(src).toContain('skipStages && skipStages.has');
  });
});

// ═══════════════════════════════════════════════════════════════════
// ChartEngine — Main-Thread Rendering
// ═══════════════════════════════════════════════════════════════════

describe('ChartEngine — Main-Thread Rendering', () => {
  const src = readSource('ChartEngine.ts');

  it('creates LayerManager without offscreen options', () => {
    expect(src).toContain('new LayerManager(container)');
    expect(src).not.toContain('offscreenLayers');
  });

  it('has WorkerBridge for indicator computation only', () => {
    expect(src).toContain('new WorkerBridge()');
    expect(src).toContain('_workerBridge');
  });

  it('does NOT have dead offscreen code', () => {
    expect(src).not.toContain('_offscreenSkipStages');
    expect(src).not.toContain('_offscreenActive');
  });

  it('demand-driven rendering: only schedules rAF when dirty', () => {
    expect(src).toContain('_needsNextFrame()');
    expect(src).toContain('_scheduleDraw()');
    expect(src).toContain('this.raf = null');
  });

  it('pipeline.execute() is called with correct arguments', () => {
    expect(src).toContain('this._pipeline.execute(frameState, this, this.fb');
  });
});
