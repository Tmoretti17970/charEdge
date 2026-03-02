// ═══════════════════════════════════════════════════════════════════
// charEdge — Mobile Chart Experience (Sprint 23)
// Touch gesture handlers, responsive breakpoints, and mobile
// optimizations for the charting library.
// ═══════════════════════════════════════════════════════════════════

/**
 * Enhanced touch gesture handler for chart interactions.
 * Supports pinch-to-zoom, two-finger pan, long-press for drawing,
 * and double-tap to reset zoom.
 */
export class ChartTouchHandler {
  constructor(element, callbacks = {}) {
    this.el = element;
    this.callbacks = callbacks;
    this.touches = [];
    this.gestureState = 'idle'; // idle, panning, zooming, longpress, drawing
    this.longPressTimer = null;
    this.lastTap = 0;
    this.initialPinchDist = 0;
    this.initialZoom = 1;
    this._bound = {};

    this._bind();
  }

  _bind() {
    this._bound.touchstart = this._onTouchStart.bind(this);
    this._bound.touchmove = this._onTouchMove.bind(this);
    this._bound.touchend = this._onTouchEnd.bind(this);

    this.el.addEventListener('touchstart', this._bound.touchstart, { passive: false });
    this.el.addEventListener('touchmove', this._bound.touchmove, { passive: false });
    this.el.addEventListener('touchend', this._bound.touchend, { passive: false });
  }

  destroy() {
    this.el.removeEventListener('touchstart', this._bound.touchstart);
    this.el.removeEventListener('touchmove', this._bound.touchmove);
    this.el.removeEventListener('touchend', this._bound.touchend);
    if (this.longPressTimer) clearTimeout(this.longPressTimer);
  }

  _onTouchStart(e) {
    this.touches = Array.from(e.touches);

    if (this.touches.length === 1) {
      // Single touch — check for double-tap
      const now = Date.now();
      if (now - this.lastTap < 300) {
        e.preventDefault();
        this.callbacks.onDoubleTap?.();
        this.lastTap = 0;
        return;
      }
      this.lastTap = now;

      // Start long-press timer (500ms)
      this.longPressTimer = setTimeout(() => {
        this.gestureState = 'longpress';
        const t = this.touches[0];
        this.callbacks.onLongPress?.({
          x: t.clientX - this.el.getBoundingClientRect().left,
          y: t.clientY - this.el.getBoundingClientRect().top,
        });
      }, 500);

      this.gestureState = 'panning';
    } else if (this.touches.length === 2) {
      e.preventDefault();
      if (this.longPressTimer) clearTimeout(this.longPressTimer);
      this.gestureState = 'zooming';
      this.initialPinchDist = this._getPinchDist(this.touches);
      this.callbacks.onPinchStart?.();
    }
  }

  _onTouchMove(e) {
    if (this.longPressTimer) clearTimeout(this.longPressTimer);
    const touches = Array.from(e.touches);

    if (this.gestureState === 'panning' && touches.length === 1) {
      e.preventDefault();
      const dx = touches[0].clientX - this.touches[0].clientX;
      const dy = touches[0].clientY - this.touches[0].clientY;
      this.callbacks.onPan?.({ dx, dy });
      this.touches = touches;
    } else if (this.gestureState === 'zooming' && touches.length === 2) {
      e.preventDefault();
      const newDist = this._getPinchDist(touches);
      const scale = newDist / this.initialPinchDist;
      const midX = (touches[0].clientX + touches[1].clientX) / 2;
      const midY = (touches[0].clientY + touches[1].clientY) / 2;
      const rect = this.el.getBoundingClientRect();
      this.callbacks.onPinch?.({
        scale,
        centerX: midX - rect.left,
        centerY: midY - rect.top,
      });
    } else if (this.gestureState === 'longpress' && touches.length === 1) {
      // Drawing mode — track finger
      const rect = this.el.getBoundingClientRect();
      this.callbacks.onDrawMove?.({
        x: touches[0].clientX - rect.left,
        y: touches[0].clientY - rect.top,
      });
    }
  }

  _onTouchEnd(e) {
    if (this.longPressTimer) clearTimeout(this.longPressTimer);

    if (this.gestureState === 'zooming') {
      this.callbacks.onPinchEnd?.();
    } else if (this.gestureState === 'longpress') {
      if (e.changedTouches.length > 0) {
        const t = e.changedTouches[0];
        const rect = this.el.getBoundingClientRect();
        this.callbacks.onDrawEnd?.({
          x: t.clientX - rect.left,
          y: t.clientY - rect.top,
        });
      }
    } else if (this.gestureState === 'panning' && e.changedTouches.length > 0) {
      this.callbacks.onPanEnd?.();
    }

    if (e.touches.length === 0) {
      this.gestureState = 'idle';
      this.touches = [];
    }
  }

  _getPinchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

/**
 * Responsive chart configuration based on viewport width.
 */
export function getResponsiveChartConfig(width) {
  if (width < 400) {
    return {
      barSpacing: 4,
      fontSize: 10,
      showVolume: false,
      showGrid: false,
      showYAxis: true,
      showXAxis: false,
      indicatorHeight: 60,
      toolbarPosition: 'bottom',
      compactMode: true,
    };
  }
  if (width < 768) {
    return {
      barSpacing: 5,
      fontSize: 11,
      showVolume: true,
      showGrid: true,
      showYAxis: true,
      showXAxis: true,
      indicatorHeight: 80,
      toolbarPosition: 'bottom',
      compactMode: true,
    };
  }
  return {
    barSpacing: 8,
    fontSize: 12,
    showVolume: true,
    showGrid: true,
    showYAxis: true,
    showXAxis: true,
    indicatorHeight: 100,
    toolbarPosition: 'top',
    compactMode: false,
  };
}
