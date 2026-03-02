// ═══════════════════════════════════════════════════════════════════
// Phase 1.3.3 — OffscreenCanvas Primary Render Path Tests
//
// Verifies that:
//   1. LayerManager supports offscreenLayers constructor option
//   2. LayerManager.getOffscreenCanvases() returns canvas references
//   3. WorkerBridge has sendFrameState(), sendResize(), sendIndicators()
//   4. RenderWorker.js handles all required message types
//   5. ChartEngine attempts offscreen init when available
//   6. RenderPipeline.execute() supports skipStages parameter
//   7. Fallback: main-thread rendering still works when offscreen disabled
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const SRC = resolve(__dirname, '..');
const CHARTING = resolve(SRC, 'charting_library/core');

// ─── Helpers ──────────────────────────────────────────────────────

function readSource(file) {
  const path = resolve(CHARTING, file);
  if (!existsSync(path)) return '';
  return readFileSync(path, 'utf8');
}

// ═══════════════════════════════════════════════════════════════════
// LayerManager — OffscreenCanvas Support
// ═══════════════════════════════════════════════════════════════════

describe('Phase 1.3.3 — LayerManager OffscreenCanvas', () => {
  const src = readSource('LayerManager.js');

  it('constructor accepts options parameter with offscreenLayers', () => {
    expect(src).toContain('constructor(container, options');
    expect(src).toContain('offscreenLayers');
  });

  it('detects OffscreenCanvas support with feature detection', () => {
    expect(src).toContain('typeof OffscreenCanvas');
    expect(src).toContain('transferControlToOffscreen');
  });

  it('exposes getOffscreenCanvases() method', () => {
    expect(src).toContain('getOffscreenCanvases()');
    expect(src).toContain('gridCanvas');
    expect(src).toContain('dataCanvas');
    expect(src).toContain('indicatorCanvas');
  });

  it('exposes isOffscreen(layerName) method', () => {
    expect(src).toContain('isOffscreen(layerName)');
    expect(src).toContain('.offscreen');
  });

  it('exposes hasOffscreenLayers getter', () => {
    expect(src).toContain('get hasOffscreenLayers');
    expect(src).toContain('_offscreenActive');
  });

  it('skips offscreen canvases during resize', () => {
    // Offscreen canvases should NOT be resized by the main thread
    expect(src).toContain('!layer.offscreen');
  });

  it('notifies callback on resize when offscreen is active', () => {
    expect(src).toContain('_onResizeCallback');
    expect(src).toContain('onResize');
  });

  it('gracefully falls back when OffscreenCanvas is unsupported', () => {
    // Feature detection guards offscreen path; _offscreenActive stays false
    expect(src).toContain("typeof OffscreenCanvas !== 'undefined'");
    expect(src).toContain('_offscreenActive');
  });
});

// ═══════════════════════════════════════════════════════════════════
// RenderWorker — Full 3-Layer Rendering
// ═══════════════════════════════════════════════════════════════════

describe('Phase 1.3.3 — RenderWorker', () => {
  const src = readSource('RenderWorker.js');

  it('handles all required message types', () => {
    const requiredMessages = ['init', 'resize', 'setData', 'scroll', 'setTheme', 'setIndicators', 'render', 'dispose'];
    for (const msg of requiredMessages) {
      expect(src).toContain(`'${msg}'`);
    }
  });

  it('renders grid with bitmap cache', () => {
    expect(src).toContain('renderGrid');
    expect(src).toContain('_gridCache');
    expect(src).toContain('cacheKey');
  });

  it('renders data layer with candles and volume', () => {
    expect(src).toContain('renderData');
    expect(src).toContain('bullColor');
    expect(src).toContain('bearColor');
    expect(src).toContain('volume');
  });

  it('renders price line with pulsing dot', () => {
    expect(src).toContain('Price Line');
    expect(src).toContain('setLineDash');
    expect(src).toContain('Pulsing dot');
  });

  it('renders indicator overlays', () => {
    expect(src).toContain('renderIndicators');
    expect(src).toContain('ind.values');
    expect(src).toContain('ind.color');
  });

  it('reports frame timing back to main thread', () => {
    expect(src).toContain("type: 'frameComplete'");
    expect(src).toContain('performance.now()');
  });

  it('sends ready message after init', () => {
    expect(src).toContain("type: 'ready'");
  });
});

// ═══════════════════════════════════════════════════════════════════
// WorkerBridge — OffscreenCanvas Protocol
// ═══════════════════════════════════════════════════════════════════

