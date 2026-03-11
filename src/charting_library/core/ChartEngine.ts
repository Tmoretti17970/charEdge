/// <reference types="vite/client" />
import { FrameBudget } from './FrameBudget.js';
import { detectDisplayHz } from './DisplayHz.js';
import { microJankDetector } from './MicroJankDetector.js';
import { createChartDrawingSetup } from './ChartDrawingSetup.js';
import { InputManager } from './InputManager.js';
import type { LayerManager} from './LayerManager.js';
import { LAYERS } from './LayerManager.js';
import { PaneManager } from './PaneManager.js';
import { BarDataBuffer } from './BarDataBuffer.js';
import { WorkerBridge } from './WorkerBridge.js';
import { loadDrawings } from '../tools/DrawingPersistence.js';
import { WebGLRenderer } from '../renderers/WebGLRenderer.ts';
import { WebGPUCompute } from '../renderers/WebGPUCompute.js';
import { checkDrawingAlerts } from '../tools/DrawingAlertEngine.js';
import { validateBars, validateProps, validateIndicators } from './validateBars.js';
import { logger } from '@/observability/logger.js';
import { memoryBudget } from '../../data/engine/infra/MemoryBudget.js';
import { renderTradeMarkers as renderTradeMarkersImpl } from '../renderers/TradeMarkerRenderer.js';

import type { Bar } from '../../types/chart.js';

// eslint-disable-next-line @typescript-eslint/naming-convention
const __DEV__ = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

// ─── Forge Render Pipeline ───────────────────────────────────────
import { FrameState } from './FrameState.js';
import { createDefaultPipeline } from './RenderPipeline.js';
import { executeGridStage } from './stages/GridStage.js';
import { executeDataStage } from './stages/DataStage.js';
import { executeIndicatorStage } from './stages/IndicatorStage.js';
import { executeDrawingStage } from './stages/DrawingStage.js';
import { executeOverlayStage } from './stages/OverlayStage.js';
import { executeAxesStage } from './stages/AxesStage.js';
import { executeUIStage } from './stages/UIStage.js';
import { SceneGraph } from '../scene/SceneGraph.js';
import { FormingCandleInterpolator } from './FormingCandleInterpolator.js';
import { CountdownOverlay } from './CountdownOverlay.js';
import { markCleanExit } from './SessionRecovery.js';

// ─── Type Definitions ────────────────────────────────────────────

/** Callbacks from the chart engine to the host application. */
export interface ChartCallbacks {
  onPrefetch?: () => void;
  onDrawingsChange?: (drawings: unknown[]) => void;
  onDrawingStateChange?: (state: unknown) => void;
  onCrosshairMove?: (data: { price: number; time: number; bar: unknown; x: number; y: number }) => void;
  onBarClick?: (price: number, time: number, bar: unknown) => void;
  onPaneResize?: (idx: number, fraction: number) => void;
  onPaneToggle?: (idx: number) => void;
  onDrawingAlert?: (alert: unknown) => void;
}

/** Props passed to the chart engine from the host. */
export interface ChartProps {
  symbol?: string;
  tf?: string;
  chartType?: string;
  theme?: string;
  compact?: boolean;
  showVolume?: boolean;
  showHeatmap?: boolean;
  showSessions?: boolean;
  showDeltaOverlay?: boolean;
  showVPOverlay?: boolean;
  showLargeTradesOverlay?: boolean;
  showOIOverlay?: boolean;
  magnetMode?: boolean;
  useUTC?: boolean;
  activeTimezone?: string;
  trades?: unknown[];
  srLevels?: unknown[];
  oiData?: unknown;
  liquidations?: unknown[];
  aggregatorKey?: string;
  paneHeights?: Record<number, number>;
  patternMarkers?: unknown;
  divergences?: unknown;
  heatmapIntensity?: number;
  renkoBrickSize?: number;
  rangeBarSize?: number;
  storeChartColors?: Record<string, string>;
}

/** Constructor options for ChartEngine. */
export interface ChartEngineOptions {
  callbacks?: ChartCallbacks;
  props?: ChartProps;
}

// AnimOHLC replaced by FormingCandleInterpolator (task 8.2.1)

/** Internal mutable engine state. */
export interface EngineState {
  visibleBars: number;
  scrollOffset: number;
  mouseX: number | null;
  mouseY: number | null;
  hoverIdx: number | null;
  dragging: string | false;
  dragStartX: number;
  dragStartY: number;
  dragStartOffset: number;
  dragStartPriceScale: number;
  dragStartPriceScroll: number;
  dragStartVisibleBars: number;
  priceScale: number;
  priceScroll: number;
  autoScale: boolean;
  scaleMode: string;
  percentBase: number;
  mainDirty: boolean;
  topDirty: boolean;
  lastRender: Record<string, unknown> | null;
  historyLoading: boolean;
  collapsedPanes: Set<number>;
  _splitterHoverIdx: number;
  _highlightedIndicator: number;
  hiddenIndicators: Set<number>;
  _legendHitRegions: unknown[];
  timeAxisZoom?: boolean;
  yAxisLocked: boolean; // Task 1.4.14: Y-axis lock toggle
  _scrollToNowBtn?: { x: number; y: number; w: number; h: number } | null;
  _autoFitBtn?: { x: number; y: number; w: number; h: number } | null;
}

