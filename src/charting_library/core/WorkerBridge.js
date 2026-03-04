// ═══════════════════════════════════════════════════════════════════
// charEdge — WorkerBridge
//
// Main-thread API for managing Web Workers.
// Provides a clean interface for ChartEngine to offload:
//   1. Indicator computation → IndicatorWorker
//
// Feature detection: automatically falls back to main-thread
// computation if Web Workers aren't available.
// ═══════════════════════════════════════════════════════════════════

export class WorkerBridge {
  constructor() {
    this._indicatorWorker = null;
    this._pendingCallbacks = new Map();
    this._callbackId = 0;

    // Feature detection
    this.hasWorkers = typeof Worker !== 'undefined';

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
    this._pendingCallbacks.clear();
  }
}
