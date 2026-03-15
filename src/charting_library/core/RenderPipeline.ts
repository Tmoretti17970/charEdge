// ═══════════════════════════════════════════════════════════════════
// charEdge — RenderPipeline
//
// Stage-based rendering orchestrator. Replaces the monolithic 900-line
// renderLoop() with a clean, testable pipeline.
//
// Each stage is a pure-ish function:
//   execute(frameState, contexts, engine) → void
//
// Stages are run in order. Each stage checks the FrameState change
// mask to decide whether it needs to repaint its layer(s).
//
// Architecture:
//   ChartEngine.renderLoop() → FrameState.create() → RenderPipeline.execute()
//     → prepareFrame
//     → gridStage       (GRID layer)
//     → dataStage       (DATA layer)
//     → indicatorStage   (INDICATORS layer)
//     → drawingStage     (DRAWINGS layer)
//     → overlayStage     (DATA layer, on top of candles)
//     → uiStage          (UI layer — clears canvas, draws crosshair/tooltip)
//     → axesStage        (UI layer — draws price/time labels ON TOP)
// ═══════════════════════════════════════════════════════════════════

import type { FrameState } from './FrameState.js';
import { CHANGED } from './FrameState.js';
import { LAYERS } from './LayerManager.js';
import { DARK_THEME, LIGHT_THEME } from './ThemeManager.js';
import { RenderCommandBuffer } from '../gpu/RenderCommandBuffer.js';
import { getCSSThemeColors } from './ThemeColors';
import { executeGPUComputeStage } from './stages/GPUComputeStage.js';
import { logger } from '@/observability/logger';
import type { StageEngine } from './stages/StageTypes.js';

// ─── Type Definitions ────────────────────────────────────────────

/** Shared render context passed to every stage. */
export interface RenderContexts {
  gridCtx: CanvasRenderingContext2D;
  dataCtx: CanvasRenderingContext2D;
  indicatorCtx: CanvasRenderingContext2D;
  drawingCtx: CanvasRenderingContext2D;
  uiCtx: CanvasRenderingContext2D;
  layers: unknown;
  theme: ResolvedTheme;
  webgl: unknown;
  webglCanvas: HTMLCanvasElement;
  drawingEngine: unknown;
  drawingRenderer: unknown;
  sceneGraph: unknown;
  commandBuffer: unknown;
  changeMask: number;
}

/** Signature for a stage execution function. */
export type StageFn = (fs: FrameState, ctx: RenderContexts, engine: StageEngine) => void;

/** Entry in the stage registry. */
export interface StageEntry {
  name: string;
  relevantChanges: number;
  execute: StageFn;
}

/** Resolved theme colors. */
export interface ResolvedTheme {
  bg: string;
  fg: string;
  axisBg: string;
  axisText: string;
  gridLine: string;
  gridColor: string;
  crosshairColor: string;
  bullCandle: string;
  bearCandle: string;
  bullVolume: string;
  bearVolume: string;
}

/** Map of stage implementations for createDefaultPipeline. */
export interface StageMap {
  grid: StageFn;
  data: StageFn;
  indicators: StageFn;
  drawings: StageFn;
  overlays: StageFn;
  axes: StageFn;
  ui: StageFn;
}

// ─── Theme Resolution ────────────────────────────────────────────

// Pre-allocated theme object — mutated in place to avoid hidden class churn.
// resolveTheme() is called every frame; spreading created ~128 hidden classes per call.
const _resolved: ResolvedTheme = {
  bg: '', fg: '', axisBg: '', axisText: '',
  gridLine: '', gridColor: '', crosshairColor: '',
  bullCandle: '', bearCandle: '', bullVolume: '', bearVolume: '',
};

/**
 * Resolve the full theme object from FrameState.
 * Merges base theme with user-configured chart colors.
 */