export class ChartEngine {
  container: HTMLElement;
  callbacks: ChartCallbacks;
  props: ChartProps;
  bars: Bar[];
  indicators: unknown[];
  alerts: unknown[];
  syncedCrosshair: unknown;
  symbol: string;
  timeframe: string;

  // Animation (task 8.2.1: FormingCandleInterpolator)
  _formingInterpolator: FormingCandleInterpolator;
  _animTarget: { open: number; high: number; low: number; close: number } | null;
  _animCurrent: { open: number; high: number; low: number; close: number } | null;
  _lastFrameTime: number;

  // Viewport tracking
  _prevStartIdx: number;
  _prevEndIdx: number;
  _prevVisibleBars: number;
  _viewportChanged: boolean;

  // Layer system
  layers: LayerManager;
  paneManager: PaneManager;
  mainCanvas: HTMLCanvasElement;
  topCanvas: HTMLCanvasElement;
  mainCtx: CanvasRenderingContext2D;
  topCtx: CanvasRenderingContext2D;
  gridCtx: CanvasRenderingContext2D;
  indicatorCtx: CanvasRenderingContext2D;
  drawingCtx: CanvasRenderingContext2D;

  // WebGL
  _webglCanvas: HTMLCanvasElement;
  _pendingWebGLResize = false;
  _webglRenderer: WebGLRenderer;

  // WebGPU
  _gpuCompute: WebGPUCompute;

  // Data
  _barBuffer: BarDataBuffer;
  _workerBridge: WorkerBridge;
  _tickUpdate: boolean;
  _loadTimestamp: number | null;

  // Engine state
  state: EngineState;

  // Drawing
  drawingEngine: unknown;
  drawingRenderer: unknown;

  // Input
  inputManager: InputManager;

  // Render loop
  raf: number | null;
  fb: FrameBudget;

  // Scene graph
  _sceneGraph: SceneGraph;

  // Pipeline
  _pipeline: unknown;
  _lastNiceStep: unknown;
  _lastDisplayTicks: unknown;
  _lastPriceTransform: unknown;
  _lastTimeTransform: unknown;
  // B2.4: Y-axis tick cross-fade transition
  _niceStepTransition: { startTime: number; fromTicks: number[]; toTicks: number[]; duration: number } | null;
  _prevNiceStepKey: string;

  // Memory budget integration (P3-2)
  _degradationLevel: number;
  _memoryUnsubscribe: (() => void) | null;

  // Countdown
  _countdownTick: number;
  _countdownInterval: ReturnType<typeof setInterval>;
  _countdownOverlay: CountdownOverlay | null;

  // Task 2.3.25: Live subscription tracking — countdown only fires when live data flows
  _hasLiveSubscription: boolean;

  // Y-axis scale reset coordination: set by setProps() when symbol changes,
  // consumed by setData() to reset the price scale even if bar count matches
  _pendingScaleReset: boolean;

