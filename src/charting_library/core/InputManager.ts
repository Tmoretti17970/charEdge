// ═══════════════════════════════════════════════════════════════════
// charEdge — InputManager
// Handles DOM events for the ChartEngine instance.
// Includes inertial pan and smooth eased zoom.
// ═══════════════════════════════════════════════════════════════════

import { LAYERS } from './LayerManager.js';

const FRICTION = 0.96;          // Inertia decay per frame (higher = longer momentum)
const MIN_VELOCITY = 0.3;       // Stop threshold (bars/frame)
const ZOOM_LERP = 0.25;         // Zoom easing speed (0–1) — snappier feel
const ZOOM_SNAP = 0.5;          // Stop easing when within this many bars
const PREFETCH_THRESHOLD = 50;  // Dispatch prefetch when within this many bars of left edge
const OVERSCROLL_MAX = 40;      // Max overscroll in bars beyond edge
const OVERSCROLL_SPRING = 0.85; // Spring-back factor per frame
const RIGHT_MARGIN_FRAC = 0.5;  // Allow scrolling past last bar by this fraction of visibleBars (TradingView-style)

// Task 1.4.12: Y-axis spring physics constants
const PRICE_FRICTION = 0.92;       // Faster decay than horizontal (tighter feel)
const MIN_PRICE_VELOCITY = 0.0001; // Stop threshold for price velocity
const PRICE_SPRING_BACK = 0.15;    // Spring-back stiffness when overscrolled

// Task 1.4.13: Zoom momentum constants
const ZOOM_MOMENTUM_WINDOW = 120;  // ms — consecutive wheel events within this window accumulate
const ZOOM_MOMENTUM_DECAY = 0.92;  // Exponential decay per frame for zoom velocity

// ─── Engine interface (avoids circular ChartEngine dependency) ────

interface LegendHitRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  type: string;
  idx: number;
}

interface RenderSnapshot {
  bSp: number;
  start: number;
  cW: number;
  txH: number;
  pr: number;
  mainH: number;
  paneH: number;
  paneCount: number;
  yMin: number;
  yMax: number;
  [key: string]: unknown;
}

interface ButtonRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface EngineState {
  scrollOffset: number;
  visibleBars: number;
  mouseX: number | null;
  mouseY: number | null;
  hoverIdx: number | null;
  dragging: string | false;
  dragStartX: number;
  dragStartY: number;
  dragStartOffset: number;
  dragStartVisibleBars: number;
  dragStartPriceScale: number;
  dragStartPriceScroll: number;
  autoScale: boolean;
  priceScale: number;
  priceScroll: number;
  scaleMode: string;
  mainDirty: boolean;
  topDirty: boolean;
  timeAxisZoom: boolean;
  lastRender: RenderSnapshot | null;
  collapsedPanes: Set<number>;
  hiddenIndicators: Set<number>;
  _splitterHoverIdx: number;
  _highlightedIndicator: number;
  _legendHitRegions: LegendHitRegion[] | null;
  _scrollToNowBtn: ButtonRect | null;
  _autoFitBtn: ButtonRect | null;
  [key: string]: unknown;
}

interface DrawingEngine {
  onMouseMove(x: number, y: number): boolean;
  onMouseDown(x: number, y: number): boolean;
  onMouseUp(x: number, y: number): boolean;
  cursorHint?: string;
}

interface LayerManager {
  markDirty(layer: string | number): void;
  markAllDirty(): void;
}

interface EngineCallbacks {
  onPaneResize?: (idx: number, fraction: number) => void;
  onPaneToggle?: (idx: number) => void;
  onCrosshairMove?: (data: { price: number; time: number; bar: unknown; x: number; y: number }) => void;
  onBarClick?: (price: number, time: number, bar: unknown) => void;
}

interface EngineRef {
  state: EngineState;
  topCanvas: HTMLCanvasElement;
  bars: { length: number;[idx: number]: { time: number; open: number; high: number; low: number; close: number; volume: number } };
  props: Record<string, unknown>;
  layers: LayerManager | null;
  indicators: unknown[];
  drawingEngine: DrawingEngine | null;
  callbacks: EngineCallbacks;
  symbol: string;
  timeframe: string;
  _scheduleDraw(): void;
  markDirty(): void;
}

type TouchMode = 'pan' | 'pinch' | 'workspace-swipe' | null;

export class InputManager {
  engine: EngineRef;
  tc: HTMLCanvasElement;

  // B1.5: Cached bounding rect — invalidated on resize
  private _cachedRect: DOMRect | null = null;
  private _resizeObs: ResizeObserver | null = null;

  // Inertia state
  private _velocityX: number = 0;
  private _lastMoveTime: number = 0;
  private _lastMoveX: number = 0;
  private _inertiaActive: boolean = false;
  private _velocitySamples: [number, number, number] = [0, 0, 0];
  private _velocityIdx: number = 0;
  private _prefetchDispatched: boolean = false;

  // Smooth zoom state
  private _targetVisibleBars: number | null = null;
  private _zoomActive: boolean = false;
  private _zoomAnchorFrac: number = 0.5;

  // Task 1.4.12: Y-axis spring physics state
  private _priceVelocity: number = 0;
  private _priceInertiaActive: boolean = false;
  private _priceDragSamples: [number, number, number] = [0, 0, 0];
  private _priceDragIdx: number = 0;
  private _lastPriceMoveTime: number = 0;
  private _lastPriceMoveY: number = 0;

  // Task 1.4.13: Zoom momentum state
  private _zoomVelocity: number = 0;
  private _lastWheelTime: number = 0;
  private _zoomMomentumActive: boolean = false;

  // P1-A #1: Trackpad sensitivity calibration
  private _trackpadSensitivity: number = 0.04; // Default reduced from 0.08
  private _smoothedPinchDelta: number = 0; // Exponential smoothing accumulator
  private _lastPinchTime: number = 0;

  // Scroll-to-now animation state
  private _scrollToNowActive: boolean = false;

  // B2.3: Elastic pinch spring-back state
  private _pinchOverstretched: boolean = false;
  private _pinchSpringActive: boolean = false;
  private _pinchSpringTarget: number = 0;
  private _pinchSpringStart: number = 0;
  private _pinchSpringStartTime: number = 0;

  // Splitter drag state
  private _dragPaneIdx: number = 0;
  private _dragStartFraction: number = 0.15;
  // Strategy Item #12: Full-viewport overlay during splitter drag
  private _dragOverlay: HTMLDivElement | null = null;

  // Touch gesture state
  private _touchMode: TouchMode = null;
  private _touchStartX: number = 0;
  private _touchStartY: number = 0;
  private _pinchStartDist: number = 0;
  private _pinchStartBars: number = 0;
  private _pinchStartOffset: number = 0;
  private _pinchStartPriceScale: number = 1;
  private _pinchAnchorFrac: number = 0.5;
  // Task 2.3.33: Angular rejection for touch pinch
  private _pinchStartAngle: number = 0;