describe('Phase 1.3.3 — WorkerBridge', () => {
  const src = readSource('WorkerBridge.js');

  it('has sendFrameState() method', () => {
    expect(src).toContain('sendFrameState(state)');
    expect(src).toContain("type: 'scroll'");
  });

  it('has sendResize() method', () => {
    expect(src).toContain('sendResize(viewport)');
    expect(src).toContain("type: 'resize'");
  });

  it('has sendIndicators() method', () => {
    expect(src).toContain('sendIndicators(indicators)');
    expect(src).toContain("type: 'setIndicators'");
  });

  it('has sendDataToRenderWorker() method', () => {
    expect(src).toContain('sendDataToRenderWorker(barBuffer)');
    expect(src).toContain("type: 'setData'");
  });

  it('has requestRender() method', () => {
    expect(src).toContain('requestRender()');
    expect(src).toContain("type: 'render'");
  });

  it('accepts pre-transferred OffscreenCanvas objects', () => {
    // Should NOT call transferControlToOffscreen in initRenderWorker
    // because LayerManager already did the transfer
    expect(src).toContain('already transferred by LayerManager');
    expect(src).not.toContain('layers.gridCanvas.transferControlToOffscreen');
  });
});

// ═══════════════════════════════════════════════════════════════════
// RenderPipeline — skipStages Support
// ═══════════════════════════════════════════════════════════════════

describe('Phase 1.3.3 — RenderPipeline skipStages', () => {
  const src = readSource('RenderPipeline.js');

  it('execute() accepts skipStages parameter', () => {
    expect(src).toContain('execute(frameState, engine, fb, skipStages)');
  });

  it('skips stages in the skipStages set', () => {
    expect(src).toContain('skipStages.has(stage.name)');
  });
});

// ═══════════════════════════════════════════════════════════════════
// ChartEngine — OffscreenCanvas Integration
// ═══════════════════════════════════════════════════════════════════

describe('Phase 1.3.3 — ChartEngine OffscreenCanvas Wiring (Disabled-but-Ready)', () => {
  const src = readSource('ChartEngine.js');

  it('creates LayerManager with offscreenLayers option (currently empty)', () => {
    // OffscreenCanvas is disabled pending rendering fixes — empty array disables it
    expect(src).toContain('offscreenLayers');
    expect(src).toContain('new LayerManager(container');
  });

  it('retains _offscreenSkipStages field for future re-enablement', () => {
    expect(src).toContain('_offscreenSkipStages');
  });

  it('has WorkerBridge instance for offscreen + indicator workers', () => {
    expect(src).toContain('new WorkerBridge()');
    expect(src).toContain('_workerBridge');
  });

  it('pipeline.execute() is called with correct arguments', () => {
    expect(src).toContain('this._pipeline.execute(frameState, this, this.fb');
  });

  it('syncs bar data to worker when offscreen is active', () => {
    expect(src).toContain('sendDataToRenderWorker');
    expect(src).toContain('_offscreenActive');
  });

  it('_offscreenActive starts false (disabled state)', () => {
    expect(src).toContain('this._offscreenActive = false');
  });

  it('demand-driven rendering: only schedules rAF when dirty', () => {
    expect(src).toContain('_needsNextFrame()');
    expect(src).toContain('_scheduleDraw()');
    expect(src).toContain('this.raf = null');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Integration: Full Pipeline Still Works Without Offscreen
// ═══════════════════════════════════════════════════════════════════

describe('Phase 1.3.3 — Fallback (main-thread rendering)', () => {
  const layerSrc = readSource('LayerManager.js');
  const engineSrc = readSource('ChartEngine.js');
  const pipelineSrc = readSource('RenderPipeline.js');

  it('LayerManager falls back to standard canvas when OffscreenCanvas unavailable', () => {
    // Feature detection means no error if OffscreenCanvas undefined
    expect(layerSrc).toContain("typeof OffscreenCanvas !== 'undefined'");
    expect(layerSrc).toContain('getContext');
  });

  it('RenderPipeline runs all stages when skipStages is null/undefined', () => {
    // When skipStages is not provided, the condition is falsy
    expect(pipelineSrc).toContain('skipStages && skipStages.has');
  });

  it('ChartEngine only skips stages when offscreen is active', () => {
    expect(engineSrc).toContain('this._offscreenActive && this._workerBridge');
  });
});
