// ═══════════════════════════════════════════════════════════════════
// charEdge — Equity Curve Smoothing Utilities (D4.1)
//
// Pure math functions for Gaussian and Weighted Moving Average
// smoothing of equity curve data.
// ═══════════════════════════════════════════════════════════════════

/**
 * Apply Gaussian smoothing to equity curve points.
 * @param {Array<{date: number|string, pnl: number}>} points
 * @param {number} sigma - Standard deviation (default: 3)
 * @returns {Array<{date: number|string, pnl: number}>}
 */
export function gaussianSmooth(points, sigma = 3) {
  if (!points || points.length < 3) return points;

  const kernelSize = Math.ceil(sigma * 3) * 2 + 1;
  const halfKernel = Math.floor(kernelSize / 2);

  // Build Gaussian kernel
  const kernel = [];
  let kernelSum = 0;
  for (let i = -halfKernel; i <= halfKernel; i++) {
    const val = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel.push(val);
    kernelSum += val;
  }
  // Normalize
  for (let i = 0; i < kernel.length; i++) {
    kernel[i] /= kernelSum;
  }

  // Apply convolution
  const result = [];
  for (let i = 0; i < points.length; i++) {
    let smoothedPnl = 0;
    let weightSum = 0;
    for (let k = 0; k < kernel.length; k++) {
      const idx = i + k - halfKernel;
      if (idx >= 0 && idx < points.length) {
        smoothedPnl += points[idx].pnl * kernel[k];
        weightSum += kernel[k];
      }
    }
    result.push({
      date: points[i].date,
      pnl: weightSum > 0 ? smoothedPnl / weightSum : points[i].pnl,
    });
  }

  return result;
}

/**
 * Apply Weighted Moving Average smoothing to equity curve points.
 * @param {Array<{date: number|string, pnl: number}>} points
 * @param {number} period - Number of periods (default: 5)
 * @returns {Array<{date: number|string, pnl: number}>}
 */
export function wmaSmooth(points, period = 5) {
  if (!points || points.length < 2) return points;

  const effectivePeriod = Math.min(period, points.length);
  const result = [];

  for (let i = 0; i < points.length; i++) {
    if (i < effectivePeriod - 1) {
      // Not enough lookback — use raw value
      result.push({ date: points[i].date, pnl: points[i].pnl });
      continue;
    }

    let weightedSum = 0;
    let totalWeight = 0;
    for (let j = 0; j < effectivePeriod; j++) {
      const weight = j + 1; // linearly increasing: 1, 2, ..., period
      weightedSum += points[i - effectivePeriod + 1 + j].pnl * weight;
      totalWeight += weight;
    }

    result.push({
      date: points[i].date,
      pnl: totalWeight > 0 ? weightedSum / totalWeight : points[i].pnl,
    });
  }

  return result;
}

/**
 * Apply smoothing to equity points based on mode.
 * @param {Array<{date: number|string, pnl: number}>} points
 * @param {'raw' | 'gaussian' | 'wma'} mode
 * @returns {Array<{date: number|string, pnl: number}>}
 */
export function applySmoothing(points, mode = 'raw') {
  switch (mode) {
    case 'gaussian':
      return gaussianSmooth(points);
    case 'wma':
      return wmaSmooth(points);
    default:
      return points;
  }
}