  // Bound event handlers
  private _onAuxClick: (e: MouseEvent) => void;

  constructor(engine: EngineRef) {
    this.engine = engine;
    this.tc = engine.topCanvas;

    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseLeave = this.onMouseLeave.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onDoubleClick = this.onDoubleClick.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    this._onAuxClick = (e: MouseEvent) => { if (e.button === 1) e.preventDefault(); };

    this.tc.style.cursor = 'crosshair';
    this.tc.addEventListener('mousemove', this.onMouseMove);
    this.tc.addEventListener('mouseleave', this.onMouseLeave);
    this.tc.addEventListener('mousedown', this.onMouseDown);
    this.tc.addEventListener('mouseup', this.onMouseUp);
    this.tc.addEventListener('dblclick', this.onDoubleClick);
    this.tc.addEventListener('wheel', this.onWheel, { passive: false });
    this.tc.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.tc.addEventListener('touchmove', this.onTouchMove, { passive: false });
    this.tc.addEventListener('touchend', this.onTouchEnd, { passive: false });
    this.tc.addEventListener('auxclick', this._onAuxClick);
    window.addEventListener('mouseup', this.onMouseUp);

    // B1.5: Observe resize to invalidate cached rect
    this._resizeObs = new ResizeObserver(() => { this._cachedRect = null; });
    this._resizeObs.observe(this.tc);
  }

  destroy(): void {
    this.tc.removeEventListener('mousemove', this.onMouseMove);
    this.tc.removeEventListener('mouseleave', this.onMouseLeave);
    this.tc.removeEventListener('mousedown', this.onMouseDown);
    this.tc.removeEventListener('mouseup', this.onMouseUp);
    this.tc.removeEventListener('dblclick', this.onDoubleClick);
    this.tc.removeEventListener('wheel', this.onWheel);
    this.tc.removeEventListener('touchstart', this.onTouchStart);
    this.tc.removeEventListener('touchmove', this.onTouchMove);
    this.tc.removeEventListener('touchend', this.onTouchEnd);
    this.tc.removeEventListener('auxclick', this._onAuxClick);
    window.removeEventListener('mouseup', this.onMouseUp);
    // B1.6: Stop all animations (no rAF IDs to cancel — engine-driven)
    this._inertiaActive = false;
    this._zoomActive = false;
    this._scrollToNowActive = false;
    this._priceInertiaActive = false;
    this._zoomMomentumActive = false;
    this._pinchSpringActive = false;
    // B1.5: Disconnect resize observer
    if (this._resizeObs) { this._resizeObs.disconnect(); this._resizeObs = null; }
    // Strategy Item #12: Clean up drag overlay if engine is destroyed mid-drag
    this._removeDragOverlay();
    // Sprint 4: Clean up GPU compositing hint
    this._clearWillChange();
  }

  // B1.5: Cached rect getter — avoids forced layout on every mouse event
  private _getRect(): DOMRect {
    if (!this._cachedRect) {
      this._cachedRect = this.tc.getBoundingClientRect();
    }
    return this._cachedRect;
  }

