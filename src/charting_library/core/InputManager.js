// ═══════════════════════════════════════════════════════════════════
// charEdge — InputManager
// Handles DOM events for the ChartEngine instance.
// Includes inertial pan and smooth eased zoom.
// ═══════════════════════════════════════════════════════════════════

import { LAYERS } from './LayerManager.js';

const FRICTION = 0.92;          // Inertia decay per frame
const MIN_VELOCITY = 0.3;       // Stop threshold (bars/frame)
const ZOOM_LERP = 0.18;         // Zoom easing speed (0–1)
const ZOOM_SNAP = 0.5;          // Stop easing when within this many bars

export class InputManager {
  constructor(engine) {
    this.engine = engine;
    this.tc = engine.topCanvas;

    // Inertia state
    this._velocityX = 0;
    this._lastMoveTime = 0;
    this._lastMoveX = 0;
    this._inertiaRaf = null;

    // Smooth zoom state
    this._targetVisibleBars = null;
    this._zoomRaf = null;
    this._zoomAnchorFrac = 0.5; // 0–1 fraction across chart width

    // Scroll-to-now animation state
    this._scrollToNowRaf = null;

    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseLeave = this.onMouseLeave.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onDoubleClick = this.onDoubleClick.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    this._onAuxClick = (e) => { if (e.button === 1) e.preventDefault(); };

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
  }

  destroy() {
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
    if (this._inertiaRaf) cancelAnimationFrame(this._inertiaRaf);
    if (this._zoomRaf) cancelAnimationFrame(this._zoomRaf);
    if (this._scrollToNowRaf) cancelAnimationFrame(this._scrollToNowRaf);
  }