  /**
   * Create a new chart engine instance attached to a DOM container.
   * Initializes the 5-layer compositing system, WebGL renderer, WebGPU compute,
   * drawing engine, input manager, and starts the demand-driven render loop.
   *
   * @param container - DOM element to host the chart (must have explicit dimensions)
   * @param options - Callbacks and initial props
   *
   * @example
   * ```ts
   * const engine = new ChartEngine(document.getElementById('chart')!, {
   *   callbacks: { onCrosshairMove: (data) => updateTooltip(data) },
   *   props: { symbol: 'BTCUSDT', tf: '1h', chartType: 'candle' },
   * });
   * ```
   */
  constructor(container: HTMLElement, options: ChartEngineOptions = {}) {
    this.container = container;
    this.callbacks = options.callbacks || {};
    this.props = options.props || {};
    this.bars = [];
    this.indicators = [];
    this.alerts = [];
    this.syncedCrosshair = null; // { time, price } from CrosshairBus
    this.symbol = options.props?.symbol || '';
    this.timeframe = options.props?.tf || '1h';

    // Task 8.2.1: Forming candle interpolation (replaces ad-hoc spring physics)
    this._formingInterpolator = new FormingCandleInterpolator(0.15, 0.001);
    this._animTarget = null; // Compat: kept for FrameState snapshot
    this._animCurrent = null; // Compat: kept for FrameState snapshot
    this._lastFrameTime = performance.now();

    // ─── Viewport Change Tracking (Batch Render Optimization) ────
    this._prevStartIdx = -1;
    this._prevEndIdx = -1;
    this._prevVisibleBars = -1;
    this._viewportChanged = true; // Force first render

    // ─── Hybrid DOM Pane Architecture ──────────────────────────────
    // PaneManager creates the main pane's LayerManager + DOM container.
    // engine.layers is a backward-compat alias to mainPane.layers.
    this.paneManager = new PaneManager(container, {
      onResize: () => { this.resize(); this._scheduleDraw(); },
    });
    this.layers = this.paneManager.mainPane.layers;

    // Backward-compat aliases for code that references mainCanvas/topCanvas
    this.mainCanvas = this.layers.getCanvas(LAYERS.DATA);
    this.topCanvas = this.layers.getCanvas(LAYERS.UI);
    this.mainCtx = this.layers.getCtx(LAYERS.DATA);
    this.topCtx = this.layers.getCtx(LAYERS.UI);
    this.gridCtx = this.layers.getCtx(LAYERS.GRID);
    this.indicatorCtx = this.layers.getCtx(LAYERS.INDICATORS);
    this.drawingCtx = this.layers.getCtx(LAYERS.DRAWINGS);

    // ─── WebGL Renderer (GPU-accelerated candlesticks, volume, lines) ─
    this._webglCanvas = document.createElement('canvas');
    this._webglCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:6;pointer-events:none';
    // Append to the main pane container (inside the flex layout), NOT the
    // engine container. This ensures the WebGL canvas resizes with the pane
    // when the side panel opens/closes.
    this.paneManager.mainPane.container.appendChild(this._webglCanvas);
    this._webglRenderer = new WebGLRenderer(this._webglCanvas);

    // ─── WebGPU Compute (GPU-accelerated indicator computation) ──
    this._gpuCompute = new WebGPUCompute();

    // ─── Typed Array Data Buffer ─────────────────────────────
    this._barBuffer = new BarDataBuffer();
    this._tickUpdate = false;
    this._loadTimestamp = null;

    // ─── Worker Bridge (offload indicators) ─────────────────
    this._workerBridge = new WorkerBridge();

    this.state = {
      visibleBars: 80,
      scrollOffset: 0,
      mouseX: null,
      mouseY: null,
      hoverIdx: null,
      dragging: false,
      dragStartX: 0,
      dragStartY: 0,
      dragStartOffset: 0,
      dragStartPriceScale: 1,
      dragStartPriceScroll: 0,
      dragStartVisibleBars: 80,
      priceScale: 1,
      priceScroll: 0,
      autoScale: true,
      scaleMode: 'linear',
      percentBase: 0,
      mainDirty: true,
      topDirty: true,
      lastRender: null,
      historyLoading: false,  // Sprint 1: set by ChartEngineWidget during history prefetch
      collapsedPanes: new Set(), // Sprint 11: collapsed indicator panes
      _splitterHoverIdx: -1,     // Sprint 11: which splitter is hovered (-1 = none)
      _highlightedIndicator: -1, // Sprint 12: legend click-to-highlight index
      hiddenIndicators: new Set(), // Sprint 12: visually hidden indicator indices
      _legendHitRegions: [],      // Sprint 12: [{x,y,w,h,type,idx}] for click detection
      yAxisLocked: false,         // Task 1.4.14: Y-axis lock toggle
    };

    this.resize = this.resize.bind(this);

    // Drawing engine setup (magnetSnap, onChange, onStateChange) extracted to ChartDrawingSetup.ts
    const drawingSetup = createChartDrawingSetup(this as unknown);
    this.drawingEngine = drawingSetup.drawingEngine;
    this.drawingRenderer = drawingSetup.drawingRenderer;
    this.inputManager = new InputManager(this as unknown);
    this.raf = null;
    this.fb = new FrameBudget({ targetFps: 60 });

    // P3: Detect actual display refresh rate and update frame budget accordingly.
    // Resolves in ~500ms; until then, the 60fps default is used.
    detectDisplayHz().then(({ hz }) => {
      this.fb = new FrameBudget({ targetFps: hz });
    }).catch(() => { /* keep default 60fps budget */ });

    // ─── Scene Graph (Phase 2) ────────────────────────────────────
    this._sceneGraph = new SceneGraph(
      container.clientWidth || 1920,
      container.clientHeight || 1080
    );
    // Connect scene graph to drawing engine for spatial-index hitTest
    if (this.drawingEngine.setSceneGraph) {
      this.drawingEngine.setSceneGraph(this._sceneGraph);
    }

    // ─── Forge Render Pipeline ────────────────────────────────────
    this._pipeline = createDefaultPipeline({
      grid: executeGridStage,
      data: executeDataStage,
      indicators: executeIndicatorStage,
      drawings: executeDrawingStage,
      overlays: executeOverlayStage,
      axes: executeAxesStage,
      ui: executeUIStage,
    });
    // Temp storage for inter-stage data (niceStep, transforms)
    this._lastNiceStep = null;
    // B2.4: Y-axis tick cross-fade transition state
    this._niceStepTransition = null;
    this._prevNiceStepKey = '';
    this._lastDisplayTicks = null;
    this._lastPriceTransform = null;
    this._lastTimeTransform = null;

    this.renderLoop = this.renderLoop.bind(this);

    this._scheduleDraw();

    // ─── P3-2: Memory Budget → Render Throttle ──────────────────
    this._degradationLevel = 0;
    memoryBudget.register('chartEngine', () => {
      // Estimate: bars × 7 floats × 8 bytes + indicator buffer overhead
      return (this.bars.length * 7 * 8) +
        (this.indicators.length * this.bars.length * 8) +
        ((this.drawingEngine?.getDrawings?.()?.length || 0) * 200);
    });
    this._memoryUnsubscribe = memoryBudget.onPressure((status: unknown) => {
      this._degradationLevel = status.level === 'critical' ? 2 : status.level === 'warning' ? 1 : 0;
    });

    // Sprint 18 #115: DOM-based countdown overlay replaces canvas-drawn countdown.
    // No longer forces 1/s UIStage repaints — the DOM element self-updates.
    this._hasLiveSubscription = false;
    this._pendingScaleReset = false;
    this._countdownTick = 0;
    this._countdownOverlay = new CountdownOverlay(container);
    // Keep a lightweight 1/s tick for memory-pressure frame counting only.
    // No markDirty() → GPU sleeps.
    this._countdownInterval = setInterval(() => {
      this._countdownTick++;
    }, 1000);
  }