  getPos(e: MouseEvent): { x: number; y: number } {
    const r = this._getRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // ─── Sprint 4: GPU Compositing Hint ───────────────────────────
  // Promotes canvas to its own compositor layer during pan for smoother frames.
  private _setWillChange(): void {
    const container = this.tc.parentElement;
    if (container) container.style.willChange = 'transform';
  }

  private _clearWillChange(): void {
    const container = this.tc.parentElement;
    if (container) container.style.willChange = '';
  }

  // ─── Strategy Item #12: Drag Overlay ────────────────────────────
  // Full-viewport transparent div captures all pointer events during splitter
  // drag, preventing cursor loss when the pointer crosses React UI overlays.
  private _createDragOverlay(cursor: string): void {
    this._removeDragOverlay();
    const overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed;inset:0;z-index:999999;cursor:${cursor};pointer-events:all;`;
    document.body.appendChild(overlay);
    this._dragOverlay = overlay;
  }

  private _removeDragOverlay(): void {
    if (this._dragOverlay) {
      this._dragOverlay.remove();
      this._dragOverlay = null;
    }
  }

  // B2.1: Quintic-out inertia timing state
  private _inertiaStartTime: number = 0;
  private _inertiaStartVelocity: number = 0;
  private _inertiaDuration: number = 800;

  // ─── Inertia Animation (B2.1: Quintic-out deceleration) ──────
  // B1.6: Converted to tick function driven by engine render loop
  private _startInertia(): void {
    // B2.1: Record initial velocity and compute duration proportional to speed
    this._inertiaStartVelocity = this._velocityX;
    this._inertiaStartTime = performance.now();
    this._inertiaDuration = Math.min(1200, Math.max(400, Math.abs(this._velocityX) * 120));
    this._inertiaActive = true;
    this.engine._scheduleDraw();
  }

  // B1.6: Inertia tick — called from tickAnimations()
  private _tickInertia(): boolean {
    const eng = this.engine;
    const S = eng.state;

    // Spring-back when overscrolled past edges
    const rightMargin = Math.floor(S.visibleBars * RIGHT_MARGIN_FRAC);
    const minScroll = -rightMargin;
    const maxScroll = Math.max(0, eng.bars.length - S.visibleBars);
    if (S.scrollOffset < minScroll) {
      S.scrollOffset = minScroll + (S.scrollOffset - minScroll) * OVERSCROLL_SPRING;
      if (Math.abs(S.scrollOffset - minScroll) < 0.5) S.scrollOffset = minScroll;
      this._velocityX = 0;
    } else if (S.scrollOffset > maxScroll) {
      const over = S.scrollOffset - maxScroll;
      S.scrollOffset = maxScroll + over * OVERSCROLL_SPRING;
      if (Math.abs(S.scrollOffset - maxScroll) < 0.5) S.scrollOffset = maxScroll;
      this._velocityX = 0;
    }

    // B2.1: Time-normalized quintic-out easing
    const elapsed = performance.now() - this._inertiaStartTime;
    const t = Math.min(1, elapsed / this._inertiaDuration);
    if (t >= 1 || (Math.abs(this._velocityX) < MIN_VELOCITY && S.scrollOffset >= minScroll && S.scrollOffset <= maxScroll)) {
      this._velocityX = 0;
      this._inertiaActive = false;
      this._prefetchDispatched = false;
      this._clearWillChange();
      return false;
    }

    // Quintic-out: velocity = initialV * (1-t)^4 (derivative of quintic-out position)
    const decay = Math.pow(1 - t, 4);
    this._velocityX = this._inertiaStartVelocity * decay;

    S.scrollOffset = Math.max(minScroll - OVERSCROLL_MAX, Math.min(maxScroll + OVERSCROLL_MAX, S.scrollOffset + this._velocityX));
    S.mainDirty = true;
    S.topDirty = true;
    if (eng.layers) {
      eng.layers.markDirty(LAYERS.DATA);
      eng.layers.markDirty(LAYERS.INDICATORS);
      eng.layers.markDirty(LAYERS.DRAWINGS);
      eng.layers.markDirty(LAYERS.GRID);
      eng.layers.markDirty(LAYERS.UI);
    }

    this._checkPrefetch(eng);
    return true;
  }

  // Sprint 1: Check if we should dispatch a prefetch event
  private _lastPrefetchBarCount: number = 0;

  private _checkPrefetch(eng: EngineRef): void {
    const S = eng.state;
    const R = S.lastRender;
    if (!R) return;

    // Reset prefetch flag when new bars have been loaded (enables chain-loading)
    if (eng.bars.length !== this._lastPrefetchBarCount) {
      this._lastPrefetchBarCount = eng.bars.length;
      this._prefetchDispatched = false;
    }

    if (this._prefetchDispatched) return;

    // Calculate how many bars from the left edge we are
    const startIdx = Math.max(0, eng.bars.length - S.scrollOffset - S.visibleBars);
    if (startIdx <= PREFETCH_THRESHOLD) {
      this._prefetchDispatched = true;
      window.dispatchEvent(new CustomEvent('charEdge:prefetch-history'));
    }
  }

  private _stopInertia(): void {
    this._velocityX = 0;
    this._inertiaActive = false;
  }

  // ─── Smooth Zoom Animation ─────────────────────────────────
  // B1.6: Converted to tick function driven by engine render loop
  private _startZoomAnimation(): void {
    if (this._zoomActive) return; // Already running
    this._zoomActive = true;
    this.engine._scheduleDraw();
  }

  // B1.6: Zoom tick — called from tickAnimations()
  private _tickZoom(): boolean {
    const eng = this.engine;
    const S = eng.state;

    if (this._targetVisibleBars === null) {
      this._zoomActive = false;
      return false;
    }

    const diff = this._targetVisibleBars - S.visibleBars;
    if (Math.abs(diff) < ZOOM_SNAP) {
      // B2.2: Compute offset correction with float precision BEFORE integer snap
      const finalDiff = this._targetVisibleBars - S.visibleBars;
      S.scrollOffset -= finalDiff * (1 - this._zoomAnchorFrac);
      S.visibleBars = Math.round(this._targetVisibleBars);
      this._targetVisibleBars = null;
      this._zoomActive = false;
      S.mainDirty = true;
      S.topDirty = true;
      return false;
    }

    // Lerp toward target
    const oldBars = S.visibleBars;
    S.visibleBars += diff * ZOOM_LERP;

    // Anchor zoom around cursor position to keep price under cursor stable
    const barDelta = S.visibleBars - oldBars;
    const rightMarginZoom = Math.floor(S.visibleBars * RIGHT_MARGIN_FRAC);
    const maxScroll = Math.max(0, eng.bars.length - S.visibleBars);
    S.scrollOffset = Math.max(-rightMarginZoom, Math.min(maxScroll,
      S.scrollOffset - barDelta * (1 - this._zoomAnchorFrac)
    ));

    S.mainDirty = true;
    S.topDirty = true;
    if (eng.layers) eng.layers.markAllDirty();
    return true;
  }

  // ─── Task 1.4.12: Y-Axis Spring Physics (Price Inertia) ────
  // B1.6: Converted to tick function driven by engine render loop
  private _startPriceInertia(): void {
    this._priceInertiaActive = true;
    this.engine._scheduleDraw();
  }

  // B1.6: Price inertia tick — called from tickAnimations()
  private _tickPriceInertia(): boolean {
    const eng = this.engine;
    const S = eng.state;

    // Decay velocity
    this._priceVelocity *= PRICE_FRICTION;

    // Apply velocity to price scroll
    S.priceScroll += this._priceVelocity;

    // Spring-back when overscrolled (priceScroll too far from 0)
    const maxDrift = 0.5;
    const R = S.lastRender;
    const range = R ? (R.yMax - R.yMin) : 1;
    const maxScroll = range * maxDrift;

    if (Math.abs(S.priceScroll) > maxScroll) {
      const target = Math.sign(S.priceScroll) * maxScroll;
      S.priceScroll += (target - S.priceScroll) * PRICE_SPRING_BACK;
      this._priceVelocity *= 0.5;
    }

    // Stop when velocity is negligible and within bounds
    if (Math.abs(this._priceVelocity) < MIN_PRICE_VELOCITY && Math.abs(S.priceScroll) <= maxScroll) {
      this._priceInertiaActive = false;
      return false;
    }

    S.mainDirty = true;
    if (eng.layers) {
      eng.layers.markDirty(LAYERS.DATA);
      eng.layers.markDirty(LAYERS.INDICATORS);
      eng.layers.markDirty(LAYERS.GRID);
    }
    return true;
  }

  private _stopPriceInertia(): void {
    this._priceVelocity = 0;
    this._priceInertiaActive = false;
  }

  // ─── Task 1.4.13: Zoom Momentum (Scroll Wheel Glide) ───────
  // B1.6: Converted to tick function driven by engine render loop
  private _startZoomMomentum(): void {
    if (this._zoomMomentumActive) return; // Already running
    this._zoomMomentumActive = true;
    this.engine._scheduleDraw();
  }

  // B1.6: Zoom momentum tick — called from tickAnimations()
  private _tickZoomMomentum(): boolean {
    const eng = this.engine;
    const S = eng.state;

    this._zoomVelocity *= ZOOM_MOMENTUM_DECAY;

    if (Math.abs(this._zoomVelocity) < 0.1) {
      this._zoomVelocity = 0;
      this._zoomMomentumActive = false;
      return false;
    }

    const maxBars = Math.max(80, eng.bars.length + 20);
    const oldBars = S.visibleBars;
    S.visibleBars = Math.max(10, Math.min(maxBars, S.visibleBars * (1 + this._zoomVelocity * 0.001)));

    // Anchor zoom
    const barDelta = S.visibleBars - oldBars;
    const rightMarginZ = Math.floor(S.visibleBars * RIGHT_MARGIN_FRAC);
    const maxScroll = Math.max(0, eng.bars.length - S.visibleBars);
    S.scrollOffset = Math.max(-rightMarginZ, Math.min(maxScroll,
      S.scrollOffset - barDelta * (1 - this._zoomAnchorFrac)
    ));

    S.mainDirty = true;
    S.topDirty = true;
    if (eng.layers) eng.layers.markAllDirty();
    return true;
  }

  // Sprint 11: Find splitter index near a given Y position (CSS pixels).
  // Returns pane index (0 = first splitter) or -1 if not near any.
  private _hitTestSplitter(y: number): number {
    const R = this.engine.state.lastRender;
    if (!R || R.paneCount <= 0) return -1;
    const TOLERANCE = 8; // px — generous for easy grabbing
    for (let i = 0; i < R.paneCount; i++) {
      const sy = R.mainH + R.paneH * i;
      if (Math.abs(y - sy) <= TOLERANCE) return i;
    }
    return -1;
  }

  // Sprint 12: Hit-test legend area. Returns {type, idx} or null.
  private _hitTestLegend(x: number, y: number): { type: string; idx: number } | null {
    const regions = this.engine.state._legendHitRegions;
    if (!regions?.length) return null;
    for (const r of regions) {
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        return { type: r.type, idx: r.idx };
      }
    }
    return null;
  }

  onMouseMove(e: MouseEvent): void {
    const pos = this.getPos(e);
    const eng = this.engine;
    const S = eng.state;
    const R = S.lastRender;
    // Task 2.3.31: Skip drawing engine hit-testing during pan/zoom drags
    const consumed = S.dragging ? false : eng.drawingEngine?.onMouseMove(pos.x, pos.y);

    if (!R) return;

    S.mouseX = pos.x;
    S.mouseY = pos.y;

    const ri = Math.round(pos.x / R.bSp - 0.5);
    S.hoverIdx = Math.max(0, Math.min(eng.bars.length - 1, R.start + ri));

    // Sprint 11: Splitter drag — position-based pane resize
    // Directly maps mouse Y to pane fraction for buttery tracking
    // Drag UP = more pane space, drag DOWN = less pane space
    if (S.dragging === 'splitter' && !consumed) {
      const availH = R.mainH + R.paneH * R.paneCount;
      // Pane takes the space below the current mouse position
      const panePixels = Math.max(0, availH - pos.y);
      const newFraction = Math.max(0.08, Math.min(0.5, panePixels / availH));
      if (eng.callbacks.onPaneResize) {
        eng.callbacks.onPaneResize(this._dragPaneIdx, newFraction);
      }
      S.mainDirty = true;
      S.topDirty = true;
      if (eng.layers) eng.layers.markAllDirty();
      eng._scheduleDraw();
      return;
    }

    if (S.dragging === 'time' && !consumed) {
      if (S.timeAxisZoom) {
        const dx = S.dragStartX - e.clientX;
        const maxBars = Math.max(80, eng.bars.length + 20);
        S.visibleBars = Math.max(10, Math.min(maxBars, S.dragStartVisibleBars * Math.exp(dx * 0.005)));
      } else {
        const maxScroll = Math.max(0, eng.bars.length - S.visibleBars);
        const rightMarginDrag = Math.floor(S.visibleBars * RIGHT_MARGIN_FRAC);
        S.scrollOffset = Math.max(-rightMarginDrag, Math.min(maxScroll, S.dragStartOffset + (e.clientX - S.dragStartX) / R.bSp));
      }
      S.mainDirty = true;
      if (eng.layers) {
        eng.layers.markDirty(LAYERS.DATA);
        eng.layers.markDirty(LAYERS.INDICATORS);
        eng.layers.markDirty(LAYERS.GRID);
        eng.layers.markDirty(LAYERS.DRAWINGS);
      }
    } else if (S.dragging === 'price' && !consumed) {
      S.autoScale = false;
      const dy = e.clientY - S.dragStartY;
      S.priceScale = Math.max(0.1, Math.min(10, S.dragStartPriceScale * Math.exp(dy * 0.005)));
      S.mainDirty = true;
      if (eng.layers) {
        eng.layers.markDirty(LAYERS.DATA);
        eng.layers.markDirty(LAYERS.INDICATORS);
        eng.layers.markDirty(LAYERS.DRAWINGS);
        eng.layers.markDirty(LAYERS.GRID);
      }

      // Task 1.4.12: Track Y-axis velocity for spring physics
      const nowPrice = performance.now();
      const dtPrice = nowPrice - this._lastPriceMoveTime;
      if (dtPrice > 0 && dtPrice < 100) {
        const R = S.lastRender;
        const range = R ? (R.yMax - R.yMin) : 1;
        const pricePerPixel = range / (R?.mainH || 400) / S.priceScale;
        const dyFrame = e.clientY - this._lastPriceMoveY;
        const sample = dyFrame * pricePerPixel * (16 / dtPrice);
        this._priceDragSamples[this._priceDragIdx % 3] = sample;
        this._priceDragIdx++;
        this._priceVelocity = (this._priceDragSamples[0] + this._priceDragSamples[1] + this._priceDragSamples[2]) / 3;
      }
      this._lastPriceMoveTime = nowPrice;
      this._lastPriceMoveY = e.clientY;
    } else if (S.dragging === 'chart' && !consumed) {
      const maxScroll = Math.max(0, eng.bars.length - S.visibleBars);
      const rightMarginChart = Math.floor(S.visibleBars * RIGHT_MARGIN_FRAC);
      S.scrollOffset = Math.max(-rightMarginChart, Math.min(maxScroll, S.dragStartOffset + (e.clientX - S.dragStartX) / R.bSp));
      const dy = e.clientY - S.dragStartY;
      if (S.autoScale && Math.abs(dy) > 5) {
        S.autoScale = false;
        S.dragStartPriceScroll = S.priceScroll;
        S.dragStartY = e.clientY;
      }
      if (!S.autoScale) {
        const pricePerPixel = (R.yMax - R.yMin) / R.mainH / S.priceScale;
        S.priceScroll = S.dragStartPriceScroll + dy * pricePerPixel;
      }
      S.mainDirty = true;
      if (eng.layers) {
        eng.layers.markDirty(LAYERS.DATA);
        eng.layers.markDirty(LAYERS.INDICATORS);
        eng.layers.markDirty(LAYERS.DRAWINGS);
        eng.layers.markDirty(LAYERS.GRID);
      }

      // Track velocity for inertia (3-sample averaging)
      const now = performance.now();
      const dt = now - this._lastMoveTime;
      if (dt > 0 && dt < 100) {
        const dx = e.clientX - this._lastMoveX;
        const sample = (dx / R.bSp) * (16 / dt);
        this._velocitySamples[this._velocityIdx % 3] = sample;
        this._velocityIdx++;
        // Average last 3 samples for smoother flick detection
        this._velocityX = (this._velocitySamples[0] + this._velocitySamples[1] + this._velocitySamples[2]) / 3;
      }
      this._lastMoveTime = now;
      this._lastMoveX = e.clientX;

      // Sprint 1: Check for left-edge prefetch during drag
      this._checkPrefetch(eng);
    }

    S.topDirty = true;
    if (eng.layers) eng.layers.markDirty(LAYERS.UI);
    eng._scheduleDraw();

    // Sprint 11: Splitter hover detection — update cursor and hover state
    if (!S.dragging) {
      const splitterIdx = this._hitTestSplitter(pos.y);
      if (splitterIdx >= 0) {
        this.tc.style.cursor = 'row-resize';
        if (S._splitterHoverIdx !== splitterIdx) {
          S._splitterHoverIdx = splitterIdx;
          if (eng.layers) eng.layers.markDirty(LAYERS.UI);
        }
      } else {
        if (S._splitterHoverIdx >= 0) {
          S._splitterHoverIdx = -1;
          if (eng.layers) eng.layers.markDirty(LAYERS.UI);
        }
        // Sprint 12: Legend hover — pointer cursor
        const legendHit = this._hitTestLegend(pos.x, pos.y);
        if (legendHit) {
          this.tc.style.cursor = 'pointer';
        } else {
          // Sprint 13.2: Dynamic cursor based on drawing hover state
          const hint = eng.drawingEngine?.cursorHint;
          this.tc.style.cursor = hint || 'crosshair';
        }
      }
    }

    if (!consumed && eng.callbacks.onCrosshairMove && S.hoverIdx != null) {
      const bar = eng.bars[S.hoverIdx];
      if (bar) {
        const price = R.yMin + ((R.mainH - pos.y) / R.mainH) * (R.yMax - R.yMin);
        eng.callbacks.onCrosshairMove({ price, time: bar.time, bar, x: pos.x, y: pos.y });
      }
    }
  }

  onMouseLeave(): void {
    const S = this.engine.state;
    // Task 2.3.30: When pointer is captured during drag, ignore mouseleave
    // events — the pointer stays locked to the chart until mouseup.
    if (S.dragging) return;
    S.mouseX = null;
    S.mouseY = null;
    S.hoverIdx = null;
    S.dragging = false;
    this.tc.style.cursor = 'crosshair';
    S.topDirty = true;
    if (this.engine.layers) this.engine.layers.markDirty(LAYERS.UI);
    this.engine._scheduleDraw();
  }

  onMouseDown(e: MouseEvent): void {
    // Allow left-click (0) and middle-click (1) for panning
    if (e.button !== 0 && e.button !== 1) return;
    if (e.button === 1) e.preventDefault(); // Suppress auto-scroll on middle click

    // Stop any running inertia when user clicks
    this._stopInertia();

    const pos = this.getPos(e);
    const eng = this.engine;
    const S = eng.state;
    const R = S.lastRender;

    if (!R) return;

    const r = this._getRect();
    const isTimeAxis = e.clientY - r.top >= this.tc.clientHeight - (R.txH * R.pr) / R.pr;
    const isPriceAxis = e.clientX - r.left >= R.cW;

    // Sprint 12: Legend click detection — before splitters and other handlers
    const legendHit = this._hitTestLegend(pos.x, pos.y);
    if (legendHit && e.button === 0) {
      if (legendHit.type === 'indicator') {
        // Toggle highlight: click same again → deselect
        S._highlightedIndicator = S._highlightedIndicator === legendHit.idx ? -1 : legendHit.idx;
      } else if (legendHit.type === 'eye') {
        // Toggle indicator visibility
        if (S.hiddenIndicators.has(legendHit.idx)) {
          S.hiddenIndicators.delete(legendHit.idx);
        } else {
          S.hiddenIndicators.add(legendHit.idx);
        }
        window.dispatchEvent(new CustomEvent('charEdge:toggle-indicator', { detail: legendHit.idx }));
      }
      eng.markDirty();
      return;
    }

    // Sprint 11: Splitter drag detection — check before other handlers
    const splitterIdx = this._hitTestSplitter(pos.y);
    if (splitterIdx >= 0 && e.button === 0) {
      S.dragging = 'splitter';
      this._dragPaneIdx = splitterIdx;
      S.dragStartY = e.clientY;
      // Compute current fraction of this pane
      const paneHeightsMap = (eng.props.paneHeights || {}) as Record<number, number>;
      this._dragStartFraction = paneHeightsMap[splitterIdx] || 0.15;
      this.tc.style.cursor = 'row-resize';
      // Strategy Item #12: Full-viewport overlay prevents cursor loss near overlays/dialogs
      this._createDragOverlay('ns-resize');
      return;
    }

    // "Scroll to Now" button hit test
    const stnBtn = S._scrollToNowBtn;
    if (stnBtn && e.button === 0) {
      const localX = e.clientX - r.left;
      const localY = e.clientY - r.top;
      if (localX >= stnBtn.x && localX <= stnBtn.x + stnBtn.w &&
        localY >= stnBtn.y && localY <= stnBtn.y + stnBtn.h) {
        // Task 1.4.10: Micro-animation — brief press pulse
        S._btnPressAnim = { id: 'stn', time: performance.now() };
        this.scrollToNow();
        return;
      }
    }

    if (eng.drawingEngine?.onMouseDown(pos.x, pos.y)) {
      eng._scheduleDraw();
      return;
    }

    // Reset velocity tracking
    this._lastMoveTime = performance.now();
    this._lastMoveX = e.clientX;
    this._velocityX = 0;

    if (isTimeAxis) {
      S.dragging = 'time';
      S.dragStartX = e.clientX;
      S.dragStartVisibleBars = S.visibleBars;
      S.dragStartOffset = S.scrollOffset;
      S.timeAxisZoom = e.ctrlKey || e.metaKey;
      this.tc.style.cursor = S.timeAxisZoom ? 'ew-resize' : 'grab';
    } else if (isPriceAxis) {
      // Check auto-fit button first
      const afBtn = S._autoFitBtn;
      if (afBtn) {
        const localX = e.clientX - r.left;
        const localY = e.clientY - r.top;
        if (localX >= afBtn.x && localX <= afBtn.x + afBtn.w &&
          localY >= afBtn.y && localY <= afBtn.y + afBtn.h) {
          // Task 1.4.10: Micro-animation — brief press pulse
          S._btnPressAnim = { id: 'af', time: performance.now() };
          S.autoScale = true;
          S.priceScale = 1;
          S.priceScroll = 0;
          S.mainDirty = true;
          S.topDirty = true;
          eng._scheduleDraw();
          return;
        }
      }

      const compact = eng.props?.compact;
      const axW = compact ? 0 : 72;
      const toggleW = 24;
      const toggleH = 18;
      const toggleY = this.tc.clientHeight - R.txH - toggleH - 4;
      const logX = this.tc.clientWidth - axW + 8;
      const pctX = logX + toggleW + 4;

      const localX = e.clientX - r.left;
      const localY = e.clientY - r.top;

      if (localY >= toggleY && localY <= toggleY + toggleH) {
        if (localX >= logX && localX <= logX + toggleW) {
          S.scaleMode = S.scaleMode === 'log' ? 'linear' : 'log';
          // Task 1.4.11: Animated scale transition — force re-autoScale with animation
          S.autoScale = true;
          S.priceScale = 1;
          S.priceScroll = 0;
          S.mainDirty = true;
          S.topDirty = true;
          eng._scheduleDraw();
          return;
        }
        if (localX >= pctX && localX <= pctX + toggleW) {
          S.scaleMode = S.scaleMode === 'percent' ? 'linear' : 'percent';
          // Task 1.4.11: Animated scale transition — force re-autoScale with animation
          S.autoScale = true;
          S.priceScale = 1;
          S.priceScroll = 0;
          S.mainDirty = true;
          S.topDirty = true;
          eng._scheduleDraw();
          return;
        }
        // Task 1.4.14: Y-axis lock toggle click
        const lockX = pctX + toggleW + 4;
        if (localX >= lockX && localX <= lockX + toggleW) {
          S.yAxisLocked = !S.yAxisLocked;
          S.mainDirty = true;
          eng._scheduleDraw();
          return;
        }
      }

      // Task 1.4.14: Guard — block price dragging when Y-axis is locked
      if (S.yAxisLocked) {
        this.tc.style.cursor = 'not-allowed';
        return;
      }

      S.dragging = 'price';
      S.dragStartY = e.clientY;
      S.dragStartPriceScale = S.priceScale;
      S.dragStartPriceScroll = S.priceScroll;
      this.tc.style.cursor = 'ns-resize';
      // Task 1.4.12: Initialize price velocity tracking
      this._stopPriceInertia();
      this._lastPriceMoveTime = performance.now();
      this._lastPriceMoveY = e.clientY;
      this._priceDragSamples = [0, 0, 0];
      this._priceDragIdx = 0;
    } else {
      S.dragging = 'chart';
      S.dragStartX = e.clientX;
      S.dragStartY = e.clientY;
      S.dragStartOffset = S.scrollOffset;
      S.dragStartPriceScroll = S.priceScroll;
      this.tc.style.cursor = 'grabbing';
      this._setWillChange(); // Sprint 4: GPU compositing hint during pan
      // P1-A #2: Dispatch pan-start event for auto-hide toolbar
      window.dispatchEvent(new CustomEvent('charEdge:pan-start'));
      // Task 2.3.30: Capture pointer so crosshair persists when mouse exits chart
      if ('setPointerCapture' in this.tc && (e as PointerEvent).pointerId != null) {
        this.tc.setPointerCapture((e as PointerEvent).pointerId);
      }
    }
  }

  onMouseUp(e: MouseEvent): void {
    const pos = this.getPos(e);
    const eng = this.engine;
    if (eng.drawingEngine?.onMouseUp(pos.x, pos.y)) {
      eng._scheduleDraw();
      return;
    }

    const wasDrag = eng.state.dragging;
    const wasChartDrag = wasDrag === 'chart';
    eng.state.dragging = false;
    // Strategy Item #12: Remove splitter drag overlay
    this._removeDragOverlay();
    // Sprint 13.2: Restore cursor from drawing engine hint
    const hint = eng.drawingEngine?.cursorHint;
    this.tc.style.cursor = hint || 'crosshair';
    // Task 2.3.30: Release pointer capture after drag
    if ('releasePointerCapture' in this.tc && (e as PointerEvent).pointerId != null) {
      try { this.tc.releasePointerCapture((e as PointerEvent).pointerId); } catch (_) { /* not captured */ }
    }

    if (!wasDrag) return;
    // P1-A #2: Dispatch pan-end event for auto-hide toolbar
    if (wasChartDrag) {
      window.dispatchEvent(new CustomEvent('charEdge:pan-end'));
    }
    const moved = Math.abs(e.clientX - eng.state.dragStartX);

    // Start inertia if we were dragging the chart area and have velocity
    if (wasChartDrag && Math.abs(this._velocityX) > MIN_VELOCITY && moved > 10) {
      this._startInertia();
    }

    // Task 1.4.12: Start Y-axis spring physics if price axis was dragged with velocity
    if (wasDrag === 'price' && Math.abs(this._priceVelocity) > MIN_PRICE_VELOCITY) {
      this._startPriceInertia();
    }

    if (moved < 3 && eng.callbacks.onBarClick && eng.state.hoverIdx != null) {
      const R = eng.state.lastRender;
      if (R) {
        const price = R.yMin + ((R.mainH - pos.y) / R.mainH) * (R.yMax - R.yMin);
        const bar = eng.bars[eng.state.hoverIdx];
        if (bar) eng.callbacks.onBarClick(price, bar.time, bar);
      }
    }
    eng._scheduleDraw();
  }

  onDoubleClick(e: MouseEvent): void {
    const pos = this.getPos(e);
    const eng = this.engine;
    const S = eng.state;

    // Sprint 11: Double-click on splitter → toggle pane collapse
    const splitterIdx = this._hitTestSplitter(pos.y);
    if (splitterIdx >= 0) {
      if (eng.callbacks.onPaneToggle) {
        eng.callbacks.onPaneToggle(splitterIdx);
      } else {
        // Fallback: toggle in engine state directly
        if (S.collapsedPanes.has(splitterIdx)) {
          S.collapsedPanes.delete(splitterIdx);
        } else {
          S.collapsedPanes.add(splitterIdx);
        }
      }
      eng.markDirty();
      return;
    }

    // Task 1.4.15: Double-click on Y-axis → auto-fit (gesture shortcut)
    const R = S.lastRender;
    if (R) {
      const isPriceAxis = pos.x >= R.cW;
      if (isPriceAxis) {
        S.autoScale = true;
        S.priceScale = 1;
        S.priceScroll = 0;
        S.mainDirty = true;
        S.topDirty = true;
        eng._scheduleDraw();
        return;
      }
    }

    this._stopInertia();
    this._targetVisibleBars = null;
    S.autoScale = true;
    S.priceScale = 1;
    S.priceScroll = 0;
    S.mainDirty = true;
    S.topDirty = true;
    eng._scheduleDraw();
  }

  onWheel(e: WheelEvent): void {
    e.preventDefault();
    const eng = this.engine;
    const S = eng.state;
    const R = S.lastRender;
    if (!R) return;

    // ─── Trackpad gesture detection ─────────────────────────────
    // Browsers set ctrlKey=true for trackpad pinch-zoom gestures.
    // deltaMode 0 = pixel-level scrolling (trackpad/touchpad).
    // deltaMode 1 = line-level scrolling (discrete mouse wheel).
    const isTrackpadPinch = e.ctrlKey && e.deltaMode === 0;
    const isDiscreteWheel = e.deltaMode === 1 || (e.deltaMode === 0 && Math.abs(e.deltaY) >= 50);

    if (isTrackpadPinch) {
      // ── Trackpad pinch-zoom: configurable sensitivity + exponential smoothing ──
      // P1-A #1: Apply exponential smoothing (α=0.3) to eliminate jitter
      const now = performance.now();
      const elapsed = now - this._lastPinchTime;
      const alpha = elapsed > 100 ? 1.0 : 0.3; // Reset smoothing after 100ms gap
      this._smoothedPinchDelta = alpha * e.deltaY + (1 - alpha) * this._smoothedPinchDelta;
      this._lastPinchTime = now;

      const d = Math.sign(this._smoothedPinchDelta);
      const maxBars = Math.max(80, eng.bars.length + 20);
      const currentTarget = this._targetVisibleBars || S.visibleBars;
      // P1-A #1: Use configurable sensitivity (default 0.04, was hardcoded 0.08)
      // Sprint 5: No Math.round() — keep fractional during animation, snap at settle
      const newTarget = Math.max(10, Math.min(maxBars, currentTarget * (1 + d * this._trackpadSensitivity)));

      if (R.cW > 0) {
        const pos = this.getPos(e);
        this._zoomAnchorFrac = Math.max(0, Math.min(1, pos.x / R.cW));
      }

      this._targetVisibleBars = newTarget;
      this._startZoomAnimation();
    } else if (!isDiscreteWheel && !e.ctrlKey) {
      // ── Trackpad scroll: horizontal pan ──
      // Use deltaX for horizontal, deltaY for vertical trackpad scrolling
      const panDelta = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? -e.deltaX : -e.deltaY);
      const barsDelta = panDelta / (R.bSp || 10);
      const maxScroll = Math.max(0, eng.bars.length - S.visibleBars);
      const rightMarginPan = Math.floor(S.visibleBars * RIGHT_MARGIN_FRAC);
      S.scrollOffset = Math.max(-rightMarginPan, Math.min(maxScroll, S.scrollOffset + barsDelta));
      S.mainDirty = true;
      S.topDirty = true;
      if (eng.layers) {
        eng.layers.markDirty(LAYERS.DATA);
        eng.layers.markDirty(LAYERS.INDICATORS);
        eng.layers.markDirty(LAYERS.UI);
        eng.layers.markDirty(LAYERS.DRAWINGS);
      }
      // Sprint 1: Check for left-edge prefetch on trackpad scroll
      this._checkPrefetch(eng);
      eng._scheduleDraw();
    } else {
      // ── Discrete mouse wheel: zoom (original behavior + Task 1.4.13 momentum) ──
      const d = Math.sign(e.deltaY);
      const maxBars = Math.max(80, eng.bars.length + 20);
      const currentTarget = this._targetVisibleBars || S.visibleBars;
      // Sprint 5: No Math.round() — keep fractional during animation, snap at settle
      const newTarget = Math.max(10, Math.min(maxBars, currentTarget * (1 + d * 0.15)));

      if (R.cW > 0) {
        const pos = this.getPos(e);
        this._zoomAnchorFrac = Math.max(0, Math.min(1, pos.x / R.cW));
      }

      this._targetVisibleBars = newTarget;
      this._startZoomAnimation();

      // Task 1.4.13: Accumulate zoom momentum for glide effect
      const now = performance.now();
      if (now - this._lastWheelTime < ZOOM_MOMENTUM_WINDOW) {
        // Consecutive wheel event — accumulate velocity
        this._zoomVelocity += d * 8;
      } else {
        // Fresh wheel event — start fresh momentum
        this._zoomVelocity = d * 5;
      }
      this._lastWheelTime = now;
      this._startZoomMomentum();
    }
  }

  // ─── Scroll to Now (animated) ────────────────────────────────
  // B1.6: Converted to tick function driven by engine render loop
  scrollToNow(): void {
    this._stopInertia();
    this._scrollToNowActive = true;
    this.engine._scheduleDraw();
  }

  // B1.6: Scroll-to-now tick — called from tickAnimations()
  private _tickScrollToNow(): boolean {
    const eng = this.engine;
    const S = eng.state;

    if (Math.abs(S.scrollOffset) < 0.5) {
      S.scrollOffset = 0;
      this._scrollToNowActive = false;
      S.mainDirty = true;
      S.topDirty = true;
      return false;
    }
    S.scrollOffset *= 0.75; // Ease toward 0
    S.mainDirty = true;
    S.topDirty = true;
    if (eng.layers) {
      eng.layers.markDirty(LAYERS.DATA);
      eng.layers.markDirty(LAYERS.INDICATORS);
      eng.layers.markDirty(LAYERS.UI);
      eng.layers.markDirty(LAYERS.DRAWINGS);
    }
    return true;
  }

  // B2.3: Elastic pinch spring-back tick
  private _tickPinchSpring(): boolean {
    const SPRING_DURATION = 200; // ms
    const elapsed = performance.now() - this._pinchSpringStartTime;
    const t = Math.min(1, elapsed / SPRING_DURATION);
    // easeOutExpo: 1 - 2^(-10t)
    const ease = t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);

    const eng = this.engine;
    const S = eng.state;
    S.visibleBars = this._pinchSpringStart + (this._pinchSpringTarget - this._pinchSpringStart) * ease;

    S.mainDirty = true;
    S.topDirty = true;

    if (t >= 1) {
      S.visibleBars = this._pinchSpringTarget;
      this._pinchSpringActive = false;
      this._pinchOverstretched = false;
      return false;
    }
    return true;
  }

  // ═══════════════════════════════════════════════════════════════
  // B1.6: PUBLIC API — Engine-driven animation tick
  // ═══════════════════════════════════════════════════════════════

  /**
   * Tick all active animations. Called once per frame from ChartEngine.renderLoop().
   * Returns `true` if any animation is still running (engine should continue rendering).
   */
  tickAnimations(): boolean {
    let anyActive = false;
    if (this._inertiaActive) anyActive = this._tickInertia() || anyActive;
    if (this._zoomActive) anyActive = this._tickZoom() || anyActive;
    if (this._priceInertiaActive) anyActive = this._tickPriceInertia() || anyActive;
    if (this._zoomMomentumActive) anyActive = this._tickZoomMomentum() || anyActive;
    if (this._scrollToNowActive) anyActive = this._tickScrollToNow() || anyActive;
    if (this._pinchSpringActive) anyActive = this._tickPinchSpring() || anyActive;
    return anyActive;
  }

  /**
   * Returns `true` if any animation is currently active.
   * Used by ChartEngine._needsNextFrame() to keep the render loop alive.
   */
  hasActiveAnimations(): boolean {
    return this._inertiaActive || this._zoomActive || this._priceInertiaActive
      || this._zoomMomentumActive || this._scrollToNowActive || this._pinchSpringActive;
  }

  // ─── P1-A #1: Trackpad Sensitivity Setter ──────────────────
  /**
   * Set trackpad pinch-to-zoom sensitivity.
   * @param value — sensitivity multiplier (0.01–0.15, default 0.04)
   */
  setTrackpadSensitivity(value: number): void {
    this._trackpadSensitivity = Math.max(0.01, Math.min(0.15, value));
  }

  // ─── Touch Gesture Support ─────────────────────────────────
  private _getTouchCenter(touches: TouchList): { x: number; y: number } {
    let x = 0, y = 0;
    for (let i = 0; i < touches.length; i++) {
      const r = this._getRect();
      x += touches[i].clientX - r.left;
      y += touches[i].clientY - r.top;
    }
    return { x: x / touches.length, y: y / touches.length };
  }

  private _getTouchDistance(touches: TouchList): number {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    this._stopInertia();

    const touches = e.touches;
    const eng = this.engine;
    const S = eng.state;
    const R = S.lastRender;
    if (!R) return;

    if (touches.length === 1) {
      // Single finger: pan
      this._touchMode = 'pan';
      this._touchStartX = touches[0].clientX;
      this._touchStartY = touches[0].clientY;
      S.dragStartOffset = S.scrollOffset;
      this._lastMoveTime = performance.now();
      this._lastMoveX = touches[0].clientX;
      this._velocityX = 0;
    } else if (touches.length === 2) {
      // Two fingers: pinch zoom
      // Task 2.3.33: Compute angle between two touch points — reject near-vertical
      // angles (2-finger scroll) to prevent accidental zoom.
      const dx = Math.abs(touches[0].clientX - touches[1].clientX);
      const dy = Math.abs(touches[0].clientY - touches[1].clientY);
      this._pinchStartAngle = Math.atan2(dy, dx);
      const MAX_PINCH_ANGLE = Math.PI / 3; // 60° — reject if fingers are mostly vertical
      if (this._pinchStartAngle > MAX_PINCH_ANGLE) {
        // Likely a 2-finger scroll, not a pinch — fall through to pan mode
        this._touchMode = 'pan';
        this._touchStartX = (touches[0].clientX + touches[1].clientX) / 2;
        this._touchStartY = (touches[0].clientY + touches[1].clientY) / 2;
        S.dragStartOffset = S.scrollOffset;
        this._lastMoveTime = performance.now();
        this._lastMoveX = this._touchStartX;
        this._velocityX = 0;
      } else {
        this._touchMode = 'pinch';
        this._pinchStartDist = this._getTouchDistance(touches);
        this._pinchStartBars = S.visibleBars;
        this._pinchStartOffset = S.scrollOffset;
        this._pinchStartPriceScale = S.priceScale; // Sprint 10: for vertical price pinch
        const center = this._getTouchCenter(touches);
        this._pinchAnchorFrac = R.cW > 0 ? center.x / R.cW : 0.5;
      }
    } else if (touches.length === 3) {
      // Task 1.1.8: Three fingers → workspace switch gesture
      this._touchMode = 'workspace-swipe';
      this._touchStartX = touches[1].clientX; // Use middle finger as reference
    }
  }

  onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    const touches = e.touches;
    const eng = this.engine;
    const S = eng.state;
    const R = S.lastRender;
    if (!R) return;

    if (this._touchMode === 'pan' && touches.length === 1) {
      const dx = touches[0].clientX - this._touchStartX;
      const maxScroll = Math.max(0, eng.bars.length - S.visibleBars);
      const rightMarginTouch = Math.floor(S.visibleBars * RIGHT_MARGIN_FRAC);
      S.scrollOffset = Math.max(-rightMarginTouch, Math.min(maxScroll, S.dragStartOffset + dx / R.bSp));
      S.mainDirty = true;
      S.topDirty = true;

      // Track velocity for inertia
      const now = performance.now();
      const dt = now - this._lastMoveTime;
      if (dt > 0 && dt < 100) {
        const touchDx = touches[0].clientX - this._lastMoveX;
        this._velocityX = (touchDx / R.bSp) * (16 / dt);
      }
      this._lastMoveTime = now;
      this._lastMoveX = touches[0].clientX;

      // Update crosshair position
      const r = this._getRect();
      S.mouseX = touches[0].clientX - r.left;
      S.mouseY = touches[0].clientY - r.top;
    } else if (this._touchMode === 'pinch' && touches.length >= 2) {
      const dist = this._getTouchDistance(touches);
      if (this._pinchStartDist > 0) {
        // Sprint 10: Detect vertical vs horizontal pinch component
        const vDist = Math.abs(touches[0].clientY - touches[1].clientY);
        const hDist = Math.abs(touches[0].clientX - touches[1].clientX);
        const isVerticalPinch = vDist > hDist * 1.5; // Mostly vertical = price scale

        if (isVerticalPinch) {
          // Sprint 10: Vertical pinch → price scale zoom
          S.autoScale = false;
          const scale = dist / this._pinchStartDist;
          S.priceScale = Math.max(0.1, Math.min(10, (this._pinchStartPriceScale || 1) * (1 / scale)));
          S.mainDirty = true;
        } else {
          // Horizontal pinch → bar count zoom (existing behavior)
          // B2.3: Allow elastic overstretch beyond min/max with resistance
          const scale = this._pinchStartDist / dist;
          const maxBars = Math.max(80, eng.bars.length + 20);
          const minBars = 10;
          const rawBars = this._pinchStartBars * scale;
          let newBars: number;

          if (rawBars < minBars) {
            // Elastic resistance below minimum: 30% of overshoot
            const overshoot = minBars - rawBars;
            newBars = minBars - overshoot * 0.3;
            this._pinchOverstretched = true;
          } else if (rawBars > maxBars) {
            // Elastic resistance above maximum: 30% of overshoot
            const overshoot = rawBars - maxBars;
            newBars = maxBars + overshoot * 0.3;
            this._pinchOverstretched = true;
          } else {
            newBars = Math.round(rawBars);
            this._pinchOverstretched = false;
          }

          const barDelta = newBars - S.visibleBars;
          S.visibleBars = newBars;

          // Anchor around pinch center
          const maxScroll = Math.max(0, eng.bars.length - S.visibleBars);
          const rightMarginPinch = Math.floor(S.visibleBars * RIGHT_MARGIN_FRAC);
          S.scrollOffset = Math.max(-rightMarginPinch, Math.min(maxScroll,
            S.scrollOffset - barDelta * (1 - this._pinchAnchorFrac)
          ));
          S.mainDirty = true;
          S.topDirty = true;
        }
      }
    }
  }

  onTouchEnd(e: TouchEvent): void {
    e.preventDefault();
    if (this._touchMode === 'pan' && Math.abs(this._velocityX) > MIN_VELOCITY) {
      this._startInertia();
    }
    // Task 1.1.8: 3-finger swipe → workspace switch
    if (this._touchMode === 'workspace-swipe' && e.changedTouches.length > 0) {
      const endX = e.changedTouches[0].clientX;
      const dx = endX - this._touchStartX;
      const SWIPE_THRESHOLD = 100; // px
      if (Math.abs(dx) > SWIPE_THRESHOLD) {
        const direction = dx < 0 ? 'next' : 'prev';
        // Dispatch custom event for React layer to handle workspace navigation
        window.dispatchEvent(new CustomEvent('charEdge:workspace-switch', {
          detail: { direction },
        }));
      }
    }
    // B2.3: Elastic pinch spring-back on release
    if (this._touchMode === 'pinch' && this._pinchOverstretched) {
      const eng = this.engine;
      const S = eng.state;
      const maxBars = Math.max(80, eng.bars.length + 20);
      const minBars = 10;
      this._pinchSpringStart = S.visibleBars;
      this._pinchSpringTarget = S.visibleBars < minBars ? minBars : maxBars;
      this._pinchSpringStartTime = performance.now();
      this._pinchSpringActive = true;
      eng._scheduleDraw();
    }
    this._touchMode = null;
  }
}
