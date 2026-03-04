// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Math Utilities
//
// Axis scaling (Heckbert's niceNum), price formatting,
// bar lookups, Heikin-Ashi conversion, and timeframe selection.
// ═══════════════════════════════════════════════════════════════════

/**
 * Format a price value for chart display
 * @param {number} v
 * @returns {string}
 */
export function fmtPrice(v) {
  if (v == null || isNaN(v)) return '0';
  const a = Math.abs(v);
  if (a >= 1000) return v.toFixed(2);
  if (a >= 1) return v.toFixed(2);
  if (a >= 0.01) return v.toFixed(4);
  if (a >= 0.0001) return v.toFixed(6);
  return v.toFixed(8);
}

/**
 * Compute a "nice" number for axis scaling (Heckbert's algorithm)
 * @param {number} r - Range value
 * @param {boolean} round - Whether to round (true) or ceil (false)
 * @returns {number}
 */
export function niceNum(r, round) {
  if (r <= 0) return 1;
  const e = Math.floor(Math.log10(r));
  const f = r / Math.pow(10, e);
  let n;
  if (round) {
    n = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
  } else {
    n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  }
  return n * Math.pow(10, e);
}

/**
 * Compute nice axis scale with min, max, ticks, and spacing
 * @param {number} min - Data minimum
 * @param {number} max - Data maximum
 * @param {number} mt - Desired number of tick marks
 * @returns {{ min: number, max: number, ticks: number[], spacing: number }}
 */
export function niceScale(min, max, mt) {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  if (!isFinite(min) || !isFinite(max)) {
    min = 0;
    max = 100;
  }
  if (mt < 2) mt = 2;

  const r = niceNum(max - min, false);
  const sp = niceNum(r / (mt - 1), true);
  if (sp <= 0) return { min: min - 1, max: max + 1, ticks: [min, max], spacing: 1 };

  const nMin = Math.floor(min / sp) * sp;
  const nMax = Math.ceil(max / sp) * sp;
  const t = [];
  for (let v = nMin; v <= nMax + sp * 0.5; v += sp) {
    t.push(+v.toFixed(10));
  }
  return { min: nMin, max: nMax, ticks: t, spacing: sp };
}

/**
 * Binary search — snap a trade timestamp to the nearest OHLCV bar
 * @param {{ time: string }[]} data - OHLCV bars with time field
 * @param {string} timestamp - ISO timestamp to find
 * @returns {number} Index of nearest bar, or -1 if not found
 */
export function findNearestBar(data, timestamp) {
  if (!data?.length || !timestamp) return -1;
  const target = new Date(timestamp).getTime();
  if (isNaN(target)) return -1;

  let lo = 0,
    hi = data.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const barTime = new Date(data[mid].time).getTime();
    if (barTime === target) return mid;
    if (barTime < target) lo = mid + 1;
    else hi = mid - 1;
  }

  // Return closest of lo and hi
  if (lo >= data.length) return data.length - 1;
  if (hi < 0) return 0;
  const loTime = new Date(data[lo].time).getTime();
  const hiTime = new Date(data[hi].time).getTime();
  return Math.abs(loTime - target) <= Math.abs(hiTime - target) ? lo : hi;
}

/**
 * Auto-select chart timeframe based on how old the trade is
 * @param {{ date: string }} trade
 * @returns {string} Timeframe ID (e.g., "1d", "5d", "3m")
 */
export function bestTfForTrade(trade) {
  if (!trade?.date) return '3m';
  const days = (Date.now() - new Date(trade.date).getTime()) / 86400000;
  if (days < 1) return '1d';
  if (days < 5) return '5d';
  if (days < 30) return '1m';
  if (days < 90) return '3m';
  if (days < 180) return '6m';
  return '1y';
}

/**
 * Convert OHLCV data to Heikin-Ashi candles
 * @param {{ open: number, high: number, low: number, close: number, time: string, volume?: number }[]} data
 * @returns {Array} Heikin-Ashi candle data with same structure
 */
export function toHeikinAshi(data) {
  if (!data?.length) return data;
  const ha = [];
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const prevHa = i > 0 ? ha[i - 1] : null;
    const haClose = (d.open + d.high + d.low + d.close) / 4;
    const haOpen = prevHa ? (prevHa.open + prevHa.close) / 2 : (d.open + d.close) / 2;
    const haHigh = Math.max(d.high, haOpen, haClose);
    const haLow = Math.min(d.low, haOpen, haClose);
    ha.push({
      ...d,
      open: haOpen,
      high: haHigh,
      low: haLow,
      close: haClose,
    });
  }
  return ha;
}