export function resolveTheme(fs: unknown): ResolvedTheme {
  const rawThm = fs.themeName === 'light' ? LIGHT_THEME : DARK_THEME;

  _resolved.bg = rawThm.background;
  _resolved.fg = rawThm.foreground;
  _resolved.axisBg = rawThm.axisBackground;
  _resolved.axisText = rawThm.textSecondary;
  _resolved.gridLine = rawThm.gridColor;
  _resolved.gridColor = rawThm.gridColor;
  _resolved.crosshairColor = rawThm.crosshairColor;
  _resolved.bullCandle = rawThm.candleUp;
  _resolved.bearCandle = rawThm.candleDown;
  _resolved.bullVolume = rawThm.volumeUp;
  _resolved.bearVolume = rawThm.volumeDown;

  // Sprint 7 #60: Apply CSS custom property colors from brand-colors.css.
  // These override the base theme defaults but are themselves overridden by
  // explicit user-configured chart colors (storeChartColors).
  const cssColors = getCSSThemeColors();
  for (const key in cssColors) {
    if (cssColors[key]) {
      (_resolved as unknown)[key] = cssColors[key];
    }
  }

  // Apply user-configured chart colors on top (highest priority).
  // Skip background/grid/crosshair if they match the *opposite* theme's
  // defaults — those are not user customizations, they're just leftovers
  // from localStorage that would override the correct theme colors.
  if (fs.storeChartColors) {
    const cc = fs.storeChartColors;
    const isLight = fs.themeName === 'light';
    // Only apply stored background if it's a genuine user customization,
    // not a default dark/light value that conflicts with the current theme.
    const DARK_BG = '#131722';
    const LIGHT_BG = '#FFFFFF';
    if (cc.background && !(isLight && cc.background === DARK_BG) && !(!isLight && cc.background === LIGHT_BG)) {
      _resolved.bg = cc.background;
    }
    if (cc.candleUp) _resolved.bullCandle = cc.candleUp;
    if (cc.candleDown) _resolved.bearCandle = cc.candleDown;
    if (cc.volumeUp) _resolved.bullVolume = cc.volumeUp;
    if (cc.volumeDown) _resolved.bearVolume = cc.volumeDown;
    if (cc.gridColor) {
      // Skip dark-default grid on light theme
      const DARK_GRID = 'rgba(54, 58, 69, 0.3)';
      if (!(isLight && cc.gridColor === DARK_GRID)) {
        _resolved.gridLine = cc.gridColor;
      }
    }
    if (cc.crosshair) {
      const DARK_CROSSHAIR = 'rgba(149, 152, 161, 0.5)';
      if (!(isLight && cc.crosshair === DARK_CROSSHAIR)) {
        _resolved.crosshairColor = cc.crosshair;
      }
    }
  }

  return _resolved;
}

// ─── RenderPipeline Class ────────────────────────────────────────

/**
 * RenderPipeline — orchestrates all render stages.
 *
 * Usage:
 *   const pipeline = new RenderPipeline();
 *   // In renderLoop:
 *   pipeline.execute(frameState, engine);
 */
export class RenderPipeline {
  _stages: StageEntry[];
  _prevFrameState: unknown;

  // P2 5.1: Pooled command buffer — reused across frames via reset()
  _commandBuffer: RenderCommandBuffer;
  // P2 5.2: Pre-rasterized grid dot canvas (invalidated on theme/DPR change)
  _dotCanvas: OffscreenCanvas | HTMLCanvasElement | null;
  _dotCanvasDPR: number;
  _dotCanvasColor: string;

  // Item 21: Pooled RenderContexts — reused across frames (zero alloc in hot path)
  _pooledCtx: RenderContexts;

  constructor() {
    this._stages = [];
    this._prevFrameState = null;
    this._commandBuffer = new RenderCommandBuffer();
    this._dotCanvas = null;
    this._dotCanvasDPR = 0;
    this._dotCanvasColor = '';
    // Item 21: Pre-allocate with null placeholders — mutated in execute()
    this._pooledCtx = {
      gridCtx: null as unknown,
      dataCtx: null as unknown,
      indicatorCtx: null as unknown,
      drawingCtx: null as unknown,
      uiCtx: null as unknown,
      layers: null,
      theme: null as unknown,
      webgl: null,
      webglCanvas: null as unknown,
      drawingEngine: null,
      drawingRenderer: null,
      sceneGraph: null,
      commandBuffer: null as unknown,
      changeMask: 0,
    };
  }

