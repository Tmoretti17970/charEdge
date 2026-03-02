// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Type System
// Registry of chart rendering styles. Each type is a renderer plugin
// that conforms to the same draw() interface.
//
// Available types:
//   - candlestick  (default, solid filled)
//   - hollow       (hollow candles, filled only when bearish)
//   - heikinashi   (Heikin-Ashi smoothed candles)
//   - ohlc         (OHLC bars — no body, just tick marks)
//   - line         (close price line)
//   - area         (line with gradient fill)
//   - baseline     (line colored above/below a baseline)
//   - renko        (Renko bricks — uniform height, no wicks)
//   - range        (Range bars — candle-style but uniform)
//   - pointfigure  (Point & Figure — X/O supply/demand)
//   - footprint    (Footprint volume delta cells)
// ═══════════════════════════════════════════════════════════════════

import { mediaToBitmap, positionsLine, positionsBox, candleBodyWidth } from '../../core/CoordinateSystem.js';
import { FootprintRenderer } from '../FootprintRenderer.js';

/**
 * @typedef {Object} ChartTypeConfig
 * @property {string}   id       - Unique identifier
 * @property {string}   name     - Display name
 * @property {string}   icon     - Unicode icon
 * @property {boolean}  hasVolume - Whether volume makes sense with this type
 */

/** All available chart types */
export const CHART_TYPES = {
  candlestick: { id: 'candlestick', name: 'Candlestick', icon: '📊', hasVolume: true },
  hollow:      { id: 'hollow', name: 'Hollow Candles', icon: '▯', hasVolume: true },
  heikinashi:  { id: 'heikinashi', name: 'Heikin-Ashi', icon: '🔷', hasVolume: true },
  footprint:   { id: 'footprint', name: 'Footprint (Volume)', icon: '👣', hasVolume: true },
  ohlc:        { id: 'ohlc', name: 'OHLC Bars', icon: '┤', hasVolume: true },
  line:        { id: 'line', name: 'Line', icon: '📈', hasVolume: false },
  area:        { id: 'area', name: 'Area', icon: '▨', hasVolume: false },
  baseline:    { id: 'baseline', name: 'Baseline', icon: '⚖', hasVolume: false },
  renko:       { id: 'renko', name: 'Renko', icon: '🧱', hasVolume: false },
  range:       { id: 'range', name: 'Range Bars', icon: '📶', hasVolume: true },
  pointfigure: { id: 'pointfigure', name: 'Point & Figure', icon: '✕', hasVolume: false },
  kagi:        { id: 'kagi', name: 'Kagi', icon: '⧸', hasVolume: false },
  linebreak:   { id: 'linebreak', name: 'Line Break', icon: '▮', hasVolume: false },
  tick:        { id: 'tick', name: 'Tick Chart', icon: '·', hasVolume: false },
  volumecandle:{ id: 'volumecandle', name: 'Volume Candles', icon: '◧', hasVolume: true },
  hilo:        { id: 'hilo', name: 'Hi-Lo', icon: '↕', hasVolume: true },
};

// ─── Shared Helpers ───────────────────────────────────────────────

/**
 * Get the x-coordinate for a bar index in bitmap (physical pixel) space.
 * Uses timeTransform if available (ChartEngine path), falls back to barSpacing math.
 */
function barX(i, params) {
  const { startIdx, firstVisibleIdx, barSpacing, pixelRatio, timeTransform } = params;
  if (timeTransform) {
    return Math.round(timeTransform.indexToPixel(startIdx + i) * pixelRatio);
  }
  return Math.round((startIdx + i - (firstVisibleIdx ?? startIdx) + 0.5) * barSpacing * pixelRatio);
}

/**
 * Convert a price to bitmap y-coordinate.
 */
function priceY(price, params) {
  return Math.round(params.priceToY(price) * params.pixelRatio);
}

/**
 * Safely apply alpha to any CSS color string (hex or rgba).
 * Returns a properly formatted rgba() string.
 */
function withAlpha(color, alpha) {
  if (!color) return `rgba(0,0,0,${alpha})`;
  // If already rgba, replace the alpha
  const rgbaMatch = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbaMatch) {
    return `rgba(${rgbaMatch[1]},${rgbaMatch[2]},${rgbaMatch[3]},${alpha})`;
  }
  // Hex color → extract RGB and apply alpha
  let hex = color.replace('#', '');
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  if (hex.length >= 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color; // fallback
}

