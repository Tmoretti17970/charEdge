// ═══════════════════════════════════════════════════════════════════
// charEdge — Volume Profile Engine
//
// Computes a volume-at-price distribution for the visible bar range.
// Returns price bins with their total volume and up/down breakdown,
// plus Value Area (VA), Point of Control (POC), VAH, and VAL.
//
// Designed to be rendered as horizontal bars overlaid on the chart.
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute a volume profile from OHLCV bars.
 *
 * @param {Object[]} bars - { open, high, low, close, volume }
 * @param {number} [numBins=50] - Number of price bins
 * @param {number} [vaPercent=70] - Value Area percentage
 * @returns {VolumeProfile}
 */
export function computeVolumeProfile(bars, numBins = 50, vaPercent = 70) {
  if (!bars?.length) return null;

  // 1. Find overall price range
  let priceHigh = -Infinity;
  let priceLow = Infinity;
  for (const b of bars) {
    if (b.high > priceHigh) priceHigh = b.high;
    if (b.low < priceLow) priceLow = b.low;
  }

  const priceRange = priceHigh - priceLow;
  if (priceRange <= 0) return null;

  const binSize = priceRange / numBins;

  // 2. Initialize bins
  const bins = [];
  for (let i = 0; i < numBins; i++) {
    bins.push({
      priceMin: priceLow + i * binSize,
      priceMax: priceLow + (i + 1) * binSize,
      priceMid: priceLow + (i + 0.5) * binSize,
      totalVolume: 0,
      upVolume: 0,
      downVolume: 0,
    });
  }

  // 3. Distribute volume across bins
  // Each bar's volume is distributed proportionally across the price bins it spans
  for (const bar of bars) {
    const barVol = bar.volume || 1;
    const isUp = bar.close >= bar.open;
    const barLow = bar.low;
    const barHigh = bar.high;
    const barRange = barHigh - barLow;

    if (barRange <= 0) {
      // Single-price bar — put all volume in one bin
      const binIdx = Math.min(Math.floor((bar.close - priceLow) / binSize), numBins - 1);
      if (binIdx >= 0 && binIdx < numBins) {
        bins[binIdx].totalVolume += barVol;
        bins[binIdx][isUp ? 'upVolume' : 'downVolume'] += barVol;
      }
      continue;
    }

    // Find which bins this bar spans
    const startBin = Math.max(0, Math.floor((barLow - priceLow) / binSize));
    const endBin = Math.min(numBins - 1, Math.floor((barHigh - priceLow) / binSize));

    for (let i = startBin; i <= endBin; i++) {
      // Calculate overlap between bar and bin
      const overlapLow = Math.max(barLow, bins[i].priceMin);
      const overlapHigh = Math.min(barHigh, bins[i].priceMax);
      const overlap = Math.max(0, overlapHigh - overlapLow);
      const proportion = overlap / barRange;
      const vol = barVol * proportion;

      bins[i].totalVolume += vol;
      bins[i][isUp ? 'upVolume' : 'downVolume'] += vol;
    }
  }

  // 4. Find POC (Point of Control — highest volume bin)
  let maxVolume = 0;
  let pocIndex = 0;
  for (let i = 0; i < numBins; i++) {
    if (bins[i].totalVolume > maxVolume) {
      maxVolume = bins[i].totalVolume;
      pocIndex = i;
    }
  }

  const poc = bins[pocIndex].priceMid;

  // 5. Compute Value Area (70% of total volume centered on POC)
  const totalVolume = bins.reduce((s, b) => s + b.totalVolume, 0);
  const vaTarget = totalVolume * (vaPercent / 100);

  let vaVolume = bins[pocIndex].totalVolume;
  let vaLowIdx = pocIndex;
  let vaHighIdx = pocIndex;

  while (vaVolume < vaTarget && (vaLowIdx > 0 || vaHighIdx < numBins - 1)) {
    const nextLow = vaLowIdx > 0 ? bins[vaLowIdx - 1].totalVolume : -1;
    const nextHigh = vaHighIdx < numBins - 1 ? bins[vaHighIdx + 1].totalVolume : -1;

    if (nextLow >= nextHigh && nextLow >= 0) {
      vaLowIdx--;
      vaVolume += bins[vaLowIdx].totalVolume;
    } else if (nextHigh >= 0) {
      vaHighIdx++;
      vaVolume += bins[vaHighIdx].totalVolume;
    } else {
      break;
    }
  }

  const vah = bins[vaHighIdx].priceMax;
  const val = bins[vaLowIdx].priceMin;

  // 6. Normalize volumes for rendering (0-1 scale)
  for (const bin of bins) {
    bin.normalizedVolume = maxVolume > 0 ? bin.totalVolume / maxVolume : 0;
  }

  return {
    bins,
    poc,
    pocIndex,
    vah,
    val,
    maxVolume,
    totalVolume,
    priceHigh,
    priceLow,
    binSize,
    numBins,
  };
}

