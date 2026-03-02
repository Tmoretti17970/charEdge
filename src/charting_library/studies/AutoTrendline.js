// ═══════════════════════════════════════════════════════════════════
// charEdge — Auto Trendline Engine (Sprint 7)
// Detects and draws auto-trendlines by connecting validated
// swing highs/lows with confidence scoring.
// ═══════════════════════════════════════════════════════════════════

/**
 * Detect auto-trendlines from OHLCV data.
 * @param {Object[]} bars
 * @param {Object} [options]
 * @returns {Object[]} Array of { start, end, slope, type, touches, confidence }
 */
export function detectAutoTrendlines(bars, options = {}) {
  const {
    pivotRange = 5,
    minTouches = 3,
    tolerance = 0.002, // 0.2% tolerance for "touching" a trendline
    maxLines = 10,
  } = options;

  if (!bars || bars.length < pivotRange * 2 + 2) return [];

  // Find swing points
  const swingHighs = [];
  const swingLows = [];

  for (let i = pivotRange; i < bars.length - pivotRange; i++) {
    let isHigh = true, isLow = true;
    for (let j = 1; j <= pivotRange; j++) {
      if (bars[i].high <= bars[i - j].high || bars[i].high <= bars[i + j].high) isHigh = false;
      if (bars[i].low >= bars[i - j].low || bars[i].low >= bars[i + j].low) isLow = false;
    }
    if (isHigh) swingHighs.push({ idx: i, price: bars[i].high, time: bars[i].time });
    if (isLow) swingLows.push({ idx: i, price: bars[i].low, time: bars[i].time });
  }

  const lines = [];

  // Build trendlines from swing lows (ascending support lines)
  for (let i = 0; i < swingLows.length - 1; i++) {
    for (let j = i + 1; j < swingLows.length; j++) {
      const p1 = swingLows[i];
      const p2 = swingLows[j];
      if (p2.idx - p1.idx < pivotRange) continue;

      const slope = (p2.price - p1.price) / (p2.idx - p1.idx);
      let touches = 2;

      // Count additional touches
      for (const sw of swingLows) {
        if (sw === p1 || sw === p2) continue;
        const expectedPrice = p1.price + slope * (sw.idx - p1.idx);
        if (Math.abs(sw.price - expectedPrice) / expectedPrice < tolerance) {
          touches++;
        }
      }

      if (touches >= minTouches) {
        lines.push({
          start: { barIdx: p1.idx, price: p1.price, time: p1.time },
          end: { barIdx: p2.idx, price: p2.price, time: p2.time },
          slope,
          type: 'support',
          direction: slope > 0 ? 'ascending' : 'descending',
          touches,
          confidence: touches * (1 + (p2.idx / bars.length)),
        });
      }
    }
  }

  // Build trendlines from swing highs (descending resistance lines)
  for (let i = 0; i < swingHighs.length - 1; i++) {
    for (let j = i + 1; j < swingHighs.length; j++) {
      const p1 = swingHighs[i];
      const p2 = swingHighs[j];
      if (p2.idx - p1.idx < pivotRange) continue;

      const slope = (p2.price - p1.price) / (p2.idx - p1.idx);
      let touches = 2;

      for (const sw of swingHighs) {
        if (sw === p1 || sw === p2) continue;
        const expectedPrice = p1.price + slope * (sw.idx - p1.idx);
        if (Math.abs(sw.price - expectedPrice) / expectedPrice < tolerance) {
          touches++;
        }
      }

      if (touches >= minTouches) {
        lines.push({
          start: { barIdx: p1.idx, price: p1.price, time: p1.time },
          end: { barIdx: p2.idx, price: p2.price, time: p2.time },
          slope,
          type: 'resistance',
          direction: slope > 0 ? 'ascending' : 'descending',
          touches,
          confidence: touches * (1 + (p2.idx / bars.length)),
        });
      }
    }
  }

  // Sort by confidence and return top lines
  lines.sort((a, b) => b.confidence - a.confidence);
  return lines.slice(0, maxLines);
}

/**
 * Detect breakouts: price crossing confirmed trendlines.
 * @param {Object[]} trendlines - From detectAutoTrendlines
 * @param {Object[]} bars
 * @returns {Object[]} Breakout events
 */
export function detectBreakouts(trendlines, bars) {
  if (!trendlines.length || !bars.length) return [];
  const breakouts = [];
  const lastBar = bars[bars.length - 1];
  const prevBar = bars.length > 1 ? bars[bars.length - 2] : lastBar;

  for (const line of trendlines) {
    const currentExpected = line.start.price + line.slope * (bars.length - 1 - line.start.barIdx);
    const prevExpected = line.start.price + line.slope * (bars.length - 2 - line.start.barIdx);

    const crossed = (prevBar.close <= prevExpected && lastBar.close > currentExpected) ||
                    (prevBar.close >= prevExpected && lastBar.close < currentExpected);

    if (crossed) {
      const direction = lastBar.close > currentExpected ? 'bullish' : 'bearish';
      breakouts.push({
        trendline: line,
        bar: lastBar,
        direction,
        message: `${direction === 'bullish' ? '🟢' : '🔴'} ${line.type} trendline breakout (${line.touches} touches)`,
      });
    }
  }

  return breakouts;
}