// ═══════════════════════════════════════════════════════════════════
// Draw Functions
// ═══════════════════════════════════════════════════════════════════

/**
 * Draw candlestick bars (solid filled, rounded corners).
 */
export function drawCandlesticks(ctx, bars, params, theme) {
  if (!bars?.length) return;
  const { pixelRatio } = params;
  const barSpacing = params.barSpacing;
  const bodyW = candleBodyWidth(barSpacing);
  const candleR = Math.max(1, Math.round(1.5 * pixelRatio));

  // Pass 1 & 2: Wicks (bull then bear)
  for (let pass = 0; pass < 2; pass++) {
    const isBull = pass === 0;
    ctx.fillStyle = isBull ? (theme.bullCandle || theme.candleUp || '#26A69A')
                           : (theme.bearCandle || theme.candleDown || '#EF5350');
    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      if ((b.close >= b.open) !== isBull) continue;
      const x = barX(i, params);
      const hY = priceY(b.high, params);
      const lY = priceY(b.low, params);
      const ww = Math.max(1, Math.round(pixelRatio));
      ctx.fillRect(x - Math.floor(ww / 2), hY, ww, Math.max(1, lY - hY));
    }
  }

  // Pass 3 & 4: Bodies (bull then bear) with rounded corners
  for (let pass = 0; pass < 2; pass++) {
    const isBull = pass === 0;
    ctx.fillStyle = isBull ? (theme.bullCandle || theme.candleUp || '#26A69A')
                           : (theme.bearCandle || theme.candleDown || '#EF5350');
    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      if ((b.close >= b.open) !== isBull) continue;
      const x = barX(i, params);
      const oY = priceY(b.open, params);
      const cY = priceY(b.close, params);
      const tp = Math.min(oY, cY);
      const h = Math.max(1, Math.max(oY, cY) - tp);
      const bw2 = Math.max(1, Math.floor(bodyW * pixelRatio));
      const rr = Math.min(candleR, bw2 / 2, h / 2);
      ctx.beginPath();
      ctx.roundRect(x - Math.floor(bw2 / 2), tp, bw2, h, rr);
      ctx.fill();
    }
  }
}

/**
 * Draw hollow candlestick bars.
 * Bullish = outlined (hollow), Bearish = filled.
 */
export function drawHollowCandles(ctx, bars, params, theme) {
  if (!bars?.length) return;
  const { pixelRatio } = params;
  const bodyW = candleBodyWidth(params.barSpacing);
  const candleR = Math.max(1, Math.round(1.5 * pixelRatio));

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const bull = b.close >= b.open;
    const color = bull ? (theme.bullCandle || theme.candleUp || '#26A69A')
                       : (theme.bearCandle || theme.candleDown || '#EF5350');
    const x = barX(i, params);
    const hY = priceY(b.high, params);
    const lY = priceY(b.low, params);
    const oY = priceY(b.open, params);
    const cY = priceY(b.close, params);
    const bw2 = Math.max(1, Math.floor(bodyW * pixelRatio));
    const tp = Math.min(oY, cY);
    const h = Math.max(1, Math.abs(oY - cY));
    const rr = Math.min(candleR, bw2 / 2, h / 2);

    // Wick
    const ww = Math.max(1, Math.round(pixelRatio));
    ctx.fillStyle = color;
    ctx.fillRect(x - Math.floor(ww / 2), hY, ww, Math.max(1, lY - hY));

    // Body
    if (bull) {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, Math.round(pixelRatio));
      ctx.beginPath();
      ctx.roundRect(x - Math.floor(bw2 / 2), tp, bw2, h, rr);
      ctx.stroke();
    } else {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x - Math.floor(bw2 / 2), tp, bw2, h, rr);
      ctx.fill();
    }
  }
}

/**
 * Draw OHLC bars (tick marks, no body fill).
 */
