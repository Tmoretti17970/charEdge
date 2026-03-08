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

import { CHANGED } from './FrameState.js';
import { LAYERS } from './LayerManager.js';
import { DARK_THEME, LIGHT_THEME } from './ThemeManager.js';
import { RenderCommandBuffer } from '../gpu/RenderCommandBuffer.js';
import { executeGPUComputeStage } from './stages/GPUComputeStage.js';
import { logger } from '../../utils/logger';

// ─── Type Definitions ────────────────────────────────────────────

/** Shared render context passed to every stage. */
export interface RenderContexts {
  gridCtx: CanvasRenderingContext2D;
  dataCtx: CanvasRenderingContext2D;
  indicatorCtx: CanvasRenderingContext2D;
  drawingCtx: CanvasRenderingContext2D;
  uiCtx: CanvasRenderingContext2D;
  layers: any;
  theme: Record<string, string>;
  webgl: any;
  webglCanvas: HTMLCanvasElement;
  drawingEngine: any;
  drawingRenderer: any;
  sceneGraph: any;
  commandBuffer: any;
  changeMask: number;
}

/** Signature for a stage execution function. */
export type StageFn = (fs: any, ctx: RenderContexts, engine: any) => void;

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
  [key: string]: string;
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

/**
 * Resolve the full theme object from FrameState.
 * Merges base theme with user-configured chart colors.
 */
export function resolveTheme(fs: any): ResolvedTheme {
  const rawThm = fs.themeName === 'light' ? LIGHT_THEME : DARK_THEME;
  const thm: any = {
    ...rawThm,
    bg: rawThm.background,
    fg: rawThm.foreground,
    axisBg: rawThm.axisBackground,
    axisText: rawThm.textSecondary,
    gridLine: rawThm.gridColor,
    gridColor: rawThm.gridColor,
    crosshairColor: rawThm.crosshairColor,
    bullCandle: rawThm.candleUp,
    bearCandle: rawThm.candleDown,
    bullVolume: rawThm.volumeUp,
    bearVolume: rawThm.volumeDown,
  };

  // Apply user-configured chart colors on top
  if (fs.storeChartColors) {
    const cc = fs.storeChartColors;
    if (cc.background) thm.bg = cc.background;
    if (cc.candleUp) thm.bullCandle = cc.candleUp;
    if (cc.candleDown) thm.bearCandle = cc.candleDown;
    if (cc.volumeUp) thm.bullVolume = cc.volumeUp;
    if (cc.volumeDown) thm.bearVolume = cc.volumeDown;
    if (cc.gridColor) thm.gridLine = cc.gridColor;
    if (cc.crosshair) thm.crosshairColor = cc.crosshair;
  }

  return thm;
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
  _prevFrameState: any;

  constructor() {
    this._stages = [];
    this._prevFrameState = null;
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
  execute(frameState: any, engine: any, fb: any, skipStages: Set<string> | null): void {
    // Compute what changed since last frame
    const changeMask = frameState.diff(this._prevFrameState);
    frameState.setChangeMask(changeMask);

    // Resolve theme once per frame (shared across all stages)
    const theme = resolveTheme(frameState);

    // Build the shared render context
    const commandBuffer = new RenderCommandBuffer();
    const ctx: RenderContexts = {
      // Layer 2D contexts
      gridCtx: engine.gridCtx,
      dataCtx: engine.mainCtx,
      indicatorCtx: engine.indicatorCtx,
      drawingCtx: engine.drawingCtx,
      uiCtx: engine.topCtx,
      // Layer manager
      layers: engine.layers,
      // Resolved theme
      theme,
      // WebGL renderer
      webgl: engine._webglRenderer,
      webglCanvas: engine._webglCanvas,
      // Drawing engine/renderer
      drawingEngine: engine.drawingEngine,
      drawingRenderer: engine.drawingRenderer,
      // Scene graph (Phase 2)
      sceneGraph: engine._sceneGraph || null,
      // Render command buffer (Phase 3)
      commandBuffer,
      // Change mask
      changeMask,
    };

    // Set shared frame uniforms once (resolution, pixelRatio) for ShaderLibrary
    if (engine._webglRenderer?.available) {
      const bw = frameState.bitmapWidth || 0;
      const bh = frameState.bitmapHeight || 0;
      const pr = frameState.pixelRatio || 1;
      engine._webglRenderer.setFrameUniforms(bw, bh, pr);
    }

    // Run each stage
    for (const stage of this._stages) {
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
    if (commandBuffer.size > 0 && engine._webglRenderer?.gl) {
      // Clear WebGL canvas immediately before flushing — NOT earlier in DataStage —
      // to prevent blank-frame flicker when the browser composites between clear and flush.
      engine._webglRenderer.clear();
      commandBuffer.flush(engine._webglRenderer.gl);
    }

    // Clear scene graph dirty flags after all stages have rendered
    if (engine._sceneGraph) {
      engine._sceneGraph.clearDirty();
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
