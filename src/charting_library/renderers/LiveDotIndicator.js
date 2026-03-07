// ═══════════════════════════════════════════════════════════════════
// charEdge — Live Dot Indicator (P1-A #5)
// Renders a pulsing 4px dot at the current price on the live candle.
// Integrated into the render pipeline as a post-candle overlay.
// ═══════════════════════════════════════════════════════════════════

/**
 * Draw a pulsing 4px dot at the close price of the last (live) candle.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} opts
 * @param {number} opts.x - X position of the last bar center (CSS px)
 * @param {number} opts.y - Y position of the close price (CSS px)
 * @param {boolean} opts.isUp - Whether candle is bullish (close >= open)
 * @param {boolean} opts.isLive - Whether live data is streaming
 * @param {number} opts.pr - Pixel ratio
 * @param {Object} [opts.colors] - Override colors { up, down }
 */
export function drawLiveDot(ctx, { x, y, isUp, isLive, pr = 1, colors }) {
  if (!isLive) return;

  const dotRadius = 2 * pr; // 4px diameter at 1x
  const glowRadius = 5 * pr;
  const upColor = colors?.up || '#22c55e';   // green-500
  const downColor = colors?.down || '#ef4444'; // red-500
  const color = isUp ? upColor : downColor;

  // Gentle pulse animation: 0.5s period using sin()
  const pulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.008);

  ctx.save();

  // Glow halo
  ctx.globalAlpha = pulse * 0.25;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x * pr, y * pr, glowRadius, 0, Math.PI * 2);
  ctx.fill();

  // Solid dot
  ctx.globalAlpha = pulse * 0.8 + 0.2; // Min 0.2 opacity so it's always visible
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x * pr, y * pr, dotRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Determine if the live dot should trigger continuous redraws.
 * Returns true when live data is streaming (dot is pulsing).
 */
export function isLiveDotActive(isLive) {
  return !!isLive;
}

export default drawLiveDot;
