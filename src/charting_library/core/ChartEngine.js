import { DARK_THEME, LIGHT_THEME } from './ThemeManager.js';
import { FrameBudget } from './FrameBudget.js';
import { createDrawingEngine } from '../tools/tools/DrawingEngine.js';
import { createDrawingRenderer } from '../tools/tools/DrawingRenderer.js';
import { niceScale, formatPrice, createPriceTransform } from './CoordinateSystem.js';
import { createTimeTransform } from './TimeAxis.js';
import { resolveTheme } from './RenderPipeline.js';
import { renderOverlayIndicator, renderPaneIndicator } from '../studies/indicators/renderer.js';
import { InputManager } from './InputManager.js';
import { HeatmapRenderer } from '../renderers/HeatmapRenderer.js';
import { getAggregator } from '../../data/OrderFlowAggregator.js';
import { drawSessionDividers } from '../renderers/SessionDividers.js';
import { renderDeltaHistogram, renderVolumeProfile, renderLargeTradeMarkers } from '../renderers/OrderFlowOverlays.js';
import { renderOIOverlay, renderLiquidationMarkers } from '../renderers/DerivativesOverlays.js';
import { toRenkoBricks, toRangeBars } from './barTransforms.js';
import { tfToMs, formatCountdown, formatTimeLabel } from './barCountdown.js';
import { getChartDrawFunction } from '../renderers/renderers/ChartTypes.js';
import { LayerManager, LAYERS } from './LayerManager.js';
import { BarDataBuffer } from './BarDataBuffer.js';
import { autoDecimate } from './Decimator.js';
import { WorkerBridge } from './WorkerBridge.js';
import { debouncedSave, loadDrawings } from '../tools/DrawingPersistence.js';
import { WebGLRenderer } from '../renderers/WebGLRenderer.js';
import { WebGPUCompute } from '../renderers/WebGPUCompute.js';
import { checkDrawingAlerts } from '../tools/DrawingAlertEngine.js';

// ─── Forge Render Pipeline ───────────────────────────────────────
import { FrameState, CHANGED } from './FrameState.js';
import { createDefaultPipeline } from './RenderPipeline.js';
import { executeGridStage } from './stages/GridStage.js';
import { executeDataStage } from './stages/DataStage.js';
import { executeIndicatorStage } from './stages/IndicatorStage.js';
import { executeDrawingStage } from './stages/DrawingStage.js';
import { executeOverlayStage } from './stages/OverlayStage.js';
import { executeAxesStage } from './stages/AxesStage.js';
import { executeUIStage } from './stages/UIStage.js';
import { SceneGraph } from '../scene/SceneGraph.js';

export class ChartEngine {
  constructor(container, options = {}) {
    this.container = container;
    this.callbacks = options.callbacks || {};
    this.props = options.props || {};
    this.bars = [];
    this.indicators = [];
    this.alerts = [];
    this.syncedCrosshair = null; // { time, price } from CrosshairBus
    this.symbol = options.props?.symbol || '';
    this.timeframe = options.props?.tf || '1h';

    // Animated candle transition state
    this._animTarget = null; // Target OHLC for last bar
    this._animCurrent = null; // Current lerp'd OHLC for last bar
    this._animLerp = 0.25; // Lerp speed (0-1, higher = faster)

    // ─── Viewport Change Tracking (Batch Render Optimization) ────
    // Only rebuild WebGL instance buffers when the visible range changes.
    // On crosshair-only frames, skip DATA/INDICATORS layers entirely.
    this._prevStartIdx = -1;
    this._prevEndIdx = -1;
    this._prevVisibleBars = -1;
    this._viewportChanged = true; // Force first render

    // ─── 5-Layer Compositing System ────────────────────────────────
    // All 5 layers render on the main thread for maximum reliability.
    // OffscreenCanvas worker rendering is disabled — the RenderWorker
    // was never fully wired, leaving transferred canvases blank.
    this._offscreenSkipStages = null;
    this.layers = new LayerManager(container, {
      offscreenLayers: [],   // Disabled: all rendering on main thread
    });

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
    // z-index 6 sits above the 5 compositing layers (0-4) but pointer-events:none keeps it non-blocking
    this._webglCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:6;pointer-events:none';
    container.appendChild(this._webglCanvas);
    this._webglRenderer = new WebGLRenderer(this._webglCanvas);

    // ─── WebGPU Compute (GPU-accelerated indicator computation) ──
    this._gpuCompute = new WebGPUCompute();

    // ─── OffscreenCanvas Worker State (disabled) ──────────────
    this._offscreenActive = false;

    // ─── Typed Array Data Buffer ─────────────────────────────
    this._barBuffer = new BarDataBuffer();

    // ─── Worker Bridge (offload indicators + OffscreenCanvas rendering) ─
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
    };