  /**
   * Register a render stage.
   */
  addStage(name: string, relevantChanges: number, executeFn: StageFn): void {
    this._stages.push({ name, relevantChanges, execute: executeFn });
  }

  /**
   * Execute all stages for a single frame.
   */
  execute(frameState: unknown, engine: unknown, fb: unknown, skipStages: Set<string> | null): void {
    // Compute what changed since last frame
    const changeMask = frameState.diff(this._prevFrameState);
    frameState.setChangeMask(changeMask);

    // Resolve theme once per frame (shared across all stages)
    const theme = resolveTheme(frameState);

    // Item 21: Mutate pooled context in-place (zero allocation)
    this._commandBuffer.reset();
    const ctx = this._pooledCtx;
    ctx.gridCtx = engine.gridCtx;
    ctx.dataCtx = engine.mainCtx;
    ctx.indicatorCtx = engine.indicatorCtx;
    ctx.drawingCtx = engine.drawingCtx;
    ctx.uiCtx = engine.topCtx;
    ctx.layers = engine.layers;
    ctx.theme = theme;
    ctx.webgl = engine._webglRenderer;
    ctx.webglCanvas = engine._webglCanvas;
    ctx.drawingEngine = engine.drawingEngine;
    ctx.drawingRenderer = engine.drawingRenderer;
    ctx.sceneGraph = engine._sceneGraph || null;
    ctx.commandBuffer = this._commandBuffer;
    ctx.changeMask = changeMask;

    // Set shared frame uniforms once (resolution, pixelRatio) for ShaderLibrary
    if (engine._webglRenderer?.available) {
      const bw = frameState.bitmapWidth || 0;
      const bh = frameState.bitmapHeight || 0;
      const pr = frameState.pixelRatio || 1;
      engine._webglRenderer.setFrameUniforms(bw, bh, pr);
    }

    // P1 Task 7: Run stages via indexed loop (avoids iterator alloc + enables V8 inline cache)
    const stages = this._stages;
    const stageCount = stages.length;
    for (let si = 0; si < stageCount; si++) {
      const stage = stages[si]!;
      // Skip stage if none of its relevant changes occurred
      // Exception: CHANGED.ALL always runs (first frame, resize, etc.)
      if (changeMask !== CHANGED.ALL &&
        (changeMask & stage.relevantChanges) === 0) {
        continue;
      }

      // Phase 1.3.3: Skip stages handled by the render worker
      if (skipStages && skipStages.has(stage.name)) {
        continue;
      }

      fb.beginPhase(stage.name);
      try {
        stage.execute(frameState, ctx, engine);
      } catch (err) {
        logger.engine.error(`[RenderPipeline] Stage "${stage.name}" failed:`, err);
      }
      fb.endPhase(stage.name);
    }

    // Flush all deferred GPU commands (sorted by program/blend/texture/z-order)
    if (ctx.commandBuffer.size > 0 && engine._webglRenderer?.gl) {
      // Clear WebGL canvas immediately before flushing — NOT earlier in DataStage —
      // to prevent blank-frame flicker when the browser composites between clear and flush.
      engine._webglRenderer.clear();
      ctx.commandBuffer.flush(engine._webglRenderer.gl);
    }

    // Clear scene graph dirty flags after all stages have rendered
    if (engine._sceneGraph) {
      engine._sceneGraph.clearDirty();
    }

    // ─── Per-Pane Rendering (Hybrid DOM Architecture) ──────────────
    // After main pane stages, iterate indicator panes and render their
    // independent grid, indicator, and UI stages on their own canvases.
    if (engine.paneManager && engine.paneManager.indicatorPanes.length > 0) {
      this._renderIndicatorPanes(frameState, engine, ctx, fb);
    }

    // Store for next frame's diff (8.1.5: release old frame to pool)
    if (this._prevFrameState?.release) {
      this._prevFrameState.release();
    }
    this._prevFrameState = frameState;
  }

