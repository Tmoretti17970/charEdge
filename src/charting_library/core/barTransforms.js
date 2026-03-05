// ═══════════════════════════════════════════════════════════════════
// charEdge — Bar Transforms
// Pure functions to convert OHLCV data into alternative bar types.
// ═══════════════════════════════════════════════════════════════════

/**
 * Calculate Average True Range (ATR).
 * @param {Array} bars - OHLCV bars
 * @param {number} period - ATR period (default 14)
 * @returns {number} ATR value
 */
export function autoATR(bars, period = 14) {
  if (!bars || bars.length < 2) return 1;
  const len = Math.min(bars.length, period + 1);
  let sum = 0;
  let count = 0;
  for (let i = 1; i < len; i++) {
    const tr = Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close)
    );
    sum += tr;
    count++;
  }
  return count > 0 ? sum / count : bars[0].high - bars[0].low || 1;
}

/**
 * Convert OHLCV bars into Renko bricks.
 * @param {Array} bars - Source OHLCV data
 * @param {number} [brickSize] - Brick size in price units. Auto-calculated from ATR(14)/2 if not provided.
 * @returns {{ bricks: Array, brickSize: number }}
 */
export function toRenkoBricks(bars, brickSize) {
  if (!bars || bars.length === 0) return { bricks: [], brickSize: 0 };

  const bs = brickSize || Math.max(autoATR(bars, 14) / 2, 0.01);
  const bricks = [];

  // Start from first bar's close, aligned to brick grid
  let lastClose = Math.round(bars[0].close / bs) * bs;
  let lastDir = 0; // 1 = up, -1 = down

  for (let i = 1; i < bars.length; i++) {
    const price = bars[i].close;
    const diff = price - lastClose;
    const bricksNeeded = Math.floor(Math.abs(diff) / bs);

    if (bricksNeeded >= 1) {
      const dir = diff > 0 ? 1 : -1;

      // Reversal requires 2 bricks in opposite direction
      if (lastDir !== 0 && dir !== lastDir && bricksNeeded < 2) continue;

      const actualBricks = (lastDir !== 0 && dir !== lastDir) ? bricksNeeded : bricksNeeded;

      for (let j = 0; j < actualBricks; j++) {
        const open = lastClose;
        const close = lastClose + dir * bs;

        bricks.push({
          time: bars[i].time, // Use source bar time for positioning
          open,
          close,
          high: Math.max(open, close),
          low: Math.min(open, close),
          volume: bars[i].volume || 0,
          _isUp: dir > 0,
        });

        lastClose = close;
        lastDir = dir;
      }
    }
  }

  return { bricks, brickSize: bs };
}

/**
 * Convert OHLCV bars into range bars with uniform price range.
 * @param {Array} bars - Source OHLCV data
 * @param {number} [rangeSize] - Range size in price units. Auto-calculated from ATR(14) if not provided.
 * @returns {{ rangeBars: Array, rangeSize: number }}
 */
export function toRangeBars(bars, rangeSize) {
  if (!bars || bars.length === 0) return { rangeBars: [], rangeSize: 0 };

  const rs = rangeSize || Math.max(autoATR(bars, 14), 0.01);
  const rangeBars = [];

  let currentBar = {
    time: bars[0].time,
    open: bars[0].open,
    high: bars[0].high,
    low: bars[0].low,
    close: bars[0].close,
    volume: bars[0].volume || 0,
  };

  for (let i = 1; i < bars.length; i++) {
    const tick = bars[i];

    // Update current bar
    currentBar.high = Math.max(currentBar.high, tick.high);
    currentBar.low = Math.min(currentBar.low, tick.low);
    currentBar.close = tick.close;
    currentBar.volume += tick.volume || 0;

    // Check if range threshold is met
    while (currentBar.high - currentBar.low >= rs) {
      // Close the current bar at the range limit
      const isUp = currentBar.close >= currentBar.open;

      if (isUp) {
        // Cap high at open + rangeSize
        const cappedHigh = currentBar.low + rs;
        rangeBars.push({
          time: currentBar.time,
          open: currentBar.open,
          high: cappedHigh,
          low: currentBar.low,
          close: cappedHigh,
          volume: currentBar.volume,
        });
        // Start new bar from capped high
        currentBar = {
          time: tick.time,
          open: cappedHigh,
          high: Math.max(cappedHigh, tick.high),
          low: cappedHigh,
          close: tick.close,
          volume: 0,
        };
      } else {
        // Cap low at high - rangeSize
        const cappedLow = currentBar.high - rs;
        rangeBars.push({
          time: currentBar.time,
          open: currentBar.open,
          high: currentBar.high,
          low: cappedLow,
          close: cappedLow,
          volume: currentBar.volume,
        });
        // Start new bar from capped low
        currentBar = {
          time: tick.time,
          open: cappedLow,
          high: cappedLow,
          low: Math.min(cappedLow, tick.low),
          close: tick.close,
          volume: 0,
        };
      }
    }
  }

  // Push final partial bar
  if (currentBar) {
    rangeBars.push(currentBar);
  }

  return { rangeBars, rangeSize: rs };
}