/**
 * Render the volume profile on a canvas context.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {VolumeProfile} profile
 * @param {number} chartWidth - chart canvas width
 * @param {number} chartHeight - chart canvas height
 * @param {Function} priceToY - convert price to Y coordinate
 * @param {Object} [options]
 */
export function renderVolumeProfile(ctx, profile, chartWidth, chartHeight, priceToY, options = {}) {
  if (!profile?.bins?.length) return;

  const {
    maxWidth = 0.25,  // Max 25% of chart width
    upColor = 'rgba(38, 166, 154, 0.4)',
    downColor = 'rgba(239, 83, 80, 0.4)',
    pocColor = 'rgba(255, 193, 7, 0.8)',
    _vahColor = 'rgba(38, 166, 154, 0.15)',
    _valColor = 'rgba(239, 83, 80, 0.15)',
    side = 'left',  // 'left' or 'right'
  } = options;

  const barMaxW = chartWidth * maxWidth;

  // Draw Value Area background
  const vahY = priceToY(profile.vah);
  const valY = priceToY(profile.val);
  ctx.fillStyle = 'rgba(100, 100, 120, 0.05)';
  ctx.fillRect(0, Math.min(vahY, valY), chartWidth, Math.abs(valY - vahY));

  // Draw bins
  for (const bin of profile.bins) {
    if (bin.totalVolume <= 0) continue;

    const y1 = priceToY(bin.priceMax);
    const y2 = priceToY(bin.priceMin);
    const barH = Math.max(1, Math.abs(y2 - y1) - 0.5);
    const yTop = Math.min(y1, y2);

    const totalW = bin.normalizedVolume * barMaxW;
    const upW = bin.totalVolume > 0 ? (bin.upVolume / bin.totalVolume) * totalW : 0;
    const downW = totalW - upW;

    const x = side === 'right' ? chartWidth - totalW : 0;

    // Up volume
    if (upW > 0) {
      ctx.fillStyle = upColor;
      ctx.fillRect(x, yTop, upW, barH);
    }

    // Down volume
    if (downW > 0) {
      ctx.fillStyle = downColor;
      ctx.fillRect(x + upW, yTop, downW, barH);
    }
  }

  // Draw POC line
  const pocY = priceToY(profile.poc);
  ctx.strokeStyle = pocColor;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 3]);
  ctx.beginPath();
  ctx.moveTo(0, pocY);
  ctx.lineTo(chartWidth, pocY);
  ctx.stroke();
  ctx.setLineDash([]);

  // POC label
  ctx.fillStyle = pocColor;
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = side === 'right' ? 'right' : 'left';
  ctx.fillText(`POC $${profile.poc.toFixed(2)}`, side === 'right' ? chartWidth - 4 : 4, pocY - 4);

  // VAH/VAL labels
  ctx.font = '9px Arial';
  ctx.fillStyle = 'rgba(38, 166, 154, 0.7)';
  ctx.fillText(`VAH $${profile.vah.toFixed(2)}`, side === 'right' ? chartWidth - 4 : 4, vahY - 2);
  ctx.fillStyle = 'rgba(239, 83, 80, 0.7)';
  ctx.fillText(`VAL $${profile.val.toFixed(2)}`, side === 'right' ? chartWidth - 4 : 4, valY + 10);
}