  /**
   * Force all stages to re-execute on the next frame
   * (e.g. after resize, theme change, data reload).
   */
  invalidate(): void {
    this._prevFrameState = null;
  }

  /**
   * Get the list of registered stage names (for profiling UI).
   */
  getStageNames(): string[] {
    return this._stages.map(s => s.name);
  }

  /**
   * Render all indicator panes. Each pane gets its own rendering pass
   * with independent grid, indicator data, and UI on its own canvases.
   */
  _renderIndicatorPanes(frameState: unknown, engine: unknown, mainCtx: RenderContexts, _fb: unknown): void {
    const paneManager = engine.paneManager;
    if (!paneManager) return;

    const panes = paneManager.indicatorPanes;
    const theme = mainCtx.theme;

    for (let pi = 0; pi < panes.length; pi++) {
      const pane = panes[pi];
      if (!pane) continue;

      // Skip collapsed panes (only render header)
      if (pane.state.collapsed) continue;

      // Get per-pane rendering contexts
      const paneCtxs = paneManager.getPaneContexts(pi);
      if (!paneCtxs) continue;

      const { gridCtx, indicatorCtx, uiCtx, layers } = paneCtxs;

      // Only render if the pane is dirty
      if (!pane.state.dirty && !layers.anyDirty()) continue;

      const paneH = pane.state.height || pane.container.clientHeight;
      const pr = layers.pixelRatio || 1;

      // ─── Pane Grid ────────────────────────────────────────────
      if (layers.isDirty(LAYERS.GRID)) {
        layers.clearDirty(LAYERS.GRID);
        const bw = layers.bitmapWidth || 1;
        const bh = layers.bitmapHeight || 1;
        // Clear and fill background
        gridCtx.fillStyle = theme.bg || '#131722';
        gridCtx.fillRect(0, 0, bw, bh);
        // Horizontal grid lines based on pane Y-axis
        this._drawPaneGrid(gridCtx, pane.state, paneH, pr, theme, bw, bh);
      }

      // ─── Pane Indicator Data ──────────────────────────────────
      if (layers.isDirty(LAYERS.INDICATORS)) {
        layers.clearDirty(LAYERS.INDICATORS);
        const bw = layers.bitmapWidth || 1;
        const bh = layers.bitmapHeight || 1;
        indicatorCtx.clearRect(0, 0, bw, bh);
        // Render the indicator(s) for this pane
        this._drawPaneIndicator(indicatorCtx, frameState, pane.state, engine, paneH, pr);
      }

      // ─── Pane UI (crosshair, header, Y-axis) ──────────────────
      if (layers.isDirty(LAYERS.UI)) {
        layers.clearDirty(LAYERS.UI);
        const bw = layers.bitmapWidth || 1;
        const bh = layers.bitmapHeight || 1;
        uiCtx.clearRect(0, 0, bw, bh);
        // Draw pane header, Y-axis ticks, and synced crosshair
        this._drawPaneUI(uiCtx, frameState, pane.state, engine, paneH, pr, theme, bw, bh);
      }

      pane.state.dirty = false;
    }
  }

