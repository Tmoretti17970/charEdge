// ═══════════════════════════════════════════════════════════════════
// charEdge v11 — TimeAxis Core
//
// Extracts all horizontal coordinate mapping (time ↔ pixels).
// Pure function library to ensure tests pass and logic is decoupled
// from Canvas rendering constraints.
// ═══════════════════════════════════════════════════════════════════

/**
 * Creates a time transform object used to convert between pixels, times, and bar indices.
 * @param {Array} bars - The OHLCV bars array.
 * @param {number} startIdx - The integer start index of the viewport.
 * @param {number} exactStart - The floating sub-pixel exact start of the viewport.
 * @param {number} visibleBars - The total number of visible bars across the viewport.
 * @param {number} chartWidth - The pixel width of the chart drawing area.
 * @returns {Object} timeTransform object
 */
export function createTimeTransform(bars, startIdx, exactStart, visibleBars, chartWidth) {
  const barSpacing = chartWidth / visibleBars;

  return {
    barSpacing,

    /**
     * Converts a data array index to an X pixel coordinate.
     * @param {number} idx - Float or int index in the bars array.
     * @returns {number} pixel x coordinate.
     */
    indexToPixel: (idx) => {
      return (idx - exactStart + 0.5) * barSpacing;
    },

    /**
     * Converts an X pixel coordinate to a floating index.
     * @param {number} x - Pixel x coordinate.
     * @returns {number} Float index in the bars array.
     */
    pixelToIndex: (x) => {
      return x / barSpacing - 0.5 + exactStart;
    },

    /**
     * Converts a pixel coordinate to a unix timestamp.
     * @param {number} x - Pixel x coordinate.
     * @returns {number} UNIX timestamp in ms.
     */
    pixelToTime: (x) => {
      if (!bars || bars.length === 0) return Date.now();
      const ri = x / barSpacing - 0.5;
      const exactIdx = exactStart + ri;
      const idx = Math.max(0, Math.min(bars.length - 1, Math.round(exactIdx)));
      return bars[idx]?.time || Date.now();
    },

    /**
     * Converts a unix timestamp to a pixel coordinate.
     * Predicts future time if timestamp is beyond the loaded data.
     * @param {number} t - UNIX timestamp in ms.
     * @returns {number} Pixel x coordinate.
     */
    timeToPixel: (t) => {
      if (!bars || bars.length === 0) return 0;

      let idx = bars.findIndex((b) => b.time === t);

      if (idx === -1) {
        // Estimate index for future bars or in-between gaps
        if (t > bars[bars.length - 1].time) {
          const diff = t - bars[bars.length - 1].time;
          // Approximate timeframe from last two bars, default to 1 min (60000ms)
          const tfMs = bars.length > 1 ? bars[bars.length - 1].time - bars[bars.length - 2].time : 60000;
          idx = bars.length - 1 + diff / tfMs;
        } else if (t < bars[0].time) {
          const diff = bars[0].time - t;
          const tfMs = bars.length > 1 ? bars[1].time - bars[0].time : 60000;
          idx = -(diff / tfMs);
        } else {
          // Binary search approximation for gaps inside the data
          idx = approximateIndexForTime(bars, t);
        }
      }

      return (idx - exactStart + 0.5) * barSpacing;
    },
  };
}

/**
 * Returns the layout properties for candles.
 * @param {number} barSpacing - Space between each bar.
 * @returns {Object} barWidth layout values.
 */
export function candleLayout(barSpacing) {
  const gap = Math.max(1, Math.round(barSpacing * 0.2));
  const barW = barSpacing - gap;
  const bodyW = Math.max(1, Math.round(barW));
  return { barW, gap, bodyW };
}

/**
 * Helper to find fractional index for a timestamp within known data bounds.
 */
function approximateIndexForTime(bars, t) {
  let low = 0;
  let high = bars.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (bars[mid].time === t) return mid;
    if (bars[mid].time < t) low = mid + 1;
    else high = mid - 1;
  }

  // low is now the insertion point. it represents the first element > t.
  // high is the last element < t.
  if (high < 0) return 0;
  if (low >= bars.length) return bars.length - 1;

  const b1 = bars[high];
  const b2 = bars[low];
  const progress = (t - b1.time) / (b2.time - b1.time);

  return high + progress;
}
