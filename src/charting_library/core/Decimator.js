// ═══════════════════════════════════════════════════════════════════
// charEdge — Decimator
//
// Data decimation pipeline for zoomed-out chart views.
// When thousands of bars are visible but only hundreds of pixels
// exist to draw them, we reduce the data set while preserving
// visual fidelity.
//
// Two algorithms:
//   LTTB  — Largest Triangle Three Buckets (for line/area charts)
//           Perceptually perfect: keeps the shape identical.
//   MinMax — Per-pixel-column OHLC (for candlestick/OHLC charts)
//           Preserves exact high/low extremes per column.
//
// Both operate on typed arrays and return index arrays (zero-copy).
// ═══════════════════════════════════════════════════════════════════

/**
 * LTTB — Largest Triangle Three Buckets downsampling.
 *
 * Reduces N points to targetCount points while preserving
 * the visual shape of the data. Works on close prices.
 *
 * Reference: Sveinn Steinarsson, "Downsampling Time Series for
 * Visual Representation" (2013)
 *
 * @param {Float64Array} xValues — typically time or index
 * @param {Float64Array} yValues — typically close price
 * @param {number} length — number of data points
 * @param {number} targetCount — desired output count
 * @returns {Int32Array} — indices into original arrays
 */
export function lttbDecimate(xValues, yValues, length, targetCount) {
  if (length <= targetCount || targetCount < 3) {
    // No decimation needed: return identity indices
    const indices = new Int32Array(length);
    for (let i = 0; i < length; i++) indices[i] = i;
    return indices;
  }

  const result = new Int32Array(targetCount);
  let resultIdx = 0;

  // Always keep first point
  result[resultIdx++] = 0;

  const bucketSize = (length - 2) / (targetCount - 2);

  let prevSelected = 0;

  for (let bucket = 0; bucket < targetCount - 2; bucket++) {
    // Bucket boundaries
    const bucketStart = Math.floor((bucket + 1) * bucketSize) + 1;
    const bucketEnd = Math.min(Math.floor((bucket + 2) * bucketSize) + 1, length - 1);

    // Calculate the average point of the NEXT bucket (for triangle area)
    const nextBucketStart = bucketEnd;
    const nextBucketEnd = Math.min(Math.floor((bucket + 3) * bucketSize) + 1, length);
    let avgX = 0, avgY = 0;
    const nextBucketLen = nextBucketEnd - nextBucketStart;
    if (nextBucketLen > 0) {
      for (let i = nextBucketStart; i < nextBucketEnd; i++) {
        avgX += xValues[i];
        avgY += yValues[i];
      }
      avgX /= nextBucketLen;
      avgY /= nextBucketLen;
    }

    // Find the point in current bucket with largest triangle area
    let maxArea = -1;
    let maxIdx = bucketStart;

    const px = xValues[prevSelected];
    const py = yValues[prevSelected];

    for (let i = bucketStart; i < bucketEnd; i++) {
      // Triangle area = |0.5 * (x_a(y_b - y_c) + x_b(y_c - y_a) + x_c(y_a - y_b))|
      const area = Math.abs(
        (px - avgX) * (yValues[i] - py) -
        (px - xValues[i]) * (avgY - py)
      );
      if (area > maxArea) {
        maxArea = area;
        maxIdx = i;
      }
    }

    result[resultIdx++] = maxIdx;
    prevSelected = maxIdx;
  }

  // Always keep last point
  result[resultIdx++] = length - 1;

  return result;
}

/**
 * MinMax per-pixel-column decimation for candlestick/OHLC charts.
 *
 * Groups bars into pixel columns and for each column outputs:
 *   - Open of first bar in column
 *   - Highest high
 *   - Lowest low
 *   - Close of last bar in column
 *   - Sum of volume
 *   - Time of first bar
 *
 * This preserves the exact visual extremes that candlesticks need.
 *
 * @param {Object} buffer — BarDataBuffer or BarDataBufferView
 * @param {number} start — start index in buffer
 * @param {number} end — end index in buffer
 * @param {number} targetColumns — number of pixel columns
 * @returns {Array<{time,open,high,low,close,volume}>} — aggregated bars
 */
