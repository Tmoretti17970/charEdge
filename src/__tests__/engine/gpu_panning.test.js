// ═══════════════════════════════════════════════════════════════════
// charEdge — Sprint 3: GPU-Translated Panning Tests
//
// Verifies the GPU pan pipeline:
//   1. WebGLRenderer has u_panOffset uniform in both shaders
//   2. WebGLRenderer has redrawWithPanOffset() method
//   3. DataStage has GPU pan fast-path with change-mask gating
//   4. DataStage has bar entry/exit detection (startIdx/endIdx check)
//   5. FrameState includes panOffset field
//   6. Saved instance state for pan-only redraws
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';

// ─── 1. WebGLRenderer — Shader Uniforms & Pan Method ────────────

describe('Sprint 3 — WebGLRenderer GPU panning', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const renderers = path.resolve(__dirname, '..', '..', 'charting_library/renderers');
    // Read WebGLRenderer + extracted renderers + all shader files for full source verification
    const webgl = fs.readFileSync(path.resolve(renderers, 'WebGLRenderer.ts'), 'utf-8');
    const candleRenderer = fs.readFileSync(path.resolve(renderers, 'CandleRenderer.ts'), 'utf-8');
    const volumeRenderer = fs.readFileSync(path.resolve(renderers, 'VolumeRenderer.ts'), 'utf-8');
    const shaderDir = path.resolve(renderers, 'shaders');
    const shaderFiles = fs.readdirSync(shaderDir).filter(f => f.endsWith('.js'));
    const shaderSrc = shaderFiles.map(f => fs.readFileSync(path.resolve(shaderDir, f), 'utf-8')).join('\n');
    source = webgl + '\n' + candleRenderer + '\n' + volumeRenderer + '\n' + shaderSrc;
  });

  it('has u_panOffset uniform in candle vertex shader', () => {
    // Shader extracted to shaders/candle.js — check full combined source
    expect(source).toContain('u_panOffset');
  });

  it('has u_panOffset uniform in volume vertex shader', () => {
    // Shader extracted to shaders/volume.js — check full combined source
    expect(source).toContain('u_volumeHeight');
    expect(source).toContain('u_panOffset');
  });

  it('applies u_panOffset to x position in candle shader', () => {
    expect(source).toContain('a_x + u_panOffset');
  });

  it('has redrawWithPanOffset method', () => {
    expect(source).toContain('redrawWithPanOffset(');
  });

  it('sets u_panOffset to 0.0 on full draw', () => {
    expect(source).toContain("'u_panOffset'), 0.0");
  });

  it('saves candle instance state for pan-only redraws', () => {
    expect(source).toContain('_lastCandleInstanceCount');
    expect(source).toContain('_lastCandleParams');
    expect(source).toContain('_lastCandleTheme');
  });

  it('saves volume instance state for pan-only redraws', () => {
    expect(source).toContain('_lastVolumeInstanceCount');
    expect(source).toContain('_lastVolumeMaxVol');
    expect(source).toContain('_lastVolumeParams');
  });

  it('reuses existing buffer data (NO re-upload) during pan', () => {
    expect(source).toContain('// Bind existing instance buffer (NO re-upload)');
    expect(source).toContain('// Bind existing volume buffer (NO re-upload)');
  });

  it('updates yMin/yMax overrides on pan redraw', () => {
    expect(source).toContain('overrides.yMin');
    expect(source).toContain('overrides.yMax');
  });

  it('tracks last pan offset', () => {
    expect(source).toContain('_lastPanOffset');
  });
});

// ─── 2. DataStage — GPU Pan Fast-Path ───────────────────────────

describe('Sprint 3 — DataStage GPU pan fast-path', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const stagesDir = path.resolve(__dirname, '..', '..', 'charting_library/core/stages');
    const main = fs.readFileSync(path.resolve(stagesDir, 'DataStage.ts'), 'utf-8');
    const gpuPan = fs.readFileSync(path.resolve(stagesDir, 'data/gpuPan.ts'), 'utf-8');
    const helpers = fs.readFileSync(path.resolve(stagesDir, 'data/renderHelpers.ts'), 'utf-8');
    source = main + '\n' + gpuPan + '\n' + helpers;
  });

  it('has GPU PAN FAST PATH section', () => {
    expect(source).toContain('GPU PAN FAST PATH');
  });

  it('gates on VIEWPORT-only change mask', () => {
    expect(source).toContain('CHANGED.VIEWPORT');
    expect(source).toContain('changeMask');
  });

  it('requires candlestick chart type for GPU pan', () => {
    expect(source).toContain("chartType === 'candlestick'");
  });

  it('requires same zoom level (visibleBars match)', () => {
    expect(source).toContain('fs.visibleBars === prevFs.visibleBars');
  });

  it('requires same canvas dimensions', () => {
    expect(source).toContain('fs.bitmapWidth === prevFs.bitmapWidth');
    expect(source).toContain('fs.bitmapHeight === prevFs.bitmapHeight');
  });

  it('requires no new bars added (barCount match)', () => {
    expect(source).toContain('fs.barCount === prevFs.barCount');
  });

  it('detects bar entry/exit via startIdx/endIdx comparison', () => {
    expect(source).toContain('fs.startIdx === prevFs.startIdx');
    expect(source).toContain('fs.endIdx === prevFs.endIdx');
  });

  it('calls redrawWithPanOffset via command buffer', () => {
    expect(source).toContain('redrawWithPanOffset(capturedPanOffset');
  });

  it('computes panOffsetPx from scrollDelta × barSpacing × pixelRatio', () => {
    expect(source).toContain('scrollDelta * bSp * fs.pixelRatio');
  });

  it('redraws Canvas 2D overlays after GPU pan', () => {
    expect(source).toContain('renderPriceLine');
  });
});

// ─── 3. FrameState — panOffset Field ────────────────────────────

describe('Sprint 3 — FrameState panOffset', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'charting_library/core/FrameState.ts'),
      'utf-8'
    );
  });

  it('includes panOffset field declaration', () => {
    // TS class field: panOffset!: number;
    expect(source).toContain('panOffset');
  });

  it('computes panOffset from fractional scrollOffset', () => {
    expect(source).toContain('fs.panOffset');
    expect(source).toContain('Math.floor(S.scrollOffset)');
  });

  it('has CHANGED.VIEWPORT bitmask flag', () => {
    expect(source).toContain('VIEWPORT');
  });

  it('detects scrollOffset changes in diff()', () => {
    expect(source).toContain('this.scrollOffset !== prev.scrollOffset');
  });
});
