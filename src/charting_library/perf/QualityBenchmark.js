// ═══════════════════════════════════════════════════════════════════
// charEdge — QualityBenchmark
//
// Visual quality regression testing framework.
// Captures canvas snapshots and performs pixel-diff comparisons
// to detect rendering regressions across DPR, zoom, and scale modes.
//
// Usage:
//   const qb = new QualityBenchmark();
//   const snap = qb.captureSnapshot(canvas, { name: 'baseline' });
//   const cmp  = QualityBenchmark.compareSnapshots(golden, current);
//   console.log(cmp.pass ? 'PASS' : 'FAIL', cmp.mse);
// ═══════════════════════════════════════════════════════════════════

/**
 * Visual quality regression testing framework.
 * Captures snapshots and performs pixel-diff comparisons.
 */
export class QualityBenchmark {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.mseThreshold=1.0] - Maximum MSE for a passing comparison
   * @param {number} [opts.maxDeltaThreshold=25] - Maximum per-channel delta allowed
   * @param {number} [opts.diffPixelRatio=0.005] - Max ratio of changed pixels (0.5%)
   */
  constructor(opts = {}) {
    this.mseThreshold = opts.mseThreshold ?? 1.0;
    this.maxDeltaThreshold = opts.maxDeltaThreshold ?? 25;
    this.diffPixelRatio = opts.diffPixelRatio ?? 0.005;

    /** @type {Snapshot[]} */
    this._snapshots = [];
  }

  // ─── Snapshot Capture ─────────────────────────────────────

  /**
   * Capture a snapshot from a canvas or image data.
   *
   * @param {HTMLCanvasElement|OffscreenCanvas|{width: number, height: number, data: Uint8ClampedArray}} source
   * @param {Object} [config]
   * @param {string} [config.name='unnamed'] - Snapshot name
   * @param {number} [config.dpr=1] - Device pixel ratio
   * @param {number} [config.zoom=1] - Zoom level
   * @param {string} [config.scaleMode='linear'] - Scale mode
   * @returns {Snapshot}
   */
  captureSnapshot(source, config = {}) {
    const name = config.name ?? 'unnamed';
    const dpr = config.dpr ?? 1;
    const zoom = config.zoom ?? 1;
    const scaleMode = config.scaleMode ?? 'linear';

    let width, height, data;

    if (source && source.data instanceof Uint8ClampedArray) {
      // Raw ImageData-like object
      width = source.width;
      height = source.height;
      data = new Uint8ClampedArray(source.data);
    } else if (source && typeof source.getContext === 'function') {
      // Canvas element
      width = source.width;
      height = source.height;
      try {
        const ctx = source.getContext('2d');
        if (ctx && ctx.getImageData) {
          const imageData = ctx.getImageData(0, 0, width, height);
          data = new Uint8ClampedArray(imageData.data);
        } else {
          // Mock/unavailable — create zeroed data
          data = new Uint8ClampedArray(width * height * 4);
        }
      } catch {
        data = new Uint8ClampedArray(width * height * 4);
      }
    } else {
      throw new Error('captureSnapshot: invalid source — expected canvas or { width, height, data }');
    }

    const snapshot = {
      name,
      width,
      height,
      data,
      config: { dpr, zoom, scaleMode },
      timestamp: Date.now(),
    };

    this._snapshots.push(snapshot);
    return snapshot;
  }

  // ─── Comparison ───────────────────────────────────────────

  /**
   * Compare two snapshots pixel-by-pixel.
   *
   * @param {Snapshot} a - Golden/reference snapshot
   * @param {Snapshot} b - Current snapshot to test
   * @param {Object} [thresholds]
   * @param {number} [thresholds.mseThreshold] - Override MSE threshold
   * @param {number} [thresholds.maxDeltaThreshold] - Override max delta
   * @param {number} [thresholds.diffPixelRatio] - Override diff pixel ratio
   * @returns {{ mse: number, maxDelta: number, diffPixelCount: number, totalPixels: number, diffRatio: number, pass: boolean }}
   */
  static compareSnapshots(a, b, thresholds = {}) {
    const mseThresh = thresholds.mseThreshold ?? 1.0;
    const maxDeltaThresh = thresholds.maxDeltaThreshold ?? 25;
    const diffRatioThresh = thresholds.diffPixelRatio ?? 0.005;

    if (!a || !b) {
      return { mse: Infinity, maxDelta: 255, diffPixelCount: 0, totalPixels: 0, diffRatio: 1, pass: false };
    }

    if (a.width !== b.width || a.height !== b.height) {
      return {
        mse: Infinity,
        maxDelta: 255,
        diffPixelCount: a.width * a.height,
        totalPixels: a.width * a.height,
        diffRatio: 1,
        pass: false,
      };
    }

    const totalPixels = a.width * a.height;
    if (totalPixels === 0) {
      return { mse: 0, maxDelta: 0, diffPixelCount: 0, totalPixels: 0, diffRatio: 0, pass: true };
    }

    const dataA = a.data;
    const dataB = b.data;
    let sumSqErr = 0;
    let maxDelta = 0;
    let diffPixelCount = 0;

    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      let pixelDiff = false;
      let pixelSqErr = 0;

      for (let c = 0; c < 4; c++) {
        const delta = Math.abs(dataA[idx + c] - dataB[idx + c]);
        if (delta > 0) pixelDiff = true;
        if (delta > maxDelta) maxDelta = delta;
        pixelSqErr += delta * delta;
      }

      sumSqErr += pixelSqErr;
      if (pixelDiff) diffPixelCount++;
    }

    // MSE across (pixels * 4 channels)
    const mse = sumSqErr / (totalPixels * 4);
    const diffRatio = diffPixelCount / totalPixels;

    const pass = mse <= mseThresh && maxDelta <= maxDeltaThresh && diffRatio <= diffRatioThresh;

    return {
      mse: Math.round(mse * 1000) / 1000,
      maxDelta,
      diffPixelCount,
      totalPixels,
      diffRatio: Math.round(diffRatio * 10000) / 10000,
      pass,
    };
  }

  // ─── Batch Testing ────────────────────────────────────────

  /**
   * Run a batch of comparisons against golden snapshots.
   *
   * @param {Snapshot[]} goldens - Array of golden snapshots
   * @param {Snapshot[]} currents - Array of current snapshots (matched by name)
   * @returns {{ results: Array<{name: string, pass: boolean, mse: number, maxDelta: number}>, allPassed: boolean }}
   */
  runBatch(goldens, currents) {
    const currentMap = new Map();
    for (const c of currents) {
      currentMap.set(c.name, c);
    }

    const results = [];
    for (const golden of goldens) {
      const current = currentMap.get(golden.name);
      if (!current) {
        results.push({ name: golden.name, pass: false, mse: Infinity, maxDelta: 255, error: 'missing' });
        continue;
      }

      const cmp = QualityBenchmark.compareSnapshots(golden, current, {
        mseThreshold: this.mseThreshold,
        maxDeltaThreshold: this.maxDeltaThreshold,
        diffPixelRatio: this.diffPixelRatio,
      });

      results.push({
        name: golden.name,
        pass: cmp.pass,
        mse: cmp.mse,
        maxDelta: cmp.maxDelta,
        diffRatio: cmp.diffRatio,
      });
    }

    return {
      results,
      allPassed: results.every(r => r.pass),
    };
  }

  // ─── Queries ──────────────────────────────────────────────

  /**
   * Get all captured snapshots.
   * @returns {Snapshot[]}
   */
  getSnapshots() {
    return [...this._snapshots];
  }

  /**
   * Find a snapshot by name.
   * @param {string} name
   * @returns {Snapshot|null}
   */
  getSnapshotByName(name) {
    return this._snapshots.find(s => s.name === name) || null;
  }

  /**
   * Reset all snapshots.
   */
  reset() {
    this._snapshots = [];
  }
}