export function minMaxDecimate(buffer, start, end, targetColumns) {
  const count = end - start;
  if (count <= targetColumns || targetColumns < 1) {
    // No decimation needed — return as-is
    return buffer.toArray ? buffer.toArray(start, end) : buffer.slice(start, end);
  }

  const barsPerColumn = count / targetColumns;
  const result = new Array(targetColumns);

  for (let col = 0; col < targetColumns; col++) {
    const colStart = start + Math.floor(col * barsPerColumn);
    const colEnd = Math.min(start + Math.floor((col + 1) * barsPerColumn), end);

    if (colStart >= colEnd) {
      // Edge case: empty column, duplicate previous
      result[col] = result[col - 1] || { time: 0, open: 0, high: 0, low: 0, close: 0, volume: 0 };
      continue;
    }

    let hi = -Infinity, lo = Infinity, vol = 0;
    const openVal = buffer.open[colStart];
    const closeVal = buffer.close[colEnd - 1];
    const timeVal = buffer.time[colStart];

    for (let i = colStart; i < colEnd; i++) {
      if (buffer.high[i] > hi) hi = buffer.high[i];
      if (buffer.low[i] < lo) lo = buffer.low[i];
      vol += buffer.volume[i];
    }

    result[col] = {
      time: timeVal,
      open: openVal,
      high: hi,
      low: lo,
      close: closeVal,
      volume: vol,
    };
  }

  return result;
}

/**
 * Auto-decimate based on chart type and available pixels.
 *
 * @param {Object} buffer — BarDataBuffer or view
 * @param {number} start — start index
 * @param {number} end — end index
 * @param {number} chartWidthPx — available chart width in CSS pixels
 * @param {string} chartType — 'candlestick', 'line', 'area', etc.
 * @returns {{bars: Array, decimated: boolean, ratio: number}}
 */
export function autoDecimate(buffer, start, end, chartWidthPx, chartType) {
  const count = end - start;
  const pixelsPerBar = chartWidthPx / count;

  // Threshold: decimate when bars are narrower than 0.5px each
  if (pixelsPerBar >= 0.5 || count <= 0) {
    // No decimation needed
    const bars = buffer.toArray ? buffer.toArray(start, end)
      : Array.isArray(buffer) ? buffer.slice(start, end)
        : [];
    return { bars, decimated: false, ratio: 1 };
  }

  const targetCount = Math.max(3, Math.floor(chartWidthPx * 0.8));

  if (chartType === 'line' || chartType === 'area' || chartType === 'baseline') {
    // LTTB for line-type charts
    // Need the data as typed arrays
    const timeArr = buffer.time || null;
    const closeArr = buffer.close || null;

    if (timeArr && closeArr) {
      // Create index-based x values for LTTB
      const xVals = new Float64Array(count);
      const yVals = new Float64Array(count);
      for (let i = 0; i < count; i++) {
        xVals[i] = i;
        yVals[i] = closeArr[start + i];
      }
      const indices = lttbDecimate(xVals, yVals, count, targetCount);
      const bars = new Array(indices.length);
      for (let i = 0; i < indices.length; i++) {
        const srcIdx = start + indices[i];
        bars[i] = {
          time: buffer.time[srcIdx],
          open: buffer.open[srcIdx],
          high: buffer.high[srcIdx],
          low: buffer.low[srcIdx],
          close: buffer.close[srcIdx],
          volume: buffer.volume[srcIdx],
        };
      }
      return { bars, decimated: true, ratio: count / indices.length };
    }
  }

  // MinMax for candlestick-style charts
  const bars = minMaxDecimate(buffer, start, end, targetCount);
  return { bars, decimated: true, ratio: count / targetCount };
}
