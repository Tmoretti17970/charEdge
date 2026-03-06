// ═══════════════════════════════════════════════════════════════════
// charEdge — WebGLRenderer
//
// GPU-accelerated chart rendering via WebGL 2.
// Renders candlesticks and volume bars as instanced geometry,
// achieving 10,000+ candles @ 60fps with minimal CPU overhead.
//
// Architecture:
//   - Single draw call for ALL visible candles (instanced rendering)
//   - Per-instance attributes: position, OHLC, color
//   - Vertex shader transforms OHLC → screen coordinates
//   - Automatic fallback to Canvas 2D if WebGL unavailable
//
// This is a HYBRID renderer: it renders geometric primitives via
// WebGL and composites with Canvas 2D text/UI layers.
// ═══════════════════════════════════════════════════════════════════

import { TextAtlas } from '../gpu/TextAtlas.js';
import { ShaderLibrary } from '../gpu/ShaderLibrary.js';
import { drawCandles as _drawCandles, updateLastCandle as _updateLastCandle } from './CandleRenderer.ts';
import type { CandleParams, CandleTheme, CandleBar } from './CandleRenderer.ts';
import { drawVolume as _drawVolume, updateLastVolume as _updateLastVolume } from './VolumeRenderer.ts';
import { drawLine as _drawLine, drawArea as _drawArea, drawAALine as _drawAALine } from './LineRenderer.ts';
import { drawVolumeProfile as _drawVolumeProfile, drawHeatmap as _drawHeatmap } from './ProfileRenderer.ts';
import { drawFibFill as _drawFibFill } from './FibRenderer.ts';
import { drawGrid as _drawGrid } from './GridRenderer.ts';
import { drawSDFText as _drawSDFText, measureSDFText as _measureSDFText, drawIndicatorLines as _drawIndicatorLines } from './TextRenderer.ts';

// ─── Shader Sources (extracted to shaders/ directory) ──────────
import { logger } from '../../utils/logger';
import {
  CANDLE_VERT, CANDLE_FRAG,
  VOLUME_VERT, VOLUME_FRAG,
  LINE_VERT, LINE_FRAG,
  AA_LINE_VERT, AA_LINE_FRAG,
  VPROFILE_VERT, VPROFILE_FRAG,
  HEATMAP_VERT, HEATMAP_FRAG,
  FIB_FILL_VERT, FIB_FILL_FRAG,
} from './shaders/index.js';

// ─── Types ────────────────────────────────────────────────────

/** GPU buffer collection keyed by purpose. */
interface GPUBuffers {
  quad: WebGLBuffer;
  candleInstances: WebGLBuffer;
  volumeInstances: WebGLBuffer;
  lineVertices: WebGLBuffer;
  aaLineVertices: WebGLBuffer;
  vprofileInstances: WebGLBuffer;
  heatmapInstances: WebGLBuffer;
  fibFillInstances: WebGLBuffer;
  [key: string]: WebGLBuffer;
}

/** GPU window stats for perf dashboard. */
interface GPUWindowStats {
  uploaded: number;
  capped: number;
  windowSize: number;
}

/** Volume render parameters. */
interface VolumeParams {
  pixelRatio: number;
  barSpacing: number;
  volTop: number;
  volH: number;
  [key: string]: unknown;
}

/** Volume theme colors. */
interface VolumeTheme {
  bullVolume?: string;
  bearVolume?: string;
  [key: string]: unknown;
}

/** Point for line/AA line rendering. */
interface Point2D {
  x: number;
  y: number;
}

/** Volume profile row. */
interface VolumeProfileRow {
  priceY: number;
  volume: number;
  isPoc: boolean;
}

/** Heatmap cell. */
interface HeatmapCell {
  x: number;
  y: number;
  w: number;
  h: number;
  intensity: number;
}

/** Fibonacci zone. */
interface FibZone {
  left: number;
  top: number;
  width: number;
  height: number;
  color: string;
  alpha: number;
}