  /**
   * Tear down the engine — disposes all layers, WebGL resources,
   * workers, and animation frames. Call when unmounting the chart.
   *
   * @example
   * ```ts
   * useEffect(() => {
   *   const engine = new ChartEngine(ref.current!);
   *   return () => engine.destroy();
   * }, []);
   * ```
   */
  destroy(): void {
    // Task 2.3.23: Mark clean shutdown so recovery prompt is suppressed
    markCleanExit().catch(() => { /* best effort on unload */ });

    // Dispose pane manager (disposes all panes + their LayerManagers)
    this.paneManager.destroy();
    this.inputManager.destroy();
    this.drawingEngine.dispose();
    if (this._workerBridge) this._workerBridge.dispose();
    if (this._webglRenderer) this._webglRenderer.dispose();
    if (this._webglCanvas?.parentElement) this._webglCanvas.parentElement.removeChild(this._webglCanvas);
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this._countdownInterval) clearInterval(this._countdownInterval);
    if (this._countdownOverlay) this._countdownOverlay.dispose();
    // P3-2: Unregister memory estimator
    memoryBudget.unregister('chartEngine');
    if (this._memoryUnsubscribe) this._memoryUnsubscribe();
  }

  /**
   * Get a composite canvas snapshot suitable for screenshots or exports.
   * Merges all 5 rendering layers into a single canvas.
   *
   * @returns A canvas element containing the flattened chart image
   *
   * @example
   * ```ts
   * const canvas = engine.getCanvas();
   * const dataUrl = canvas.toDataURL('image/png');
   * ```
   */
  getCanvas(): HTMLCanvasElement {
    // Composite all panes (main + indicators) for export
    return this.paneManager.getSnapshotCanvas();
  }

  /**
   * Respond to container size changes. Rebuilds spatial index,
   * syncs WebGL overlay dimensions, and triggers a full redraw.
   * Called automatically by ResizeObserver; can also be called manually.
   */
  resize(): void {
    // LayerManager handles resize via ResizeObserver automatically
    this.markDirty();
    // Rebuild spatial index on resize
    if (this._sceneGraph) {
      this._sceneGraph.rebuildSpatialIndex(
        this.container.clientWidth || 1920,
        this.container.clientHeight || 1080
      );
    }
    // Sync WebGL overlay canvas dimensions
    if (this._webglRenderer && this._webglCanvas) {
      const pr = window.devicePixelRatio || 1;
      const paneEl = this.paneManager.mainPane.container;
      const w = paneEl.clientWidth;
      const h = paneEl.clientHeight;
      this._webglCanvas.width = w * pr;
      this._webglCanvas.height = h * pr;
      this._webglCanvas.style.width = w + 'px';
      this._webglCanvas.style.height = h + 'px';
      this._webglRenderer.resize(w * pr, h * pr);
    }
  }

  // ─── Demand-Driven Rendering (Phase 1.1.1) ──────────────────

  /**
   * Determine whether the next requestAnimationFrame callback is needed.
   * Returns `true` if any layer is dirty, an animation is in progress,
   * or a live chart type (heatmap, footprint) requires continuous updates.
   * This is the core of demand-driven rendering — the engine sleeps at
   * 0% CPU when nothing changes.
   */
  _needsNextFrame(): boolean {
    if (this.state.mainDirty || this.state.topDirty) return true;
    if (this.layers.anyDirty()) return true;
    // B1.6: InputManager animations keep the render loop alive
    if (this.inputManager?.hasActiveAnimations()) return true;
    // B2.4: Y-axis tick cross-fade transition
    if (this._niceStepTransition) return true;
    // Task 8.2.1 + #20: Animation in progress — keep rendering only if
    // the remaining delta maps to ≥0.5 physical pixel on screen.
    if (!this._formingInterpolator.isDone) {
      const delta = this._formingInterpolator.maxDelta();
      const pr = window.devicePixelRatio || 1;
      const pxDelta = delta * (this.state.priceScale || 1) * pr;
      if (pxDelta >= 0.5) return true;
    }
    // Live chart types that need continuous updates
    if (this.props.showHeatmap || this.props.chartType === 'footprint') return true;
    return false;
  }

  /**
   * Schedule a render frame via `requestAnimationFrame` if one isn't
   * already pending. Safe to call multiple times — only one frame will
   * be queued. This is the primary entry point for triggering redraws.
   */
  _scheduleDraw(): void {
    if (!this.raf) {
      this.raf = requestAnimationFrame(this.renderLoop);
    }
  }

  /**
   * Force all rendering layers to redraw on the next frame.
   * Call this after any state change that affects visual output
   * (e.g., theme change, external data mutation, window focus).
   *
   * @example
   * ```ts
   * engine.props.theme = 'light';
   * engine.markDirty(); // triggers full repaint
   * ```
   */
  markDirty(): void {
    this.layers.markAllDirty();
    this.state.mainDirty = true;
    this.state.topDirty = true;
    this._scheduleDraw();
  }

  /**
   * Load OHLCV bar data into the chart. Handles tick updates (same bar count)
   * with smooth animation and new-bar additions with auto-scroll.
   *
   * @param bars - Array of OHLCV bar objects (must be sorted by time ascending)
   *
   * @example
   * ```ts
   * const bars = await fetch('/api/bars?symbol=BTCUSDT&tf=1h').then(r => r.json());
   * engine.setData(bars);
   * ```
   */
  setData(bars: Bar[]): void {
    // ─── Input Validation (dev only) ────────────────────────────────
    if (__DEV__) {
      const result = validateBars(bars);
      if (!result.valid) {
        for (const err of result.errors) {
          logger.engine.warn(err.message);
        }
      }
    }
    // ─── Phase 1.1.2: Track tick vs new-bar updates ─────────────────
    this._tickUpdate = (bars.length > 0 && this.bars.length === bars.length);

    // Task 2.3.25: Mark live subscription active on tick data
    if (this._tickUpdate) this._hasLiveSubscription = true;

    // Task 8.2.1: Route forming candle animation through FormingCandleInterpolator
    if (this._tickUpdate) {
      const last = bars[bars.length - 1];
      this._formingInterpolator.setTarget({ open: last.open, high: last.high, low: last.low, close: last.close });
      // Compat: keep _animTarget/_animCurrent for FrameState snapshot
      this._animTarget = { open: last.open, high: last.high, low: last.low, close: last.close };
      this._animCurrent = this._formingInterpolator.current as unknown;
    } else {
      // New bar added or data reset — snap immediately
      if (bars.length > 0) {
        const last = bars[bars.length - 1];
        this._formingInterpolator.snap({ open: last.open, high: last.high, low: last.low, close: last.close });
      } else {
        this._formingInterpolator.reset();
      }
      this._animTarget = null;
      this._animCurrent = null;
      if (bars.length !== this.bars.length) {
        this._loadTimestamp = performance.now();
      }
    }
    // ─── Auto-scroll to latest bar (Tier 1.4) ─────────────────────
    if (bars.length > this.bars.length && this.state.scrollOffset < 2) {
      this.state.scrollOffset = 0;
    }

    // Bug fix: Reset price scale when data set changes (symbol/TF switch)
    // Without this, the Y-axis stays at the previous symbol's price range.
    // Uses _pendingScaleReset flag (set by setProps) OR detects huge price range change.
    if (bars.length > 0) {
      const needsReset = this._pendingScaleReset;
      // Heuristic: if the new data's midpoint is 5x different from old, force reset
      if (!needsReset && this.bars.length > 0) {
        const oldMid = (this.bars[this.bars.length - 1].high + this.bars[this.bars.length - 1].low) / 2;
        const newMid = (bars[bars.length - 1].high + bars[bars.length - 1].low) / 2;
        const ratio = oldMid > 0 ? newMid / oldMid : 0;
        if (ratio < 0.2 || ratio > 5) {
          this.state.priceScale = 1;
          this.state.priceScroll = 0;
          this.state.autoScale = true;
        }
      }
      if (needsReset) {
        this.state.priceScale = 1;
        this.state.priceScroll = 0;
        this.state.autoScale = true;
        this._pendingScaleReset = false;
      }
    }

    this.bars = bars;

    // Sprint 18 #115: Update countdown overlay context
    if (this._countdownOverlay && bars.length > 0) {
      const lastBar = bars[bars.length - 1];
      this._countdownOverlay.setContext(this.timeframe, lastBar.time || lastBar.t);
      if (this._tickUpdate && !this._countdownOverlay['_intervalId']) {
        this._countdownOverlay.start();
      }
    }
    // Populate typed array buffer for high-perf access
    this._barBuffer.fromArray(bars);
    // Task 2.3.27: Only mark DATA + UI dirty on tick updates — Grid and Indicators
    // haven't changed (same bar count), so skip them to avoid redundant repaints.
    this.layers.markDirty(LAYERS.DATA);
    this.state.topDirty = true;
    if (!this._tickUpdate) {
      this.layers.markDirty(LAYERS.GRID);
      this.layers.markDirty(LAYERS.INDICATORS);
      this.state.mainDirty = true;
    }

    // Mark indicator pane layers dirty so they re-render with updated data.
    // #19: On tick updates (same bar count), indicator computed data hasn't
    // changed — skip the expensive markAllDirty() to avoid redundant repaints.
    if (!this._tickUpdate) {
      for (const pane of this.paneManager.indicatorPanes) {
        pane.layers.markAllDirty();
        pane.state.dirty = true;
        // Auto-fit Y-axis to indicator data range
        if (pane.state.autoScale) {
          this._autoFitPaneY(pane);
        }
      }
    }

    this._scheduleDraw();

    // ─── Drawing Alert Check (Sprint 4) ─────────────────────────
    if (this.alerts?.length > 0 && bars.length >= 2) {
      const current = bars[bars.length - 1].close;
      const prev = bars[bars.length - 2].close;
      const currentTime = bars[bars.length - 1].time;
      const triggered = checkDrawingAlerts(this.alerts as unknown[], current, currentTime, prev);
      if (triggered.length > 0 && this.callbacks.onDrawingAlert) {
        for (const alert of triggered) {
          this.callbacks.onDrawingAlert(alert);
        }
      }
    }
  }

  /**
   * P1 Task 2: Lightweight fast path for streaming tick updates.
   *
   * Mutates the last bar in-place and schedules a minimal redraw.
   * Skips validation, full buffer rebuild, indicator pane dirty marks,
   * and price scale heuristics — ~5x faster than setData() for ticks.
   *
   * @param bar - Updated OHLCV values for the last (forming) bar
   */
  updateLast(bar: Bar): void {
    const bars = this.bars;
    if (bars.length === 0) return;

    // Mutate last bar in-place (same array reference = no GC)
    const last = bars[bars.length - 1];
    last.open = bar.open;
    last.high = bar.high;
    last.low = bar.low;
    last.close = bar.close;
    last.volume = bar.volume;
    last.time = bar.time;

    // Update typed array buffer (last entry only)
    this._barBuffer.updateLast(bar);

    // Route through forming candle interpolator
    this._tickUpdate = true;
    this._formingInterpolator.setTarget({ open: bar.open, high: bar.high, low: bar.low, close: bar.close });
    this._animTarget = { open: bar.open, high: bar.high, low: bar.low, close: bar.close };
    this._animCurrent = this._formingInterpolator.current as unknown;

    // Mark live subscription active
    this._hasLiveSubscription = true;

    // Minimal dirty marking — only DATA + UI (no grid, no indicators)
    this.layers.markDirty(LAYERS.DATA);
    this.state.topDirty = true;

    this._scheduleDraw();

    // Drawing alert check (hot path — inline for speed)
    if (this.alerts?.length > 0 && bars.length >= 2) {
      const prev = bars[bars.length - 2].close;
      const currentTime = bar.time;
      const triggered = checkDrawingAlerts(this.alerts as unknown[], bar.close, currentTime, prev);
      if (triggered.length > 0 && this.callbacks.onDrawingAlert) {
        for (const alert of triggered) {
          this.callbacks.onDrawingAlert(alert);
        }
      }
    }
  }

  /**
   * Apply technical indicators to the chart. Each indicator object
   * specifies its type, parameters, and visual style.
   *
   * @param indicators - Array of indicator configuration objects
   *
   * @example
   * ```ts
   * engine.setIndicators([
   *   { type: 'ema', period: 20, color: '#FFD700' },
   *   { type: 'rsi', period: 14, pane: 1 },
   * ]);
   * ```
   */
  setIndicators(indicators: unknown[]): void {
    // ─── Input Validation (dev only) ────────────────────────────────
    if (__DEV__) {
      const result = validateIndicators(indicators);
      if (!result.valid) {
        for (const err of result.errors) {
          logger.engine.warn(err.message);
        }
      }
    }
    this.indicators = indicators;

    // Sync indicator panes with PaneManager
    this.paneManager.syncIndicators(
      indicators as unknown[],
      this.props.paneHeights as unknown,
      this.state.collapsedPanes,
    );

    this.layers.markDirty(LAYERS.INDICATORS);
    this.state.mainDirty = true;
    this._scheduleDraw();
  }

  /**
   * Update chart configuration props. Merges with existing props.
   * Automatically reloads persisted drawings when symbol or timeframe changes.
   *
   * @param props - Partial chart props to merge
   *
   * @example
   * ```ts
   * engine.setProps({ chartType: 'heikinashi', showVolume: true, theme: 'dark' });
   * ```
   */
  setProps(props: ChartProps): void {
    // ─── Input Validation (dev only) ────────────────────────────────
    if (__DEV__) {
      const result = validateProps(props);
      if (!result.valid) {
        for (const err of result.errors) {
          logger.engine.warn(err.message);
        }
      }
    }
    // ─── Shallow diff: skip markDirty() if nothing actually changed ──
    let changed = false;
    for (const key in props) {
      if ((props as unknown)[key] !== (this.props as unknown)[key]) {
        changed = true;
        break;
      }
    }

    const prevSymbol = this.symbol;
    const prevTf = this.timeframe;
    this.props = { ...this.props, ...props };
    this.symbol = this.props.symbol || this.symbol;
    this.timeframe = this.props.tf || this.timeframe;

    // Only trigger a full repaint if at least one prop value changed
    if (changed) {
      this.markDirty();
    }

    // Bug fix: Reset price scale when symbol or timeframe changes.
    // Without this, the Y-axis stays locked to the previous symbol's range
    // (e.g., BTC ~68000 when switching to AAPL ~260).
    if (this.symbol !== prevSymbol || this.timeframe !== prevTf) {
      this.state.priceScale = 1;
      this.state.priceScroll = 0;
      this.state.autoScale = true;
      this._pendingScaleReset = true; // Signal to setData() in case it arrives before this effect
      this.loadSavedDrawings();
    }
  }

  /**
   * Load persisted drawings from IndexedDB for the current symbol
   * and timeframe. Called automatically when symbol/timeframe changes
   * via `setProps()`. Can also be called manually to force a reload.
   *
   * @returns Resolves when drawings have been loaded into the drawing engine
   */
  async loadSavedDrawings(): Promise<void> {
    if (!this.symbol) return;
    try {
      const saved = await loadDrawings(this.symbol, this.timeframe);
      if (saved && saved.length > 0) {
        this.drawingEngine.loadDrawings(saved);
      } else {
        this.drawingEngine.loadDrawings([]);
      }
    } catch (err) {
      logger.engine.warn('Failed to load saved drawings', err);
    }
  }

  /**
   * Set drawing-based price alerts. Alerts are checked on each
   * `setData()` call and emit `onDrawingAlert` callbacks when triggered.
   *
   * @param alerts - Array of alert configurations (trendline, horizontal, etc.)
   */
  setAlerts(alerts: unknown[]): void {
    this.alerts = alerts;
    this.state.mainDirty = true;
    this._scheduleDraw();
  }

  /**
   * Receive a crosshair position from another chart instance via
   * the CrosshairBus. Renders a ghost crosshair on this chart at
   * the synced time/price coordinates.
   *
   * @param data - `{ time, price }` from the broadcasting chart, or `null` to clear
   */
  setSyncedCrosshair(data: unknown): void {
    this.syncedCrosshair = data;
    this.state.topDirty = true;
    this._scheduleDraw();
  }

  /**
   * Render trade execution markers (buy/sell arrows) on the chart.
   * Delegates to `TradeMarkerRenderer` with the current viewport transforms.
   *
   * @param ctx - Canvas 2D context to draw on
   * @param trades - Array of trade objects with `time`, `price`, `side`
   * @param symbol - Current chart symbol for filtering
   * @param bars - Full bar array
   * @param startIdx - Visible range start index
   * @param endIdx - Visible range end index
   * @param timeTransform - Time-to-pixel transform function
   * @param p2y - Price-to-Y pixel transform function
   * @param pr - Device pixel ratio
   */
  renderTradeMarkers(
    ctx: CanvasRenderingContext2D,
    trades: unknown[],
    symbol: string,
    bars: Bar[],
    startIdx: number,
    endIdx: number,
    timeTransform: unknown,
    p2y: unknown,
    pr: number,
  ): void {
    (renderTradeMarkersImpl as unknown)(ctx, trades, symbol, bars, startIdx, endIdx, timeTransform, p2y, pr);
  }

  /**
   * Auto-fit a pane's Y-axis to the visible range of its indicator data.
   * Scans computed indicator outputs within the visible bar range to find
   * min/max values, then sets paneState.yMin/yMax with 10% padding.
   */
  _autoFitPaneY(pane: unknown): void {
    const indicators = pane.state.indicators || [];
    const bars = this.bars;
    if (bars.length === 0 || indicators.length === 0) return;

    const S = this.state;
    const visibleBars = S.visibleBars || 80;
    const endIdx = Math.max(0, bars.length - 1 - (S.scrollOffset || 0));
    const startIdx = Math.max(0, endIdx - visibleBars + 1);

    let dataMin = Infinity;
    let dataMax = -Infinity;

    for (const ind of indicators) {
      if (!ind.computed) continue;
      for (const out of (ind.outputs || [])) {
        const vals = ind.computed[out.key];
        if (!vals) continue;
        for (let i = startIdx; i <= endIdx && i < vals.length; i++) {
          const v = vals[i];
          if (v == null || isNaN(v)) continue;
          if (v < dataMin) dataMin = v;
          if (v > dataMax) dataMax = v;
        }
      }
      // Also check histogram values
      if (ind.computed.histogram) {
        const histVals = ind.computed.histogram;
        for (let i = startIdx; i <= endIdx && i < histVals.length; i++) {
          const v = histVals[i];
          if (v == null || isNaN(v)) continue;
          if (v < dataMin) dataMin = v;
          if (v > dataMax) dataMax = v;
        }
      }
    }

    if (dataMin === Infinity || dataMax === -Infinity) return;

    // Add 10% padding
    const range = dataMax - dataMin || 1;
    const pad = range * 0.1;
    pane.state.yMin = dataMin - pad;
    pane.state.yMax = dataMax + pad;
  }

  /**
   * Main render loop callback, invoked by `requestAnimationFrame`.
   * Drives candle animation lerp, delegates to the Forge Render Pipeline,
   * and re-schedules itself only if another frame is needed (demand-driven).
   * Do not call directly — use `markDirty()` or `_scheduleDraw()` instead.
   */
  renderLoop(): void {
    this.raf = null; // Clear pending rAF reference
    this.fb.beginFrame();
    // Task 2.3.21: MicroJankDetector frame timing
    microJankDetector.beginFrame();

    // B1.6: Tick all InputManager animations (inertia, zoom, price, momentum, scroll-to-now)
    this.inputManager.tickAnimations();

    const S = this.state;
    const bars = this.bars;

    if (!bars.length) { this.fb.endFrame(); return; }

    // ─── P3-2: Memory Pressure Render Throttle ───────────────────
    // Level 0 = normal, Level 1 = warning (cap bars), Level 2 = critical (30fps)
    const degradation = this._degradationLevel;
    if (degradation >= 2) {
      // Critical: skip every other frame (effectively 30fps)
      if ((this._countdownTick & 1) === 1) {
        this.fb.endFrame();
        this._scheduleDraw(); // Stay alive but throttled
        return;
      }
    }

    // ─── Task 8.2.1: Forming candle interpolation ────────────────────
    if (!this._formingInterpolator.isDone && bars.length > 0) {
      const now = performance.now();
      const dt = Math.min(now - this._lastFrameTime, 32); // Cap at ~30fps min
      this._lastFrameTime = now;

      const result = this._formingInterpolator.tick(dt);

      const lastBar = bars[bars.length - 1] as unknown;
      lastBar._animOpen = result.open;
      lastBar._animHigh = result.high;
      lastBar._animLow = result.low;
      lastBar._animClose = result.close;

      // Sync compat fields for FrameState
      this._animCurrent = { open: result.open, high: result.high, low: result.low, close: result.close };

      if (!result.done) {
        S.mainDirty = true;
        S.topDirty = true;
        this.layers.markDirty(LAYERS.DATA);
        this.layers.markDirty(LAYERS.UI);
      }
    }

    // Force continuous rendering for live-updating chart types
    if (this.props.showHeatmap || this.props.chartType === 'footprint') {
      S.mainDirty = true;
    }

    // ─── Create immutable frame snapshot ───────────────────────
    const lod = this.fb.getLOD();

    // Only run the pipeline when something is dirty
    if (S.mainDirty || S.topDirty || this.layers.anyDirty()) {
      const frameState = FrameState.create(this as unknown, lod as unknown, this._pipeline._prevFrameState);

      // Mark layers dirty based on engine dirty flags.
      // Note: GRID is NOT included here — grid lines only change on viewport
      // geometry changes (zoom, scroll, resize), which mark GRID dirty explicitly
      // via InputManager/setData/setProps. This avoids ~30% redundant grid redraws
      // during live tick streaming. (Strategy Item #5)
      if (S.mainDirty) {
        this.layers.markDirty(LAYERS.DATA);
        this.layers.markDirty(LAYERS.INDICATORS);
      }
      if (S.topDirty) {
        this.layers.markDirty(LAYERS.UI);
      }

      S.mainDirty = false;
      S.topDirty = false;

      // ─── Delegate to the Forge Render Pipeline ────────────
      this._pipeline.execute(frameState, this, this.fb, null);
    }

    // Schedule next frame only if still needed (demand-driven rendering)
    if (this._needsNextFrame()) {
      this._scheduleDraw();
    }

    this.fb.endFrame();
    // Task 2.3.21: MicroJankDetector frame timing
    microJankDetector.endFrame();
  }
}