    this.resize = this.resize.bind(this);
    // LayerManager handles ResizeObserver internally; no separate ro needed

    this.drawingEngine = createDrawingEngine({
      magnetSnap: (price, time) => {
        if (!this.props.magnetMode) return { price, time };
        if (!this.bars || !this.bars.length) return { price, time };

        let targetBar = null;
        const vis = this.state.lastRender?.vis;
        if (vis && vis.length > 0) {
          let minTimeDiff = Infinity;
          for (const b of vis) {
            const diff = Math.abs(b.time - time);
            if (diff < minTimeDiff) { minTimeDiff = diff; targetBar = b; }
          }
        } else {
          targetBar = this.bars.find((b) => b.time === time);
        }

        if (!targetBar) return { price, time };

        // Enhanced: track which OHLC level is closest for label display
        const ohlcPoints = [
          { p: targetBar.open, label: 'Open' },
          { p: targetBar.high, label: 'High' },
          { p: targetBar.low, label: 'Low' },
          { p: targetBar.close, label: 'Close' },
        ];
        let closest = price;
        let closestLabel = 'OHLC';
        let minDist = Infinity;
        for (const { p, label } of ohlcPoints) {
          const dist = Math.abs(p - price);
          if (dist < minDist) { minDist = dist; closest = p; closestLabel = label; }
        }

        const relThreshold = Math.abs(price) * 0.005;
        if (minDist <= relThreshold) {
          return { price: closest, time: targetBar.time, label: closestLabel };
        }
        return { price, time: targetBar.time };
      },
      onChange: (drawings) => {
        this.state.mainDirty = true;
        this.state.topDirty = true;
        this._scheduleDraw();
        if (this.callbacks.onDrawingsChange) this.callbacks.onDrawingsChange(drawings);
        // Sprint 13.1: Auto-save drawings to IndexedDB
        if (this.symbol) {
          debouncedSave(this.symbol, this.timeframe, drawings);
        }
      },
      onStateChange: (state) => {
        this.state.topDirty = true;
        this._scheduleDraw();
        if (this.callbacks.onDrawingStateChange) this.callbacks.onDrawingStateChange(state);
      },
    });

    this.drawingRenderer = createDrawingRenderer(this.drawingEngine);
    this.inputManager = new InputManager(this);
    this.raf = null;
    this.fb = new FrameBudget({ targetFps: 60 });

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
    this._lastDisplayTicks = null;
    this._lastPriceTransform = null;
    this._lastTimeTransform = null;

    // ─── OffscreenCanvas render worker (disabled) ──────────────────
    // Kept as no-op — all rendering on main thread for reliability.

    this.renderLoop = this.renderLoop.bind(this);

    this._scheduleDraw();

