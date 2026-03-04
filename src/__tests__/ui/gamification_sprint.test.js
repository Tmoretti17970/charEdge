/**
 * Sprint A — Phase A Source Verification Tests
 *
 * Sprint 3: GPU-translated panning (u_panOffset uniform)
 * Sprint 1/8: History loading indicator
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');

function readSrc(rel) {
  return readFileSync(resolve(ROOT, rel), 'utf-8');
}

// Read WebGLRenderer + extracted renderers + all shader files for full source verification
function readWebGLSrc() {
  const renderers = resolve(ROOT, 'charting_library/renderers');
  const webgl = readFileSync(resolve(renderers, 'WebGLRenderer.ts'), 'utf-8');
  const candleRenderer = readFileSync(resolve(renderers, 'CandleRenderer.ts'), 'utf-8');
  const volumeRenderer = readFileSync(resolve(renderers, 'VolumeRenderer.ts'), 'utf-8');
  const shaderDir = resolve(renderers, 'shaders');
  const { readdirSync } = require('fs');
  const shaderFiles = readdirSync(shaderDir).filter(f => f.endsWith('.js'));
  const shaderSrc = shaderFiles.map(f => readFileSync(resolve(shaderDir, f), 'utf-8')).join('\n');
  return webgl + '\n' + candleRenderer + '\n' + volumeRenderer + '\n' + shaderSrc;
}

describe('Sprint 3: GPU-Translated Panning', () => {
  const webglSrc = readWebGLSrc();
  const dataStageSrc = readSrc('charting_library/core/stages/DataStage.ts');

  describe('Vertex Shader Uniforms', () => {
    it('candle vertex shader declares u_panOffset uniform', () => {
      // Should be in the CANDLE_VERT shader string
      expect(webglSrc).toContain('uniform float u_panOffset;');
    });

    it('candle vertex shader applies u_panOffset to x position', () => {
      expect(webglSrc).toContain('a_x + u_panOffset +');
    });

    it('volume vertex shader declares u_panOffset uniform', () => {
      // Two occurrences: candle + volume
      const matches = webglSrc.match(/uniform float u_panOffset;/g);
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('WebGLRenderer Pan-Only Method', () => {
    it('exports redrawWithPanOffset method', () => {
      expect(webglSrc).toContain('redrawWithPanOffset(panOffsetPx');
    });

    it('drawCandles sets u_panOffset to 0.0 during full draw', () => {
      expect(webglSrc).toContain("'u_panOffset'), 0.0");
    });

    it('saves last candle instance count for pan-only redraws', () => {
      expect(webglSrc).toContain('_lastCandleInstanceCount = instanceCount');
    });

    it('saves last candle params for pan-only redraws', () => {
      expect(webglSrc).toContain('_lastCandleParams');
    });

    it('saves last volume instance count for pan-only redraws', () => {
      expect(webglSrc).toContain('_lastVolumeInstanceCount = instanceCount');
    });

    it('redrawWithPanOffset binds existing buffers without re-upload', () => {
      // Should contain comments about NO re-upload
      expect(webglSrc).toContain('NO re-upload');
    });

    it('pan-only path draws using existing instance data', () => {
      expect(webglSrc).toContain('_lastCandleInstanceCount');
      expect(webglSrc).toContain('_lastVolumeInstanceCount');
    });
  });

  describe('DataStage GPU Pan Fast Path', () => {
    it('has GPU PAN FAST PATH section', () => {
      expect(dataStageSrc).toContain('GPU PAN FAST PATH');
    });

    it('checks for viewport-only changes', () => {
      expect(dataStageSrc).toContain('isGpuPanCandidate');
    });

    it('checks same zoom level (visibleBars)', () => {
      expect(dataStageSrc).toContain('fs.visibleBars === prevFs.visibleBars');
    });

    it('checks same bar count (no new data)', () => {
      expect(dataStageSrc).toContain('fs.barCount === prevFs.barCount');
    });

    it('calculates scroll delta for pan offset', () => {
      expect(dataStageSrc).toContain('scrollDelta = fs.scrollOffset - prevFs.scrollOffset');
    });

    it('calls webgl.redrawWithPanOffset', () => {
      expect(dataStageSrc).toContain('webgl.redrawWithPanOffset(panOffsetPx');
    });

    it('still redraws Canvas 2D price line on GPU pan path', () => {
      expect(dataStageSrc).toContain('renderPriceLine(mCtx, bars, p2y');
    });
  });
});

describe('Sprint 1/8: History Loading Indicator', () => {
  const widgetSrc = readSrc('app/components/chart/core/ChartEngineWidget.jsx');

  it('subscribes to historyLoading from store', () => {
    expect(widgetSrc).toContain('historyLoading');
    expect(widgetSrc).toContain("useChartStore((s) => s.historyLoading)");
  });

  it('renders loading indicator when historyLoading is true', () => {
    expect(widgetSrc).toContain('Loading history');
  });

  it('positions indicator at left edge with absolute positioning', () => {
    expect(widgetSrc).toContain("left: 8");
  });

  it('includes spinner animation for loading indicator', () => {
    expect(widgetSrc).toContain('spin .8s linear infinite');
  });
});
