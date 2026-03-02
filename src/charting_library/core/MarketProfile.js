// ═══════════════════════════════════════════════════════════════════
// charEdge — Market Profile / TPO Charts Engine
//
// Computes Time Price Opportunity (TPO) distribution from OHLCV
// data. Each bar is discretized into price bins that the price
// "visited" during that period, producing a letter-based TPO map.
//
// Key concepts:
// - TPO: each 30-min (or bar) period gets a letter (A, B, C...)
// - POC: price level with the most TPOs
// - Value Area: 70% of TPOs centered on POC
// - IB (Initial Balance): first two periods of the session
// ═══════════════════════════════════════════════════════════════════

const TPO_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * Compute a Market Profile from OHLCV bars.
 *
 * @param {Object[]} bars - OHLCV bar data
 * @param {number} [tickSize] - Price level granularity (auto-detected if omitted)
 * @param {number} [vaPercent=70] - Value Area percentage
 * @returns {MarketProfile}
 */
export function computeMarketProfile(bars, tickSize, vaPercent = 70) {
  if (!bars?.length) return null;

  // Auto-detect tick size from price range
  let priceHigh = -Infinity;
  let priceLow = Infinity;
  for (const b of bars) {
    if (b.high > priceHigh) priceHigh = b.high;
    if (b.low < priceLow) priceLow = b.low;
  }

  const range = priceHigh - priceLow;
  if (range <= 0) return null;

  // Auto tick size: aim for ~40-60 price levels
  if (!tickSize) {
    const targetLevels = 50;
    tickSize = range / targetLevels;
    // Round to a nice number
    const magnitude = Math.pow(10, Math.floor(Math.log10(tickSize)));
    tickSize = Math.round(tickSize / magnitude) * magnitude;
    if (tickSize <= 0) tickSize = range / targetLevels;
  }

  // Build price levels
  const levelLow = Math.floor(priceLow / tickSize) * tickSize;
  const levelHigh = Math.ceil(priceHigh / tickSize) * tickSize;
  const numLevels = Math.round((levelHigh - levelLow) / tickSize) + 1;

  // Initialize TPO map
  const levels = {};
  for (let i = 0; i < numLevels; i++) {
    const price = levelLow + i * tickSize;
    const key = price.toFixed(8);
    levels[key] = {
      price,
      tpos: [],
      tpoCount: 0,
      volume: 0,
    };
  }

  // Assign TPO letters to each bar's price range
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const letter = i < TPO_LETTERS.length ? TPO_LETTERS[i] : String(i);

    const barLow = Math.floor(bar.low / tickSize) * tickSize;
    const barHigh = Math.ceil(bar.high / tickSize) * tickSize;

    let price = barLow;
    while (price <= barHigh) {
      const key = price.toFixed(8);
      if (levels[key]) {
        levels[key].tpos.push(letter);
        levels[key].tpoCount++;
        // Distribute volume proportionally
        const barRange = bar.high - bar.low || tickSize;
        levels[key].volume += (bar.volume || 0) * (tickSize / barRange);
      }
      price += tickSize;
    }
  }

  // Convert to sorted array
  const levelArray = Object.values(levels)
    .filter(l => l.tpoCount > 0)
    .sort((a, b) => b.price - a.price); // High to low

  if (!levelArray.length) return null;

  // Find POC (most TPOs)
  let maxTPO = 0;
  let pocIdx = 0;
  for (let i = 0; i < levelArray.length; i++) {
    if (levelArray[i].tpoCount > maxTPO) {
      maxTPO = levelArray[i].tpoCount;
      pocIdx = i;
    }
  }
  const poc = levelArray[pocIdx].price;

  // Value Area (70% of total TPOs)
  const totalTPOs = levelArray.reduce((s, l) => s + l.tpoCount, 0);
  const vaTarget = totalTPOs * (vaPercent / 100);
  let vaTPOs = levelArray[pocIdx].tpoCount;
  let vaHighIdx = pocIdx;
  let vaLowIdx = pocIdx;

  while (vaTPOs < vaTarget && (vaHighIdx > 0 || vaLowIdx < levelArray.length - 1)) {
    const addHigh = vaHighIdx > 0 ? levelArray[vaHighIdx - 1].tpoCount : -1;
    const addLow = vaLowIdx < levelArray.length - 1 ? levelArray[vaLowIdx + 1].tpoCount : -1;

    if (addHigh >= addLow && addHigh >= 0) {
      vaHighIdx--;
      vaTPOs += levelArray[vaHighIdx].tpoCount;
    } else if (addLow >= 0) {
      vaLowIdx++;
      vaTPOs += levelArray[vaLowIdx].tpoCount;
    } else break;
  }

  const vah = levelArray[vaHighIdx].price;
  const val = levelArray[vaLowIdx].price;

  // Initial Balance (first 2 periods)
  const ibBars = bars.slice(0, Math.min(2, bars.length));
  const ibHigh = Math.max(...ibBars.map(b => b.high));
  const ibLow = Math.min(...ibBars.map(b => b.low));

  // Profile shape detection
  const midIdx = Math.floor(levelArray.length / 2);
  const topHalf = levelArray.slice(0, midIdx).reduce((s, l) => s + l.tpoCount, 0);
  const bottomHalf = levelArray.slice(midIdx).reduce((s, l) => s + l.tpoCount, 0);
  let shape = 'Normal';
  if (topHalf > bottomHalf * 1.3) shape = 'P-Shape (buying)';
  else if (bottomHalf > topHalf * 1.3) shape = 'b-Shape (selling)';
  else if (maxTPO < totalTPOs / levelArray.length * 1.5) shape = 'D-Shape (balanced)';

  // Single prints (only 1 TPO — indicate fast price movement)
  const singlePrints = levelArray
    .filter(l => l.tpoCount === 1)
    .map(l => l.price);

  return {
    levels: levelArray,
    poc,
    vah,
    val,
    ibHigh,
    ibLow,
    tickSize,
    totalTPOs,
    maxTPO,
    shape,
    singlePrints,
    priceHigh,
    priceLow,
  };
}