  /**
   * Draw horizontal grid lines for an indicator pane.
   */
  _drawPaneGrid(
    ctx: CanvasRenderingContext2D, paneState: unknown,
    paneH: number, pr: number, theme: unknown,
    bw: number, bh: number,
  ): void {
    const { yMin, yMax } = paneState;
    if (yMin >= yMax) return;

    const range = yMax - yMin;
    // Compute nice tick spacing
    const rawStep = range / 5;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const niceSteps = [1, 2, 2.5, 5, 10];
    let step = niceSteps[niceSteps.length - 1]! * mag;
    for (const ns of niceSteps) {
      if (ns * mag >= rawStep) { step = ns * mag; break; }
    }

    const dotRadius = Math.max(0.8, pr * 0.7);
    const dotColor = theme.gridLine || 'rgba(54,58,69,0.22)';

    // P2 5.2: Pre-rasterize a single dot to an offscreen canvas;
    // stamp via drawImage instead of hundreds of arc() calls.
    if (!this._dotCanvas || this._dotCanvasDPR !== pr || this._dotCanvasColor !== dotColor) {
      const size = Math.ceil(dotRadius * 2 + 2);
      const dot = typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(size, size)
        : document.createElement('canvas');
      if (!(dot instanceof OffscreenCanvas)) {
        dot.width = size;
        dot.height = size;
      }
      const dCtx = dot.getContext('2d') as CanvasRenderingContext2D;
      dCtx.fillStyle = dotColor;
      dCtx.beginPath();
      dCtx.arc(size / 2, size / 2, dotRadius, 0, Math.PI * 2);
      dCtx.fill();
      this._dotCanvas = dot;
      this._dotCanvasDPR = pr;
      this._dotCanvasColor = dotColor;
    }

    const dotImg = this._dotCanvas;
    const dotSize = dotImg.width;
    const halfDot = dotSize / 2;
    ctx.globalAlpha = 0.18;

    const firstTick = Math.ceil(yMin / step) * step;
    for (let tick = firstTick; tick <= yMax; tick += step) {
      const y = Math.round((1 - (tick - yMin) / range) * paneH * pr);
      if (y >= 0 && y <= bh) {
        for (let x = Math.round(30 * pr); x < bw; x += Math.round(80 * pr)) {
          ctx.drawImage(dotImg as unknown, x - halfDot, y - halfDot);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Draw indicator data for a pane.
   */
  _drawPaneIndicator(
    ctx: CanvasRenderingContext2D, fs: unknown, paneState: unknown,
    engine: unknown, paneH: number, pr: number,
  ): void {
    const indicators = paneState.indicators || [];
    if (indicators.length === 0) return;

    const bars = fs.bars || engine.bars;
    const startIdx = fs.startIdx ?? 0;
    const endIdx = fs.endIdx ?? bars.length - 1;
    const { yMin, yMax } = paneState;
    if (yMin >= yMax || bars.length === 0) return;

    const _bw = ctx.canvas.width;
    const _bh = ctx.canvas.height;
    const R = engine.state.lastRender;
    if (!R?.timeTransform) return;

    // Price-to-Y transform for this pane
    const range = yMax - yMin;
    const p2y = (price: number) => (1 - (price - yMin) / range) * paneH;

    for (const ind of indicators) {
      if (!ind.computed) continue;
      const hiddenSet = engine.state.hiddenIndicators || new Set();
      const idx = engine.indicators.indexOf(ind);
      if (idx >= 0 && hiddenSet.has(idx)) continue;

      for (const out of (ind.outputs || [])) {
        const vals = ind.computed[out.key];
        if (!vals) continue;

        ctx.save();
        ctx.strokeStyle = out.color || '#2962FF';
        ctx.lineWidth = Math.max(1, (out.lineWidth || 2) * pr);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        // Line rendering
        ctx.beginPath();
        let started = false;
        for (let i = startIdx; i <= endIdx && i < vals.length; i++) {
          const val = vals[i];
          if (val == null || isNaN(val)) { started = false; continue; }
          const x = R.timeTransform.indexToPixel(i) * pr;
          const y = p2y(val) * pr;
          if (!started) { ctx.moveTo(x, y); started = true; }
          else { ctx.lineTo(x, y); }
        }
        ctx.stroke();
        ctx.restore();
      }

      // Histogram rendering (MACD, volume-based indicators)
      if (ind.computed.histogram) {
        const histVals = ind.computed.histogram;
        ctx.save();
        for (let i = startIdx; i <= endIdx && i < histVals.length; i++) {
          const val = histVals[i];
          if (val == null || isNaN(val)) continue;
          const x = R.timeTransform.indexToPixel(i) * pr;
          const barW = Math.max(1, (R.barWidth || 4) * pr * 0.6);
          const y = p2y(val) * pr;
          const zeroY = p2y(0) * pr;
          ctx.fillStyle = val >= 0
            ? (engine.state.lastRender?.thm?.bullCandle || '#26A69A')
            : (engine.state.lastRender?.thm?.bearCandle || '#EF5350');
          ctx.globalAlpha = 0.7;
          ctx.fillRect(x - barW / 2, Math.min(y, zeroY), barW, Math.abs(y - zeroY));
        }
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }
  }

  /**
   * Draw pane UI: header label, Y-axis ticks, synced crosshair.
   */
  _drawPaneUI(
    ctx: CanvasRenderingContext2D, fs: unknown, paneState: unknown,
    engine: unknown, paneH: number, pr: number, theme: unknown,
    bw: number, bh: number,
  ): void {
    const { yMin, yMax } = paneState;
    if (yMin >= yMax) return;

    const range = yMax - yMin;

    // ─── Pane Header ────────────────────────────────────────────
    const indicators = paneState.indicators || [];
    const headerLabel = indicators[0]?.label || indicators[0]?.shortName || indicators[0]?.indicatorId || 'Indicator';
    const headerFs = Math.round(11 * pr);
    ctx.font = `bold ${headerFs}px Arial`;
    ctx.fillStyle = theme.fg || '#D1D4DC';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(headerLabel, Math.round(8 * pr), Math.round(4 * pr));

    // Indicator value at crosshair
    if (indicators[0]?.computed && fs.hoverIdx != null) {
      let vx = Math.round(8 * pr) + ctx.measureText(headerLabel).width + Math.round(10 * pr);
      ctx.font = `${Math.round(10 * pr)}px Arial`;
      for (const out of (indicators[0].outputs || [])) {
        const vals = indicators[0].computed[out.key];
        if (!vals) continue;
        const val = fs.hoverIdx < vals.length ? vals[fs.hoverIdx] : NaN;
        if (isNaN(val)) continue;
        ctx.fillStyle = out.color || '#2962FF';
        const valStr = val.toFixed(2);
        ctx.fillText(valStr, vx, Math.round(5 * pr));
        vx += ctx.measureText(valStr).width + Math.round(8 * pr);
      }
    }

    // ─── Y-Axis Labels (right edge) ─────────────────────────────
    const rawStep = range / 5;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const niceSteps = [1, 2, 2.5, 5, 10];
    let step = niceSteps[niceSteps.length - 1]! * mag;
    for (const ns of niceSteps) {
      if (ns * mag >= rawStep) { step = ns * mag; break; }
    }

    const axFs = Math.round(9 * pr);
    ctx.font = `${axFs}px Arial`;
    ctx.fillStyle = theme.axisText || '#787B86';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const axisX = bw - Math.round(4 * pr);

    const firstTick = Math.ceil(yMin / step) * step;
    for (let tick = firstTick; tick <= yMax; tick += step) {
      const y = Math.round((1 - (tick - yMin) / range) * paneH * pr);
      if (y >= Math.round(15 * pr) && y <= bh - Math.round(5 * pr)) {
        ctx.fillText(tick.toFixed(2), axisX, y);
      }
    }

    // ─── Synced Crosshair (vertical line from main chart) ───────
    const S = engine.state;
    if (S.mouseX != null && S.mouseX >= 0 && S.mouseX <= (engine.state.lastRender?.cW || 9999)) {
      const bx = Math.round(S.mouseX * pr);
      ctx.strokeStyle = theme.crosshairColor || 'rgba(149,152,161,0.5)';
      ctx.lineWidth = Math.max(1, Math.round(pr));
      ctx.setLineDash([Math.round(4 * pr), Math.round(4 * pr)]);
      ctx.beginPath();
      ctx.moveTo(bx + 0.5, 0);
      ctx.lineTo(bx + 0.5, bh);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ─── Separator line at top ──────────────────────────────────
    ctx.strokeStyle = theme.gridLine || 'rgba(54,58,69,0.5)';
    ctx.lineWidth = Math.max(1, pr);
    ctx.beginPath();
    ctx.moveTo(0, 0.5);
    ctx.lineTo(bw, 0.5);
    ctx.stroke();
  }
}

/**
 * Create a fully-configured RenderPipeline with all standard stages.
 * Stages are registered in render order.
 */
export function createDefaultPipeline(stages: StageMap): RenderPipeline {
  const pipeline = new RenderPipeline();

  // Stage 1: Grid (background, watermark, grid lines)
  // Triggers: resize, theme, props (symbol/TF), viewport (zoom/scroll)
  // Strategy Item #5: DATA is excluded — grid appearance doesn't depend on
  // bar content. Symbol/TF changes arrive via PROPS. setData() only marks
  // GRID dirty on non-tick updates (new bars change viewport geometry).
  pipeline.addStage('grid',
    CHANGED.SIZE | CHANGED.THEME | CHANGED.PROPS | CHANGED.VIEWPORT,
    stages.grid
  );

  // Stage 2: Data (candles, volume, price line, alerts, S/R, entrance animation)
  // Triggers: data, viewport, animation, props, theme, tick (Phase 1.1.2 incremental)
  pipeline.addStage('data',
    CHANGED.DATA | CHANGED.VIEWPORT | CHANGED.ANIMATION | CHANGED.PROPS | CHANGED.THEME | CHANGED.SIZE | CHANGED.TICK,
    stages.data
  );

  // Stage 2.5: GPU Compute (dispatches WGSL shaders for eligible indicators)
  // Triggers: data change, indicator config change
  pipeline.addStage('gpuCompute',
    CHANGED.DATA | CHANGED.INDICATORS,
    executeGPUComputeStage
  );

  // Stage 3: Indicators (overlays + panes, session dividers)
  // Triggers: data, viewport, indicators change, size
  pipeline.addStage('indicators',
    CHANGED.DATA | CHANGED.VIEWPORT | CHANGED.INDICATORS | CHANGED.SIZE | CHANGED.THEME,
    stages.indicators
  );

  // Stage 4: Drawings (user drawings — trendlines, fibs, etc.)
  // Triggers: drawings change, viewport change
  pipeline.addStage('drawings',
    CHANGED.DRAWINGS | CHANGED.VIEWPORT | CHANGED.SIZE | CHANGED.DATA,
    stages.drawings
  );

  // Stage 5: Overlays (order flow — delta, VP, large trades, OI, liquidations, heatmap)
  // Triggers: data, viewport, props
  pipeline.addStage('overlays',
    CHANGED.DATA | CHANGED.VIEWPORT | CHANGED.PROPS | CHANGED.SIZE,
    stages.overlays
  );

  // Stage 6: UI (crosshair, tooltip, countdown, synced crosshair, magnet dot, pane splitters)
  // Runs BEFORE axes so axes labels draw ON TOP when sharing the UI canvas.
  // Triggers: mouse, viewport, data (for countdown), props
  pipeline.addStage('ui',
    CHANGED.MOUSE | CHANGED.VIEWPORT | CHANGED.DATA | CHANGED.PROPS | CHANGED.SIZE | CHANGED.ANIMATION,
    stages.ui
  );

  // Stage 7: Axes (price axis, time axis, scale toggles, auto-fit button)
  // Runs AFTER UI so labels are always visible on top of crosshair elements.
  // Triggers: data, viewport, theme, size, props, tick (price badge), mouse (shared canvas clear)
  pipeline.addStage('axes',
    CHANGED.DATA | CHANGED.VIEWPORT | CHANGED.THEME | CHANGED.SIZE | CHANGED.PROPS | CHANGED.TICK | CHANGED.MOUSE,
    stages.axes
  );

  return pipeline;
}