    // Countdown timer: only repaint the lightweight UI layer every second.
    // DATA layer refresh for pulsing dot moved to every 10s to reduce GPU churn.
    this._countdownTick = 0;
    this._countdownInterval = setInterval(() => {
      this.layers.markDirty(LAYERS.UI);
      this.state.topDirty = true;
      this._countdownTick++;
      if (this._countdownTick % 10 === 0) {
        this.layers.markDirty(LAYERS.DATA);
        this.state.mainDirty = true;
      }
      this._scheduleDraw();
    }, 1000);
  }

  destroy() {
    this.layers.dispose();
    this.inputManager.destroy();
    this.drawingEngine.dispose();
    if (this._workerBridge) this._workerBridge.dispose();
    if (this._webglRenderer) this._webglRenderer.dispose();
    if (this._webglCanvas?.parentElement) this._webglCanvas.parentElement.removeChild(this._webglCanvas);
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this._countdownInterval) clearInterval(this._countdownInterval);
  }

  getCanvas() {
    return this.layers.getSnapshotCanvas();
  }

  resize() {
    // LayerManager handles resize via ResizeObserver automatically
    // This is kept for manual resize calls
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
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      this._webglCanvas.width = w * pr;
      this._webglCanvas.height = h * pr;
      this._webglCanvas.style.width = w + 'px';
      this._webglCanvas.style.height = h + 'px';
      this._webglRenderer.resize(w * pr, h * pr);
    }
  }

  // ─── Demand-Driven Rendering (Phase 1.1.1) ──────────────────

  /**
   * Check whether the next rAF frame is needed.
   * Returns true if anything is dirty, animating, or a live chart type is active.
   */
  _needsNextFrame() {
    if (this.state.mainDirty || this.state.topDirty) return true;
    if (this.layers.anyDirty()) return true;
    // Animation in progress — keep rendering until lerp settles
    if (this._animTarget && this._animCurrent) {
      for (const k of ['open', 'high', 'low', 'close']) {
        if (Math.abs(this._animTarget[k] - this._animCurrent[k]) > 0.0001) return true;
      }
    }
    // Live chart types that need continuous updates
    if (this.props.showHeatmap || this.props.chartType === 'footprint') return true;
    return false;
  }

  /**
   * Schedule a render frame if one isn't already pending.
   * Call this any time state changes that should trigger a repaint.
   */
  _scheduleDraw() {
    if (!this.raf) {
      this.raf = requestAnimationFrame(this.renderLoop);
    }
  }

  markDirty() {
    this.layers.markAllDirty();
    this.state.mainDirty = true;
    this.state.topDirty = true;
    this._scheduleDraw();
  }

  setData(bars) {
    // ─── Phase 1.1.2: Track tick vs new-bar updates ─────────────────
    // A tick update = same bar count, last bar OHLC changed.
    // DataStage uses this to skip full re-render (incremental fast path).
    this._tickUpdate = (bars.length > 0 && this.bars.length === bars.length);

    // Detect tick update (same bar count, last bar changed) for animation
    if (this._tickUpdate) {
      const last = bars[bars.length - 1];
      this._animTarget = { open: last.open, high: last.high, low: last.low, close: last.close };
      if (!this._animCurrent) {
        this._animCurrent = { ...this._animTarget };
      }
    } else {
      // New bar added or data reset — snap immediately & start entrance animation
      this._animTarget = null;
      this._animCurrent = null;
      if (bars.length !== this.bars.length) {
        this._loadTimestamp = Date.now();
      }
    }
    // ─── Auto-scroll to latest bar (Tier 1.4) ─────────────────────
    // If scrollOffset is near 0 (viewing latest bars) and new bars arrive,
    // keep the chart pinned to the latest candle.
    if (bars.length > this.bars.length && this.state.scrollOffset < 2) {
      this.state.scrollOffset = 0;
    }

    this.bars = bars;
    // Populate typed array buffer for high-perf access
    this._barBuffer.fromArray(bars);
    // Mark data-dependent layers dirty
    this.layers.markDirty(LAYERS.GRID);
    this.layers.markDirty(LAYERS.DATA);
    this.layers.markDirty(LAYERS.INDICATORS);
    this.state.mainDirty = true;
    this.state.topDirty = true;
    this._scheduleDraw();

    // ─── Drawing Alert Check (Sprint 4) ─────────────────────────
    // On each data update, check if price has crossed any drawing-based alerts.
    if (this.alerts?.length > 0 && bars.length >= 2) {
      const current = bars[bars.length - 1].close;
      const prev = bars[bars.length - 2].close;
      const currentTime = bars[bars.length - 1].time;
      const triggered = checkDrawingAlerts(this.alerts, current, currentTime, prev);
      if (triggered.length > 0 && this.callbacks.onDrawingAlert) {
        for (const alert of triggered) {
          this.callbacks.onDrawingAlert(alert);
        }
      }
    }

    // ─── OffscreenCanvas Worker Data Sync (Phase 1.3.3) ─────────
    if (this._offscreenActive && this._workerBridge) {
      this._workerBridge.sendDataToRenderWorker(this._barBuffer);
    }
  }

  setIndicators(indicators) {
    this.indicators = indicators;
    this.layers.markDirty(LAYERS.INDICATORS);
    this.state.mainDirty = true;
    this._scheduleDraw();
  }

  setProps(props) {
    const prevSymbol = this.symbol;
    const prevTf = this.timeframe;
    this.props = { ...this.props, ...props };
    this.symbol = this.props.symbol || this.symbol;
    this.timeframe = this.props.tf || this.timeframe;
    this.markDirty();

    // Sprint 13.1: Auto-load drawings when symbol or timeframe changes
    if (this.symbol !== prevSymbol || this.timeframe !== prevTf) {
      this.loadSavedDrawings();
    }
  }

  /**
   * Sprint 13.1: Load persisted drawings from IndexedDB.
   * Called on mount and on symbol/timeframe change.
   */
  async loadSavedDrawings() {
    if (!this.symbol) return;
    try {
      const saved = await loadDrawings(this.symbol, this.timeframe);
      if (saved && saved.length > 0) {
        this.drawingEngine.loadDrawings(saved);
      } else {
        // Clear existing drawings when switching to a symbol with no saved drawings
        this.drawingEngine.loadDrawings([]);
      }
    } catch (err) {
      console.warn('[ChartEngine] Failed to load saved drawings:', err);
    }
  }

  setAlerts(alerts) {
    this.alerts = alerts;
    this.state.mainDirty = true;
    this._scheduleDraw();
  }

  setSyncedCrosshair(data) {
    this.syncedCrosshair = data;
    this.state.topDirty = true;
    this._scheduleDraw();
  }

  renderTradeMarkers(ctx, trades, symbol, bars, startIdx, endIdx, timeTransform, p2y, pr) {
    if (!trades?.length || !symbol) return;
    const symUpper = symbol.toUpperCase();
    const matchingTrades = trades.filter((t) => {
      const ts = (t.symbol || '').toUpperCase();
      return ts === symUpper || ts === symUpper + 'USDT' || ts.includes(symUpper);
    });

    if (!matchingTrades.length) return;
    for (const trade of matchingTrades) {
      const entryTime = trade.entryTime || trade.openTime;
      const exitTime = trade.exitTime || trade.closeTime;
      const entryPrice = trade.entryPrice || trade.openPrice;
      const exitPrice = trade.exitPrice || trade.closePrice;
      const isWin = (exitPrice - entryPrice) * (trade.side === 'short' ? -1 : 1) > 0;

      let entryIdx = -1, exitIdx = -1;
      if (entryTime) {
        for (let i = 0; i < bars.length; i++) {
          if (Math.abs(bars[i].time - entryTime) < 60000 * 5) { entryIdx = i; break; }
        }
      }
      if (exitTime) {
        for (let i = 0; i < bars.length; i++) {
          if (Math.abs(bars[i].time - exitTime) < 60000 * 5) { exitIdx = i; break; }
        }
      }

      if (entryIdx >= startIdx && entryIdx <= endIdx && entryPrice) {
        const x = Math.round(timeTransform.indexToPixel(entryIdx) * pr);
        const y = Math.round(p2y(entryPrice) * pr);
        const isLong = trade.side !== 'short';

        ctx.fillStyle = isLong ? '#26A69A' : '#EF5350';
        ctx.beginPath();
        const s = Math.round(6 * pr);
        if (isLong) {
          ctx.moveTo(x, y - s); ctx.lineTo(x - s, y + s); ctx.lineTo(x + s, y + s);
        } else {
          ctx.moveTo(x, y + s); ctx.lineTo(x - s, y - s); ctx.lineTo(x + s, y - s);
        }
        ctx.closePath(); ctx.fill();
      }

      if (exitIdx >= startIdx && exitIdx <= endIdx && exitPrice) {
        const x = Math.round(timeTransform.indexToPixel(exitIdx) * pr);
        const y = Math.round(p2y(exitPrice) * pr);
        ctx.strokeStyle = isWin ? '#26A69A' : '#EF5350';
        ctx.lineWidth = Math.round(2 * pr);
        const s = Math.round(5 * pr);
        ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s); ctx.stroke();
      }

      if (entryIdx >= 0 && exitIdx >= 0 && entryPrice && exitPrice) {
        const x1 = Math.round(timeTransform.indexToPixel(entryIdx) * pr);
        const y1 = Math.round(p2y(entryPrice) * pr);
        const x2 = Math.round(timeTransform.indexToPixel(exitIdx) * pr);
        const y2 = Math.round(p2y(exitPrice) * pr);
        ctx.strokeStyle = isWin ? 'rgba(38,166,154,0.3)' : 'rgba(239,83,80,0.3)';
        ctx.lineWidth = Math.max(1, pr);
        ctx.setLineDash([Math.round(3 * pr), Math.round(3 * pr)]);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  renderLoop() {
    this.raf = null; // Clear pending rAF reference
    this.fb.beginFrame();

    const S = this.state;
    const bars = this.bars;

    if (!bars.length) { this.fb.endFrame(); return; }

    // ─── Animated candle transition: lerp toward target OHLC ────
    if (this._animTarget && this._animCurrent && bars.length > 0) {
      const t = this._animTarget;
      const c = this._animCurrent;
      const lerp = this._animLerp;
      let animating = false;
      for (const k of ['open', 'high', 'low', 'close']) {
        const diff = t[k] - c[k];
        if (Math.abs(diff) > 0.0001) {
          c[k] += diff * lerp;
          animating = true;
        } else {
          c[k] = t[k];
        }
      }
      const lastBar = bars[bars.length - 1];
      lastBar._animOpen = c.open;
      lastBar._animHigh = c.high;
      lastBar._animLow = c.low;
      lastBar._animClose = c.close;
      if (animating) {
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
      const frameState = FrameState.create(this, lod, this._pipeline._prevFrameState);

      // NOTE: Coordinate transforms (priceTransform, timeTransform) and
      // lastRender are computed once inside DataStage to avoid duplication.
      // DataStage always runs when mainDirty is set, which covers all cases
      // that need fresh transforms.

      // Mark layers dirty based on engine dirty flags
      if (S.mainDirty) {
        this.layers.markDirty(LAYERS.GRID);
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
  }
}
