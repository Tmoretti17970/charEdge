// ═══════════════════════════════════════════════════════════════════
// charEdge — LayerManager
//
// Multi-layer canvas compositing system.
// Splits rendering into 5 independent canvas layers, each with its
// own dirty flag. This eliminates 60-80% of unnecessary redraws:
//
// Phase 1.3.3: OffscreenCanvas support — GRID, DATA, INDICATORS
// layers can be transferred to a Web Worker for off-main-thread
// rendering. DRAWINGS + UI stay on the main thread for zero-latency
// interaction. Fallback: if OffscreenCanvas unsupported, all layers
// render on the main thread as before.
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
  GRID:       'GRID',
  DATA:       'DATA',
  INDICATORS: 'INDICATORS',
  DRAWINGS:   'DRAWINGS',
  UI:         'UI',
};

const LAYER_ORDER = [
  LAYERS.GRID,
  LAYERS.DATA,
  LAYERS.INDICATORS,
  LAYERS.DRAWINGS,
  LAYERS.UI,
];

export class LayerManager {
  /**
   * @param {HTMLElement} container — parent DOM element
   * @param {Object} [options]
   * @param {string[]} [options.offscreenLayers] — layer names to transfer to a worker
   *   e.g. ['GRID', 'DATA', 'INDICATORS']. These layers' 2D contexts become null on
   *   the main thread (worker owns rendering). Falls back gracefully if unsupported.
   * @param {Function} [options.onResize] — callback(viewport) when dimensions change,
   *   used to notify the render worker of resize events.
   */
  constructor(container, options = {}) {
    this.container = container;
    this._layers = new Map();
    this._dirty = new Map();
    this._disposed = false;

    // Phase 1.3.3: OffscreenCanvas layer tracking
    this._offscreenSet = new Set(options.offscreenLayers || []);
    this._offscreenCanvases = new Map(); // name → OffscreenCanvas
    this._offscreenActive = false; // true if any layer was successfully transferred
    this._onResizeCallback = options.onResize || null;

    // Feature detection
    const hasOffscreen = typeof OffscreenCanvas !== 'undefined'
      && typeof HTMLCanvasElement.prototype.transferControlToOffscreen === 'function';

    // Store dimensions
    this.mediaWidth = 0;
    this.mediaHeight = 0;
    this.bitmapWidth = 0;
    this.bitmapHeight = 0;
    this.pixelRatio = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;

    // Create all layers — all render on the main thread.
    for (let i = 0; i < LAYER_ORDER.length; i++) {
      const name = LAYER_ORDER[i];
      const canvas = document.createElement('canvas');
      canvas.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;z-index:${i}`;

      container.appendChild(canvas);

      // Context options: GRID is opaque (no alpha), others need transparency.
      const ctxOptions = name === LAYERS.GRID
        ? { alpha: false }
        : { alpha: true };

      const ctx = canvas.getContext('2d', ctxOptions);
      this._layers.set(name, { canvas, ctx, offscreen: false });
      this._dirty.set(name, true); // All dirty initially
    }

    // ResizeObserver for HiDPI handling
    this._ro = new ResizeObserver(this._onResize.bind(this));
    this._ro.observe(container);
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

      this.mediaWidth = mw;
      this.mediaHeight = mh;
      this.bitmapWidth = bw;
      this.bitmapHeight = bh;
      this.pixelRatio = pr;

      // Resize all canvas buffers (skip offscreen — worker handles those)
      for (const [_name, layer] of this._layers) {
        if (layer.offscreen) continue; // Cannot touch canvas after transferControlToOffscreen()
        layer.canvas.width = bw;
        layer.canvas.height = bh;
        layer.canvas.style.width = mw + 'px';
        layer.canvas.style.height = mh + 'px';
      }

      // All layers dirty after resize
      this.markAllDirty();

      // Phase 1.3.3: Notify render worker of resize
      if (this._offscreenActive && this._onResizeCallback) {
        this._onResizeCallback({ bitmapWidth: bw, bitmapHeight: bh, pixelRatio: pr });
      }
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
    for (const name of LAYER_ORDER) {
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

  // ─── OffscreenCanvas Access (Phase 1.3.3) ───────────────────

  /**
   * Get transferable OffscreenCanvas objects for worker init.
   * Call once, then pass to WorkerBridge.initRenderWorker().
   * @returns {{ gridCanvas, dataCanvas, indicatorCanvas } | null}
   */
  getOffscreenCanvases() {
    if (!this._offscreenActive) return null;
    const grid = this._offscreenCanvases.get(LAYERS.GRID);
    const data = this._offscreenCanvases.get(LAYERS.DATA);
    const indicator = this._offscreenCanvases.get(LAYERS.INDICATORS);
    if (!grid || !data || !indicator) return null;
    return { gridCanvas: grid, dataCanvas: data, indicatorCanvas: indicator };
  }

  /**
   * Check if a specific layer is rendered offscreen (by worker).
   * @param {string} layerName
   * @returns {boolean}
   */
  isOffscreen(layerName) {
    return this._layers.get(layerName)?.offscreen || false;
  }

  /**
   * Whether any layers have been transferred to a worker.
   * @returns {boolean}
   */
  get hasOffscreenLayers() {
    return this._offscreenActive;
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
    const merged = document.createElement('canvas');
    merged.width = this.bitmapWidth;
    merged.height = this.bitmapHeight;
    const ctx = merged.getContext('2d');

    for (const name of LAYER_ORDER) {
      const canvas = this.getCanvas(name);
      if (canvas) ctx.drawImage(canvas, 0, 0);
    }

    return merged;
  }

  /**
   * Dispose all layers and clean up.
   */
  dispose() {
    if (this._disposed) return;
    this._disposed = true;

    this._ro.disconnect();

    for (const [_name, layer] of this._layers) {
      // Release canvas memory (iOS Safari fix)
      // Cannot set width/height on canvases transferred to OffscreenCanvas
      if (!layer.offscreen) {
        layer.canvas.width = 0;
        layer.canvas.height = 0;
      }
      if (layer.canvas.parentElement) {
        layer.canvas.parentElement.removeChild(layer.canvas);
      }
    }

    this._layers.clear();
    this._dirty.clear();
  }
}