  getPos(e) {
    const r = this.tc.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // ─── Inertia Animation ──────────────────────────────────────
  _startInertia() {
    if (this._inertiaRaf) cancelAnimationFrame(this._inertiaRaf);
    const eng = this.engine;
    const S = eng.state;

    const step = () => {
      if (Math.abs(this._velocityX) < MIN_VELOCITY) {
        this._velocityX = 0;
        this._inertiaRaf = null;
        return;
      }

      this._velocityX *= FRICTION;
      const maxScroll = Math.max(0, eng.bars.length - 10);
      S.scrollOffset = Math.max(0, Math.min(maxScroll, S.scrollOffset + this._velocityX));
      S.mainDirty = true;
      S.topDirty = true;
      if (eng.layers) {
        eng.layers.markDirty(LAYERS.DATA);
        eng.layers.markDirty(LAYERS.INDICATORS);
        eng.layers.markDirty(LAYERS.UI);
      }
      this._inertiaRaf = requestAnimationFrame(step);
    };
    this._inertiaRaf = requestAnimationFrame(step);
  }

  _stopInertia() {
    this._velocityX = 0;
    if (this._inertiaRaf) {
      cancelAnimationFrame(this._inertiaRaf);
      this._inertiaRaf = null;
    }
  }

  // ─── Smooth Zoom Animation ─────────────────────────────────
  _startZoomAnimation() {
    if (this._zoomRaf) return; // Already running
    const eng = this.engine;
    const S = eng.state;

    const step = () => {
      if (this._targetVisibleBars === null) {
        this._zoomRaf = null;
        return;
      }

      const diff = this._targetVisibleBars - S.visibleBars;
      if (Math.abs(diff) < ZOOM_SNAP) {
        S.visibleBars = Math.round(this._targetVisibleBars);
        this._targetVisibleBars = null;
        this._zoomRaf = null;
        S.mainDirty = true;
        S.topDirty = true;
        return;
      }

      // Lerp toward target
      const oldBars = S.visibleBars;
      S.visibleBars += diff * ZOOM_LERP;

      // Anchor zoom around cursor position to keep price under cursor stable
      const barDelta = S.visibleBars - oldBars;
      const maxScroll = Math.max(0, eng.bars.length - 10);
      S.scrollOffset = Math.max(0, Math.min(maxScroll,
        S.scrollOffset - barDelta * (1 - this._zoomAnchorFrac)
      ));

      S.mainDirty = true;
      S.topDirty = true;
      this._zoomRaf = requestAnimationFrame(step);
    };
    this._zoomRaf = requestAnimationFrame(step);
  }

  onMouseMove(e) {
    const pos = this.getPos(e);
    const eng = this.engine;
    const S = eng.state;
    const R = S.lastRender;
    const consumed = eng.drawingEngine?.onMouseMove(pos.x, pos.y);

    if (!R) return;

    S.mouseX = pos.x;
    S.mouseY = pos.y;

    const ri = Math.round(pos.x / R.bSp - 0.5);
    S.hoverIdx = Math.max(0, Math.min(eng.bars.length - 1, R.start + ri));

    if (S.dragging === 'time' && !consumed) {
      if (S.timeAxisZoom) {
        const dx = S.dragStartX - e.clientX;
        const maxBars = Math.max(80, eng.bars.length);
        S.visibleBars = Math.max(10, Math.min(maxBars, S.dragStartVisibleBars * Math.exp(dx * 0.005)));
      } else {
        const maxScroll = Math.max(0, eng.bars.length - 10);
        S.scrollOffset = Math.max(0, Math.min(maxScroll, S.dragStartOffset + (e.clientX - S.dragStartX) / R.bSp));
      }
      S.mainDirty = true;
      if (eng.layers) {
        eng.layers.markDirty(LAYERS.DATA);
        eng.layers.markDirty(LAYERS.INDICATORS);
        eng.layers.markDirty(LAYERS.GRID);
      }
    } else if (S.dragging === 'price' && !consumed) {
      S.autoScale = false;
      const dy = e.clientY - S.dragStartY;
      S.priceScale = Math.max(0.1, Math.min(10, S.dragStartPriceScale * Math.exp(dy * 0.005)));
      S.mainDirty = true;
      if (eng.layers) {
        eng.layers.markDirty(LAYERS.DATA);
        eng.layers.markDirty(LAYERS.INDICATORS);
        eng.layers.markDirty(LAYERS.GRID);
      }
    } else if (S.dragging === 'chart' && !consumed) {
      const maxScroll = Math.max(0, eng.bars.length - 10);
      S.scrollOffset = Math.max(0, Math.min(maxScroll, S.dragStartOffset + (e.clientX - S.dragStartX) / R.bSp));
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
        eng.layers.markDirty(LAYERS.GRID);
      }

      // Track velocity for inertia
      const now = performance.now();
      const dt = now - this._lastMoveTime;
      if (dt > 0 && dt < 100) {
        const dx = e.clientX - this._lastMoveX;
        this._velocityX = (dx / R.bSp) * (16 / dt); // Normalize to ~60fps frame
      }
      this._lastMoveTime = now;
      this._lastMoveX = e.clientX;
    }

    S.topDirty = true;
    if (eng.layers) eng.layers.markDirty(LAYERS.UI);
    eng._scheduleDraw();

    // Sprint 13.2: Dynamic cursor based on drawing hover state
    if (!S.dragging) {
      const hint = eng.drawingEngine?.cursorHint;
      this.tc.style.cursor = hint || 'crosshair';
    }

    if (!consumed && eng.callbacks.onCrosshairMove && S.hoverIdx != null) {
      const bar = eng.bars[S.hoverIdx];
      if (bar) {
        const price = R.yMin + ((R.mainH - pos.y) / R.mainH) * (R.yMax - R.yMin);
        eng.callbacks.onCrosshairMove({ price, time: bar.time, bar, x: pos.x, y: pos.y });
      }
    }
  }

  onMouseLeave() {
    const S = this.engine.state;
    S.mouseX = null;
    S.mouseY = null;
    S.hoverIdx = null;
    S.dragging = false;
    this.tc.style.cursor = 'crosshair';
    S.topDirty = true;
    if (this.engine.layers) this.engine.layers.markDirty(LAYERS.UI);
    this.engine._scheduleDraw();
  }

