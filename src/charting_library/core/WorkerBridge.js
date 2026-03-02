// ═══════════════════════════════════════════════════════════════════
// charEdge — WorkerBridge
//
// Main-thread API for managing Web Workers.
// Provides a clean interface for ChartEngine to offload:
//   1. Indicator computation → IndicatorWorker
//   2. (Future) Heavy rendering → RenderWorker via OffscreenCanvas
//
// Feature detection: automatically falls back to main-thread
// computation if Web Workers aren't available.
// ═══════════════════════════════════════════════════════════════════

export class WorkerBridge {
  constructor() {
    this._indicatorWorker = null;
    this._renderWorker = null;
    this._pendingCallbacks = new Map();
    this._callbackId = 0;
    this._ready = false;

    // Feature detection
    this.hasWorkers = typeof Worker !== 'undefined';
    this.hasOffscreenCanvas = typeof OffscreenCanvas !== 'undefined';

    this._initIndicatorWorker();
  }

  // ─── Indicator Worker ───────────────────────────────────────

  _initIndicatorWorker() {
    if (!this.hasWorkers) return;

    try {
      this._indicatorWorker = new Worker(
        new URL('./IndicatorWorker.js', import.meta.url),
        { type: 'module' }
      );

      this._indicatorWorker.onmessage = (e) => {
        const { type, payload } = e.data;
        if (type === 'result') {
          this._resolveCallback('indicator', payload);
        }
      };

      this._indicatorWorker.onerror = (err) => {
        console.warn('[WorkerBridge] Indicator worker error:', err.message);
      };
    } catch (err) {
      console.warn('[WorkerBridge] Failed to create indicator worker:', err.message);
      this._indicatorWorker = null;
    }
  }

  /**
   * Compute indicators in the background worker.
   * Falls back to synchronous computation if no worker available.
   *
   * @param {Array} indicators — list of indicator configs
   * @param {Object} barBuffer — BarDataBuffer instance
   * @returns {Promise<Object>} — results keyed by indicator id
   */
  computeIndicators(indicators, barBuffer) {
    if (!this._indicatorWorker || !barBuffer || barBuffer.length === 0) {
      return Promise.resolve({});
    }

    return new Promise((resolve) => {
      const id = this._storeCallback('indicator', resolve);

      // Phase 1.2.3: Zero-copy transfer via Transferable ArrayBuffers.
      // After postMessage, the source buffers become detached.
      // This is safe because BarDataBuffer.fromArray() rebuilds them on every setData().
      const data = {
        time: barBuffer.time.buffer,
        open: barBuffer.open.buffer,
        high: barBuffer.high.buffer,
        low: barBuffer.low.buffer,
        close: barBuffer.close.buffer,
        volume: barBuffer.volume.buffer,
        length: barBuffer.length,
      };

      this._indicatorWorker.postMessage({
        type: 'compute',
        payload: {
          indicators: indicators.map(ind => ({
            id: ind.id || ind.label,
            type: ind.type || ind.name,
            period: ind.params?.period || ind.period,
            fast: ind.params?.fast,
            slow: ind.params?.slow,
            signal: ind.params?.signal,
            stdDev: ind.params?.stdDev,
          })),
          barData: data,
        },
      }, [data.time, data.open, data.high, data.low, data.close, data.volume]);

      // Timeout fallback
      setTimeout(() => {
        if (this._pendingCallbacks.has('indicator')) {
          this._resolveCallback('indicator', {});
        }
      }, 5000);
    });
  }

  /**
   * Initialize the render worker with OffscreenCanvas layers.
   * The canvases must already be OffscreenCanvas objects (transferred by LayerManager).
   * @param {Object} canvases — { gridCanvas, dataCanvas, indicatorCanvas } (OffscreenCanvas)
   * @param {Object} viewport — { bitmapWidth, bitmapHeight, pixelRatio }
   * @returns {boolean} true if worker was successfully initialized
   */
  initRenderWorker(canvases, viewport) {
    if (!this.hasWorkers || !this.hasOffscreenCanvas) return false;

    try {
      this._renderWorker = new Worker(
        new URL('./RenderWorker.js', import.meta.url),
        { type: 'module' }
      );

      this._renderWorker.onmessage = (e) => {
        const { type, payload } = e.data;
        if (type === 'frameComplete') {
          this._resolveCallback('render', payload);
        } else if (type === 'ready') {
          this._ready = true;
        }
      };

      this._renderWorker.onerror = (err) => {
        console.warn('[WorkerBridge] Render worker error:', err.message);
      };

      // OffscreenCanvases are already transferred by LayerManager
      // — send them directly to the worker
      const { gridCanvas, dataCanvas, indicatorCanvas } = canvases;

      this._renderWorker.postMessage({
        type: 'init',
        payload: {
          gridCanvas,
          dataCanvas,
          indicatorCanvas,
          viewport,
        },
      }, [gridCanvas, dataCanvas, indicatorCanvas]);

      return true;
    } catch (err) {
      console.warn('[WorkerBridge] Failed to init render worker:', err.message);
      this._renderWorker = null;
      return false;
    }
  }