/**
 * Convert OHLCV bars into Heikin-Ashi smoothed candles.
 * HA candles filter noise and make trends more visible.
 *
 * Formula:
 *   HA-Close = (O + H + L + C) / 4
 *   HA-Open  = (prev HA-Open + prev HA-Close) / 2
 *   HA-High  = max(H, HA-Open, HA-Close)
 *   HA-Low   = min(L, HA-Open, HA-Close)
 *
 * @param {Array} bars - Source OHLCV data
 * @returns {Array} Heikin-Ashi bars (same structure, volume preserved)
 */
export function toHeikinAshi(bars) {
  if (!bars || bars.length === 0) return [];

  const ha = new Array(bars.length);

  // First bar: averaged values
  const b0 = bars[0];
  const haClose0 = (b0.open + b0.high + b0.low + b0.close) / 4;
  const haOpen0 = (b0.open + b0.close) / 2;
  ha[0] = {
    time: b0.time,
    open: haOpen0,
    close: haClose0,
    high: Math.max(b0.high, haOpen0, haClose0),
    low: Math.min(b0.low, haOpen0, haClose0),
    volume: b0.volume || 0,
  };

  for (let i = 1; i < bars.length; i++) {
    const b = bars[i];
    const prev = ha[i - 1];
    const haClose = (b.open + b.high + b.low + b.close) / 4;
    const haOpen = (prev.open + prev.close) / 2;
    ha[i] = {
      time: b.time,
      open: haOpen,
      close: haClose,
      high: Math.max(b.high, haOpen, haClose),
      low: Math.min(b.low, haOpen, haClose),
      volume: b.volume || 0,
    };
  }

  return ha;
}

// ═══════════════════════════════════════════════════════════════════
// Phase 1 Deep Dive — New Chart Type Transforms
// ═══════════════════════════════════════════════════════════════════

/**
 * Convert OHLCV bars into Kagi reversal lines.
 * @param {Array} bars - Source OHLCV data
 * @param {number} [reversalPct] - Reversal percentage. Auto-calculated from ATR if not provided.
 * @returns {{ kagiSegments: Array, reversalPct: number }}
 */
