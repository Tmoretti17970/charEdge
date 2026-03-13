// ═══════════════════════════════════════════════════════════════════
// charEdge — LayerManager
//
// Multi-layer canvas compositing system.
// Splits rendering into 5 independent canvas layers, each with its
// own dirty flag. This eliminates 60-80% of unnecessary redraws:
//
//   Layer 0  GRID         Grid lines, watermark, background
//                         Dirty on: resize, theme change
//
//   Layer 1  DATA         Candles, volume, heatmap, S/R, alerts, trades, price line
//                         Dirty on: data change, scroll, zoom
//
//   Layer 2  INDICATORS   Overlay + pane indicators, session dividers
//                         Dirty on: indicator config/data change, scroll
//
//   Layer 3  DRAWINGS     User drawings (trendlines, fibs, etc.)
//                         Dirty on: drawing edits
//
//   Layer 4  UI           Crosshair, tooltips, countdown, magnet dot
//                         Dirty on: mouse move
//
// Each layer is a <canvas> with its own 2D context, stacked via
// CSS z-index. Only dirty layers are cleared and redrawn per frame.
// ═══════════════════════════════════════════════════════════════════

/** Layer names in z-order */
export const LAYERS = {
  GRID: 'GRID',
  DATA: 'DATA',
  INDICATORS: 'INDICATORS',
  DRAWINGS: 'DRAWINGS',
  UI: 'UI',
};

const LAYER_ORDER = [LAYERS.GRID, LAYERS.DATA, LAYERS.INDICATORS, LAYERS.DRAWINGS, LAYERS.UI];

/** Indicator panes only need 3 layers (no DATA or DRAWINGS) */
const INDICATOR_LAYER_ORDER = [LAYERS.GRID, LAYERS.INDICATORS, LAYERS.UI];

