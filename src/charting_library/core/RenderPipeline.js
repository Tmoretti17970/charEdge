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

/**
 * Resolve the full theme object from FrameState.
 * Merges base theme with user-configured chart colors.
 *
 * @param {import('./FrameState.js').FrameState} fs
 * @returns {Object} Resolved theme colors
 */
export function resolveTheme(fs) {
  const rawThm = fs.themeName === 'light' ? LIGHT_THEME : DARK_THEME;
  const thm = {
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
    ...rawThm,
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

/**
 * RenderPipeline — orchestrates all render stages.
 *
 * Usage:
 *   const pipeline = new RenderPipeline();
 *   // In renderLoop:
 *   pipeline.execute(frameState, engine);
 */
export class RenderPipeline {
  constructor() {
    /** @type {Array<{name: string, execute: Function, relevantChanges: number}>} */
    this._stages = [];
    this._prevFrameState = null;
  }

  /**
   * Register a render stage.
   *
   * @param {string} name - Human-readable stage name (for profiling)
   * @param {number} relevantChanges - Bitmask of CHANGED flags that trigger this stage
   * @param {(fs: FrameState, ctx: RenderContexts, engine: ChartEngine) => void} executeFn
   */
  addStage(name, relevantChanges, executeFn) {
    this._stages.push({ name, relevantChanges, execute: executeFn });
  }

  /**
   * Execute all stages for a single frame.
   *
   * @param {import('./FrameState.js').FrameState} frameState
   * @param {Object} engine - ChartEngine instance (for layer access, WebGL, etc.)
   * @param {import('./FrameBudget.js').FrameBudget} fb - Frame budget for profiling
   * @param {Set<string>} [skipStages] - Stage names to skip (Phase 1.3.3: worker-handled stages)
   */
  execute(frameState, engine, fb, skipStages) {
    // Compute what changed since last frame
    const changeMask = frameState.diff(this._prevFrameState);
    frameState.setChangeMask(changeMask);

    // Resolve theme once per frame (shared across all stages)
    const theme = resolveTheme(frameState);

    // Build the shared render context
    const commandBuffer = new RenderCommandBuffer();
    const ctx = {
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
        console.error(`[RenderPipeline] Stage "${stage.name}" failed:`, err);
      }
      fb.endPhase(stage.name);
    }

    // Flush all deferred GPU commands (sorted by program/blend/texture/z-order)
    if (commandBuffer.size > 0 && engine._webglRenderer?.gl) {
      commandBuffer.flush(engine._webglRenderer.gl);
    }

    // Clear scene graph dirty flags after all stages have rendered
    if (engine._sceneGraph) {
      engine._sceneGraph.clearDirty();
    }

    // Store for next frame's diff
    this._prevFrameState = frameState;
  }

  /**
   * Force all stages to re-execute on the next frame
   * (e.g. after resize, theme change, data reload).
   */
  invalidate() {
    this._prevFrameState = null;
  }

  /**
   * Get the list of registered stage names (for profiling UI).
   * @returns {string[]}
   */
  getStageNames() {
    return this._stages.map(s => s.name);
  }
}

/**
 * Create a fully-configured RenderPipeline with all standard stages.
 * Stages are registered in render order.
 *
 * @param {Object} stages - Map of stage implementations
 * @returns {RenderPipeline}
 */
export function createDefaultPipeline(stages) {
  const pipeline = new RenderPipeline();

  // Stage 1: Grid (background, watermark, grid lines)
  // Triggers: resize, theme change, data change (for watermark symbol)
  pipeline.addStage('grid',
    CHANGED.SIZE | CHANGED.THEME | CHANGED.DATA | CHANGED.PROPS | CHANGED.VIEWPORT,
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
    CHANGED.DRAWINGS | CHANGED.VIEWPORT | CHANGED.SIZE,
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