export function toKagiBars(bars, reversalPct) {
  if (!bars || bars.length === 0) return { kagiSegments: [], reversalPct: 0 };

  const rp = reversalPct || Math.max(autoATR(bars, 14) / bars[bars.length - 1].close * 100, 0.5);
  const segments = [];
  let dir = 0; // 1 = up, -1 = down
  let lastPrice = bars[0].close;
  let extremePrice = lastPrice;

  for (let i = 1; i < bars.length; i++) {
    const price = bars[i].close;
    const change = ((price - extremePrice) / Math.abs(extremePrice)) * 100;

    if (dir === 0) {
      dir = price > lastPrice ? 1 : -1;
      extremePrice = price;
      segments.push({
        time: bars[i].time,
        open: lastPrice,
        close: price,
        high: Math.max(lastPrice, price),
        low: Math.min(lastPrice, price),
        volume: bars[i].volume || 0,
        _dir: dir,
        _thick: dir === 1, // Yang (thick) when going up
      });
      lastPrice = price;
      continue;
    }

    if (dir === 1) {
      if (price > extremePrice) {
        extremePrice = price;
        if (segments.length > 0) {
          const last = segments[segments.length - 1];
          last.close = price;
          last.high = Math.max(last.high, price);
        }
      } else if (-change >= rp) {
        // Reversal down
        dir = -1;
        const thick = price < (segments.length > 1 ? segments[segments.length - 2].low : lastPrice);
        segments.push({
          time: bars[i].time, open: extremePrice, close: price,
          high: extremePrice, low: price, volume: bars[i].volume || 0,
          _dir: -1, _thick: !thick,
        });
        extremePrice = price;
      }
    } else {
      if (price < extremePrice) {
        extremePrice = price;
        if (segments.length > 0) {
          const last = segments[segments.length - 1];
          last.close = price;
          last.low = Math.min(last.low, price);
        }
      } else if (change >= rp) {
        // Reversal up
        dir = 1;
        const thick = price > (segments.length > 1 ? segments[segments.length - 2].high : lastPrice);
        segments.push({
          time: bars[i].time, open: extremePrice, close: price,
          high: price, low: extremePrice, volume: bars[i].volume || 0,
          _dir: 1, _thick: thick,
        });
        extremePrice = price;
      }
    }
  }

  return { kagiSegments: segments, reversalPct: rp };
}

/**
 * Convert OHLCV bars into Line Break (3-Line Break) bars.
 * @param {Array} bars - Source OHLCV data
 * @param {number} [lineCount=3] - Number of lines required for reversal
 * @returns {{ lineBreakBars: Array }}
 */
export function toLineBreakBars(bars, lineCount = 3) {
  if (!bars || bars.length < 2) return { lineBreakBars: [] };

  const lbBars = [];
  lbBars.push({
    time: bars[1].time,
    open: bars[0].close,
    close: bars[1].close,
    high: Math.max(bars[0].close, bars[1].close),
    low: Math.min(bars[0].close, bars[1].close),
    volume: bars[1].volume || 0,
    _isUp: bars[1].close >= bars[0].close,
  });

  for (let i = 2; i < bars.length; i++) {
    const price = bars[i].close;
    const last = lbBars[lbBars.length - 1];

    if (last._isUp && price > last.close) {
      // Continuation up
      lbBars.push({
        time: bars[i].time, open: last.close, close: price,
        high: price, low: last.close, volume: bars[i].volume || 0, _isUp: true,
      });
    } else if (!last._isUp && price < last.close) {
      // Continuation down
      lbBars.push({
        time: bars[i].time, open: last.close, close: price,
        high: last.close, low: price, volume: bars[i].volume || 0, _isUp: false,
      });
    } else {
      // Check reversal: price must break beyond N lines ago
      const lookback = Math.min(lineCount, lbBars.length);
      const refBar = lbBars[lbBars.length - lookback];
      if (last._isUp && price < refBar.low) {
        lbBars.push({
          time: bars[i].time, open: last.close, close: price,
          high: last.close, low: price, volume: bars[i].volume || 0, _isUp: false,
        });
      } else if (!last._isUp && price > refBar.high) {
        lbBars.push({
          time: bars[i].time, open: last.close, close: price,
          high: price, low: last.close, volume: bars[i].volume || 0, _isUp: true,
        });
      }
    }
  }

  return { lineBreakBars: lbBars };
}

/**
 * Transform bars for Volume Candles (width proportional to volume).
 * Returns bars with a _widthRatio field (0-1, relative to max volume).
 * @param {Array} bars - Source OHLCV data
 * @returns {Array} Same bars with _widthRatio added
 */
export function toVolumeCandles(bars) {
  if (!bars || bars.length === 0) return [];
  let maxVol = 0;
  for (const b of bars) {
    if ((b.volume || 0) > maxVol) maxVol = b.volume;
  }
  if (maxVol === 0) maxVol = 1;

  return bars.map(b => ({
    ...b,
    _widthRatio: Math.max(0.2, (b.volume || 0) / maxVol),
  }));
}

/**
 * Hi-Lo bars — simple high-low range bars (no open/close distinction).
 * Same data structure as normal bars, just rendered differently.
 */
export function toHiLoBars(bars) {
  if (!bars || bars.length === 0) return [];
  return bars.map(b => ({
    ...b,
    _isHiLo: true,
  }));
}