export class LayerManager {
  /**
   * @param {HTMLElement} container — parent DOM element
   * @param {{ layerSet?: 'main' | 'indicator', onResize?: () => void }} [options] — layer configuration
   *   'main' (default): 5 layers (GRID, DATA, INDICATORS, DRAWINGS, UI)
   *   'indicator': 3 layers (GRID, INDICATORS, UI) — saves ~40% GPU memory per pane
   *   onResize: callback invoked after container resize to wake the render loop
   */
  constructor(container, options = {}) {
    this.container = container;
    this._layers = new Map();
    this._dirty = new Map();
    this._disposed = false;
    /** @type {number|null} Pending rAF for batched canvas resize */
    this._pendingResizeRaf = null;
    /** @type {(() => void) | null} Callback invoked after resize to wake the render loop */
    this._onResizeCallback = options.onResize || null;

    /** @type {'main' | 'indicator'} */
    this._layerSet = options.layerSet || 'main';
    /** Which layers this instance manages */
    this._layerOrder = this._layerSet === 'indicator' ? INDICATOR_LAYER_ORDER : LAYER_ORDER;

    // Store dimensions
    this.mediaWidth = 0;
    this.mediaHeight = 0;
    this.bitmapWidth = 0;
    this.bitmapHeight = 0;
    this.pixelRatio = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;

    // Create layers for this set
    for (let i = 0; i < this._layerOrder.length; i++) {
      const name = this._layerOrder[i];
      const canvas = document.createElement('canvas');
      canvas.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;z-index:${i}`;
      // E3.2: Promote DRAWINGS canvas to its own GPU compositing layer
      if (name === LAYERS.DRAWINGS) canvas.style.transform = 'translateZ(0)';

      container.appendChild(canvas);

      // Context options: GRID is opaque (no alpha), others need transparency.
      const ctxOptions = name === LAYERS.GRID ? { alpha: false } : { alpha: true };

      const ctx = canvas.getContext('2d', {
        ...ctxOptions,
        desynchronized: name === LAYERS.UI,
      });
      this._layers.set(name, { canvas, ctx });
      this._dirty.set(name, true); // All dirty initially
    }

    // ResizeObserver for HiDPI handling
    this._ro = new ResizeObserver(this._onResize.bind(this));
    this._ro.observe(container);

    // Trigger initial sizing synchronously so canvases aren't 0×0 on first render
    const initW = container.clientWidth || container.offsetWidth || 1;
    const initH = container.clientHeight || container.offsetHeight || 1;
    if (initW > 0 && initH > 0) {
      const pr = this.pixelRatio;
      this.mediaWidth = initW;
      this.mediaHeight = initH;
      this.bitmapWidth = Math.round(initW * pr);
      this.bitmapHeight = Math.round(initH * pr);
      for (const [_name, layer] of this._layers) {
        layer.canvas.width = this.bitmapWidth;
        layer.canvas.height = this.bitmapHeight;
        layer.canvas.style.width = initW + 'px';
        layer.canvas.style.height = initH + 'px';
      }
    }
  }

  // ─── Resize ────────────────────────────────────────────────────

  _onResize(entries) {
    if (this._disposed) return;

    for (const entry of entries) {
      if (entry.target !== this.container) continue;

      const cr = entry.contentRect;
      const pr = window.devicePixelRatio || 1;
      const mw = Math.max(1, Math.round(cr.width));
      const mh = Math.max(1, Math.round(cr.height));

      let bw, bh;
      if (entry.devicePixelContentBoxSize) {
        const dpx = entry.devicePixelContentBoxSize[0];
        bw = dpx.inlineSize;
        bh = dpx.blockSize;
      } else {
        bw = Math.max(1, Math.round(mw * pr));
        bh = Math.max(1, Math.round(mh * pr));
      }

      // Skip if unchanged
      if (this.bitmapWidth === bw && this.bitmapHeight === bh) return;

      // Update dimension properties immediately (FrameState reads these)
      this.mediaWidth = mw;
      this.mediaHeight = mh;
      this.bitmapWidth = bw;
      this.bitmapHeight = bh;
      this.pixelRatio = pr;

      // Batch canvas buffer resize into the next rAF to prevent the
      // black/white flash. Setting canvas.width instantly clears the
      // buffer, but the render loop won't repaint until the next rAF.
      // By deferring the resize, the old content stays visible until
      // the render loop repaints with the new dimensions in the same
      // frame. Cancel any pending resize to coalesce rapid calls.
      if (this._pendingResizeRaf) cancelAnimationFrame(this._pendingResizeRaf);
      const capturedBW = bw;
      const capturedBH = bh;
      const capturedMW = mw;
      const capturedMH = mh;
      this._pendingResizeRaf = requestAnimationFrame(() => {
        if (this._disposed) return;
        this._pendingResizeRaf = null;
        for (const [_name, layer] of this._layers) {
          layer.canvas.width = capturedBW;
          layer.canvas.height = capturedBH;
          layer.canvas.style.width = capturedMW + 'px';
          layer.canvas.style.height = capturedMH + 'px';
        }
        // All layers dirty after resize
        this.markAllDirty();
        // Notify engine to schedule a render frame (demand-driven loop wake-up)
        if (this._onResizeCallback) this._onResizeCallback();
      });
    }
  }

  // ─── Dirty Tracking ─────────────────────────────────────────

  /**
   * Mark a specific layer as needing redraw.
   * @param {string} layerName — one of LAYERS constants
   */
  markDirty(layerName) {
    this._dirty.set(layerName, true);
  }

  /**
   * Mark all layers as dirty (resize, theme change, etc.)
   */
  markAllDirty() {
    for (const name of this._layerOrder) {
      this._dirty.set(name, true);
    }
  }

  /**
   * Check if a layer needs redraw.
   * @param {string} layerName
   * @returns {boolean}
   */
  isDirty(layerName) {
    return this._dirty.get(layerName) || false;
  }

  /**
   * Clear dirty flag for a layer (after rendering it).
   * @param {string} layerName
   */
  clearDirty(layerName) {
    this._dirty.set(layerName, false);
  }

  /**
   * Check if any layer is dirty.
   * @returns {boolean}
   */
  anyDirty() {
    for (const dirty of this._dirty.values()) {
      if (dirty) return true;
    }
    return false;
  }

  // ─── Layer Access ───────────────────────────────────────────

  /**
   * Get the canvas element for a layer.
   * @param {string} layerName
   * @returns {HTMLCanvasElement}
   */
  getCanvas(layerName) {
    return this._layers.get(layerName)?.canvas;
  }

  /**
   * Get the 2D context for a layer.
   * @param {string} layerName
   * @returns {CanvasRenderingContext2D}
   */
  getCtx(layerName) {
    return this._layers.get(layerName)?.ctx || null;
  }

  /**
   * Get the topmost canvas (UI layer) for event binding.
   * @returns {HTMLCanvasElement}
   */
  getEventTarget() {
    return this.getCanvas(LAYERS.UI);
  }

  // ─── Utility ────────────────────────────────────────────────

  /**
   * Clear a specific layer.
   * @param {string} layerName
   */
  clearLayer(layerName) {
    const ctx = this.getCtx(layerName);
    if (ctx) {
      ctx.clearRect(0, 0, this.bitmapWidth, this.bitmapHeight);
    }
  }

  /**
   * Composite all layers into a single canvas for export/screenshot.
   * @returns {HTMLCanvasElement}
   */
  getSnapshotCanvas() {
    const bw = this.bitmapWidth || 1;
    const bh = this.bitmapHeight || 1;
    const merged = document.createElement('canvas');
    merged.width = bw;
    merged.height = bh;
    const ctx = merged.getContext('2d');

    for (const name of this._layerOrder) {
      const canvas = this.getCanvas(name);
      if (canvas && canvas.width > 0 && canvas.height > 0) {
        ctx.drawImage(canvas, 0, 0);
      }
    }

    return merged;
  }

  /**
   * Dispose all layers and clean up.
   */
  dispose() {
    if (this._disposed) return;
    this._disposed = true;

    if (this._pendingResizeRaf) {
      cancelAnimationFrame(this._pendingResizeRaf);
      this._pendingResizeRaf = null;
    }

    this._ro.disconnect();

    for (const [_name, layer] of this._layers) {
      // Release canvas memory (iOS Safari fix)
      layer.canvas.width = 0;
      layer.canvas.height = 0;
      if (layer.canvas.parentElement) {
        layer.canvas.parentElement.removeChild(layer.canvas);
      }
    }

    this._layers.clear();
    this._dirty.clear();
  }
}
