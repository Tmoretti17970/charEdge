// ═══════════════════════════════════════════════════════════════════
// charEdge — Trade Marker Renderer
//
// Renders trade entry/exit markers on the chart canvas.
// Pure function: no state, no side effects.
//
// Usage:
//   import { renderTradeMarkers } from './TradeMarkerRenderer.js';
//   renderTradeMarkers(ctx, trades, symbol, bars, startIdx, endIdx, timeTransform, p2y, pr);
// ═══════════════════════════════════════════════════════════════════

/**
 * Render trade entry/exit markers on the chart.
 *
 * @param {CanvasRenderingContext2D} ctx — Canvas context to draw on
 * @param {Array} trades — Array of trade objects
 * @param {string} symbol — Current chart symbol
 * @param {Array} bars — Visible bar data
 * @param {number} startIdx — First visible bar index
 * @param {number} endIdx — Last visible bar index
 * @param {Object} timeTransform — { indexToPixel(i) → x }
 * @param {Function} p2y — price-to-Y pixel converter
 * @param {number} pr — Device pixel ratio
 */
export function renderTradeMarkers(ctx, trades, symbol, bars, startIdx, endIdx, timeTransform, p2y, pr) {
  if (!trades?.length || !symbol) return;
  const symUpper = symbol.toUpperCase();
  const matchingTrades = trades.filter((t) => {
    const ts = (t.symbol || '').toUpperCase();
    return ts === symUpper || ts === symUpper + 'USDT' || ts.includes(symUpper);
  });

  if (!matchingTrades.length) return;
  for (const trade of matchingTrades) {
    const entryTime = trade.entryTime || trade.openTime;
    const exitTime = trade.exitTime || trade.closeTime;
    const entryPrice = trade.entryPrice || trade.openPrice;
    const exitPrice = trade.exitPrice || trade.closePrice;
    const isWin = (exitPrice - entryPrice) * (trade.side === 'short' ? -1 : 1) > 0;

    let entryIdx = -1, exitIdx = -1;
    if (entryTime) {
      for (let i = 0; i < bars.length; i++) {
        if (Math.abs(bars[i].time - entryTime) < 60000 * 5) { entryIdx = i; break; }
      }
    }
    if (exitTime) {
      for (let i = 0; i < bars.length; i++) {
        if (Math.abs(bars[i].time - exitTime) < 60000 * 5) { exitIdx = i; break; }
      }
    }

    if (entryIdx >= startIdx && entryIdx <= endIdx && entryPrice) {
      const x = Math.round(timeTransform.indexToPixel(entryIdx) * pr);
      const y = Math.round(p2y(entryPrice) * pr);
      const isLong = trade.side !== 'short';

      ctx.fillStyle = isLong ? '#26A69A' : '#EF5350';
      ctx.beginPath();
      const s = Math.round(6 * pr);
      if (isLong) {
        ctx.moveTo(x, y - s); ctx.lineTo(x - s, y + s); ctx.lineTo(x + s, y + s);
      } else {
        ctx.moveTo(x, y + s); ctx.lineTo(x - s, y - s); ctx.lineTo(x + s, y - s);
      }
      ctx.closePath(); ctx.fill();
    }

    if (exitIdx >= startIdx && exitIdx <= endIdx && exitPrice) {
      const x = Math.round(timeTransform.indexToPixel(exitIdx) * pr);
      const y = Math.round(p2y(exitPrice) * pr);
      ctx.strokeStyle = isWin ? '#26A69A' : '#EF5350';
      ctx.lineWidth = Math.round(2 * pr);
      const s = Math.round(5 * pr);
      ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s); ctx.stroke();
    }

    if (entryIdx >= 0 && exitIdx >= 0 && entryPrice && exitPrice) {
      const x1 = Math.round(timeTransform.indexToPixel(entryIdx) * pr);
      const y1 = Math.round(p2y(entryPrice) * pr);
      const x2 = Math.round(timeTransform.indexToPixel(exitIdx) * pr);
      const y2 = Math.round(p2y(exitPrice) * pr);
      ctx.strokeStyle = isWin ? 'rgba(38,166,154,0.3)' : 'rgba(239,83,80,0.3)';
      ctx.lineWidth = Math.max(1, pr);
      ctx.setLineDash([Math.round(3 * pr), Math.round(3 * pr)]);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}