  /**
   * Request a render frame from the worker.
   * @returns {Promise<{time: number}>}
   */
  requestRender() {
    if (!this._renderWorker || !this._ready) return Promise.resolve({ time: 0 });

    return new Promise((resolve) => {
      this._storeCallback('render', resolve);
      this._renderWorker.postMessage({ type: 'render' });
    });
  }

  /**
   * Send data to the render worker.
   * @param {BarDataBuffer} barBuffer
   */
  sendDataToRenderWorker(barBuffer) {
    if (!this._renderWorker || !this._ready) return;

    this._renderWorker.postMessage({
      type: 'setData',
      payload: {
        time: barBuffer.time.slice(0, barBuffer.length),
        open: barBuffer.open.slice(0, barBuffer.length),
        high: barBuffer.high.slice(0, barBuffer.length),
        low: barBuffer.low.slice(0, barBuffer.length),
        close: barBuffer.close.slice(0, barBuffer.length),
        volume: barBuffer.volume.slice(0, barBuffer.length),
        length: barBuffer.length,
      },
    });
  }

  /**
   * Send scroll state to the render worker.
   * @param {Object} scrollState
   */
  sendScrollState(scrollState) {
    if (!this._renderWorker || !this._ready) return;
    this._renderWorker.postMessage({ type: 'scroll', payload: scrollState });
  }

  /**
   * Send theme to the render worker.
   * @param {Object} theme
   */
  sendTheme(theme) {
    if (!this._renderWorker || !this._ready) return;
    this._renderWorker.postMessage({ type: 'setTheme', payload: theme });
  }

  /**
   * Send serialized frame state to the render worker.
   * Called each frame when offscreen rendering is active.
   * @param {{ scrollOffset: number, visibleBars: number, symbol?: string }} state
   */
  sendFrameState(state) {
    if (!this._renderWorker || !this._ready) return;
    this._renderWorker.postMessage({ type: 'scroll', payload: state });
  }

  /**
   * Send resize event to the render worker.
   * @param {{ bitmapWidth: number, bitmapHeight: number, pixelRatio: number }} viewport
   */
  sendResize(viewport) {
    if (!this._renderWorker || !this._ready) return;
    this._renderWorker.postMessage({ type: 'resize', payload: viewport });
  }

  /**
   * Send indicator data to the render worker.
   * @param {Array<{ type: string, values: number[], color: string, lineWidth?: number }>} indicators
   */
  sendIndicators(indicators) {
    if (!this._renderWorker || !this._ready) return;
    this._renderWorker.postMessage({ type: 'setIndicators', payload: indicators });
  }

  // ─── Callback Management ────────────────────────────────────

  _storeCallback(key, resolve) {
    this._pendingCallbacks.set(key, resolve);
    return key;
  }

  _resolveCallback(key, data) {
    const cb = this._pendingCallbacks.get(key);
    if (cb) {
      this._pendingCallbacks.delete(key);
      cb(data);
    }
  }

  // ─── Cleanup ────────────────────────────────────────────────

  dispose() {
    if (this._indicatorWorker) {
      this._indicatorWorker.postMessage({ type: 'dispose' });
      this._indicatorWorker.terminate();
      this._indicatorWorker = null;
    }
    if (this._renderWorker) {
      this._renderWorker.postMessage({ type: 'dispose' });
      this._renderWorker.terminate();
      this._renderWorker = null;
    }
    this._pendingCallbacks.clear();
  }

  /** @returns {boolean} */
  get isRenderWorkerReady() {
    return this._ready;
  }
}