export function drawOHLCBars(ctx, bars, params, theme) {
  if (!bars?.length) return;
  const { pixelRatio } = params;
  const bodyW = candleBodyWidth(params.barSpacing);

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const color = b.close >= b.open ? (theme.bullCandle || theme.candleUp || '#26A69A')
                                    : (theme.bearCandle || theme.candleDown || '#EF5350');
    const x = barX(i, params);
    const hY = priceY(b.high, params);
    const lY = priceY(b.low, params);
    const oY = priceY(b.open, params);
    const cY = priceY(b.close, params);
    const tickW = Math.max(2, Math.floor(bodyW * 0.5 * pixelRatio));
    const lw = Math.max(1, Math.round(pixelRatio));
    ctx.fillStyle = color;
    // Vertical line (high to low)
    ctx.fillRect(x - Math.floor(lw / 2), hY, lw, Math.max(1, lY - hY));
    // Open tick (left)
    ctx.fillRect(x - tickW, oY - Math.floor(lw / 2), tickW, lw);
    // Close tick (right)
    ctx.fillRect(x, cY - Math.floor(lw / 2), tickW, lw);
  }
}

/**
 * Draw line chart (close price only).
 */
export function drawLineChart(ctx, bars, params, theme) {
  if (!bars?.length) return;
  const { pixelRatio } = params;

  ctx.strokeStyle = theme.lineColor || theme.bullCandle || theme.candleUp || '#2962FF';
  ctx.lineWidth = Math.max(1.5, 2 * pixelRatio);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < bars.length; i++) {
    const x = barX(i, params);
    const y = priceY(bars[i].close, params);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/**
 * Draw area chart (line with gradient fill below).
 */
export function drawAreaChart(ctx, bars, params, theme) {
  if (!bars?.length) return;
  const { pixelRatio, bitmapHeight } = params;
  const mainBH = bitmapHeight || Math.round((params.mainH || 400) * pixelRatio);
  const areaColor = theme.lineColor || theme.bullCandle || theme.candleUp || '#2962FF';

  // Build path for fill
  ctx.beginPath();
  for (let i = 0; i < bars.length; i++) {
    const x = barX(i, params);
    const y = priceY(bars[i].close, params);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  if (bars.length > 0) {
    const lastX = barX(bars.length - 1, params);
    const firstX = barX(0, params);
    ctx.lineTo(lastX, mainBH);
    ctx.lineTo(firstX, mainBH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, mainBH);
    grad.addColorStop(0, withAlpha(theme.areaTopColor || areaColor, 0.25));
    grad.addColorStop(1, withAlpha(theme.areaBottomColor || areaColor, 0.02));
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // Draw line on top
  ctx.strokeStyle = areaColor;
  ctx.lineWidth = Math.max(1.5, 2 * pixelRatio);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < bars.length; i++) {
    const x = barX(i, params);
    const y = priceY(bars[i].close, params);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/**
 * Draw baseline chart (line colored above/below a reference price).
 */
export function drawBaselineChart(ctx, bars, params, theme) {
  if (!bars?.length) return;
  const { pixelRatio, bitmapHeight } = params;
  const mainBH = bitmapHeight || Math.round((params.mainH || 400) * pixelRatio);
  const cBW = params.chartWidth || mainBH; // chart bitmap width
  const basePrice = bars[0].close;
  const baseY = priceY(basePrice, params);
  const aboveColor = theme.bullCandle || theme.candleUp || '#26A69A';
  const belowColor = theme.bearCandle || theme.candleDown || '#EF5350';

  // Baseline reference dashed line
  ctx.strokeStyle = theme.axisText || '#787B86';
  ctx.lineWidth = Math.max(1, pixelRatio);
  ctx.setLineDash([Math.round(4 * pixelRatio), Math.round(4 * pixelRatio)]);
  ctx.beginPath();
  ctx.moveTo(0, baseY + 0.5);
  ctx.lineTo(cBW, baseY + 0.5);
  ctx.stroke();
  ctx.setLineDash([]);

  // Fill above baseline
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, cBW, baseY);
  ctx.clip();
  ctx.beginPath();
  for (let i = 0; i < bars.length; i++) {
    const x = barX(i, params);
    const y = priceY(bars[i].close, params);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  if (bars.length > 0) {
    const lastX = barX(bars.length - 1, params);
    const firstX = barX(0, params);
    ctx.lineTo(lastX, baseY);
    ctx.lineTo(firstX, baseY);
    ctx.closePath();
    ctx.fillStyle = withAlpha(aboveColor, 0.19);
    ctx.fill();
  }
  ctx.restore();

  // Fill below baseline
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, baseY, cBW, mainBH - baseY);
  ctx.clip();
  ctx.beginPath();
  for (let i = 0; i < bars.length; i++) {
    const x = barX(i, params);
    const y = priceY(bars[i].close, params);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  if (bars.length > 0) {
    const lastX = barX(bars.length - 1, params);
    const firstX = barX(0, params);
    ctx.lineTo(lastX, baseY);
    ctx.lineTo(firstX, baseY);
    ctx.closePath();
    ctx.fillStyle = withAlpha(belowColor, 0.19);
    ctx.fill();
  }
  ctx.restore();

  // Colored line segments
  for (let i = 1; i < bars.length; i++) {
    const x0 = barX(i - 1, params);
    const y0 = priceY(bars[i - 1].close, params);
    const x1 = barX(i, params);
    const y1 = priceY(bars[i].close, params);
    const midY = (y0 + y1) / 2;
    ctx.strokeStyle = midY <= baseY ? aboveColor : belowColor;
    ctx.lineWidth = Math.max(1.5, 2 * pixelRatio);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
}

/**
 * Convert OHLCV bars to Heikin-Ashi and draw as candlesticks.
 */
export function drawHeikinAshi(ctx, bars, params, theme) {
  if (!bars?.length) return;

  const ha = [];
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const haClose = (b.open + b.high + b.low + b.close) / 4;
    const haOpen = i === 0 ? (b.open + b.close) / 2 : (ha[i - 1].open + ha[i - 1].close) / 2;
    ha.push({
      open: haOpen,
      high: Math.max(b.high, haOpen, haClose),
      low: Math.min(b.low, haOpen, haClose),
      close: haClose,
      volume: b.volume,
      time: b.time,
    });
  }

  drawCandlesticks(ctx, ha, params, theme);
}

/**
 * Draw Renko bricks (no wicks, uniform height blocks).
 */
export function drawRenko(ctx, bars, params, theme) {
  if (!bars?.length) return;
  const { pixelRatio } = params;
  const cW = params.chartWidth || 800;
  const rBSp = cW / Math.max(1, bars.length);
  const rbw = Math.max(1, Math.floor(rBSp * 0.8 * pixelRatio));

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const x = Math.round((i + 0.5) * rBSp * pixelRatio);
    const oY = priceY(b.open, params);
    const cY = priceY(b.close, params);
    const tp = Math.min(oY, cY);
    const h = Math.max(1, Math.abs(oY - cY));
    ctx.fillStyle = b._isUp ? (theme.bullCandle || '#26A69A') : (theme.bearCandle || '#EF5350');
    ctx.fillRect(x - Math.floor(rbw / 2), tp, rbw, h);
  }
}

/**
 * Draw Range bars (candle-style but uniform height).
 */
export function drawRange(ctx, bars, params, theme) {
  if (!bars?.length) return;
  const { pixelRatio } = params;
  const cW = params.chartWidth || 800;
  const rBSp = cW / Math.max(1, bars.length);

  // Wicks
  for (let ps = 0; ps < 2; ps++) {
    ctx.fillStyle = ps === 0 ? (theme.bullCandle || '#26A69A') : (theme.bearCandle || '#EF5350');
    for (let i = 0; i < bars.length; i++) {
      if ((bars[i].close >= bars[i].open) !== (ps === 0)) continue;
      const x = Math.round((i + 0.5) * rBSp * pixelRatio);
      const hY = priceY(bars[i].high, params);
      const lY = priceY(bars[i].low, params);
      const ww = Math.max(1, Math.round(pixelRatio));
      ctx.fillRect(x - Math.floor(ww / 2), hY, ww, Math.max(1, lY - hY));
    }
  }
  // Bodies
  for (let ps = 0; ps < 2; ps++) {
    ctx.fillStyle = ps === 0 ? (theme.bullCandle || '#26A69A') : (theme.bearCandle || '#EF5350');
    const rbw = Math.max(1, Math.floor(rBSp * 0.7 * pixelRatio));
    for (let i = 0; i < bars.length; i++) {
      if ((bars[i].close >= bars[i].open) !== (ps === 0)) continue;
      const x = Math.round((i + 0.5) * rBSp * pixelRatio);
      const oY = priceY(bars[i].open, params);
      const cY = priceY(bars[i].close, params);
      const tp = Math.min(oY, cY);
      const h = Math.max(1, Math.max(oY, cY) - tp);
      ctx.fillRect(x - Math.floor(rbw / 2), tp, rbw, h);
    }
  }
}

/**
 * Draw Footprint chart (volume delta cells).
 * Delegates to FootprintRenderer for each bar.
 */
export function drawFootprint(ctx, bars, params, theme, aggregator) {
  if (!bars?.length) return;
  const { pixelRatio } = params;
  const bodyW = candleBodyWidth(params.barSpacing);

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const x = barX(i, params);
    const yOpen = priceY(bar.open, params);
    const yClose = priceY(bar.close, params);
    const yHigh = priceY(bar.high, params);
    const yLow = priceY(bar.low, params);
    FootprintRenderer.draw(
      ctx, bar, x, yOpen, yClose, yHigh, yLow,
      (p) => priceY(p, params),
      Math.max(1, Math.floor(bodyW * pixelRatio))
    );
  }
}

/**
 * Draw Point & Figure chart (X = up, O = down).
 * Computes P&F columns on-the-fly from OHLCV bars.
 * Box size auto-calculated from ATR(14); 3-box reversal.
 */
export function drawPointAndFigure(ctx, bars, params, theme) {
  if (!bars?.length || bars.length < 2) return;
  const { pixelRatio } = params;
  const cW = params.chartWidth || 800;

  // --- Auto-calculate box size from ATR(14) ---
  const atrPeriod = Math.min(14, bars.length);
  let atrSum = 0;
  for (let i = Math.max(1, bars.length - atrPeriod); i < bars.length; i++) {
    const prev = bars[i - 1];
    const c = bars[i];
    atrSum += Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));
  }
  const boxSize = (atrSum / atrPeriod) || 1;
  const reversal = 3;

  // --- Build P&F columns ---
  // column = { direction: 1 (X/up) | -1 (O/down), boxes: [price, ...] }
  const columns = [];
  let currentDir = 0;  // 0 = undecided
  let colTop = 0;
  let colBot = 0;

  // Seed with first bar
  const startPrice = Math.round(bars[0].close / boxSize) * boxSize;
  colTop = startPrice;
  colBot = startPrice;

  for (let i = 1; i < bars.length; i++) {
    const high = bars[i].high;
    const low  = bars[i].low;

    if (currentDir === 0) {
      // Determine initial direction
      const upBoxes  = Math.floor((high - colTop) / boxSize);
      const dnBoxes  = Math.floor((colBot - low) / boxSize);
      if (upBoxes >= reversal) {
        currentDir = 1;
        colTop = colTop + upBoxes * boxSize;
        columns.push({ direction: 1, top: colTop, bottom: colBot });
      } else if (dnBoxes >= reversal) {
        currentDir = -1;
        colBot = colBot - dnBoxes * boxSize;
        columns.push({ direction: -1, top: colTop, bottom: colBot });
      }
      continue;
    }

    if (currentDir === 1) {
      // Currently in X (up) column
      const upBoxes = Math.floor((high - colTop) / boxSize);
      if (upBoxes > 0) {
        colTop += upBoxes * boxSize;
        columns[columns.length - 1].top = colTop;
      } else {
        const dnBoxes = Math.floor((colTop - low) / boxSize);
        if (dnBoxes >= reversal) {
          // Reversal to O column
          currentDir = -1;
          colTop = colTop - boxSize;  // step back one box
          colBot = colTop - (dnBoxes - 1) * boxSize;
          columns.push({ direction: -1, top: colTop, bottom: colBot });
        }
      }
    } else {
      // Currently in O (down) column
      const dnBoxes = Math.floor((colBot - low) / boxSize);
      if (dnBoxes > 0) {
        colBot -= dnBoxes * boxSize;
        columns[columns.length - 1].bottom = colBot;
      } else {
        const upBoxes = Math.floor((high - colBot) / boxSize);
        if (upBoxes >= reversal) {
          // Reversal to X column
          currentDir = 1;
          colBot = colBot + boxSize;  // step back one box
          colTop = colBot + (upBoxes - 1) * boxSize;
          columns.push({ direction: 1, top: colTop, bottom: colBot });
        }
      }
    }
  }

  if (columns.length === 0) return;

  // --- Render ---
  const colSpacing = cW / Math.max(1, columns.length);
  const xColor = theme.bullCandle || theme.candleUp || '#26A69A';
  const oColor = theme.bearCandle || theme.candleDown || '#EF5350';

  for (let c = 0; c < columns.length; c++) {
    const col = columns[c];
    const cx = Math.round((c + 0.5) * colSpacing * pixelRatio);
    const numBoxes = Math.round((col.top - col.bottom) / boxSize) + 1;
    const halfBox = Math.max(2, Math.floor(colSpacing * 0.35 * pixelRatio));

    if (col.direction === 1) {
      // Draw X's
      ctx.strokeStyle = xColor;
      ctx.lineWidth = Math.max(1.5, 2 * pixelRatio);
      ctx.lineCap = 'round';
      for (let b = 0; b < numBoxes; b++) {
        const price = col.bottom + b * boxSize;
        const y = priceY(price, params);
        ctx.beginPath();
        ctx.moveTo(cx - halfBox, y - halfBox);
        ctx.lineTo(cx + halfBox, y + halfBox);
        ctx.moveTo(cx + halfBox, y - halfBox);
        ctx.lineTo(cx - halfBox, y + halfBox);
        ctx.stroke();
      }
    } else {
      // Draw O's
      ctx.strokeStyle = oColor;
      ctx.lineWidth = Math.max(1.5, 2 * pixelRatio);
      for (let b = 0; b < numBoxes; b++) {
        const price = col.bottom + b * boxSize;
        const y = priceY(price, params);
        ctx.beginPath();
        ctx.arc(cx, y, halfBox, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
}

/**
 * Draw Kagi chart — reversal lines with thick/thin width transitions.
 */
export function drawKagi(ctx, bars, params, theme) {
  if (!bars?.length) return;
  const { pixelRatio } = params;
  const cW = params.chartWidth || 800;
  const segSpacing = cW / Math.max(1, bars.length);
  const thickW = Math.max(2, Math.round(3 * pixelRatio));
  const thinW = Math.max(1, Math.round(1.5 * pixelRatio));
  const upColor = theme.bullCandle || theme.candleUp || '#26A69A';
  const dnColor = theme.bearCandle || theme.candleDown || '#EF5350';

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const x = Math.round((i + 0.5) * segSpacing * pixelRatio);
    const oY = priceY(b.open, params);
    const cY = priceY(b.close, params);

    ctx.strokeStyle = b._dir === 1 ? upColor : dnColor;
    ctx.lineWidth = b._thick ? thickW : thinW;

    ctx.beginPath();
    ctx.moveTo(x, oY);
    ctx.lineTo(x, cY);
    if (i < bars.length - 1) {
      const nextX = Math.round((i + 1.5) * segSpacing * pixelRatio);
      ctx.lineTo(nextX, cY);
    }
    ctx.stroke();
  }
}

/**
 * Draw Line Break chart (3-line break boxes).
 */
export function drawLineBreak(ctx, bars, params, theme) {
  if (!bars?.length) return;
  const { pixelRatio } = params;
  const cW = params.chartWidth || 800;
  const barSpacing = cW / Math.max(1, bars.length);
  const bw = Math.max(1, Math.floor(barSpacing * 0.7 * pixelRatio));
  const candleR = Math.max(1, Math.round(1.5 * pixelRatio));

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const x = Math.round((i + 0.5) * barSpacing * pixelRatio);
    const oY = priceY(b.open, params);
    const cY = priceY(b.close, params);
    const tp = Math.min(oY, cY);
    const h = Math.max(1, Math.abs(oY - cY));

    ctx.fillStyle = b._isUp
      ? (theme.bullCandle || theme.candleUp || '#26A69A')
      : (theme.bearCandle || theme.candleDown || '#EF5350');
    const rr = Math.min(candleR, bw / 2, h / 2);
    ctx.beginPath();
    ctx.roundRect(x - Math.floor(bw / 2), tp, bw, h, rr);
    ctx.fill();
  }
}

/**
 * Draw Tick chart — plots every bar's close as a dot with connecting line.
 */
export function drawTickChart(ctx, bars, params, theme) {
  if (!bars?.length) return;
  const { pixelRatio } = params;
  const lineColor = theme.lineColor || theme.bullCandle || theme.candleUp || '#2962FF';
  const dotR = Math.max(1.5, 2 * pixelRatio);

  ctx.strokeStyle = lineColor;
  ctx.lineWidth = Math.max(1, 1.5 * pixelRatio);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < bars.length; i++) {
    const x = barX(i, params);
    const y = priceY(bars[i].close, params);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.fillStyle = lineColor;
  for (let i = 0; i < bars.length; i++) {
    const x = barX(i, params);
    const y = priceY(bars[i].close, params);
    ctx.beginPath();
    ctx.arc(x, y, dotR, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draw Volume Candles — candlestick width proportional to volume.
 */
export function drawVolumeCandles(ctx, bars, params, theme) {
  if (!bars?.length) return;
  const { pixelRatio, barSpacing } = params;
  const maxBodyW = candleBodyWidth(barSpacing);
  const candleR = Math.max(1, Math.round(1.5 * pixelRatio));

  for (let pass = 0; pass < 2; pass++) {
    const isBull = pass === 0;
    ctx.fillStyle = isBull ? (theme.bullCandle || theme.candleUp || '#26A69A')
                           : (theme.bearCandle || theme.candleDown || '#EF5350');
    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      if ((b.close >= b.open) !== isBull) continue;
      const x = barX(i, params);
      const hY = priceY(b.high, params);
      const lY = priceY(b.low, params);
      const ww = Math.max(1, Math.round(pixelRatio));
      ctx.fillRect(x - Math.floor(ww / 2), hY, ww, Math.max(1, lY - hY));
      const widthRatio = b._widthRatio || 1;
      const bw2 = Math.max(1, Math.floor(maxBodyW * widthRatio * pixelRatio));
      const oY = priceY(b.open, params);
      const cY = priceY(b.close, params);
      const tp = Math.min(oY, cY);
      const h = Math.max(1, Math.max(oY, cY) - tp);
      const rr = Math.min(candleR, bw2 / 2, h / 2);
      ctx.beginPath();
      ctx.roundRect(x - Math.floor(bw2 / 2), tp, bw2, h, rr);
      ctx.fill();
    }
  }
}

/**
 * Draw Hi-Lo bars — simple high-to-low vertical range bars.
 */
export function drawHiLo(ctx, bars, params, theme) {
  if (!bars?.length) return;
  const { pixelRatio, barSpacing } = params;
  const bodyW = candleBodyWidth(barSpacing);

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const color = b.close >= b.open ? (theme.bullCandle || theme.candleUp || '#26A69A')
                                    : (theme.bearCandle || theme.candleDown || '#EF5350');
    const x = barX(i, params);
    const hY = priceY(b.high, params);
    const lY = priceY(b.low, params);
    const bw = Math.max(2, Math.floor(bodyW * 0.6 * pixelRatio));
    ctx.fillStyle = color;
    ctx.fillRect(x - Math.floor(bw / 2), hY, bw, Math.max(1, lY - hY));
  }
}

// ═══════════════════════════════════════════════════════════════════
// Registry
// ═══════════════════════════════════════════════════════════════════

/**
 * Get the draw function for a chart type.
 * @param {string} typeId
 * @returns {Function}
 */
export function getChartDrawFunction(typeId) {
  switch (typeId) {
    case 'candlestick': case 'candle': return drawCandlesticks;
    case 'hollow':      return drawHollowCandles;
    case 'heikinashi':  return drawHeikinAshi;
    case 'ohlc':        return drawOHLCBars;
    case 'line':        return drawLineChart;
    case 'area':        return drawAreaChart;
    case 'baseline':    return drawBaselineChart;
    case 'renko':       return drawRenko;
    case 'range':       return drawRange;
    case 'pointfigure': case 'pnf': return drawPointAndFigure;
    case 'footprint':   return drawFootprint;
    case 'kagi':        return drawKagi;
    case 'linebreak':   return drawLineBreak;
    case 'tick':        return drawTickChart;
    case 'volumecandle': return drawVolumeCandles;
    case 'hilo':        return drawHiLo;
    default:            return drawCandlesticks;
  }
}

/**
 * Get list of chart types for UI.
 * @returns {Array<{id: string, name: string, icon: string}>}
 */
export function getChartTypeList() {
  return Object.values(CHART_TYPES);
}