/**
 * Render market profile on canvas.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {MarketProfile} profile
 * @param {number} chartWidth
 * @param {number} chartHeight
 * @param {Function} priceToY
 * @param {Object} [options]
 */
export function renderMarketProfile(ctx, profile, chartWidth, chartHeight, priceToY, options = {}) {
  if (!profile?.levels?.length) return;

  const {
    charWidth = 8,
    charFont = '9px monospace',
    pocColor = '#FFC107',
    vaColor = 'rgba(100, 181, 246, 0.08)',
    textColor = 'rgba(200, 200, 210, 0.7)',
    singlePrintColor = 'rgba(239, 83, 80, 0.5)',
    side = 'right',
  } = options;

  ctx.font = charFont;

  // Draw Value Area background
  const vahY = priceToY(profile.vah);
  const valY = priceToY(profile.val);
  ctx.fillStyle = vaColor;
  ctx.fillRect(0, Math.min(vahY, valY), chartWidth, Math.abs(valY - vahY));

  // Draw each level's TPO letters
  for (const level of profile.levels) {
    const y = priceToY(level.price);
    const isPOC = Math.abs(level.price - profile.poc) < profile.tickSize * 0.5;
    const isVA = level.price >= profile.val && level.price <= profile.vah;

    for (let i = 0; i < level.tpos.length; i++) {
      const x = side === 'right'
        ? chartWidth - (i + 1) * charWidth
        : i * charWidth;

      ctx.fillStyle = isPOC ? pocColor
        : level.tpoCount === 1 ? singlePrintColor
        : isVA ? 'rgba(100, 181, 246, 0.6)'
        : textColor;

      ctx.fillText(level.tpos[i], x, y + 3);
    }
  }

  // POC line
  const pocY = priceToY(profile.poc);
  ctx.strokeStyle = pocColor;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(0, pocY);
  ctx.lineTo(chartWidth, pocY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Labels
  ctx.font = 'bold 9px Arial';
  ctx.fillStyle = pocColor;
  ctx.textAlign = 'left';
  ctx.fillText(`POC ${profile.poc.toFixed(2)}`, 4, pocY - 3);

  ctx.fillStyle = 'rgba(100, 181, 246, 0.7)';
  ctx.fillText(`VAH ${profile.vah.toFixed(2)}`, 4, Math.min(vahY, valY) - 3);
  ctx.fillText(`VAL ${profile.val.toFixed(2)}`, 4, Math.max(vahY, valY) + 12);
}