  onMouseDown(e) {
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

    const r = this.tc.getBoundingClientRect();
    const isTimeAxis = e.clientY - r.top >= this.tc.clientHeight - (R.txH * R.pr) / R.pr;
    const isPriceAxis = e.clientX - r.left >= R.cW;

    // "Scroll to Now" button hit test
    const stnBtn = S._scrollToNowBtn;
    if (stnBtn && e.button === 0) {
      const localX = e.clientX - r.left;
      const localY = e.clientY - r.top;
      if (localX >= stnBtn.x && localX <= stnBtn.x + stnBtn.w &&
          localY >= stnBtn.y && localY <= stnBtn.y + stnBtn.h) {
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
    } else    if (isPriceAxis) {
      // Check auto-fit button first
      const afBtn = S._autoFitBtn;
      if (afBtn) {
        const localX = e.clientX - r.left;
        const localY = e.clientY - r.top;
        if (localX >= afBtn.x && localX <= afBtn.x + afBtn.w &&
            localY >= afBtn.y && localY <= afBtn.y + afBtn.h) {
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
          S.mainDirty = true;
          eng._scheduleDraw();
          return;
        }
        if (localX >= pctX && localX <= pctX + toggleW) {
          S.scaleMode = S.scaleMode === 'percent' ? 'linear' : 'percent';
          S.mainDirty = true;
          eng._scheduleDraw();
          return;
        }
      }

      S.dragging = 'price';
      S.dragStartY = e.clientY;
      S.dragStartPriceScale = S.priceScale;
      S.dragStartPriceScroll = S.priceScroll;
      this.tc.style.cursor = 'ns-resize';
    } else {
      // Middle-click (button 1) always starts chart pan, skipping drawing/axis checks
      S.dragging = 'chart';
      S.dragStartX = e.clientX;
      S.dragStartY = e.clientY;
      S.dragStartOffset = S.scrollOffset;
      S.dragStartPriceScroll = S.priceScroll;
      this.tc.style.cursor = 'grabbing';
    }
  }

  onMouseUp(e) {
    const pos = this.getPos(e);
    const eng = this.engine;
    if (eng.drawingEngine?.onMouseUp(pos.x, pos.y)) {
      eng._scheduleDraw();
      return;
    }

    const wasDrag = eng.state.dragging;
    const wasChartDrag = wasDrag === 'chart';
    eng.state.dragging = false;
    // Sprint 13.2: Restore cursor from drawing engine hint
    const hint = eng.drawingEngine?.cursorHint;
    this.tc.style.cursor = hint || 'crosshair';

    if (!wasDrag) return;
    const moved = Math.abs(e.clientX - eng.state.dragStartX);

    // Start inertia if we were dragging the chart area and have velocity
    if (wasChartDrag && Math.abs(this._velocityX) > MIN_VELOCITY && moved > 10) {
      this._startInertia();
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

  onDoubleClick(e) {
    const S = this.engine.state;
    this._stopInertia();
    this._targetVisibleBars = null;
    S.autoScale = true;
    S.priceScale = 1;
    S.priceScroll = 0;
    S.mainDirty = true;
    S.topDirty = true;
    this.engine._scheduleDraw();
  }

  onWheel(e) {
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
      // ── Trackpad pinch-zoom: zoom with reduced sensitivity ──
      const d = Math.sign(e.deltaY);
      const maxBars = Math.max(80, eng.bars.length);
      const currentTarget = this._targetVisibleBars || S.visibleBars;
      // Reduced sensitivity (0.08 vs 0.15) for trackpad pinch
      const newTarget = Math.max(10, Math.min(maxBars, Math.round(currentTarget * (1 + d * 0.08))));

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
      const maxScroll = Math.max(0, eng.bars.length - 10);
      S.scrollOffset = Math.max(0, Math.min(maxScroll, S.scrollOffset + barsDelta));
      S.mainDirty = true;
      S.topDirty = true;
      if (eng.layers) {
        eng.layers.markDirty(LAYERS.DATA);
        eng.layers.markDirty(LAYERS.INDICATORS);
        eng.layers.markDirty(LAYERS.UI);
      }
      eng._scheduleDraw();
    } else {
      // ── Discrete mouse wheel: zoom (original behavior) ──
      const d = Math.sign(e.deltaY);
      const maxBars = Math.max(80, eng.bars.length);
      const currentTarget = this._targetVisibleBars || S.visibleBars;
      const newTarget = Math.max(10, Math.min(maxBars, Math.round(currentTarget * (1 + d * 0.15))));

      if (R.cW > 0) {
        const pos = this.getPos(e);
        this._zoomAnchorFrac = Math.max(0, Math.min(1, pos.x / R.cW));
      }

      this._targetVisibleBars = newTarget;
      this._startZoomAnimation();
    }
  }

  // ─── Scroll to Now (animated) ────────────────────────────────
  scrollToNow() {
    this._stopInertia();
    if (this._scrollToNowRaf) cancelAnimationFrame(this._scrollToNowRaf);
    const eng = this.engine;
    const S = eng.state;

    const step = () => {
      if (Math.abs(S.scrollOffset) < 0.5) {
        S.scrollOffset = 0;
        this._scrollToNowRaf = null;
        S.mainDirty = true;
        S.topDirty = true;
        return;
      }
      S.scrollOffset *= 0.75; // Ease toward 0
      S.mainDirty = true;
      S.topDirty = true;
      if (eng.layers) {
        eng.layers.markDirty(LAYERS.DATA);
        eng.layers.markDirty(LAYERS.INDICATORS);
        eng.layers.markDirty(LAYERS.UI);
      }
      this._scrollToNowRaf = requestAnimationFrame(step);
    };
    this._scrollToNowRaf = requestAnimationFrame(step);
  }

  // ─── Touch Gesture Support ─────────────────────────────────
  _getTouchCenter(touches) {
    let x = 0, y = 0;
    for (let i = 0; i < touches.length; i++) {
      const r = this.tc.getBoundingClientRect();
      x += touches[i].clientX - r.left;
      y += touches[i].clientY - r.top;
    }
    return { x: x / touches.length, y: y / touches.length };
  }

  _getTouchDistance(touches) {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  onTouchStart(e) {
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
      this._touchMode = 'pinch';
      this._pinchStartDist = this._getTouchDistance(touches);
      this._pinchStartBars = S.visibleBars;
      this._pinchStartOffset = S.scrollOffset;
      const center = this._getTouchCenter(touches);
      this._pinchAnchorFrac = R.cW > 0 ? center.x / R.cW : 0.5;
    }
  }

  onTouchMove(e) {
    e.preventDefault();
    const touches = e.touches;
    const eng = this.engine;
    const S = eng.state;
    const R = S.lastRender;
    if (!R) return;

    if (this._touchMode === 'pan' && touches.length === 1) {
      const dx = touches[0].clientX - this._touchStartX;
      const maxScroll = Math.max(0, eng.bars.length - 10);
      S.scrollOffset = Math.max(0, Math.min(maxScroll, S.dragStartOffset + dx / R.bSp));
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
      const r = this.tc.getBoundingClientRect();
      S.mouseX = touches[0].clientX - r.left;
      S.mouseY = touches[0].clientY - r.top;
    } else if (this._touchMode === 'pinch' && touches.length >= 2) {
      const dist = this._getTouchDistance(touches);
      if (this._pinchStartDist > 0) {
        const scale = this._pinchStartDist / dist;
        const maxBars = Math.max(80, eng.bars.length);
        const newBars = Math.max(10, Math.min(maxBars, Math.round(this._pinchStartBars * scale)));
        const barDelta = newBars - S.visibleBars;

        S.visibleBars = newBars;

        // Anchor around pinch center
        const maxScroll = Math.max(0, eng.bars.length - 10);
        S.scrollOffset = Math.max(0, Math.min(maxScroll,
          S.scrollOffset - barDelta * (1 - this._pinchAnchorFrac)
        ));
        S.mainDirty = true;
        S.topDirty = true;
      }
    }
  }

  onTouchEnd(e) {
    e.preventDefault();
    if (this._touchMode === 'pan' && Math.abs(this._velocityX) > MIN_VELOCITY) {
      this._startInertia();
    }
    this._touchMode = null;
  }
}