/** SDF text entry. */
interface SDFTextEntry {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: Float32Array | number[];
  align?: string;
}

/** Indicator series for GPU line rendering. */
interface IndicatorSeries {
  values: number[] | Float32Array;
  color: string;
  lineWidth?: number;
  dash?: number[];
}

/** Generic render params shared across draw methods. */
interface RenderParams {
  pixelRatio: number;
  barSpacing?: number;
  startIdx?: number;
  endIdx?: number;
  timeTransform?: { indexToPixel: (idx: number) => number } | null;
  priceToY?: (price: number) => number;
  mainH?: number;
  [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════
// WebGLRenderer Class
//
// Phase 1.1.4: Virtual bar window — GPU instance buffers are capped
// at GPU_WINDOW_SIZE. This ensures memory-constant rendering:
// 1M bars loaded → only viewport-visible bars in GPU memory.
// ═══════════════════════════════════════════════════════════════

// Maximum instance count for GPU buffers.
// Enough for ~1024 visible candles × 2 (wick + body) with headroom.
// Buffers never grow beyond this — excess bars are clamped.
const GPU_WINDOW_SIZE = 2048;

export class WebGLRenderer {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext | null;
  _shaderLib: ShaderLibrary | null;
  _buffers: Partial<GPUBuffers>;
  _available: boolean;
  _maxInstances: number;
  _textAtlas: TextAtlas | null;

  // Phase 3 Task 3.1.9: GPU context loss recovery
  private _contextLostHandler: ((e: Event) => void) | null;
  private _contextRestoredHandler: (() => void) | null;
  private _contextLost: boolean;

  // Instance data arrays
  _candleData!: Float32Array;
  _volumeData!: Float32Array;
  _lineData!: Float32Array;
  _aaLineData!: Float32Array;
  _vprofileData!: Float32Array;
  _heatmapData!: Float32Array;
  _fibFillData!: Float32Array;

  // GPU window stats
  _gpuWindowStats: GPUWindowStats;

  // Pan-only redraw state
  _lastPanOffset: number;
  _lastCandleInstanceCount: number;
  _lastVolumeInstanceCount: number;
  _lastCandleParams!: CandleParams & { mainH: number };
  _lastCandleTheme!: CandleTheme;
  _lastVolumeParams!: VolumeParams;
  _lastVolumeTheme!: VolumeTheme;
  _lastVolumeMaxVol!: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.gl = null;
    this._shaderLib = null;
    this._buffers = {};
    this._available = false;
    this._maxInstances = 0;
    this._textAtlas = null;

    // Phase 3 Task 3.1.9: GPU context loss state
    this._contextLost = false;
    this._contextLostHandler = null;
    this._contextRestoredHandler = null;

    // Phase 1.1.4: Virtual bar window stats for perf dashboard
    this._gpuWindowStats = { uploaded: 0, capped: 0, windowSize: GPU_WINDOW_SIZE };

    // Sprint 3: GPU-translated panning
    this._lastPanOffset = 0;
    this._lastCandleInstanceCount = 0;
    this._lastVolumeInstanceCount = 0;

    this._init();
  }

  get available(): boolean {
    return this._available;
  }

  // ─── Initialization ─────────────────────────────────────────

  private _init(): void {
    try {
      const gl = this.canvas.getContext('webgl2', {
        alpha: true,
        premultipliedAlpha: false,
        antialias: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      });

      if (!gl) {
        logger.engine.warn('[WebGLRenderer] WebGL 2 not available, falling back to Canvas 2D');
        return;
      }

      this.gl = gl;
      this._available = true;

      // Enable blending for transparency
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      // Register shader programs via ShaderLibrary (compile-on-demand)
      this._shaderLib = new ShaderLibrary(gl);
      this._shaderLib.register('candle', CANDLE_VERT, CANDLE_FRAG);
      this._shaderLib.register('volume', VOLUME_VERT, VOLUME_FRAG);
      this._shaderLib.register('line', LINE_VERT, LINE_FRAG);
      this._shaderLib.register('aaLine', AA_LINE_VERT, AA_LINE_FRAG);
      this._shaderLib.register('vprofile', VPROFILE_VERT, VPROFILE_FRAG);
      this._shaderLib.register('heatmap', HEATMAP_VERT, HEATMAP_FRAG);
      this._shaderLib.register('fibFill', FIB_FILL_VERT, FIB_FILL_FRAG);

      // Create quad geometry (shared by all instanced draws)
      this._createQuadBuffer();

      // Pre-allocate instance buffers
      this._maxInstances = 4096;
      this._createInstanceBuffers();

      // Phase 3 Task 3.1.10: Shader warm-up — eagerly compile all programs
      // to eliminate first-render stutter from lazy compilation.
      this._warmUpShaders();

      // Phase 3 Task 3.1.9: GPU context loss/restoration handlers
      this._setupContextRecovery();

    } catch (err: unknown) {
      logger.engine.warn('[WebGLRenderer] Init failed:', (err as Error).message);
      this._available = false;
    }
  }

  // ─── Phase 3: GPU Context Recovery ──────────────────────────

  /**
   * Listen for WebGL context loss and automatically re-initialize.
   * Mobile GPUs and driver updates can trigger context loss.
   */
  private _setupContextRecovery(): void {
    this._contextLostHandler = (e: Event) => {
      e.preventDefault(); // Prevents default 'context is gone forever' behavior
      this._contextLost = true;
      this._available = false;
      logger.engine.warn('[WebGLRenderer] GPU context lost — will attempt recovery');
    };

    this._contextRestoredHandler = () => {
      logger.engine.info('[WebGLRenderer] GPU context restored — re-initializing');
      this._contextLost = false;
      // Re-init from scratch: new GL state, new shaders, new buffers
      this._init();
    };

    this.canvas.addEventListener('webglcontextlost', this._contextLostHandler);
    this.canvas.addEventListener('webglcontextrestored', this._contextRestoredHandler);
  }

  /** Whether the GPU context has been lost. */
  get contextLost(): boolean {
    return this._contextLost;
  }

  // ─── Phase 3: Shader Warm-Up ────────────────────────────────

  /**
   * Eagerly compile all registered shader programs at init.
   * This prevents the first-render stutter caused by lazy compilation.
   */
  private _warmUpShaders(): void {
    if (!this._shaderLib) return;
    const programs = ['candle', 'volume', 'line', 'aaLine', 'vprofile', 'heatmap', 'fibFill'];
    for (const name of programs) {
      this._shaderLib.get(name); // Triggers compile-on-first-access
    }
  }

  // ─── Shader Access ──────────────────────────────────────────

  /**
   * Set per-frame shared uniforms (resolution, pixelRatio).
   * Call once per frame before any draw methods.
   */
  setFrameUniforms(width: number, height: number, pixelRatio: number): void {
    if (this._shaderLib) {
      this._shaderLib.setFrameUniforms(width, height, pixelRatio);
    }
  }

  /**
   * Get a compiled shader program by name.
   */
  getProgram(name: string): WebGLProgram | null {
    return this._shaderLib ? this._shaderLib.get(name) : null;
  }

  // ─── Buffer Setup ───────────────────────────────────────────

  private _createQuadBuffer(): void {
    const gl = this.gl!;
    // Unit quad: 2 triangles making a rectangle
    const quadVerts = new Float32Array([
      0, 0, 1, 0, 0, 1,  // triangle 1
      1, 0, 1, 1, 0, 1,  // triangle 2
    ]);
    this._buffers.quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.quad);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);
  }

  private _createInstanceBuffers(): void {
    const gl = this.gl!;
    const n = this._maxInstances;

    // Candle instances: x, open, high, low, close, isBull, isWick
    this._candleData = new Float32Array(n * 7);
    this._buffers.candleInstances = gl.createBuffer()!;

    // Volume instances: x, volume, isBull
    this._volumeData = new Float32Array(n * 3);
    this._buffers.volumeInstances = gl.createBuffer()!;

    // Line vertices
    this._lineData = new Float32Array(n * 2);
    this._buffers.lineVertices = gl.createBuffer()!;

    // AA line vertices: per-vertex = posA(2) + posB(2) + side(1) + miter(1) = 6 floats
    // 4 vertices per segment, (n-1) segments max
    this._aaLineData = new Float32Array(n * 4 * 6);
    this._buffers.aaLineVertices = gl.createBuffer()!;

    // Volume profile instances: y, width, height, intensity, isPoc = 5 floats
    this._vprofileData = new Float32Array(n * 5);
    this._buffers.vprofileInstances = gl.createBuffer()!;

    // Heatmap instances: x, y, cellW, cellH, intensity = 5 floats
    this._heatmapData = new Float32Array(n * 5);
    this._buffers.heatmapInstances = gl.createBuffer()!;

    // Fib fill instances: left, top, w, h, r, g, b, a = 8 floats
    this._fibFillData = new Float32Array(n * 8);
    this._buffers.fibFillInstances = gl.createBuffer()!;
  }

  /**
   * Phase 1.1.4: Virtual bar window — capped GPU buffer management.
   * Buffers grow up to GPU_WINDOW_SIZE but never beyond.
   * If count exceeds window size, callers clamp their instance data.
   */
  _ensureCapacity(count: number): number {
    // Track stats for performance dashboard
    this._gpuWindowStats.uploaded = count;

    // Clamp to GPU window size — never allocate more than needed
    const capped = Math.min(count, GPU_WINDOW_SIZE);
    if (capped > this._maxInstances) {
      this._maxInstances = Math.min(Math.max(capped, this._maxInstances * 2), GPU_WINDOW_SIZE);
      this._candleData = new Float32Array(this._maxInstances * 7);
      this._volumeData = new Float32Array(this._maxInstances * 3);
      this._lineData = new Float32Array(this._maxInstances * 2);
      this._aaLineData = new Float32Array(this._maxInstances * 4 * 6);
      this._vprofileData = new Float32Array(this._maxInstances * 5);
      this._heatmapData = new Float32Array(this._maxInstances * 5);
      this._fibFillData = new Float32Array(this._maxInstances * 8);
    }

    if (count > GPU_WINDOW_SIZE) {
      this._gpuWindowStats.capped++;
    }

    return capped;
  }

  // ─── Candlestick Rendering ──────────────────────────────────

  /**
   * Draw candlesticks via WebGL instanced rendering.
   * Single draw call for ALL visible candles.
   */
  drawCandles(bars: CandleBar[], params: CandleParams, theme: CandleTheme): void {
    _drawCandles(this as any, bars, params, theme);
  }

  /**
   * Update only the last candle's instance data via bufferSubData.
   * Avoids full buffer re-upload on live ticks (~16ms → ~0.5ms).
   */
  updateLastCandle(bar: CandleBar, params: CandleParams, theme: CandleTheme): boolean {
    return _updateLastCandle(this as any, bar, params, theme);
  }

  // ─── Volume Rendering ──────────────────────────────────────

  /** Draw volume bars via WebGL. */
  drawVolume(bars: CandleBar[], params: RenderParams, theme: VolumeTheme): void {
    _drawVolume(this as any, bars, params, theme);
  }

  /**
   * Update only the last volume bar's instance data via bufferSubData.
   * Task 2.3.13: Avoids full volume buffer re-upload on live ticks.
   */
  updateLastVolume(bar: CandleBar, params: RenderParams, theme: VolumeTheme): boolean {
    return _updateLastVolume(this as any, bar, params, theme);
  }

  // ─── Sprint 3: GPU-Translated Pan-Only Redraw ────────────────
  /**
   * Re-issues candle + volume draw calls using the EXISTING GPU buffer
   * data, only changing the u_panOffset uniform. This avoids the expensive
   * instance data rebuild + upload that dominates pan frame time.
   *
   * @returns True if pan-only redraw was successful
   */
  redrawWithPanOffset(panOffsetPx: number, overrides: { yMin?: number; yMax?: number } = {}): boolean {
    if (!this._available) return false;
    if (!this._lastCandleInstanceCount) return false;

    const gl = this.gl!;
    const cW = this.canvas.width;
    const cH = this.canvas.height;

    // NOTE: Do NOT clear here — the pipeline's centralized webgl.clear()
    // handles clearing before flushing the command buffer.
    gl.viewport(0, 0, cW, cH);

    // ── Redraw candles with pan offset ──
    const candleProg = this._shaderLib!.get('candle');
    if (candleProg && this._lastCandleInstanceCount > 0) {
      const p = this._lastCandleParams;
      const pr = p.pixelRatio;
      const mainH = p.mainH;

      gl.useProgram(candleProg);
      gl.uniform2f(gl.getUniformLocation(candleProg, 'u_resolution'), cW, cH);
      gl.uniform1f(gl.getUniformLocation(candleProg, 'u_bodyWidth'), Math.max(1, p.barSpacing * 0.35 * pr));
      gl.uniform1f(gl.getUniformLocation(candleProg, 'u_wickWidth'), Math.max(0.5, pr * 0.5));
      gl.uniform1f(gl.getUniformLocation(candleProg, 'u_yMin'), overrides.yMin ?? p.yMin);
      gl.uniform1f(gl.getUniformLocation(candleProg, 'u_yMax'), overrides.yMax ?? p.yMax);
      gl.uniform1f(gl.getUniformLocation(candleProg, 'u_mainH'), mainH * pr);
      gl.uniform1f(gl.getUniformLocation(candleProg, 'u_panOffset'), panOffsetPx);
      gl.uniform1f(gl.getUniformLocation(candleProg, 'u_hollow'), this._lastCandleParams?.hollow ? 1.0 : 0.0);

      const t = this._lastCandleTheme;
      gl.uniform4fv(gl.getUniformLocation(candleProg, 'u_bullColor'), this._parseColor(t.bullCandle || '#26A69A'));
      gl.uniform4fv(gl.getUniformLocation(candleProg, 'u_bearColor'), this._parseColor(t.bearCandle || '#EF5350'));

      // Bind quad
      const aPos = gl.getAttribLocation(candleProg, 'a_position');
      gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.quad!);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(aPos, 0);

      // Bind existing instance buffer (NO re-upload)
      gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.candleInstances!);
      const stride = 7 * 4;
      const candleAttrs = ['a_x', 'a_open', 'a_high', 'a_low', 'a_close', 'a_isBull', 'a_isWick'];
      for (let i = 0; i < candleAttrs.length; i++) {
        const loc = gl.getAttribLocation(candleProg, candleAttrs[i]);
        if (loc >= 0) {
          gl.enableVertexAttribArray(loc);
          gl.vertexAttribPointer(loc, 1, gl.FLOAT, false, stride, i * 4);
          gl.vertexAttribDivisor(loc, 1);
        }
      }

      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this._lastCandleInstanceCount);

      for (const attr of candleAttrs) {
        const loc = gl.getAttribLocation(candleProg, attr);
        if (loc >= 0) gl.vertexAttribDivisor(loc, 0);
      }
    }

    // ── Redraw volume with pan offset ──
    const volProg = this._shaderLib!.get('volume');
    if (volProg && this._lastVolumeInstanceCount > 0) {
      const v = this._lastVolumeParams;
      const pr = v.pixelRatio;

      gl.useProgram(volProg);
      gl.uniform2f(gl.getUniformLocation(volProg, 'u_resolution'), cW, cH);
      gl.uniform1f(gl.getUniformLocation(volProg, 'u_bodyWidth'), Math.max(1, v.barSpacing! * 0.35 * pr));
      gl.uniform1f(gl.getUniformLocation(volProg, 'u_maxVolume'), this._lastVolumeMaxVol);
      gl.uniform1f(gl.getUniformLocation(volProg, 'u_volumeTop'), v.volTop);
      gl.uniform1f(gl.getUniformLocation(volProg, 'u_volumeHeight'), v.volH);
      gl.uniform1f(gl.getUniformLocation(volProg, 'u_panOffset'), panOffsetPx);

      const t = this._lastVolumeTheme;
      gl.uniform4fv(gl.getUniformLocation(volProg, 'u_bullColor'), this._parseColor(t.bullVolume || '#26A69A80'));
      gl.uniform4fv(gl.getUniformLocation(volProg, 'u_bearColor'), this._parseColor(t.bearVolume || '#EF535080'));

      const aPos = gl.getAttribLocation(volProg, 'a_position');
      gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.quad!);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(aPos, 0);

      // Bind existing volume buffer (NO re-upload)
      gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.volumeInstances!);
      const stride = 3 * 4;
      const volAttrs = ['a_x', 'a_volume', 'a_isBull'];
      for (let i = 0; i < volAttrs.length; i++) {
        const loc = gl.getAttribLocation(volProg, volAttrs[i]);
        if (loc >= 0) {
          gl.enableVertexAttribArray(loc);
          gl.vertexAttribPointer(loc, 1, gl.FLOAT, false, stride, i * 4);
          gl.vertexAttribDivisor(loc, 1);
        }
      }

      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this._lastVolumeInstanceCount);

      for (const attr of volAttrs) {
        const loc = gl.getAttribLocation(volProg, attr);
        if (loc >= 0) gl.vertexAttribDivisor(loc, 0);
      }
    }

    this._lastPanOffset = panOffsetPx;
    return true;
  }

  // ─── Line Chart Rendering ──────────────────────────────────

  /**
   * Draw a line chart via WebGL (GL_LINE_STRIP).
   * Use for line charts and indicator overlay lines.
   */
  drawLine(bars: CandleBar[], params: RenderParams, color: string, lineWidth: number = 2): void {
    _drawLine(this as any, bars, params, color, lineWidth);
  }

  // ─── Area Chart Rendering ──────────────────────────────────

  /**
   * Draw an area chart via WebGL (TRIANGLE_STRIP + LINE_STRIP).
   * Renders a filled area below the line with gradient-like opacity.
   */
  drawArea(bars: CandleBar[], params: RenderParams, lineColor: string, fillColor: string): void {
    _drawArea(this as any, bars, params, lineColor, fillColor);
  }

  // ─── Anti-Aliased Line Rendering ──────────────────────────

  /**
   * Draw an anti-aliased line via triangle-strip expansion.
   * Produces sub-pixel smooth lines that look better than Canvas2D.
   */
  drawAALine(points: Point2D[], color: string, lineWidth: number = 2): void {
    _drawAALine(this as any, points, color, lineWidth);
  }

  // ─── Volume Profile Rendering ──────────────────────────────

  /**
   * Draw a volume profile histogram via WebGL instanced horizontal bars.
   */
  drawVolumeProfile(rows: VolumeProfileRow[], params: RenderParams, theme: Record<string, unknown>): void {
    _drawVolumeProfile(this as any, rows, params, theme);
  }

  // ─── Heatmap Rendering ─────────────────────────────────────

  /**
   * Draw a heatmap via WebGL instanced color-gradient quads.
   */
  drawHeatmap(cells: HeatmapCell[], params: RenderParams, theme: Record<string, unknown>): void {
    _drawHeatmap(this as any, cells, params, theme);
  }

  // ─── Fibonacci Fill Rendering ──────────────────────────────

  /**
   * Draw Fibonacci zone fills via WebGL instanced quads.
   */
  drawFibFill(zones: FibZone[], params: { pixelRatio: number }): void {
    _drawFibFill(this as any, zones, params);
  }

  // ─── SDF Text Rendering ─────────────────────────────────────

  /**
   * Draw text entries via GPU SDF text atlas.
   */
  drawSDFText(entries: SDFTextEntry[], params: { pixelRatio: number }): void {
    _drawSDFText(this as any, entries, params, TextAtlas);
  }

  /**
   * Measure text width using the SDF atlas (CSS pixels).
   */
  measureSDFText(text: string, fontSize: number): number {
    return _measureSDFText(this as any, text, fontSize);
  }

  // ─── GPU Indicator Lines ─────────────────────────────────────

  /**
   * Draw multiple indicator overlay line series via GPU anti-aliased lines.
   */
  drawIndicatorLines(seriesArray: IndicatorSeries[], params: RenderParams): void {
    _drawIndicatorLines(this as any, seriesArray, params);
  }

  // ─── GPU Grid Lines ────────────────────────────────────────────

  /**
   * Draw all grid lines (horizontal + vertical) via GPU instanced quads.
   */
  drawGrid(gridData: Record<string, unknown>, params: RenderParams, theme: Record<string, unknown>): void {
    _drawGrid(this as any, gridData, params, theme);
  }

  // ─── Clear ──────────────────────────────────────────────────

  clear(): void {
    if (!this._available) return;
    const gl = this.gl!;
    gl.clearColor(0, 0, 0, 0); // transparent clear
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  // ─── Resize ─────────────────────────────────────────────────

  resize(width: number, height: number): void {
    if (!this._available) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl!.viewport(0, 0, width, height);
  }

  // ─── Utilities ──────────────────────────────────────────────

  /**
   * Parse CSS color string to [r, g, b, a] normalized floats.
   */
  _parseColor(color: string): Float32Array {
    const result = new Float32Array([0, 0, 0, 1]);
    if (!color) return result;

    // Handle rgba
    const rgbaMatch = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (rgbaMatch) {
      result[0] = parseInt(rgbaMatch[1]) / 255;
      result[1] = parseInt(rgbaMatch[2]) / 255;
      result[2] = parseInt(rgbaMatch[3]) / 255;
      result[3] = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1;
      return result;
    }

    // Handle hex
    let hex = color.replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    if (hex.length >= 6) {
      result[0] = parseInt(hex.slice(0, 2), 16) / 255;
      result[1] = parseInt(hex.slice(2, 4), 16) / 255;
      result[2] = parseInt(hex.slice(4, 6), 16) / 255;
      if (hex.length === 8) {
        result[3] = parseInt(hex.slice(6, 8), 16) / 255;
      }
    }
    return result;
  }

  // ─── Cleanup ────────────────────────────────────────────────

  dispose(): void {
    // Phase 3: Remove context recovery listeners
    if (this._contextLostHandler) {
      this.canvas.removeEventListener('webglcontextlost', this._contextLostHandler);
      this._contextLostHandler = null;
    }
    if (this._contextRestoredHandler) {
      this.canvas.removeEventListener('webglcontextrestored', this._contextRestoredHandler);
      this._contextRestoredHandler = null;
    }

    if (!this.gl) return;
    const gl = this.gl;

    for (const name in this._buffers) {
      gl.deleteBuffer(this._buffers[name]!);
    }
    if (this._shaderLib) {
      this._shaderLib.dispose();
      this._shaderLib = null;
    }
    if (this._textAtlas) {
      this._textAtlas.dispose();
      this._textAtlas = null;
    }

    this.gl = null;
    this._available = false;
  }
}
